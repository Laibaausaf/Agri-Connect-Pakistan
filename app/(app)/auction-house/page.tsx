import Link from 'next/link';
import { AuctionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { cancelAuction, closeAuction } from '@/lib/actions/auctions';
import ActionForm from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/ui/kit';

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
  const { t, plural, crop, place, status, grade, kg, perKg, money, isUrdu } = await getI18n();

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

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('auctionHouse.title')}
        subtitle={t('auctionHouse.subtitle')}
        action={
          <Link
            href="/inventory"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            {t('auctionHouse.addFromInventory')}
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label={t('auctionHouse.statLive')} value={String(live.length)} tone={live.length ? 'accent' : 'default'} />
        <StatCard label={t('auctionHouse.statFloor')} value={kg(live.reduce((s, a) => s + a.quantityKg, 0))} />
        <StatCard label={t('auctionHouse.statSold')} value={money(Math.round(soldValue))} />
      </div>

      {auctions.length === 0 ? (
        <EmptyState
          title={t('auctionHouse.emptyTitle')}
          message={t('auctionHouse.emptyMessage')}
          actionHref="/inventory"
          actionLabel={t('auctionHouse.emptyAction')}
        />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-2">
              {t('auctionHouse.onFloor', { count: live.length })}
            </h2>
            <div className="space-y-3">
              {live.length === 0 && (
                <Card>
                  <p className="text-xs text-[#636E72]">
                    {t('auctionHouse.nothingLive')}
                  </p>
                </Card>
              )}
              {live.map((auction) => {
                const top = auction.bids[0];
                const left = minutesLeft(auction.endTime);
                const margin = top
                  ? Math.round(
                      ((top.amountPerKg - auction.inventoryLot.purchasePricePerKg) /
                        auction.inventoryLot.purchasePricePerKg) *
                        100
                    )
                  : null;
                return (
                  <Card key={auction.id}>
                    <div className="flex items-start gap-3">
                      <CropThumb
                        imageUrl={firstPhoto(auction.photos) ?? auction.inventoryLot.crop.imageUrl}
                        name={auction.inventoryLot.crop.name}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-charcoal">
                            {crop(auction.inventoryLot.crop)}
                          </span>
                          <Badge tone="live">{t('common.live')}</Badge>
                          <Badge tone="neutral">{grade(auction.grade)}</Badge>
                        </div>
                        <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                          {auction.auctionNumber} · {auction.inventoryLot.lotNumber}
                        </div>
                        <div className="text-[11px] text-[#636E72]">
                          {auction.inventoryLot.sourceFarmerName}, {place(auction.inventoryLot.sourceCity)}{' '}
                          {isUrdu ? '←' : '→'} {place(auction.mandi.name)}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                          <div>
                            <div className="text-[10px] text-[#636E72]">{t('auctionHouse.quantity')}</div>
                            <div className="font-semibold text-charcoal">
                              {kg(auction.quantityKg)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#636E72]">{t('auctionHouse.reserve')}</div>
                            <div className="font-semibold text-charcoal">
                              {perKg(auction.reservePrice)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#636E72]">{t('auctionHouse.topBid')}</div>
                            <div className="font-semibold text-agri-900">
                              {top ? perKg(top.amountPerKg) : t('auctionHouse.noBids')}
                            </div>
                            {margin != null && (
                              <div className="text-[10px] text-[#636E72]">
                                {t('auctionHouse.onCost', { margin: `${margin >= 0 ? '+' : ''}${margin}` })}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] text-[#636E72]">{t('auctionHouse.closesIn')}</div>
                            <div className="font-semibold text-charcoal">
                              {left > 0 ? t('auctionHouse.minutes', { count: left }) : t('auctionHouse.timeUp')}
                            </div>
                            <div className="text-[10px] text-[#636E72]">
                              {plural('auctionHouse.bid', auction.bidCount)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {auction.bids.length > 0 && (
                      <ul className="mt-3 pt-3 border-t border-[#E5E7EB] space-y-1 text-[11px]">
                        {auction.bids.map((bid, index) => (
                          <li key={bid.id} className="flex items-center justify-between">
                            <span className={index === 0 ? 'font-semibold text-charcoal' : 'text-[#636E72]'}>
                              {bid.bidder.name}
                            </span>
                            <span className={index === 0 ? 'font-bold text-agri-900' : 'text-[#636E72]'}>
                              {perKg(bid.amountPerKg)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 items-start">
                      <ActionForm
                        action={closeAuction}
                        submitLabel={top ? t('auctionHouse.closeSell', { rate: perKg(top.amountPerKg) }) : t('auctionHouse.closeNoSale')}
                        successMessage={
                          top
                            ? t('auctionHouse.sold')
                            : t('auctionHouse.closedNoBids')
                        }
                        variant="inline"
                        hidden={{ auctionId: auction.id }}
                        className="inline-block"
                      />
                      {auction.bidCount === 0 && (
                        <ActionForm
                          action={cancelAuction}
                          submitLabel={t('auctionHouse.cancel')}
                          variant="inline"
                          hidden={{ auctionId: auction.id }}
                          className="inline-block"
                        />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          {settled.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-2">
                {t('auctionHouse.settled', { count: settled.length })}
              </h2>
              <div className="space-y-2">
                {settled.map((auction) => {
                  const top = auction.bids[0];
                  return (
                    <Card key={auction.id} padded={false}>
                      <div className="px-3 py-2.5 flex items-center gap-3 text-xs">
                        <CropThumb
                          imageUrl={auction.inventoryLot.crop.imageUrl}
                          name={auction.inventoryLot.crop.name}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-charcoal">
                              {kg(auction.quantityKg)} {crop(auction.inventoryLot.crop)}
                            </span>
                            <Badge tone={auction.status === AuctionStatus.SOLD ? 'green' : 'neutral'}>
                              {status(auction.status)}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-[#636E72] font-mono">
                            {auction.auctionNumber}
                            {auction.sale && ` · ${auction.sale.saleNumber}`}
                          </div>
                        </div>
                        <div className="text-end whitespace-nowrap">
                          {auction.status === AuctionStatus.SOLD && top ? (
                            <>
                              <div className="font-bold text-agri-900">
                                {perKg(top.amountPerKg)}
                              </div>
                              <div className="text-[10px] text-[#636E72]">
                                {t('auctionHouse.gross', { amount: money(auction.sale?.grossAmount ?? 0) })}
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px] text-[#636E72]">{t('auctionHouse.returned')}</div>
                          )}
                        </div>
                      </div>
                    </Card>
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
