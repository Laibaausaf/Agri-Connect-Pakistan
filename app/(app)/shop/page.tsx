import Link from 'next/link';
import { OfferListingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { placeConsumerOrder } from '@/lib/actions/retail';
import { distanceKm, formatDistance } from '@/lib/geo';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Badge, Card, CropThumb, EmptyState, money } from '@/components/ui/kit';
import { MapPin, Clock, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ConsumerShopPage({
  searchParams,
}: {
  searchParams: Promise<{ crop?: string }>;
}) {
  const user = await requireCapability('consumer.retail.browse');
  const { crop: cropFilter } = await searchParams;

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
      select: { id: true, name: true },
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
          Fresh today <span className="text-sm font-normal text-[#636E72]">آج کی تازہ</span>
        </h1>
        <p className="text-xs text-[#636E72] mt-0.5">
          Straight from shops near you — every item traced back to the farm it grew on.
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
          Everything
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
            {c.name}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing on sale right now"
          message="Shops nearby restock every morning from the mandi. Check back a little later."
          actionHref="/nearby"
          actionLabel="See Shops Nearby"
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
                      {listing.crop.name}
                      {listing.crop.nameUrdu ? ` · ${listing.crop.nameUrdu}` : ''}
                    </div>
                    <div className="mt-1.5 text-base font-bold text-agri-900">
                      {money(listing.pricePerKg)}
                      <span className="text-[10px] font-normal text-[#636E72]"> / kg</span>
                    </div>
                    <div className="text-[10px] text-[#636E72] mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {shop?.shopName ?? listing.shopkeeper.name} · {formatDistance(km)}
                    </div>
                    <div className="text-[10px] text-[#636E72] flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />~{shop?.avgDeliveryMinutes ?? 35} min
                      </span>
                      {shop && shop.ratingCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          {shop.rating.toFixed(1)}
                        </span>
                      )}
                      <Badge tone="green">{pack} kg packs</Badge>
                    </div>
                  </div>
                </div>

                <details className="border-t border-[#E5E7EB] px-3 pb-3">
                  <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer py-2.5">
                    Order now
                  </summary>
                  <ActionForm
                    action={placeConsumerOrder}
                    submitLabel="Place order"
                    submitLabelUrdu="آرڈر کریں"
                    successMessage="Order placed. Track it on the Orders tab."
                    hidden={{ listingId: listing.id }}
                  >
                    <div className="space-y-2.5">
                      <Field
                        label="How much?"
                        labelUrdu="کتنا"
                        hint={
                          listing.remainingKg < 5
                            ? `Only ${listing.remainingKg} kg left`
                            : 'Free delivery over Rs 1,000'
                        }
                      >
                        <select name="quantityKg" defaultValue={pack} className={inputClass}>
                          {[pack, pack * 2, pack * 3, pack * 5]
                            .filter((q) => q <= maxKg)
                            .map((q) => (
                              <option key={q} value={q}>
                                {q} kg — {money(q * listing.pricePerKg)}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Deliver to" labelUrdu="پتہ">
                        <input
                          name="deliveryAddress"
                          defaultValue={address}
                          placeholder="House, street, sector"
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
