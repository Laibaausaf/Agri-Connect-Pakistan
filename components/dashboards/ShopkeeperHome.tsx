import Link from 'next/link';
import { ConsumerOrderStatus, OfferListingStatus, StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import { Badge, Card, CropThumb, StatCard, statusTone } from '@/components/ui/kit';

const OPEN_ORDERS: ConsumerOrderStatus[] = [
  ConsumerOrderStatus.PLACED,
  ConsumerOrderStatus.CONFIRMED,
  ConsumerOrderStatus.PREPARING,
  ConsumerOrderStatus.OUT_FOR_DELIVERY,
];

function cityList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((c): c is string => typeof c === 'string') : [];
}

export default async function ShopkeeperHome({ userId, name }: { userId: string; name: string }) {
  const { t, crop, place, status, kg, perKg, money } = await getI18n();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const profile = await prisma.shopkeeperProfile.findUnique({
    where: { userId },
    select: { shopName: true, city: true, rating: true, ratingCount: true, avgDeliveryMinutes: true },
  });

  const [orders, stocks, listings, todayTakings, deals] = await Promise.all([
    prisma.consumerOrder.findMany({
      where: { shopkeeperId: userId, status: { in: OPEN_ORDERS } },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
        etaMinutes: true,
        placedAt: true,
        consumer: { select: { name: true } },
        items: {
          select: {
            quantityKg: true,
            listing: { select: { title: true, crop: { select: { name: true, nameUrdu: true, imageUrl: true } } } },
          },
        },
      },
      orderBy: { placedAt: 'asc' },
      take: 4,
    }),
    prisma.shopkeeperInventory.findMany({
      where: { shopkeeperId: userId, availableKg: { gt: 0 }, status: { not: StockStatus.SOLD_OUT } },
      select: {
        id: true,
        availableKg: true,
        quantityKg: true,
        costPerKg: true,
        grade: true,
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
        listings: {
          where: { status: OfferListingStatus.ACTIVE },
          select: { id: true, remainingKg: true, pricePerKg: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.retailListing.findMany({
      where: { shopkeeperId: userId, status: OfferListingStatus.ACTIVE },
      select: {
        id: true,
        title: true,
        remainingKg: true,
        listedQuantityKg: true,
        pricePerKg: true,
        imageUrl: true,
        crop: { select: { name: true, imageUrl: true } },
        stock: { select: { costPerKg: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.consumerOrder.aggregate({
      where: {
        shopkeeperId: userId,
        placedAt: { gte: midnight },
        status: { not: ConsumerOrderStatus.CANCELLED },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.vendorOffer.findMany({
      where: { status: OfferListingStatus.ACTIVE, remainingKg: { gt: 0 } },
      select: {
        id: true,
        pricePerKg: true,
        remainingKg: true,
        minOrderKg: true,
        deliveryCities: true,
        deliveryEtaHours: true,
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
        vendor: { select: { name: true, vendorProfile: { select: { businessName: true } } } },
      },
      orderBy: { pricePerKg: 'asc' },
      take: 12,
    }),
  ]);

  const stockKg = stocks.reduce((sum, s) => sum + s.availableKg, 0);
  const unlisted = stocks.filter((s) => s.listings.length === 0);
  const myCity = profile?.city ?? null;
  const bestDeals = deals
    .filter((offer) => !myCity || cityList(offer.deliveryCities).includes(myCity))
    .slice(0, 4);

  return (
    <>
      <Card className="mb-4 bg-agri-900 border-agri-900">
        <div className="text-white">
          <div className="text-[11px] text-white/70">{t('shome.role')}</div>
          <h1 className="text-lg font-bold">{profile?.shopName ?? name}</h1>
          <p className="text-[11px] text-white/80 mt-1 max-w-lg">
            {profile?.city ? t('shome.serving', { city: place(profile.city) }) : ''}
            {profile?.ratingCount
              ? t('shome.rating', { rating: profile.rating.toFixed(1), count: profile.ratingCount })
              : ''}
            {t('shome.tagline')}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label={t('shome.toFulfil')}
          value={String(orders.length)}
          tone={orders.length ? 'warn' : 'default'}
          hint={orders.length ? t('shome.waiting') : t('shome.allClear')}
        />
        <StatCard label={t('shome.takings')} value={money(todayTakings._sum.totalAmount ?? 0)} hint={t('shome.ordersCount', { count: todayTakings._count })} />
        <StatCard label={t('shome.backRoom')} value={kg(stockKg)} hint={t('shome.liveListings', { count: listings.length })} />
        <StatCard
          label={t('shome.notOnShelf')}
          value={String(unlisted.length)}
          tone={unlisted.length ? 'warn' : 'default'}
          hint={t('shome.noListing')}
        />
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-charcoal">{t('shome.customerOrders')}</h2>
          <Link href="/retail-orders" className="text-[11px] font-semibold text-agri-900 hover:underline">
            {t('shome.queue')}
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-[11px] text-[#636E72] py-4 text-center">{t('shome.noOrder')}</p>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const first = order.items[0];
              const extra = order.items.length - 1;
              return (
                <Link
                  key={order.id}
                  href="/retail-orders"
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 hover:bg-amber-100"
                >
                  {first && (
                    <CropThumb
                      imageUrl={first.listing.crop.imageUrl}
                      name={first.listing.crop.name}
                      size="sm"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-charcoal">{order.orderNumber}</span>
                      <Badge tone={statusTone(order.status)}>{status(order.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {first ? `${kg(first.quantityKg)} ${crop(first.listing.crop)}` : t('shome.order')}
                      {extra > 0 ? t('shome.more', { count: extra }) : ''} · {money(order.totalAmount)}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {t('shome.promised', { name: order.consumer.name, count: order.etaMinutes ?? 0 })}
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
              {unlisted.length ? t('shome.notShelfTitle') : t('shome.onShelf')}
            </h2>
            <Link href="/shop-stock" className="text-[11px] font-semibold text-agri-900 hover:underline">
              {t('shome.shopStock')}
            </Link>
          </div>
          {unlisted.length > 0 ? (
            <div className="space-y-2">
              {unlisted.slice(0, 4).map((stock) => (
                <div
                  key={stock.id}
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"
                >
                  <CropThumb imageUrl={stock.crop.imageUrl} name={stock.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-charcoal">{crop(stock.crop)}</div>
                    <div className="text-[11px] text-[#636E72]">
                      {t('shome.costLine', { qty: kg(stock.availableKg), rate: perKg(stock.costPerKg) })}
                    </div>
                    <div className="text-[10px] text-[#636E72]">{t('shome.hidden')}</div>
                  </div>
                  <Link
                    href="/storefront/new"
                    className="bg-agri-900 hover:bg-agri-800 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
                  >
                    {t('shome.listIt')}
                  </Link>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">{t('shome.nothingListed')}</p>
          ) : (
            <div className="space-y-2">
              {listings.map((listing) => {
                const sold = listing.listedQuantityKg - listing.remainingKg;
                const pct = Math.round((sold / listing.listedQuantityKg) * 100);
                return (
                  <div
                    key={listing.id}
                    className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3"
                  >
                    <CropThumb
                      imageUrl={listing.imageUrl ?? listing.crop.imageUrl}
                      name={listing.crop.name}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      {/* The listing title is typed by the shopkeeper and shown as stored. */}
                      <div className="text-xs font-semibold text-charcoal truncate">{listing.title}</div>
                      <div className="text-[11px] text-[#636E72]">
                        {t('shome.listingLine', {
                          rate: perKg(listing.pricePerKg),
                          qty: kg(listing.remainingKg),
                          margin: perKg(listing.pricePerKg - listing.stock.costPerKg),
                        })}
                      </div>
                      <div className="h-1 rounded-full bg-[#F2F4F7] mt-1.5">
                        <div
                          className="h-1 rounded-full bg-agri-900"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">{t('shome.cheapest')}</h2>
            <Link href="/wholesale" className="text-[11px] font-semibold text-agri-900 hover:underline">
              {t('shome.market')}
            </Link>
          </div>
          {bestDeals.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">
              {t('shome.noVendor', { city: myCity ? place(myCity) : t('shome.yourCity') })}
            </p>
          ) : (
            <div className="space-y-2">
              {bestDeals.map((offer) => (
                <Link
                  key={offer.id}
                  href="/wholesale"
                  className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3 hover:bg-[#F8F9F5]"
                >
                  <CropThumb imageUrl={offer.crop.imageUrl} name={offer.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-charcoal">{crop(offer.crop)}</div>
                    <div className="text-[11px] text-[#636E72]">
                      {t('shome.minOrder', { rate: perKg(offer.pricePerKg), qty: kg(offer.minOrderKg) })}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {t('shome.delivers', {
                        vendor: offer.vendor.vendorProfile?.businessName ?? offer.vendor.name,
                        hours: offer.deliveryEtaHours,
                      })}
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
