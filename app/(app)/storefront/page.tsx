import Link from 'next/link';
import { ConsumerOrderStatus, OfferListingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
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

export default async function StorefrontPage() {
  const user = await requireCapability('shopkeeper.retail.manage');
  const { t, plural, place, status, kg, perKg, money } = await getI18n();

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
        title={profile?.shopName ?? t('storefront.title')}
        subtitle={t('storefront.subtitle')}
        action={
          <Link
            href="/storefront/new"
            className="bg-agri-900 hover:bg-agri-800 text-white text-[11px] font-semibold px-3 py-2 rounded-xl whitespace-nowrap"
          >
            {t('storefront.add')}
          </Link>
        }
      />

      {profile && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#636E72]">
            <span className="font-semibold text-charcoal">{place(profile.city)}</span>
            <span>
              {t('storefront.open', { from: profile.opensAt ?? '', to: profile.closesAt ?? '' })}
            </span>
            <span>{t('storefront.delivery', { count: profile.avgDeliveryMinutes })}</span>
            <span>
              {profile.ratingCount > 0
                ? t(profile.ratingCount === 1 ? 'storefront.rating.one' : 'storefront.rating.other', {
                    rating: profile.rating.toFixed(1),
                    count: profile.ratingCount,
                  })
                : t('storefront.noRatings')}
            </span>
            {liveOrders > 0 && (
              <Link href="/retail-orders" className="font-semibold text-agri-900 hover:underline">
                {plural('storefront.toFulfil', liveOrders)}
              </Link>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('storefront.statLive')} value={String(open.length)} />
        <StatCard label={t('storefront.statCounter')} value={kg(onCounter)} tone="accent" />
        <StatCard label={t('storefront.statSold')} value={kg(soldKg)} />
        <StatCard label={t('storefront.statRevenue')} value={money(revenue)} />
      </div>

      {listings.length === 0 ? (
        <EmptyState
          title={t('storefront.emptyTitle')}
          message={t('storefront.emptyMessage')}
          actionHref="/shop-stock"
          actionLabel={t('storefront.emptyAction')}
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
                      <Badge tone="green">{t('storefront.live')}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {listing.listingNumber} · {listing.stock.stockNumber}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('storefront.retailPrice')}</div>
                        <div className="font-semibold text-agri-900">
                          {perKg(listing.pricePerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('storefront.cost')}</div>
                        <div className="font-semibold text-charcoal">
                          {perKg(listing.stock.costPerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('storefront.margin')}</div>
                        <div className="font-semibold text-charcoal">+{perKg(marginPerKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('storefront.pack')}</div>
                        <div className="font-semibold text-charcoal">{kg(listing.packSizeKg)}</div>
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
                      {t('storefront.soldLeft', { sold: kg(sold), left: kg(listing.remainingKg), total: kg(listing.listedQuantityKg) })}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {cleared.length > 0 && (
            <div className="pt-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#636E72] mb-2">
                {t('storefront.cleared')}
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
                      <div className="text-end whitespace-nowrap">
                        <div className="font-semibold text-charcoal">
                          {perKg(listing.pricePerKg)}
                        </div>
                        <Badge tone="neutral">{status(listing.status)}</Badge>
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
