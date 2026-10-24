import Link from 'next/link';
import { AuctionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { cancelAuction, closeAuction } from '@/lib/actions/auctions';
import ActionForm from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import { Badge, CropThumb, EmptyState, PageHeader } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

function minutesLeft(endTime: Date) {
  return Math.max(0, Math.round((endTime.getTime() - Date.now()) / 60000));
}

export default async function AuctionHousePage() {
  const user = await requireCapability('arhti.auction.manage');
  const { t, plural, crop, place, status, grade, kg, perKg, money, isUrdu, time } = await getI18n();

  const auctions = await prisma.auction.findMany({
    where: { arhtiId: user.id },
    include: {
      inventoryLot: {
        select: {
          lotNumber: true,
          sourceCity: true,
          sourceFarmerName: true,
          purchasePricePerKg: true,
          crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
        },
      },
      mandi: { select: { name: true, city: true } },
      bids: {
        orderBy: { amountPerKg: 'desc' },
        take: 3,
        select: {
          id: true,
          amountPerKg: true,
          timestamp: true,
          bidder: { select: { name: true } },
        },
      },
      sale: { select: { saleNumber: true, grossAmount: true, commission: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const live = auctions.filter((a) => a.status === AuctionStatus.ACTIVE);
  const settled = auctions.filter((a) => a.status !== AuctionStatus.ACTIVE);
  const soldValue = settled
    .filter((a) => a.status === AuctionStatus.SOLD)
    .reduce((sum, a) => sum + (a.sale?.grossAmount ?? 0), 0);

  const stat = (value: string, label: string) => (
    <div className="rounded-2xl bg-sage px-4 py-3">
      <div className="tabular text-xl font-extrabold leading-tight">{value}</div>
      <div className="text-[12.5px] font-semibold text-muted">{label}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('auctionHouse.title')} subtitle={t('auctionHouse.subtitle')} />

      <div className="mb-6 grid grid-cols-3 gap-2">
        {stat(String(live.length), t('auctionHouse.statLive'))}
        {stat(kg(live.reduce((sum, a) => sum + a.quantityKg, 0)), t('auctionHouse.statFloor'))}
        {stat(money(Math.round(soldValue)), t('auctionHouse.statSold'))}
      </div>

      {auctions.length === 0 ? (
        <EmptyState
          title={t('auctionHouse.emptyTitle')}
          message={t('auctionHouse.emptyMessage')}
          actionHref="/inventory"
          actionLabel={t('auctionHouse.emptyAction')}
        />
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-[.08em] text-muted">{t('auctionHouse.onFloor', { count: live.length })}</h2>
            {live.length === 0 && <p className="card p-4 text-sm text-muted">{t('auctionHouse.nothingLive')}</p>}
            {live.map((auction) => {
              const top = auction.bids[0];
              const left = minutesLeft(auction.endTime);
              const margin = top
                ? Math.round(((top.amountPerKg - auction.inventoryLot.purchasePricePerKg) / auction.inventoryLot.purchasePricePerKg) * 100)
                : null;
              const cell = (label: string, value: React.ReactNode, hint?: React.ReactNode, big = false) => (
                <div className="p-4">
                  <div className="text-[13px] font-semibold text-[#D6E6D9]">{label}</div>
                  <div className={`tabular font-extrabold leading-tight ${big ? 'text-[30px] text-[#F6C871]' : 'text-xl'}`}>{value}</div>
                  {hint && <div className="text-[12.5px] text-[#D6E6D9]">{hint}</div>}
                </div>
              );
              return (
                <article key={auction.id} className="card overflow-hidden">
                  <div className="bg-brand text-white">
                    <div className="flex items-start gap-3 p-4">
                      <CropThumb imageUrl={firstPhoto(auction.photos) ?? auction.inventoryLot.crop.imageUrl} name={auction.inventoryLot.crop.name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[17px] font-extrabold">
                            {crop(auction.inventoryLot.crop)} · {grade(auction.grade)}
                          </span>
                          <Badge tone="live">{t('common.live')}</Badge>
                        </div>
                        <div className="font-mono text-[12.5px] text-[#D6E6D9]">
                          {auction.auctionNumber} · {auction.inventoryLot.lotNumber}
                        </div>
                        <div className="text-[13px] text-[#D6E6D9]">
                          {auction.inventoryLot.sourceFarmerName}, {place(auction.inventoryLot.sourceCity)} {isUrdu ? '←' : '→'} {place(auction.mandi.name)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 bg-white/[.06] rtl:divide-x-reverse">
                      {cell(
                        t('auctionHouse.topBid'),
                        top ? perKg(top.amountPerKg) : t('auctionHouse.noBids'),
                        margin != null ? t('auctionHouse.onCost', { margin: `${margin >= 0 ? '+' : ''}${margin}` }) : null,
                        true
                      )}
                      {cell(
                        t('auctionHouse.closesIn'),
                        left > 0 ? t('auctionHouse.minutes', { count: left }) : t('auctionHouse.timeUp'),
                        plural('auctionHouse.bid', auction.bidCount)
                      )}
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 rtl:divide-x-reverse">
                      {cell(t('auctionHouse.quantity'), kg(auction.quantityKg))}
                      {cell(t('auctionHouse.reserve'), perKg(auction.reservePrice))}
                    </div>
                  </div>

                  <div className="space-y-2 p-4">
                    {auction.bids.length > 0 && (
                      <ol className="space-y-2">
                        {auction.bids.map((bid, index) => (
                          <li key={bid.id} className={`flex items-center gap-3 rounded-2xl p-3 ${index === 0 ? 'bg-sage' : 'border border-line'}`}>
                            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${index === 0 ? 'bg-gold text-ongold' : 'bg-sage'}`}>
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-bold">
                                {bid.bidder.name}
                                {index === 0 ? ` · ${t('auctionHouse.highest')}` : ''}
                              </span>
                              <span className="block text-[12.5px] text-muted">{time(bid.timestamp, { hour: 'numeric', minute: '2-digit' })}</span>
                            </span>
                            <span className="tabular text-lg font-extrabold">{perKg(bid.amountPerKg)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    <ActionForm
                      action={closeAuction}
                      submitLabel={top ? t('auctionHouse.closeSell', { rate: perKg(top.amountPerKg) }) : t('auctionHouse.closeNoSale')}
                      successMessage={top ? t('auctionHouse.sold') : t('auctionHouse.closedNoBids')}
                      icon="gavel"
                      hidden={{ auctionId: auction.id }}
                    />
                    {auction.bidCount === 0 && (
                      <ActionForm
                        action={cancelAuction}
                        submitLabel={t('auctionHouse.cancel')}
                        variant="outline"
                        icon="xcircle"
                        hidden={{ auctionId: auction.id }}
                        className="[&>button]:mt-0 [&>button]:text-err-fg"
                      />
                    )}
                  </div>
                </article>
              );
            })}
            <Link href="/inventory" className="btn btn-outline w-full">
              <Icon name="pluscircle" size={20} />
              {t('auctionHouse.addFromInventory')}
            </Link>
          </section>

          {settled.length > 0 && (
            <section>
              <h2 className="font-display h-section mb-2 font-semibold">{t('auctionHouse.settled', { count: settled.length })}</h2>
              <div className="divide-y divide-line">
                {settled.map((auction) => {
                  const top = auction.bids[0];
                  return (
                    <div key={auction.id} className="flex items-center gap-3 py-3">
                      <CropThumb imageUrl={auction.inventoryLot.crop.imageUrl} name={auction.inventoryLot.crop.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-bold">
                            {kg(auction.quantityKg)} {crop(auction.inventoryLot.crop)}
                          </span>
                          <Badge tone={auction.status === AuctionStatus.SOLD ? 'green' : 'neutral'}>{status(auction.status)}</Badge>
                        </div>
                        <div className="font-mono text-[12.5px] text-muted">
                          {auction.auctionNumber}
                          {auction.sale && ` · ${auction.sale.saleNumber}`}
                        </div>
                      </div>
                      <div className="shrink-0 text-end">
                        {auction.status === AuctionStatus.SOLD && top ? (
                          <>
                            <div className="tabular text-lg font-extrabold">{perKg(top.amountPerKg)}</div>
                            <div className="text-[12.5px] text-muted">{t('auctionHouse.gross', { amount: money(auction.sale?.grossAmount ?? 0) })}</div>
                          </>
                        ) : (
                          <div className="text-[13px] text-muted">{t('auctionHouse.returned')}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
