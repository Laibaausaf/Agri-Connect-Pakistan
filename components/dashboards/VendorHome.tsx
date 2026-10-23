import Link from 'next/link';
import { AuctionStatus, OfferListingStatus, SaleStatus, StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import type { I18n } from '@/lib/i18n';
import { Badge, Card, CropThumb, StatCard, statusTone } from '@/components/ui/kit';

function endsIn(endTime: Date, t: I18n['t']) {
  const mins = Math.round((new Date(endTime).getTime() - Date.now()) / 60000);
  if (mins <= 0) return t('vhome.closingNow');
  if (mins < 60) return t('vhome.minLeft', { count: mins });
  return t('vhome.hoursLeft', { count: Math.round(mins / 60) });
}

export default async function VendorHome({ userId, name }: { userId: string; name: string }) {
  const { t, plural, crop, place, status, kg, perKg, money } = await getI18n();

  const [profile, auctions, myBids, stocks, offers, orders, spend] = await Promise.all([
    prisma.vendorProfile.findUnique({
      where: { userId },
      select: { businessName: true, warehouseCity: true, minOrderKg: true, rating: true },
    }),
    prisma.auction.findMany({
      where: { status: AuctionStatus.ACTIVE },
      select: {
        id: true,
        quantityKg: true,
        grade: true,
        reservePrice: true,
        currentHighestBid: true,
        bidCount: true,
        endTime: true,
        mandi: { select: { name: true, city: true } },
        inventoryLot: { select: { crop: { select: { name: true, nameUrdu: true, imageUrl: true } }, sourceCity: true } },
      },
      orderBy: { endTime: 'asc' },
      take: 4,
    }),
    prisma.bid.findMany({
      where: { bidderId: userId, auction: { status: AuctionStatus.ACTIVE } },
      select: { auctionId: true, amountPerKg: true },
    }),
    prisma.vendorInventory.findMany({
      where: { vendorId: userId, status: { not: StockStatus.SOLD_OUT } },
      select: {
        id: true,
        availableKg: true,
        quantityKg: true,
        costPerKg: true,
        grade: true,
        sourceFarmCity: true,
        sourceMandiCity: true,
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
        offers: {
          where: { status: OfferListingStatus.ACTIVE },
          select: { id: true, remainingKg: true, pricePerKg: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.vendorOffer.findMany({
      where: { vendorId: userId, status: OfferListingStatus.ACTIVE },
      select: {
        id: true,
        offerNumber: true,
        remainingKg: true,
        offeredQuantityKg: true,
        pricePerKg: true,
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
        stock: { select: { costPerKg: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.vendorShopkeeperSale.findMany({
      where: { vendorId: userId, status: { notIn: [SaleStatus.COMPLETED, SaleStatus.CANCELLED] } },
      select: {
        id: true,
        saleNumber: true,
        quantityKg: true,
        ratePerKg: true,
        grossAmount: true,
        status: true,
        deliveryCity: true,
        createdAt: true,
        shopkeeper: { select: { name: true, shopkeeperProfile: { select: { shopName: true } } } },
        offer: { select: { crop: { select: { name: true, nameUrdu: true, imageUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.arhtiVendorSale.aggregate({
      where: { vendorId: userId },
      _sum: { grossAmount: true, commission: true, quantityKg: true },
    }),
  ]);

  const bidByAuction = new Map(myBids.map((b) => [b.auctionId, b.amountPerKg]));
  const warehouseKg = stocks.reduce((sum, s) => sum + s.availableKg, 0);
  const capital = stocks.reduce((sum, s) => sum + s.availableKg * s.costPerKg, 0);
  const unlisted = stocks.filter((s) => s.availableKg > 0 && s.offers.length === 0);

  return (
    <>
      <Card className="mb-4 bg-agri-900 border-agri-900">
        <div className="text-white">
          <div className="text-[11px] text-white/70">{t('vhome.role')}</div>
          <h1 className="text-lg font-bold">{profile?.businessName ?? name}</h1>
          <p className="text-[11px] text-white/80 mt-1 max-w-lg">
            {profile?.warehouseCity ? t('vhome.warehouseIn', { city: place(profile.warehouseCity) }) : ''}
            {t('vhome.tagline')}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label={t('vhome.auctionsLive')}
          value={String(auctions.length)}
          tone="accent"
          hint={myBids.length ? t('vhome.bidsIn', { count: myBids.length }) : t('vhome.noBids')}
        />
        <StatCard label={t('vhome.warehouse')} value={kg(warehouseKg)} hint={t('vhome.ofStock', { amount: money(capital) })} />
        <StatCard
          label={t('vhome.notOnShelf')}
          value={String(unlisted.length)}
          tone={unlisted.length ? 'warn' : 'default'}
          hint={t('vhome.noLiveOffer')}
        />
        <StatCard
          label={t('vhome.orders')}
          value={String(orders.length)}
          hint={t('vhome.paidMandi', { amount: money((spend._sum.grossAmount ?? 0) + (spend._sum.commission ?? 0)) })}
        />
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-charcoal">{t('vhome.closingSoon')}</h2>
          <Link href="/auctions" className="text-[11px] font-semibold text-agri-900 hover:underline">
            {t('vhome.allAuctions')}
          </Link>
        </div>
        {auctions.length === 0 ? (
          <p className="text-[11px] text-[#636E72] py-4 text-center">{t('vhome.noAuction')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {auctions.map((auction) => {
              const top = auction.currentHighestBid ?? auction.reservePrice;
              const mine = bidByAuction.get(auction.id);
              const leading = mine !== undefined && mine >= top;
              return (
                <Link
                  key={auction.id}
                  href={`/auctions/${auction.id}`}
                  className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3 hover:bg-[#F8F9F5]"
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
                      {mine !== undefined && (
                        <Badge tone={leading ? 'green' : 'red'}>
                          {leading ? t('vhome.youLead') : t('vhome.outbid')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {kg(auction.quantityKg)} · <span className="font-semibold text-charcoal">
                        {perKg(top)}
                      </span>{' '}
                      · {t('common.bids', { count: auction.bidCount })}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {place(auction.mandi.city)} · {t('vhome.from', { city: place(auction.inventoryLot.sourceCity) })} ·{' '}
                      {endsIn(auction.endTime, t)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">
              {unlisted.length ? t('vhome.earningNothing') : t('vhome.warehouseStock')}
            </h2>
            <Link href="/stock" className="text-[11px] font-semibold text-agri-900 hover:underline">
              {t('vhome.warehouse')}
            </Link>
          </div>
          {stocks.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">{t('vhome.winLot')}</p>
          ) : (
            <div className="space-y-2">
              {(unlisted.length ? unlisted : stocks).slice(0, 4).map((stock) => (
                <div
                  key={stock.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    stock.offers.length === 0 ? 'border-amber-200 bg-amber-50' : 'border-[#E5E7EB]'
                  }`}
                >
                  <CropThumb imageUrl={stock.crop.imageUrl} name={stock.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-charcoal">{crop(stock.crop)}</div>
                    <div className="text-[11px] text-[#636E72]">
                      {t('vhome.free', { qty: kg(stock.availableKg), rate: perKg(stock.costPerKg) })}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {t('vhome.route', { farm: place(stock.sourceFarmCity), mandi: place(stock.sourceMandiCity) })}
                      {stock.offers.length === 0 ? t('vhome.notListed') : ''}
                    </div>
                  </div>
                  {stock.offers.length === 0 && (
                    <Link
                      href="/wholesale-shop/new"
                      className="bg-agri-900 hover:bg-agri-800 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
                    >
                      {t('vhome.listIt')}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">{t('vhome.orders')}</h2>
            <Link href="/sales" className="text-[11px] font-semibold text-agri-900 hover:underline">
              {t('vhome.allOrders')}
            </Link>
          </div>
          {orders.length === 0 ? (
            <>
              <p className="text-[11px] text-[#636E72] py-2 text-center">
                {plural('vhome.noOrder', offers.length)}
              </p>
              {offers.length > 0 && (
                <div className="space-y-2">
                  {offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3"
                    >
                      <CropThumb imageUrl={offer.crop.imageUrl} name={offer.crop.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-charcoal">{crop(offer.crop)}</div>
                        <div className="text-[11px] text-[#636E72]">
                          {t('vhome.leftOf', { rate: perKg(offer.pricePerKg), left: kg(offer.remainingKg), total: kg(offer.offeredQuantityKg) })}
                        </div>
                        <div className="text-[10px] text-[#636E72]">
                          {t('vhome.margin', { rate: perKg(offer.pricePerKg - offer.stock.costPerKg) })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3">
                  <CropThumb imageUrl={order.offer.crop.imageUrl} name={order.offer.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-charcoal">{crop(order.offer.crop)}</span>
                      <Badge tone={statusTone(order.status)}>{status(order.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {t('vhome.orderLine', { qty: kg(order.quantityKg), rate: perKg(order.ratePerKg), total: money(order.grossAmount) })}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {order.shopkeeper.shopkeeperProfile?.shopName ?? order.shopkeeper.name}
                      {order.deliveryCity ? t('vhome.deliverTo', { city: place(order.deliveryCity) }) : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
