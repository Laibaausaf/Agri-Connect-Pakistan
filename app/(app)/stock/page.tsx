import Link from 'next/link';
import { OfferListingStatus, StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createVendorOffer } from '@/lib/actions/wholesale';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
  statusTone,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

export default async function VendorStockPage() {
  const user = await requireCapability('vendor.stock.manage');
  const { t, crop, place, status, grade, kg, perKg, money, number } = await getI18n();

  const [stocks, profile] = await Promise.all([
    prisma.vendorInventory.findMany({
      where: { vendorId: user.id },
      include: {
        crop: true,
        sale: {
          select: {
            saleNumber: true,
            ratePerKg: true,
            quantityKg: true,
            grossAmount: true,
            commission: true,
            createdAt: true,
            auction: { select: { auctionNumber: true, arhti: { select: { name: true } } } },
          },
        },
        offers: {
          select: {
            id: true,
            offerNumber: true,
            remainingKg: true,
            offeredQuantityKg: true,
            pricePerKg: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vendorProfile.findUnique({
      where: { userId: user.id },
      select: { warehouseCity: true, servesCities: true, minOrderKg: true },
    }),
  ]);

  const unlisted = stocks.reduce((sum, s) => sum + s.availableKg, 0);
  const capital = stocks.reduce((sum, s) => sum + s.availableKg * s.costPerKg, 0);
  const listed = stocks.reduce(
    (sum, s) =>
      sum +
      s.offers
        .filter((o) => o.status === OfferListingStatus.ACTIVE)
        .reduce((acc, o) => acc + o.remainingKg, 0),
    0
  );

  const defaultCities = Array.isArray(profile?.servesCities)
    ? profile.servesCities.filter((c): c is string => typeof c === 'string').join(', ')
    : (profile?.warehouseCity ?? '');

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('stock.title')}
        subtitle={t('stock.subtitle')}
        action={
          <Link
            href="/wholesale-shop"
            className="btn btn-outline btn-sm whitespace-nowrap"
          >
            {t('stock.myShop')}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('stock.statLots')} value={String(stocks.length)} />
        <StatCard label={t('stock.statUnlisted')} value={kg(unlisted)} tone="accent" />
        <StatCard label={t('stock.statLive')} value={kg(listed)} />
        <StatCard
          label={t('stock.statCapital')}
          value={money(capital)}
          hint={profile?.warehouseCity ? t('stock.warehouseIn', { city: place(profile.warehouseCity) }) : undefined}
        />
      </div>

      {stocks.length === 0 ? (
        <EmptyState
          title={t('stock.emptyTitle')}
          message={t('stock.emptyMessage')}
          actionHref="/auctions"
          actionLabel={t('stock.browse')}
        />
      ) : (
        <div className="space-y-3">
          {stocks.map((stock) => {
            const activeOffers = stock.offers.filter(
              (o) => o.status === OfferListingStatus.ACTIVE || o.status === OfferListingStatus.PAUSED
            );
            const canList = stock.availableKg > 0 && stock.status !== StockStatus.SOLD_OUT;
            const floor = Math.ceil(stock.costPerKg * 1.1);
            return (
              <Card key={stock.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={firstPhoto(stock.photos) ?? stock.crop.imageUrl}
                    name={stock.crop.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[17px] font-bold text-ink">{crop(stock.crop)}</span>
                      <Badge tone="neutral">{grade(stock.grade)}</Badge>
                      <Badge tone={statusTone(stock.status)}>{status(stock.status)}</Badge>
                    </div>
                    <div className="text-[13px] text-muted font-mono mt-0.5">
                      {stock.stockNumber}
                    </div>
                    <div className="text-[13px] text-muted">
                      {t('stock.origin', { farm: place(stock.sourceFarmCity), mandi: place(stock.sourceMandiCity), arhti: stock.sale.auction.arhti.name })}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-sm">
                      <div>
                        <div className="text-[12.5px] text-muted">{t('stock.won')}</div>
                        <div className="font-semibold text-ink">{kg(stock.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('stock.unlisted')}</div>
                        <div className="font-semibold text-forest">{kg(stock.availableKg)}</div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('stock.costInclCommission')}</div>
                        <div className="font-semibold text-ink">
                          {t('common.perKgExact', { amount: number(stock.costPerKg, 2) })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('stock.auction')}</div>
                        <div className="font-semibold text-ink font-mono truncate">
                          {stock.sale.auction.auctionNumber}
                        </div>
                      </div>
                    </div>
                    <div className="text-[13px] text-muted mt-2">
                      {t('stock.paidLine', {
                        paid: money(stock.sale.grossAmount + stock.sale.commission),
                        value: money(stock.sale.grossAmount),
                        rate: perKg(stock.sale.ratePerKg),
                        commission: money(stock.sale.commission),
                        sale: stock.sale.saleNumber,
                      })}
                    </div>
                  </div>
                </div>

                {activeOffers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-line space-y-1.5">
                    {activeOffers.map((offer) => (
                      <div
                        key={offer.id}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="text-muted">
                          <span className="font-mono">{offer.offerNumber}</span> ·{' '}
                          {t('stock.offerLine', { left: kg(offer.remainingKg), total: kg(offer.offeredQuantityKg), rate: perKg(offer.pricePerKg) })}
                        </span>
                        <Badge tone={offer.status === OfferListingStatus.ACTIVE ? 'green' : 'amber'}>
                          {status(offer.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {canList && (
                  <details className="mt-3 pt-3 border-t border-line">
                    <summary className="flex min-h-12 cursor-pointer items-center text-[15px] font-bold">
                      {t('stock.list')}
                    </summary>
                    <ActionForm
                      action={createVendorOffer}
                      submitLabel={t('wform.publish')}
                      hidden={{ stockId: stock.id }}
                      className="mt-3"
                    >
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field
                          label={t('wform.quantity')}
                          hint={t('wform.upTo', { qty: kg(stock.availableKg) })}
                        >
                          <input
                            type="number"
                            name="offeredQuantityKg"
                            required
                            min="1"
                            step="1"
                            max={stock.availableKg}
                            defaultValue={stock.availableKg}
                            className={inputClass}
                          />
                        </Field>
                        <Field
                          label={t('wform.price')}
                          hint={t('wform.priceHint', { rate: perKg(stock.costPerKg) })}
                        >
                          <input
                            type="number"
                            name="pricePerKg"
                            required
                            min={stock.costPerKg + 1}
                            step="0.5"
                            defaultValue={floor}
                            className={inputClass}
                          />
                        </Field>
                        <Field label={t('wform.minOrder')}>
                          <input
                            type="number"
                            name="minOrderKg"
                            min="1"
                            step="1"
                            defaultValue={profile?.minOrderKg ?? 50}
                            className={inputClass}
                          />
                        </Field>
                        <Field label={t('wform.window')}>
                          <select name="deliveryEtaHours" defaultValue={12} className={inputClass}>
                            <option value={6}>{t('wform.sameDay')}</option>
                            <option value={12}>{t('wform.nextMorning')}</option>
                            <option value={24}>{t('wform.within24')}</option>
                            <option value={48}>{t('wform.within48')}</option>
                          </select>
                        </Field>
                        <div className="sm:col-span-2">
                          <Field
                            label={t('wform.cities')}
                            hint={t('wform.citiesHint')}
                          >
                            <input
                              type="text"
                              name="deliveryCities"
                              defaultValue={defaultCities}
                              placeholder="Islamabad, Rawalpindi"
                              className={inputClass}
                              dir="ltr"
                            />
                          </Field>
                        </div>
                      </div>
                    </ActionForm>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
