import Link from 'next/link';
import { AuctionStatus, InventoryLotStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createAuction } from '@/lib/actions/auctions';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import { Badge, CropThumb, EmptyState, PageHeader, statusTone } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

export default async function InventoryPage() {
  const user = await requireCapability('arhti.inventory.manage');
  const { t, crop, place, status, grade, kg, perKg, money } = await getI18n();

  const lots = await prisma.arhtiInventoryLot.findMany({
    where: { arhtiId: user.id, status: { not: InventoryLotStatus.SPOILED } },
    include: {
      crop: true,
      mandi: { select: { name: true, city: true } },
      deal: { select: { id: true, dealNumber: true, farmer: { select: { name: true } } } },
      auctions: {
        select: {
          id: true,
          auctionNumber: true,
          quantityKg: true,
          status: true,
          currentHighestBid: true,
          reservePrice: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const held = lots.reduce((sum, lot) => sum + lot.availableQuantityKg, 0);
  const capital = lots.reduce(
    (sum, lot) => sum + lot.availableQuantityKg * lot.purchasePricePerKg,
    0
  );
  const inAuction = lots.reduce(
    (sum, lot) =>
      sum +
      lot.auctions
        .filter((a) => a.status === AuctionStatus.ACTIVE)
        .reduce((s, a) => s + a.quantityKg, 0),
    0
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
        action={
          <Link href="/auction-house" className="btn btn-outline btn-sm">
            <Icon name="gavel" size={16} />
            {t('inventory.auctionHouse')}
          </Link>
        }
      />

      <div className="card mb-6 grid grid-cols-2 overflow-hidden lg:grid-cols-4">
        {[
          { label: t('inventory.statLots'), value: String(lots.length), gold: false },
          { label: t('inventory.statUnsold'), value: kg(held), gold: false },
          { label: t('inventory.statLocked'), value: kg(inAuction), gold: true },
          { label: t('inventory.statCapital'), value: money(Math.round(capital)), gold: false },
        ].map((item, i) => (
          <div key={item.label} className={`border-line p-4 ${i % 2 === 0 ? 'border-e' : ''} ${i < 2 ? 'border-b lg:border-b-0' : ''} lg:border-e lg:last:border-e-0`}>
            <div className="text-[13px] font-semibold text-muted">{item.label}</div>
            <div className={`tabular mt-0.5 text-[22px] font-extrabold ${item.gold ? 'text-goldtext' : ''}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {lots.length === 0 ? (
        <EmptyState
          title={t('inventory.emptyTitle')}
          message={t('inventory.emptyMessage')}
          actionHref="/receiving"
          actionLabel={t('inventory.emptyAction')}
        />
      ) : (
        <div className="space-y-4">
          {lots.map((lot) => {
            const liveAuction = lot.auctions.find((a) => a.status === AuctionStatus.ACTIVE);
            const canAuction = lot.availableQuantityKg > 0;
            const floor = Math.ceil(lot.purchasePricePerKg * 1.05);
            const auctioned = Math.max(0, lot.receivedQuantityKg - lot.availableQuantityKg);
            return (
              <article key={lot.id} className="card overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <CropThumb imageUrl={firstPhoto(lot.photos) ?? lot.crop.imageUrl} name={lot.crop.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] font-extrabold">
                      {crop(lot.crop)} · {grade(lot.grade)}
                    </div>
                    <div className="mt-1">
                      <Badge tone={statusTone(lot.status)}>{status(lot.status)}</Badge>
                    </div>
                    <div className="mt-1 font-mono text-[12.5px] text-muted">
                      {lot.lotNumber} ·{' '}
                      <Link href={`/deals/${lot.deal.id}`} className="underline-offset-2 hover:underline">
                        {lot.deal.dealNumber}
                      </Link>
                    </div>
                    <div className="text-[13px] text-muted">{t('inventory.from', { name: lot.deal.farmer.name, city: place(lot.sourceCity), mandi: place(lot.mandi.name) })}</div>
                  </div>
                </div>

                {/* Received kilos split into auctioned and still available */}
                {auctioned > 0 && lot.availableQuantityKg > 0 && (
                  <div className="px-4 pb-3">
                    <div className="flex h-2.5 gap-1 overflow-hidden rounded-full" aria-hidden="true">
                      <span className="rounded-full bg-gold" style={{ flexGrow: auctioned }} />
                      <span className="rounded-full bg-forest" style={{ flexGrow: lot.availableQuantityKg }} />
                    </div>
                    <div className="mt-1.5 flex justify-between gap-2 text-[13px] font-semibold">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gold" />{t('inventory.inAuctionKg', { qty: kg(auctioned) })}</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-forest" />{t('inventory.availableKg', { qty: kg(lot.availableQuantityKg) })}</span>
                    </div>
                  </div>
                )}

                <dl className="grid grid-cols-3 border-t border-line">
                  <div className="border-e border-line p-4">
                    <dt className="text-[12.5px] text-muted">{t('inventory.received')}</dt>
                    <dd className="text-base font-extrabold">{kg(lot.receivedQuantityKg)}</dd>
                  </div>
                  <div className="border-e border-line p-4">
                    <dt className="text-[12.5px] text-muted">{t('inventory.available')}</dt>
                    <dd className="text-base font-extrabold">{kg(lot.availableQuantityKg)}</dd>
                  </div>
                  <div className="p-4">
                    <dt className="text-[12.5px] text-muted">{t('inventory.cost')}</dt>
                    <dd className="text-base font-extrabold">{perKg(lot.purchasePricePerKg)}</dd>
                  </div>
                </dl>

                {liveAuction && (
                  <Link href="/auction-house" className="flex items-center gap-3 border-t border-line bg-sage px-4 py-3 text-sm font-bold">
                    <span className="ac-pulse h-2.5 w-2.5 shrink-0 rounded-full bg-gold" />
                    <span className="min-w-0 flex-1">
                      {t('inventory.liveIn', { qty: kg(liveAuction.quantityKg), auction: liveAuction.auctionNumber })}{' '}
                      {liveAuction.currentHighestBid
                        ? t('inventory.topBid', { rate: perKg(liveAuction.currentHighestBid) })
                        : t('inventory.reserveNoBids', { rate: perKg(liveAuction.reservePrice) })}
                    </span>
                    {t('inventory.manage')}
                    <Icon name="chevronright" size={16} />
                  </Link>
                )}

                {canAuction && (
                  <details className="border-t border-line bg-paper [&[open]>summary_.chev]:rotate-180">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 text-[15px] font-bold">
                      <Icon name="chevrondown" size={18} className="chev transition-transform" />
                      {t('inventory.openAuction')}
                    </summary>
                    <div className="px-4 pb-4">
                      <ActionForm
                        action={createAuction}
                        submitLabel={t('inventory.start')}
                        successMessage={t('inventory.started')}
                        hidden={{ inventoryLotId: lot.id }}
                        icon="gavel"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label={t('common.qtyKg')} hint={t('inventory.upTo', { qty: kg(lot.availableQuantityKg) })}>
                            <input type="number" name="quantityKg" required min="1" step="1" max={lot.availableQuantityKg} defaultValue={lot.availableQuantityKg} className={inputClass} />
                          </Field>
                          <Field label={t('inventory.reserve')} hint={t('inventory.reserveHint', { rate: perKg(lot.purchasePricePerKg) })}>
                            <input type="number" name="reservePrice" required min={lot.purchasePricePerKg} step="0.5" defaultValue={floor} className={inputClass} />
                          </Field>
                          <Field label={t('inventory.increment')}>
                            <input type="number" name="minimumIncrement" min="0.5" step="0.5" defaultValue={1} className={inputClass} />
                          </Field>
                          <Field label={t('inventory.duration')}>
                            <select name="durationMinutes" defaultValue={30} className={inputClass}>
                              <option value={15}>{t('inventory.min15')}</option>
                              <option value={30}>{t('inventory.min30')}</option>
                              <option value={60}>{t('inventory.hour1')}</option>
                              <option value={180}>{t('inventory.hour3')}</option>
                            </select>
                          </Field>
                        </div>
                      </ActionForm>
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
