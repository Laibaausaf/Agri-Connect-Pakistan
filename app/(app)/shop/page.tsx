import Link from 'next/link';
import { OfferListingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { placeConsumerOrder } from '@/lib/actions/retail';
import { distanceKm } from '@/lib/geo';
import { getI18n } from '@/lib/i18n/server';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Badge, Card, CropThumb, EmptyState } from '@/components/ui/kit';
import { MapPin, Clock, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ConsumerShopPage({
  searchParams,
}: {
  searchParams: Promise<{ crop?: string }>;
}) {
  const user = await requireCapability('consumer.retail.browse');
  const { crop: cropFilter } = await searchParams;
  const { t, crop, kg, money, distance } = await getI18n();

  const [me, listings, crops] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        latitude: true,
        longitude: true,
        location: true,
        consumerProfile: { select: { deliveryAddress: true, preferredCity: true } },
      },
    }),
    prisma.retailListing.findMany({
      where: {
        status: OfferListingStatus.ACTIVE,
        remainingKg: { gt: 0 },
        ...(cropFilter ? { cropId: cropFilter } : {}),
      },
      include: {
        crop: { select: { id: true, name: true, nameUrdu: true, imageUrl: true } },
        shopkeeper: {
          select: {
            latitude: true,
            longitude: true,
            name: true,
            shopkeeperProfile: {
              select: {
                shopName: true,
                city: true,
                rating: true,
                ratingCount: true,
                avgDeliveryMinutes: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.crop.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameUrdu: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const here = { latitude: me?.latitude ?? null, longitude: me?.longitude ?? null };
  const address = me?.consumerProfile?.deliveryAddress ?? '';

  const items = listings
    .map((listing) => ({ listing, km: distanceKm(here, listing.shopkeeper) }))
    .sort((a, b) => {
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km;
    });

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-charcoal">
          {t('cshop.title')}
        </h1>
        <p className="text-xs text-[#636E72] mt-0.5">
          {t('cshop.subtitle')}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4 overflow-x-auto">
        <Link
          href="/shop"
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap ${
            cropFilter
              ? 'bg-white text-[#636E72] border-[#E5E7EB]'
              : 'bg-agri-900 text-white border-agri-900'
          }`}
        >
          {t('cshop.everything')}
        </Link>
        {crops.map((c) => (
          <Link
            key={c.id}
            href={`/shop?crop=${c.id}`}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap ${
              cropFilter === c.id
                ? 'bg-agri-900 text-white border-agri-900'
                : 'bg-white text-[#636E72] border-[#E5E7EB]'
            }`}
          >
            {crop(c)}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={t('cshop.emptyTitle')}
          message={t('cshop.emptyMessage')}
          actionHref="/nearby"
          actionLabel={t('cshop.emptyAction')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(({ listing, km }) => {
            const shop = listing.shopkeeper.shopkeeperProfile;
            const maxKg = Math.floor(listing.remainingKg);
            const pack = listing.packSizeKg;
            return (
              <Card key={listing.id} padded={false} className="overflow-hidden">
                <div className="flex gap-3 p-3">
                  <CropThumb
                    imageUrl={listing.imageUrl ?? listing.crop.imageUrl}
                    name={listing.crop.name}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-charcoal leading-tight">
                      {listing.title}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {crop(listing.crop)}
                    </div>
                    <div className="mt-1.5 text-base font-bold text-agri-900">
                      {money(listing.pricePerKg)}
                      <span className="text-[10px] font-normal text-[#636E72]">{t('cshop.perKg')}</span>
                    </div>
                    <div className="text-[10px] text-[#636E72] mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {shop?.shopName ?? listing.shopkeeper.name} · {distance(km)}
                    </div>
                    <div className="text-[10px] text-[#636E72] flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{t('cshop.minutes', { count: shop?.avgDeliveryMinutes ?? 35 })}
                      </span>
                      {shop && shop.ratingCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          {shop.rating.toFixed(1)}
                        </span>
                      )}
                      <Badge tone="green">{t('cshop.packs', { qty: kg(pack) })}</Badge>
                    </div>
                  </div>
                </div>

                <details className="border-t border-[#E5E7EB] px-3 pb-3">
                  <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer py-2.5">
                    {t('cshop.orderNow')}
                  </summary>
                  <ActionForm
                    action={placeConsumerOrder}
                    submitLabel={t('cshop.placeOrder')}
                    successMessage={t('cshop.placed')}
                    hidden={{ listingId: listing.id }}
                  >
                    <div className="space-y-2.5">
                      <Field
                        label={t('cshop.howMuch')}
                        hint={
                          listing.remainingKg < 5
                            ? t('cshop.onlyLeft', { qty: kg(listing.remainingKg) })
                            : t('cshop.freeOver')
                        }
                      >
                        <select name="quantityKg" defaultValue={pack} className={inputClass}>
                          {[pack, pack * 2, pack * 3, pack * 5]
                            .filter((q) => q <= maxKg)
                            .map((q) => (
                              <option key={q} value={q}>
                                {t('cshop.qtyOption', { qty: kg(q), amount: money(q * listing.pricePerKg) })}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label={t('cshop.deliverTo')}>
                        <input
                          name="deliveryAddress"
                          defaultValue={address}
                          placeholder={t('cshop.addressPlaceholder')}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </ActionForm>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
