import Link from 'next/link';
import {
  AuctionStatus,
  CropBatchStatus,
  DealStatus,
  DemandStatus,
  InventoryLotStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import { getArhtiEarnings } from '@/lib/earnings';
import ArhtiEarnings from '@/components/dashboards/ArhtiEarnings';
import { Badge, Card, CropThumb, StatCard, statusTone } from '@/components/ui/kit';

const INCOMING: DealStatus[] = [
  DealStatus.PICKUP_SCHEDULED,
  DealStatus.PICKED_UP,
  DealStatus.IN_TRANSIT,
];

export default async function ArhtiHome({ userId, name }: { userId: string; name: string }) {
  const i18n = await getI18n();
  const { t, crop, place, status, grade, kg, perKg, money, isUrdu } = i18n;

  const [profile, incoming, lots, liveAuctions, freshBatches, openDemand, earnings] = await Promise.all([
    prisma.arhtiProfile.findUnique({
      where: { userId },
      select: { businessName: true, commissionRate: true, mandi: { select: { name: true, city: true } } },
    }),
    prisma.farmerArhtiDeal.findMany({
      where: { arhtiId: userId, status: { in: INCOMING } },
      select: {
        id: true,
        dealNumber: true,
        agreedQuantityKg: true,
        agreedPricePerKg: true,
        status: true,
        sourceCity: true,
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
        farmer: { select: { name: true } },
        pickup: { select: { driverName: true, vehiclePlate: true, expectedArrivalAt: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
    prisma.arhtiInventoryLot.findMany({
      where: {
        arhtiId: userId,
        availableQuantityKg: { gt: 0 },
        status: { in: [InventoryLotStatus.IN_STOCK, InventoryLotStatus.PARTIALLY_AUCTIONED] },
      },
      select: {
        id: true,
        lotNumber: true,
        availableQuantityKg: true,
        receivedQuantityKg: true,
        purchasePricePerKg: true,
        grade: true,
        sourceCity: true,
        sourceFarmerName: true,
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 4,
    }),
    prisma.auction.findMany({
      where: { arhtiId: userId, status: AuctionStatus.ACTIVE },
      select: {
        id: true,
        auctionNumber: true,
        quantityKg: true,
        reservePrice: true,
        currentHighestBid: true,
        bidCount: true,
        endTime: true,
        inventoryLot: { select: { crop: { select: { name: true, nameUrdu: true, imageUrl: true } }, purchasePricePerKg: true } },
      },
      orderBy: { endTime: 'asc' },
      take: 4,
    }),
    prisma.farmerCropBatch.findMany({
      where: { status: CropBatchStatus.READY_FOR_SALE, availableKg: { gt: 0 } },
      select: {
        id: true,
        availableKg: true,
        grade: true,
        originCity: true,
        askingPricePerKg: true,
        harvestDate: true,
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
        farmer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.arhtiDemandRequest.count({
      where: { arhtiId: userId, status: { in: [DemandStatus.OPEN, DemandStatus.PARTIALLY_FULFILLED] } },
    }),
    getArhtiEarnings(userId),
  ]);

  const stockKg = lots.reduce((sum, l) => sum + l.availableQuantityKg, 0);
  const stockCost = lots.reduce((sum, l) => sum + l.availableQuantityKg * l.purchasePricePerKg, 0);
  // English keeps the stored grade after "grade"; Urdu shows the translated grade.
  const gradeText = (value: string) => (isUrdu ? grade(value) : t('common.grade', { grade: value }));

  return (
    <>
      <Card className="mb-4 bg-agri-900 border-agri-900">
        <div className="text-white">
          <div className="text-[11px] text-white/70">{t('ahome.role')}</div>
          <h1 className="text-lg font-bold">{profile?.businessName ?? name}</h1>
          <p className="text-[11px] text-white/80 mt-1 max-w-lg">
            {profile?.mandi
              ? t('ahome.tradingAt', { mandi: place(profile.mandi.name), city: place(profile.mandi.city) })
              : t('ahome.noMandi')}{' '}
            {t('ahome.tagline')}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatCard
          label={t('ahome.trucks')}
          value={String(incoming.length)}
          tone={incoming.length ? 'warn' : 'default'}
          hint={t('ahome.awaitingWeighing')}
        />
        <StatCard label={t('ahome.stock')} value={kg(stockKg)} hint={t('ahome.tiedUp', { amount: money(stockCost) })} />
        <StatCard
          label={t('ahome.liveAuctions')}
          value={String(liveAuctions.length)}
          tone="accent"
          hint={t('ahome.openRequests', { count: openDemand })}
        />
      </div>

      <ArhtiEarnings earnings={earnings} i18n={i18n} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">{t('ahome.arriving')}</h2>
            <Link href="/receiving" className="text-[11px] font-semibold text-agri-900 hover:underline">
              {t('ahome.receive')}
            </Link>
          </div>
          {incoming.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">{t('ahome.noIncoming')}</p>
          ) : (
            <div className="space-y-2">
              {incoming.map((deal) => (
                <Link
                  key={deal.id}
                  href="/receiving"
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 hover:bg-amber-100"
                >
                  <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-charcoal">{crop(deal.crop)}</span>
                      <Badge tone={statusTone(deal.status)}>{status(deal.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {t('ahome.fromFarmer', { qty: kg(deal.agreedQuantityKg), name: deal.farmer.name, city: place(deal.sourceCity) })}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {deal.pickup
                        ? `${deal.pickup.driverName}${deal.pickup.vehiclePlate ? ` · ${deal.pickup.vehiclePlate}` : ''}`
                        : t('ahome.noPickup')}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">{t('ahome.liveHouse')}</h2>
            <Link href="/auction-house" className="text-[11px] font-semibold text-agri-900 hover:underline">
              {t('ahome.auctionHouse')}
            </Link>
          </div>
          {liveAuctions.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">{t('ahome.nothingHammer')}</p>
          ) : (
            <div className="space-y-2">
              {liveAuctions.map((auction) => {
                const top = auction.currentHighestBid ?? auction.reservePrice;
                const cost = auction.inventoryLot.purchasePricePerKg;
                const spread = Math.round(((top - cost) / cost) * 100);
                return (
                  <Link
                    key={auction.id}
                    href={`/auctions/${auction.id}`}
                    className="flex items-start gap-3 rounded-xl border border-[#B7D4C8] bg-[#E8F3EE] p-3 hover:bg-[#D8EBE1]"
                  >
                    <CropThumb
                      imageUrl={auction.inventoryLot.crop.imageUrl}
                      name={auction.inventoryLot.crop.name}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-charcoal">
                          {crop(auction.inventoryLot.crop)}
                        </span>
                        <Badge tone="live">{t('common.live')}</Badge>
                      </div>
                      <div className="text-[11px] text-[#636E72]">
                        {kg(auction.quantityKg)} · {t('common.topBid')}{' '}
                        <span className="font-semibold text-charcoal">{perKg(top)}</span> ·{' '}
                        {t('common.bids', { count: auction.bidCount })}
                      </div>
                      <div className="text-[10px] text-[#636E72]">
                        {t('ahome.boughtAt', { rate: perKg(cost), spread: `${spread >= 0 ? '+' : ''}${spread}` })}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">{t('ahome.waitingStock')}</h2>
            <Link href="/inventory" className="text-[11px] font-semibold text-agri-900 hover:underline">
              {t('ahome.inventory')}
            </Link>
          </div>
          {lots.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">{t('ahome.godownEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {lots.map((lot) => (
                <div key={lot.id} className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3">
                  <CropThumb imageUrl={lot.crop.imageUrl} name={lot.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-charcoal">{crop(lot.crop)}</div>
                    <div className="text-[11px] text-[#636E72]">
                      {t('ahome.unsoldOf', { available: kg(lot.availableQuantityKg), received: kg(lot.receivedQuantityKg) })} ·{' '}
                      {gradeText(lot.grade)}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {lot.sourceFarmerName}, {place(lot.sourceCity)} · {t('ahome.cost', { rate: perKg(lot.purchasePricePerKg) })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">{t('ahome.fresh')}</h2>
            <Link href="/sourcing" className="text-[11px] font-semibold text-agri-900 hover:underline">
              {t('ahome.farmerMarket')}
            </Link>
          </div>
          {freshBatches.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">{t('ahome.noBatch')}</p>
          ) : (
            <div className="space-y-2">
              {freshBatches.map((batch) => (
                <Link
                  key={batch.id}
                  href="/sourcing"
                  className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3 hover:bg-[#F8F9F5]"
                >
                  <CropThumb imageUrl={batch.crop.imageUrl} name={batch.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-charcoal">{crop(batch.crop)}</div>
                    <div className="text-[11px] text-[#636E72]">
                      {kg(batch.availableKg)} · {gradeText(batch.grade)} · {place(batch.originCity)}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {batch.farmer.name}
                      {batch.askingPricePerKg ? ` · ${t('ahome.asking', { rate: perKg(batch.askingPricePerKg) })}` : ''}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
