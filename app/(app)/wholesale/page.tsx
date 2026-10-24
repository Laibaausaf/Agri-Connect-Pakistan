import Link from 'next/link';
import { OfferListingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { purchaseWholesale } from '@/lib/actions/wholesale';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
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
  const { t, crop, place, grade, kg, perKg } = await getI18n();

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
      select: { id: true, name: true, nameUrdu: true },
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
        title={t('wmarket.title')}
        subtitle={t('wmarket.subtitle')}
        action={
          <Link
            href="/shop-stock"
            className="btn btn-outline btn-sm whitespace-nowrap"
          >
            {t('wmarket.myStock')}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('wmarket.statOpen')} value={String(offers.length)} />
        <StatCard
          label={t('wmarket.statDelivers')}
          value={String(deliverable)}
          tone="accent"
          hint={myCity ? place(myCity) : undefined}
        />
        <StatCard label={t('wmarket.statQty')} value={kg(available)} />
        <StatCard label={t('wmarket.statBest')} value={cheapest ? perKg(cheapest) : '—'} />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Link
          href="/wholesale"
          className={`text-[13px] font-semibold px-3 py-1.5 rounded-full border ${
            cropFilter
              ? 'bg-sf text-muted border-line'
              : 'bg-forest text-paper border-forest'
          }`}
        >
          {t('common.allCrops')}
        </Link>
        {crops.map((c) => (
          <Link
            key={c.id}
            href={`/wholesale?crop=${c.id}`}
            className={`text-[13px] font-semibold px-3 py-1.5 rounded-full border ${
              cropFilter === c.id
                ? 'bg-forest text-paper border-forest'
                : 'bg-sf text-muted border-line'
            }`}
          >
            {crop(c)}
          </Link>
        ))}
      </div>

      {ranked.length === 0 ? (
        <EmptyState
          title={t('wmarket.emptyTitle')}
          message={t('wmarket.emptyMessage')}
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
                      <span className="text-[17px] font-bold text-ink">{crop(offer.crop)}</span>
                      <Badge tone="neutral">{grade(offer.grade)}</Badge>
                      {deliversHere && <Badge tone="green">{t('wmarket.deliversTo', { city: place(myCity) })}</Badge>}
                    </div>
                    <div className="text-[13px] text-muted mt-0.5">
                      {offer.vendor.vendorProfile?.businessName ?? offer.vendor.name}
                      {offer.vendor.vendorProfile?.warehouseCity
                        ? ` · ${place(offer.vendor.vendorProfile.warehouseCity)}`
                        : ''}
                      {offer.vendor.vendorProfile?.rating
                        ? ` · ★ ${offer.vendor.vendorProfile.rating.toFixed(1)}`
                        : ''}
                    </div>
                    <div className="text-[13px] text-muted">
                      {t('wmarket.origin', { farm: place(offer.stock.sourceFarmCity), mandi: place(offer.stock.sourceMandiCity) })}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-sm">
                      <div>
                        <div className="text-[12.5px] text-muted">{t('wmarket.rate')}</div>
                        <div className="font-semibold text-forest">
                          {perKg(offer.pricePerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('wmarket.available')}</div>
                        <div className="font-semibold text-ink">{kg(offer.remainingKg)}</div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('wmarket.minOrder')}</div>
                        <div className="font-semibold text-ink">{kg(offer.minOrderKg)}</div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('wmarket.delivery')}</div>
                        <div className="font-semibold text-ink">
                          {t('wmarket.hours', { count: offer.deliveryEtaHours })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <details className="mt-3 pt-3 border-t border-line">
                  <summary className="flex min-h-12 cursor-pointer items-center text-[15px] font-bold">
                    {t('wmarket.order')}
                  </summary>
                  <ActionForm
                    action={purchaseWholesale}
                    submitLabel={t('wmarket.confirm')}
                    successMessage={t('wmarket.ordered')}
                    hidden={{ offerId: offer.id }}
                    className="mt-3"
                  >
                    <Field
                      label={t('common.qtyKg')}
                      hint={t('wmarket.qtyHint', { min: kg(offer.minOrderKg), max: kg(offer.remainingKg) })}
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
