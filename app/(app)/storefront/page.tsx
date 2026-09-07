import Link from 'next/link';
import { ConsumerOrderStatus, OfferListingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
  humanStatus,
  money,
  qty,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

export default async function StorefrontPage() {
  const user = await requireCapability('shopkeeper.retail.manage');

  const [listings, profile, liveOrders] = await Promise.all([
    prisma.retailListing.findMany({
      where: { shopkeeperId: user.id },
      include: {
        crop: { select: { name: true, imageUrl: true } },
        stock: { select: { costPerKg: true, stockNumber: true } },
        orderItems: { select: { quantityKg: true, lineTotal: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shopkeeperProfile.findUnique({
      where: { userId: user.id },
      select: {
        shopName: true,
        city: true,
        rating: true,
        ratingCount: true,
        opensAt: true,
        closesAt: true,
        avgDeliveryMinutes: true,
      },
    }),
    prisma.consumerOrder.count({
      where: {
        shopkeeperId: user.id,
        status: { notIn: [ConsumerOrderStatus.DELIVERED, ConsumerOrderStatus.CANCELLED] },
      },
    }),
  ]);

  const open = listings.filter((l) => l.status === OfferListingStatus.ACTIVE);
  const cleared = listings.filter((l) => l.status !== OfferListingStatus.ACTIVE);
  const onCounter = open.reduce((sum, l) => sum + l.remainingKg, 0);
  const soldKg = listings.reduce(
    (sum, l) => sum + l.orderItems.reduce((acc, i) => acc + i.quantityKg, 0),
    0
  );
  const revenue = listings.reduce(
    (sum, l) => sum + l.orderItems.reduce((acc, i) => acc + i.lineTotal, 0),
    0
  );

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={profile?.shopName ?? 'My Storefront'}
        titleUrdu="میری دکان"
        subtitle="Exactly what customers nearby see when they open the app. Prices here are public retail prices."
        action={
          <Link
            href="/storefront/new"
            className="bg-agri-900 hover:bg-agri-800 text-white text-[11px] font-semibold px-3 py-2 rounded-xl whitespace-nowrap"
          >
            Add Retail Listing
          </Link>
        }
      />

      {profile && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#636E72]">
            <span className="font-semibold text-charcoal">{profile.city}</span>
            <span>
              Open {profile.opensAt}–{profile.closesAt}
            </span>
            <span>~{profile.avgDeliveryMinutes} min delivery</span>
            <span>
              {profile.ratingCount > 0
                ? `★ ${profile.rating.toFixed(1)} from ${profile.ratingCount} customer${profile.ratingCount === 1 ? '' : 's'}`
                : 'No customer ratings yet'}
            </span>
            {liveOrders > 0 && (
              <Link href="/retail-orders" className="font-semibold text-agri-900 hover:underline">
                {liveOrders} order{liveOrders === 1 ? '' : 's'} to fulfil
              </Link>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Listings live" value={String(open.length)} />
        <StatCard label="On the counter" value={qty(onCounter)} tone="accent" />
        <StatCard label="Sold to customers" value={qty(soldKg)} />
        <StatCard label="Retail revenue" value={money(revenue)} />
      </div>

      {listings.length === 0 ? (
        <EmptyState
          title="Your storefront is empty"
          message="Price some shop stock and it appears to customers within your delivery radius straight away."
          actionHref="/shop-stock"
          actionLabel="Open Shop Stock"
        />
      ) : (
        <div className="space-y-3">
          {open.map((listing) => {
            const sold = listing.listedQuantityKg - listing.remainingKg;
            const marginPerKg = listing.pricePerKg - listing.stock.costPerKg;
            return (
              <Card key={listing.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={listing.imageUrl ?? listing.crop.imageUrl}
                    name={listing.crop.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{listing.title}</span>
                      <Badge tone="green">Live</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {listing.listingNumber} · {listing.stock.stockNumber}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Retail price</div>
                        <div className="font-semibold text-agri-900">
                          {money(listing.pricePerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Your cost</div>
                        <div className="font-semibold text-charcoal">
                          {money(listing.stock.costPerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Margin</div>
                        <div className="font-semibold text-charcoal">+{money(marginPerKg)}/kg</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Pack</div>
                        <div className="font-semibold text-charcoal">{listing.packSizeKg} kg</div>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[#F2F4F7] overflow-hidden">
                      <div
                        className="h-full bg-agri-900"
                        style={{
                          width: `${Math.min(100, Math.round((sold / listing.listedQuantityKg) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-[#636E72] mt-1">
                      {qty(sold)} sold · {qty(listing.remainingKg)} left of{' '}
                      {qty(listing.listedQuantityKg)}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {cleared.length > 0 && (
            <div className="pt-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#636E72] mb-2">
                Cleared listings
              </h2>
              <Card padded={false}>
                <div className="divide-y divide-[#E5E7EB]">
                  {cleared.map((listing) => (
                    <div
                      key={listing.id}
                      className="p-3 flex items-center justify-between gap-3 text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-charcoal truncate">{listing.title}</div>
                        <div className="text-[#636E72] font-mono">{listing.listingNumber}</div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="font-semibold text-charcoal">
                          {money(listing.pricePerKg)}/kg
                        </div>
                        <Badge tone="neutral">{humanStatus(listing.status)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
