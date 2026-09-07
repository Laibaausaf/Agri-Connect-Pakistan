import Link from 'next/link';
import { ConsumerOrderStatus, OfferListingStatus, StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Badge, Card, CropThumb, StatCard, humanStatus, money, qty, statusTone } from '@/components/ui/kit';

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
            listing: { select: { title: true, crop: { select: { name: true, imageUrl: true } } } },
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
        crop: { select: { name: true, imageUrl: true } },
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
        crop: { select: { name: true, imageUrl: true } },
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
          <div className="text-[11px] text-white/70">Retail shop</div>
          <h1 className="text-lg font-bold">{profile?.shopName ?? name}</h1>
          <p className="text-[11px] text-white/80 mt-1 max-w-lg">
            {profile?.city ? `Serving ${profile.city}. ` : ''}
            {profile?.ratingCount
              ? `${profile.rating.toFixed(1)}★ from ${profile.ratingCount} customers. `
              : ''}
            Buy wholesale, put it on the shelf, get it to the customer&apos;s door.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Orders to fulfil"
          value={String(orders.length)}
          tone={orders.length ? 'warn' : 'default'}
          hint={orders.length ? 'Customers waiting' : 'All clear'}
        />
        <StatCard label="Today's takings" value={money(todayTakings._sum.totalAmount ?? 0)} hint={`${todayTakings._count} orders`} />
        <StatCard label="Back-room stock" value={qty(stockKg)} hint={`${listings.length} live listings`} />
        <StatCard
          label="Not on shelf"
          value={String(unlisted.length)}
          tone={unlisted.length ? 'warn' : 'default'}
          hint="Stock with no listing"
        />
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-charcoal">Customer orders</h2>
          <Link href="/retail-orders" className="text-[11px] font-semibold text-agri-900 hover:underline">
            Fulfilment queue
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-[11px] text-[#636E72] py-4 text-center">
            No order waiting. Keep the shelf stocked so customers can order.
          </p>
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
                      <Badge tone={statusTone(order.status)}>{humanStatus(order.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {first ? `${qty(first.quantityKg)} ${first.listing.crop.name}` : 'Order'}
                      {extra > 0 ? ` +${extra} more` : ''} · {money(order.totalAmount)}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {order.consumer.name} · promised in {order.etaMinutes} min
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
              {unlisted.length ? 'Stock not on the shelf' : 'On the shelf'}
            </h2>
            <Link href="/shop-stock" className="text-[11px] font-semibold text-agri-900 hover:underline">
              Shop stock
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
                    <div className="text-xs font-semibold text-charcoal">{stock.crop.name}</div>
                    <div className="text-[11px] text-[#636E72]">
                      {qty(stock.availableKg)} · cost {money(stock.costPerKg)}/kg
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      Customers cannot see this until you list it
                    </div>
                  </div>
                  <Link
                    href="/storefront/new"
                    className="bg-agri-900 hover:bg-agri-800 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
                  >
                    List it
                  </Link>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">
              Nothing listed. Buy from the wholesale market to get started.
            </p>
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
                      <div className="text-xs font-semibold text-charcoal truncate">{listing.title}</div>
                      <div className="text-[11px] text-[#636E72]">
                        {money(listing.pricePerKg)}/kg · {qty(listing.remainingKg)} left ·{' '}
                        {money(listing.pricePerKg - listing.stock.costPerKg)}/kg margin
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
            <h2 className="text-xs font-bold text-charcoal">Cheapest wholesale for you</h2>
            <Link href="/wholesale" className="text-[11px] font-semibold text-agri-900 hover:underline">
              Wholesale market
            </Link>
          </div>
          {bestDeals.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">
              No vendor is delivering to {myCity ?? 'your city'} right now.
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
                    <div className="text-xs font-semibold text-charcoal">{offer.crop.name}</div>
                    <div className="text-[11px] text-[#636E72]">
                      {money(offer.pricePerKg)}/kg · min order {qty(offer.minOrderKg)}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {offer.vendor.vendorProfile?.businessName ?? offer.vendor.name} · delivers in{' '}
                      {offer.deliveryEtaHours} h
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
