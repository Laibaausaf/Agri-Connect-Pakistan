import Link from 'next/link';
import { OfferListingStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { distanceKm } from '@/lib/geo';
import { getI18n } from '@/lib/i18n/server';
import { Badge, Card, CropThumb, EmptyState } from '@/components/ui/kit';
import { Clock, MapPin, Star } from 'lucide-react';

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
        <h1 className="text-lg font-bold text-charcoal">
          {t('nearby.title')}
        </h1>
        <p className="text-xs text-[#636E72] mt-0.5">
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
                      <span className="text-sm font-bold text-charcoal">{profile.shopName}</span>
                      {withinRange && <Badge tone="green">{t('nearby.deliversToYou')}</Badge>}
                      {items.length === 0 && <Badge tone="neutral">{t('nearby.restocking')}</Badge>}
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {profile.shopAddress ?? (profile.city ? place(profile.city) : t('nearby.noAddress'))} ·{' '}
                      {distance(km)}
                    </div>
                    <div className="text-[11px] text-[#636E72] flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{t('cshop.minutes', { count: profile.avgDeliveryMinutes })}
                      </span>
                      {profile.opensAt && profile.closesAt && (
                        <span>
                          {profile.opensAt}–{profile.closesAt}
                        </span>
                      )}
                      {profile.ratingCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          {profile.rating.toFixed(1)} ({profile.ratingCount})
                        </span>
                      )}
                    </div>
                    {cheapest !== null && (
                      <div className="text-[11px] text-agri-900 font-semibold mt-1">
                        {t('nearby.from', { rate: perKg(cheapest) })}
                      </div>
                    )}
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <div className="flex gap-2 overflow-x-auto">
                      {items.map((item) => (
                        <div key={item.id} className="w-24 shrink-0">
                          <CropThumb
                            imageUrl={item.imageUrl ?? item.crop.imageUrl}
                            name={item.crop.name}
                            size="lg"
                          />
                          <div className="text-[10px] font-semibold text-charcoal mt-1 truncate">
                            {crop(item.crop)}
                          </div>
                          <div className="text-[10px] text-agri-900 font-bold">
                            {perKg(item.pricePerKg)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/shop"
                      className="inline-flex mt-3 text-[11px] font-semibold text-agri-900 hover:underline"
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
