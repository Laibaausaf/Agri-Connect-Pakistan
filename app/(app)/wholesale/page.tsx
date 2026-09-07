import Link from 'next/link';
import { OfferListingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { purchaseWholesale } from '@/lib/actions/wholesale';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
  money,
  qty,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

function cityList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

export default async function WholesaleMarketPage({
  searchParams,
}: {
  searchParams: Promise<{ crop?: string }>;
}) {
  const user = await requireCapability('shopkeeper.wholesale.browse');
  const { crop: cropFilter } = await searchParams;

  const [offers, crops, profile] = await Promise.all([
    prisma.vendorOffer.findMany({
      where: {
        status: OfferListingStatus.ACTIVE,
        remainingKg: { gt: 0 },
        ...(cropFilter ? { cropId: cropFilter } : {}),
      },
      include: {
        crop: true,
        vendor: {
          select: {
            name: true,
            vendorProfile: { select: { businessName: true, warehouseCity: true, rating: true } },
          },
        },
        stock: { select: { sourceFarmCity: true, sourceMandiCity: true } },
      },
      orderBy: { pricePerKg: 'asc' },
    }),
    prisma.crop.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.shopkeeperProfile.findUnique({
      where: { userId: user.id },
      select: { city: true, shopName: true },
    }),
  ]);

  const myCity = profile?.city ?? null;
  const ranked = [...offers].sort((a, b) => {
    const aHere = myCity ? cityList(a.deliveryCities).includes(myCity) : false;
    const bHere = myCity ? cityList(b.deliveryCities).includes(myCity) : false;
    if (aHere !== bHere) return aHere ? -1 : 1;
    return a.pricePerKg - b.pricePerKg;
  });

  const deliverable = myCity
    ? offers.filter((o) => cityList(o.deliveryCities).includes(myCity)).length
    : offers.length;
  const cheapest = offers.length ? Math.min(...offers.map((o) => o.pricePerKg)) : 0;
  const available = offers.reduce((sum, o) => sum + o.remainingKg, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Wholesale Market"
        titleUrdu="تھوک منڈی"
        subtitle="Vendor offers you can order from today. Every offer shows the farm and mandi the produce came from, so you know exactly what you are reselling."
        action={
          <Link
            href="/shop-stock"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            My Shop Stock
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Offers open" value={String(offers.length)} />
        <StatCard
          label="Delivers to you"
          value={String(deliverable)}
          tone="accent"
          hint={myCity ?? undefined}
        />
        <StatCard label="Quantity on market" value={qty(available)} />
        <StatCard label="Best rate" value={cheapest ? `${money(cheapest)}/kg` : '—'} />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Link
          href="/wholesale"
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${
            cropFilter
              ? 'bg-white text-[#636E72] border-[#E5E7EB]'
              : 'bg-agri-900 text-white border-agri-900'
          }`}
        >
          All crops
        </Link>
        {crops.map((c) => (
          <Link
            key={c.id}
            href={`/wholesale?crop=${c.id}`}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${
              cropFilter === c.id
                ? 'bg-agri-900 text-white border-agri-900'
                : 'bg-white text-[#636E72] border-[#E5E7EB]'
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {ranked.length === 0 ? (
        <EmptyState
          title="No wholesale offers right now"
          message="Vendors list stock right after they win a mandi auction. Check back shortly or widen the crop filter."
        />
      ) : (
        <div className="space-y-3">
          {ranked.map((offer) => {
            const deliversHere = myCity ? cityList(offer.deliveryCities).includes(myCity) : false;
            const maxOrder = Math.floor(offer.remainingKg);
            const defaultOrder = Math.min(maxOrder, Math.max(offer.minOrderKg, 200));
            return (
              <Card key={offer.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={firstPhoto(offer.photos) ?? offer.crop.imageUrl}
                    name={offer.crop.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{offer.crop.name}</span>
                      <Badge tone="neutral">{offer.grade}</Badge>
                      {deliversHere && <Badge tone="green">Delivers to {myCity}</Badge>}
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {offer.vendor.vendorProfile?.businessName ?? offer.vendor.name}
                      {offer.vendor.vendorProfile?.warehouseCity
                        ? ` · ${offer.vendor.vendorProfile.warehouseCity}`
                        : ''}
                      {offer.vendor.vendorProfile?.rating
                        ? ` · ★ ${offer.vendor.vendorProfile.rating.toFixed(1)}`
                        : ''}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      Grown in {offer.stock.sourceFarmCity} · traded at {offer.stock.sourceMandiCity}{' '}
                      mandi
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Rate</div>
                        <div className="font-semibold text-agri-900">
                          {money(offer.pricePerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Available</div>
                        <div className="font-semibold text-charcoal">{qty(offer.remainingKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Minimum order</div>
                        <div className="font-semibold text-charcoal">{qty(offer.minOrderKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Delivery</div>
                        <div className="font-semibold text-charcoal">
                          {offer.deliveryEtaHours} h
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <details className="mt-3 pt-3 border-t border-[#E5E7EB]">
                  <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer">
                    Order from this offer
                  </summary>
                  <ActionForm
                    action={purchaseWholesale}
                    submitLabel="Confirm order"
                    submitLabelUrdu="آرڈر کریں"
                    successMessage="Ordered. The stock is now in your shop inventory."
                    hidden={{ offerId: offer.id }}
                    className="mt-3"
                  >
                    <Field
                      label="Quantity (kg)"
                      labelUrdu="مقدار"
                      hint={`Between ${qty(offer.minOrderKg)} and ${qty(offer.remainingKg)}. Paid on delivery via Raast.`}
                    >
                      <input
                        type="number"
                        name="quantityKg"
                        required
                        min={offer.minOrderKg}
                        max={maxOrder}
                        step="1"
                        defaultValue={defaultOrder}
                        className={inputClass}
                      />
                    </Field>
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
