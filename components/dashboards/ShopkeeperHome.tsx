import Link from 'next/link';
import { ConsumerOrderStatus, OfferListingStatus, StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import { Badge, Card, CropThumb, statusTone } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';
import BrandGlow from '@/components/ui/BrandGlow';

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

  const [waiting] = orders;
  const waitingItem = waiting?.items[0];
  const tile = (value: string, label: string, hint: string, warn = false) => (
    <div className="rounded-2xl bg-sage p-4">
      <div className={`tabular text-[22px] font-extrabold leading-tight ${warn ? 'text-warn-fg' : ''}`}>{value}</div>
      <div className="text-[13.5px] font-bold">{label}</div>
      <div className="text-[12.5px] text-muted">{hint}</div>
    </div>
  );

  return (
    <>
      <div className="ac-up mb-5">
        <p className="text-[15px] text-muted">
          {t('home.greeting')}, {name}
        </p>
        <h1 className="font-display h-page font-semibold">{profile?.shopName ?? name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {t('shome.role')} · {profile?.city ? t('shome.serving', { city: place(profile.city) }) : ''}
          {profile?.ratingCount ? t('shome.rating', { rating: profile.rating.toFixed(1), count: profile.ratingCount }) : ''}
          {t('shome.tagline')}
        </p>
      </div>

      {/* Today's takings, with the one order that needs an answer */}
      <section className="ac-up ac-d1 relative mb-5 overflow-hidden rounded-hero bg-brand p-5 text-white sm:p-6">
        <BrandGlow />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="flex items-end justify-between gap-3 lg:block">
            <div>
              <div className="text-[15px] font-bold text-[#D6E6D9]">{t('shome.takings')}</div>
              <div className="tabular text-[40px] font-extrabold leading-tight text-[#F6C871]">{money(todayTakings._sum.totalAmount ?? 0)}</div>
            </div>
            <div className="text-[13px] text-[#D6E6D9]">{t('shome.ordersCount', { count: todayTakings._count })}</div>
          </div>
          {waiting ? (
            <div className="rounded-2xl bg-sf p-4 text-ink">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-bold text-warn-fg">
                  <span className="ac-pulse h-2 w-2 rounded-full bg-gold" />
                  {t('shome.waiting')}
                </span>
                <Badge tone={statusTone(waiting.status)}>{status(waiting.status)}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-3">
                {waitingItem && <CropThumb imageUrl={waitingItem.listing.crop.imageUrl} name={waitingItem.listing.crop.name} size="md" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-extrabold">
                    {waitingItem ? `${kg(waitingItem.quantityKg)} ${crop(waitingItem.listing.crop)}` : t('shome.order')}
                    {waiting.items.length > 1 ? t('shome.more', { count: waiting.items.length - 1 }) : ''}
                  </div>
                  <div className="text-[13px] text-muted">
                    <span className="font-mono">{waiting.orderNumber}</span> · {t('shome.promised', { name: waiting.consumer.name, count: waiting.etaMinutes ?? 0 })}
                  </div>
                </div>
                <span className="tabular shrink-0 text-lg font-extrabold">{money(waiting.totalAmount)}</span>
              </div>
              <Link href="/retail-orders" className="btn btn-primary mt-4 w-full">
                <Icon name="check" size={20} />
                {t('shome.openOrder')}
              </Link>
            </div>
          ) : (
            <p className="rounded-2xl bg-white/10 p-4 text-sm">{t('shome.noOrder')}</p>
          )}
        </div>
      </section>

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        {tile(String(orders.length), t('shome.toFulfil'), orders.length ? t('shome.waiting') : t('shome.allClear'), orders.length > 0)}
        {tile(kg(stockKg), t('shome.backRoom'), t('shome.liveListings', { count: listings.length }))}
        {tile(String(unlisted.length), t('shome.notOnShelf'), t('shome.noListing'), unlisted.length > 0)}
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-bold text-ink">{t('shome.customerOrders')}</h2>
          <Link href="/retail-orders" className="inline-flex min-h-11 items-center text-sm font-bold hover:underline">
            {t('shome.queue')}
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-[13px] text-muted py-4 text-center">{t('shome.noOrder')}</p>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const first = order.items[0];
              const extra = order.items.length - 1;
              return (
                <Link
                  key={order.id}
                  href="/retail-orders"
                  className="flex items-start gap-3 rounded-xl border border-line bg-warn-bg p-3 hover:bg-warn-bg"
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
                      <span className="text-sm font-semibold text-ink">{order.orderNumber}</span>
                      <Badge tone={statusTone(order.status)}>{status(order.status)}</Badge>
                    </div>
                    <div className="text-[13px] text-muted">
                      {first ? `${kg(first.quantityKg)} ${crop(first.listing.crop)}` : t('shome.order')}
                      {extra > 0 ? t('shome.more', { count: extra }) : ''} · {money(order.totalAmount)}
                    </div>
                    <div className="text-[12.5px] text-muted">
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
            <h2 className="text-[17px] font-bold text-ink">
              {unlisted.length ? t('shome.notShelfTitle') : t('shome.onShelf')}
            </h2>
            <Link href="/shop-stock" className="inline-flex min-h-11 items-center text-sm font-bold hover:underline">
              {t('shome.shopStock')}
            </Link>
          </div>
          {unlisted.length > 0 ? (
            <div className="space-y-2">
              {unlisted.slice(0, 4).map((stock) => (
                <div
                  key={stock.id}
                  className="flex items-start gap-3 rounded-xl border border-line bg-warn-bg p-3"
                >
                  <CropThumb imageUrl={stock.crop.imageUrl} name={stock.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">{crop(stock.crop)}</div>
                    <div className="text-[13px] text-muted">
                      {t('shome.costLine', { qty: kg(stock.availableKg), rate: perKg(stock.costPerKg) })}
                    </div>
                    <div className="text-[12.5px] text-muted">{t('shome.hidden')}</div>
                  </div>
                  <Link href="/storefront/new" className="btn btn-secondary btn-sm shrink-0">
                    {t('shome.listIt')}
                  </Link>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <p className="text-[13px] text-muted py-4 text-center">{t('shome.nothingListed')}</p>
          ) : (
            <div className="space-y-2">
              {listings.map((listing) => {
                const sold = listing.listedQuantityKg - listing.remainingKg;
                const pct = Math.round((sold / listing.listedQuantityKg) * 100);
                return (
                  <div
                    key={listing.id}
                    className="flex items-start gap-3 rounded-xl border border-line p-3"
                  >
                    <CropThumb
                      imageUrl={listing.imageUrl ?? listing.crop.imageUrl}
                      name={listing.crop.name}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      {/* The listing title is typed by the shopkeeper and shown as stored. */}
                      <div className="text-sm font-semibold text-ink truncate">{listing.title}</div>
                      <div className="text-[13px] text-muted">
                        {t('shome.listingLine', {
                          rate: perKg(listing.pricePerKg),
                          qty: kg(listing.remainingKg),
                          margin: perKg(listing.pricePerKg - listing.stock.costPerKg),
                        })}
                      </div>
                      <div className="h-1 rounded-full bg-sage mt-1.5">
                        <div
                          className="h-1 rounded-full bg-forest"
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
            <h2 className="text-[17px] font-bold text-ink">{t('shome.cheapest')}</h2>
            <Link href="/wholesale" className="inline-flex min-h-11 items-center text-sm font-bold hover:underline">
              {t('shome.market')}
            </Link>
          </div>
          {bestDeals.length === 0 ? (
            <p className="text-[13px] text-muted py-4 text-center">
              {t('shome.noVendor', { city: myCity ? place(myCity) : t('shome.yourCity') })}
            </p>
          ) : (
            <div className="space-y-2">
              {bestDeals.map((offer) => (
                <Link
                  key={offer.id}
                  href="/wholesale"
                  className="flex items-start gap-3 rounded-xl border border-line p-3 hover:bg-paper"
                >
                  <CropThumb imageUrl={offer.crop.imageUrl} name={offer.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">{crop(offer.crop)}</div>
                    <div className="text-[13px] text-muted">
                      {t('shome.minOrder', { rate: perKg(offer.pricePerKg), qty: kg(offer.minOrderKg) })}
                    </div>
                    <div className="text-[12.5px] text-muted">
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
