import Link from 'next/link';
import { OfferListingStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { placeConsumerOrder } from '@/lib/actions/retail';
import { distanceKm } from '@/lib/geo';
import { getI18n } from '@/lib/i18n/server';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Badge, EmptyState } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

export default async function ConsumerShopPage({
  searchParams,
}: {
  searchParams: Promise<{ crop?: string }>;
}) {
  const user = await requireCapability('consumer.retail.browse');
  const { crop: cropFilter } = await searchParams;
  const { t, crop, kg, money, distance, perKg } = await getI18n();

  const [me, listings, crops, shops] = await Promise.all([
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
      select: { id: true, name: true, nameUrdu: true, imageUrl: true },
      orderBy: { name: 'asc' },
    }),
    // Read-only: the same shops query the Nearby page runs.
    prisma.user.findMany({
      where: { role: UserRole.SHOPKEEPER, shopkeeperProfile: { isNot: null } },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        shopkeeperProfile: { select: { shopName: true, shopAddress: true, rating: true, ratingCount: true, opensAt: true, closesAt: true } },
        retailListings: {
          where: { status: OfferListingStatus.ACTIVE, remainingKg: { gt: 0 } },
          select: { id: true, pricePerKg: true },
          orderBy: { pricePerKg: 'asc' },
          take: 1,
        },
      },
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

  // Same order as the Nearby page: shops with stock first, then by distance.
  const nearShops = shops
    .map((shop) => ({ shop, km: distanceKm(here, shop) }))
    .sort((a, b) => {
      const aOpen = a.shop.retailListings.length > 0;
      const bOpen = b.shop.retailListings.length > 0;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km;
    })
    .slice(0, 3);
  const chip = (active: boolean) =>
    `ac-press inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] pe-4 ps-1.5 text-sm font-bold ${
      active ? 'border-forest bg-forest text-paper' : 'border-line bg-sf text-ink'
    }`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display h-page font-semibold">{t('cshop.title')}</h1>
        <p className="mt-1 text-[15px] text-muted">{t('cshop.subtitle')}</p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href="/shop" className={chip(!cropFilter)}>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sage text-forest">
            <Icon name="grid" size={16} />
          </span>
          {t('cshop.everything')}
        </Link>
        {crops.map((c) => (
          <Link key={c.id} href={`/shop?crop=${c.id}`} className={chip(cropFilter === c.id)}>
            <span className="h-8 w-8 overflow-hidden rounded-full bg-sage">
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            {crop(c)}
          </Link>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-sage p-4">
        <Icon name="route" size={22} className="mt-0.5 text-forest" />
        <div>
          <div className="text-[15px] font-bold">{t('cshop.tracedTitle')}</div>
          <div className="text-[13px] text-muted">{t('cshop.tracedText')}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState title={t('cshop.emptyTitle')} message={t('cshop.emptyMessage')} actionHref="/nearby" actionLabel={t('cshop.emptyAction')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map(({ listing, km }) => {
            const shop = listing.shopkeeper.shopkeeperProfile;
            const maxKg = Math.floor(listing.remainingKg);
            const pack = listing.packSizeKg;
            const photo = listing.imageUrl ?? listing.crop.imageUrl;
            return (
              <article key={listing.id} className="card overflow-hidden">
                <div className="relative h-40 bg-sage">
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={crop(listing.crop)} className="h-full w-full object-cover" />
                  )}
                  {/* The origin label is typed by the shopkeeper and shown as stored. */}
                  {listing.originLabel && (
                    <span className="absolute start-3 top-3 inline-flex h-7 items-center gap-1 rounded-full bg-[#0F3D2E]/85 px-2.5 text-[12.5px] font-bold text-white">
                      <Icon name="leaf" size={14} />
                      {listing.originLabel}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* The listing title is typed by the shopkeeper and shown as stored. */}
                      <div className="text-[17px] font-bold leading-snug">{listing.title}</div>
                      <div className="text-[13px] text-muted">{crop(listing.crop)}</div>
                    </div>
                    <div className="shrink-0 text-end">
                      <span className="tabular text-[22px] font-extrabold">{money(listing.pricePerKg)}</span>
                      <span className="text-[12.5px] text-muted">{t('cshop.perKg')}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="store" size={14} />
                      {shop?.shopName ?? listing.shopkeeper.name}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="pin" size={14} />
                      {distance(km)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="clock" size={14} />
                      {t('cshop.minutes', { count: shop?.avgDeliveryMinutes ?? 35 })}
                    </span>
                    {shop && shop.ratingCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="star" size={14} />
                        {shop.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <details className="mt-3 [&[open]>summary]:mb-3">
                    <summary className="btn btn-secondary w-full cursor-pointer list-none">
                      <Icon name="plus" size={18} />
                      {t('cshop.orderNow')} · {t('cshop.packs', { qty: kg(pack) })}
                    </summary>
                    <ActionForm action={placeConsumerOrder} submitLabel={t('cshop.placeOrder')} successMessage={t('cshop.placed')} hidden={{ listingId: listing.id }} icon="cart">
                      <div className="space-y-3">
                        <Field label={t('cshop.howMuch')} hint={listing.remainingKg < 5 ? t('cshop.onlyLeft', { qty: kg(listing.remainingKg) }) : t('cshop.freeOver')}>
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
                          <input name="deliveryAddress" defaultValue={address} placeholder={t('cshop.addressPlaceholder')} className={inputClass} />
                        </Field>
                      </div>
                    </ActionForm>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {nearShops.length > 0 && (
        <section>
          <div className="mb-2 flex items-end justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[.08em] text-muted">{t('cshop.nearHeading')}</h2>
            <Link href="/nearby" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold">
              {t('cshop.emptyAction')}
              <Icon name="chevronright" size={16} />
            </Link>
          </div>
          <div className="card divide-y divide-line">
            {nearShops.map(({ shop, km }) => {
              const profile = shop.shopkeeperProfile;
              const cheapest = shop.retailListings[0];
              return (
                <Link key={shop.id} href="/nearby" className="flex items-center gap-3 p-4">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage text-forest">
                    <Icon name="store" size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold">{profile?.shopName ?? shop.name}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {profile?.shopAddress ?? ''} · {distance(km)}
                    </span>
                    {profile?.opensAt && profile.closesAt && (
                      <span className="block text-[13px] text-muted" dir="ltr">
                        {profile.opensAt}–{profile.closesAt}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {!cheapest && <Badge tone="amber" icon="refresh">{t('nearby.restocking')}</Badge>}
                    {cheapest && <span className="text-[13px] font-bold">{t('nearby.from', { rate: perKg(cheapest.pricePerKg) })}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
