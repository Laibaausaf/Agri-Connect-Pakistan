import Link from 'next/link';
import { OfferListingStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { distanceKm } from '@/lib/geo';
import { getI18n } from '@/lib/i18n/server';
import { Badge, Card, CropThumb, EmptyState } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

export default async function NearbyShopsPage() {
  const user = await requireCapability('consumer.retail.browse');
  const { t, crop, place, perKg, distance } = await getI18n();

  const [me, shops] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        latitude: true,
        longitude: true,
        consumerProfile: { select: { preferredCity: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: UserRole.SHOPKEEPER, shopkeeperProfile: { isNot: null } },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        shopkeeperProfile: {
          select: {
            shopName: true,
            shopAddress: true,
            shopImageUrl: true,
            city: true,
            rating: true,
            ratingCount: true,
            avgDeliveryMinutes: true,
            deliveryRadiusKm: true,
            opensAt: true,
            closesAt: true,
          },
        },
        retailListings: {
          where: { status: OfferListingStatus.ACTIVE, remainingKg: { gt: 0 } },
          select: {
            id: true,
            title: true,
            pricePerKg: true,
            imageUrl: true,
            crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
          },
          orderBy: { pricePerKg: 'asc' },
          take: 4,
        },
      },
    }),
  ]);

  const here = { latitude: me?.latitude ?? null, longitude: me?.longitude ?? null };

  const ranked = shops
    .map((shop) => ({ shop, km: distanceKm(here, shop) }))
    .sort((a, b) => {
      const aOpen = a.shop.retailListings.length > 0;
      const bOpen = b.shop.retailListings.length > 0;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km;
    });

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-ink">
          {t('nearby.title')}
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {me?.consumerProfile?.preferredCity
            ? t('nearby.around', { city: place(me.consumerProfile.preferredCity) })
            : t('nearby.aroundYou')}
        </p>
      </div>

      {ranked.length === 0 ? (
        <EmptyState
          title={t('nearby.emptyTitle')}
          message={t('nearby.emptyMessage')}
        />
      ) : (
        <div className="space-y-3">
          {ranked.map(({ shop, km }) => {
            const profile = shop.shopkeeperProfile;
            if (!profile) return null;
            const items = shop.retailListings;
            const cheapest = items.length ? items[0].pricePerKg : null;
            const withinRange = km !== null && km <= profile.deliveryRadiusKm;
            return (
              <Card key={shop.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={profile.shopImageUrl}
                    name={profile.shopName}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[17px] font-bold text-ink">{profile.shopName}</span>
                      {withinRange && <Badge tone="green">{t('nearby.deliversToYou')}</Badge>}
                      {items.length === 0 && <Badge tone="neutral">{t('nearby.restocking')}</Badge>}
                    </div>
                    <div className="text-[13px] text-muted mt-0.5 flex items-center gap-1">
                      <Icon name="pin" size={12} />
                      {profile.shopAddress ?? (profile.city ? place(profile.city) : t('nearby.noAddress'))} ·{' '}
                      {distance(km)}
                    </div>
                    <div className="text-[13px] text-muted flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Icon name="clock" size={12} />{t('cshop.minutes', { count: profile.avgDeliveryMinutes })}
                      </span>
                      {profile.opensAt && profile.closesAt && (
                        <span>
                          {profile.opensAt}–{profile.closesAt}
                        </span>
                      )}
                      {profile.ratingCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Icon name="star" size={12} />
                          {profile.rating.toFixed(1)} ({profile.ratingCount})
                        </span>
                      )}
                    </div>
                    {cheapest !== null && (
                      <div className="text-[13px] text-forest font-semibold mt-1">
                        {t('nearby.from', { rate: perKg(cheapest) })}
                      </div>
                    )}
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <div className="flex gap-2 overflow-x-auto">
                      {items.map((item) => (
                        <div key={item.id} className="w-24 shrink-0">
                          <CropThumb
                            imageUrl={item.imageUrl ?? item.crop.imageUrl}
                            name={item.crop.name}
                            size="lg"
                          />
                          <div className="text-[12.5px] font-semibold text-ink mt-1 truncate">
                            {crop(item.crop)}
                          </div>
                          <div className="text-[12.5px] text-forest font-bold">
                            {perKg(item.pricePerKg)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/shop"
                      className="inline-flex mt-3 text-[13px] font-semibold text-forest hover:underline"
                    >
                      {t('nearby.orderHere')}
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
