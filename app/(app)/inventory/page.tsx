import Link from 'next/link';
import { AuctionStatus, InventoryLotStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createAuction } from '@/lib/actions/auctions';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
  statusTone,
} from '@/components/ui/kit';

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
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
        action={
          <Link
            href="/auction-house"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            {t('inventory.auctionHouse')}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('inventory.statLots')} value={String(lots.length)} />
        <StatCard label={t('inventory.statUnsold')} value={kg(held)} tone="accent" />
        <StatCard label={t('inventory.statLocked')} value={kg(inAuction)} />
        <StatCard label={t('inventory.statCapital')} value={money(Math.round(capital))} />
      </div>

      {lots.length === 0 ? (
        <EmptyState
          title={t('inventory.emptyTitle')}
          message={t('inventory.emptyMessage')}
          actionHref="/receiving"
          actionLabel={t('inventory.emptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {lots.map((lot) => {
            const liveAuction = lot.auctions.find((a) => a.status === AuctionStatus.ACTIVE);
            const canAuction = lot.availableQuantityKg > 0;
            const floor = Math.ceil(lot.purchasePricePerKg * 1.05);
            return (
              <Card key={lot.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={firstPhoto(lot.photos) ?? lot.crop.imageUrl}
                    name={lot.crop.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{crop(lot.crop)}</span>
                      <Badge tone="neutral">{grade(lot.grade)}</Badge>
                      <Badge tone={statusTone(lot.status)}>{status(lot.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {lot.lotNumber}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {t('inventory.from', { name: lot.deal.farmer.name, city: place(lot.sourceCity), mandi: place(lot.mandi.name) })}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('inventory.received')}</div>
                        <div className="font-semibold text-charcoal">
                          {kg(lot.receivedQuantityKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('inventory.available')}</div>
                        <div className="font-semibold text-agri-900">
                          {kg(lot.availableQuantityKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('inventory.cost')}</div>
                        <div className="font-semibold text-charcoal">
                          {perKg(lot.purchasePricePerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('inventory.sourceDeal')}</div>
                        <Link
                          href={`/deals/${lot.deal.id}`}
                          className="font-semibold text-agri-900 hover:underline truncate block"
                        >
                          {lot.deal.dealNumber}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {liveAuction && (
                  <div className="mt-3 p-2.5 rounded-lg bg-[#E8F3EE] border border-[#B7D4C8] text-[11px] flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-agri-900 font-semibold">
                      {t('inventory.liveIn', { qty: kg(liveAuction.quantityKg), auction: liveAuction.auctionNumber })}{' '}
                      {liveAuction.currentHighestBid
                        ? t('inventory.topBid', { rate: perKg(liveAuction.currentHighestBid) })
                        : t('inventory.reserveNoBids', { rate: perKg(liveAuction.reservePrice) })}
                    </span>
                    <Link
                      href="/auction-house"
                      className="font-semibold text-agri-900 hover:underline"
                    >
                      {t('inventory.manage')}
                    </Link>
                  </div>
                )}

                {canAuction && (
                  <details className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer">
                      {t('inventory.openAuction')}
                    </summary>
                    <ActionForm
                      action={createAuction}
                      submitLabel={t('inventory.start')}
                      successMessage={t('inventory.started')}
                      hidden={{ inventoryLotId: lot.id }}
                      className="mt-3"
                    >
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field
                          label={t('common.qtyKg')}
                          hint={t('inventory.upTo', { qty: kg(lot.availableQuantityKg) })}
                        >
                          <input
                            type="number"
                            name="quantityKg"
                            required
                            min="1"
                            step="1"
                            max={lot.availableQuantityKg}
                            defaultValue={lot.availableQuantityKg}
                            className={inputClass}
                          />
                        </Field>
                        <Field
                          label={t('inventory.reserve')}
                          hint={t('inventory.reserveHint', { rate: perKg(lot.purchasePricePerKg) })}
                        >
                          <input
                            type="number"
                            name="reservePrice"
                            required
                            min={lot.purchasePricePerKg}
                            step="0.5"
                            defaultValue={floor}
                            className={inputClass}
                          />
                        </Field>
                        <Field label={t('inventory.increment')}>
                          <input
                            type="number"
                            name="minimumIncrement"
                            min="0.5"
                            step="0.5"
                            defaultValue={1}
                            className={inputClass}
                          />
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
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
