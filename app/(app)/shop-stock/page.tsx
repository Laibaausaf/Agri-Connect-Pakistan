import Link from 'next/link';
import { OfferListingStatus, StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createRetailListing } from '@/lib/actions/retail';
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

export default async function ShopStockPage() {
  const user = await requireCapability('shopkeeper.stock.manage');
  const { t, crop, place, status, grade, kg, perKg, money } = await getI18n();

  const stocks = await prisma.shopkeeperInventory.findMany({
    where: { shopkeeperId: user.id },
    include: {
      crop: true,
      sale: {
        select: {
          saleNumber: true,
          ratePerKg: true,
          vendor: { select: { name: true, vendorProfile: { select: { businessName: true } } } },
          offer: { select: { stock: { select: { sourceFarmCity: true, sourceMandiCity: true } } } },
        },
      },
      listings: {
        select: {
          id: true,
          listingNumber: true,
          title: true,
          remainingKg: true,
          listedQuantityKg: true,
          pricePerKg: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const unlisted = stocks.reduce((sum, s) => sum + s.availableKg, 0);
  const onCounter = stocks.reduce(
    (sum, s) =>
      sum +
      s.listings
        .filter((l) => l.status === OfferListingStatus.ACTIVE)
        .reduce((acc, l) => acc + l.remainingKg, 0),
    0
  );
  const capital = stocks.reduce((sum, s) => sum + s.availableKg * s.costPerKg, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('sstock.title')}
        subtitle={t('sstock.subtitle')}
        action={
          <Link
            href="/storefront"
            className="btn btn-outline btn-sm whitespace-nowrap"
          >
            {t('sstock.storefront')}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('sstock.statLots')} value={String(stocks.length)} />
        <StatCard label={t('sstock.statUnpriced')} value={kg(unlisted)} tone="accent" />
        <StatCard label={t('sstock.statCounter')} value={kg(onCounter)} />
        <StatCard label={t('sstock.statCost')} value={money(capital)} />
      </div>

      {stocks.length === 0 ? (
        <EmptyState
          title={t('sstock.emptyTitle')}
          message={t('sstock.emptyMessage')}
          actionHref="/wholesale"
          actionLabel={t('purchases.emptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {stocks.map((stock) => {
            const canList = stock.availableKg > 0 && stock.status !== StockStatus.SOLD_OUT;
            const suggested = Math.ceil(stock.costPerKg * 1.35);
            const origin = stock.sale.offer.stock;
            const activeListings = stock.listings.filter(
              (l) => l.status === OfferListingStatus.ACTIVE || l.status === OfferListingStatus.PAUSED
            );
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
                      {t('sstock.origin', {
                        farm: place(origin.sourceFarmCity),
                        mandi: place(origin.sourceMandiCity),
                        vendor: stock.sale.vendor.vendorProfile?.businessName ?? stock.sale.vendor.name,
                      })}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-sm">
                      <div>
                        <div className="text-[12.5px] text-muted">{t('sstock.bought')}</div>
                        <div className="font-semibold text-ink">{kg(stock.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('sstock.unlisted')}</div>
                        <div className="font-semibold text-forest">{kg(stock.availableKg)}</div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('sstock.cost')}</div>
                        <div className="font-semibold text-ink">
                          {perKg(stock.costPerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('sstock.wholesaleOrder')}</div>
                        <div className="font-semibold text-ink font-mono truncate">
                          {stock.sale.saleNumber}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {activeListings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-line space-y-1.5">
                    {activeListings.map((listing) => (
                      <div
                        key={listing.id}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="text-muted truncate">
                          {t('sstock.listingLine', { title: listing.title, qty: kg(listing.remainingKg), rate: perKg(listing.pricePerKg) })}
                        </span>
                        <Badge
                          tone={listing.status === OfferListingStatus.ACTIVE ? 'green' : 'amber'}
                        >
                          {status(listing.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {canList && (
                  <details className="mt-3 pt-3 border-t border-line">
                    <summary className="flex min-h-12 cursor-pointer items-center text-[15px] font-bold">
                      {t('sstock.putOnCounter')}
                    </summary>
                    <ActionForm
                      action={createRetailListing}
                      submitLabel={t('retailForm.publish')}
                      hidden={{ stockId: stock.id }}
                      className="mt-3"
                    >
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <Field label={t('retailForm.title')}>
                            <input
                              name="title"
                              required
                              defaultValue={`Fresh ${stock.crop.name} — ${origin.sourceFarmCity}`}
                              className={inputClass}
                            />
                          </Field>
                        </div>
                        <Field
                          label={t('common.qtyKg')}
                          hint={t('retailForm.upTo', { qty: kg(stock.availableKg) })}
                        >
                          <input
                            type="number"
                            name="listedQuantityKg"
                            required
                            min="1"
                            step="1"
                            max={stock.availableKg}
                            defaultValue={stock.availableKg}
                            className={inputClass}
                          />
                        </Field>
                        <Field
                          label={t('retailForm.price')}
                          hint={t('retailForm.priceHint', { rate: perKg(stock.costPerKg) })}
                        >
                          <input
                            type="number"
                            name="pricePerKg"
                            required
                            min={stock.costPerKg + 1}
                            step="1"
                            defaultValue={suggested}
                            className={inputClass}
                          />
                        </Field>
                        <Field label={t('retailForm.pack')} hint={t('retailForm.packHint')}>
                          <select name="packSizeKg" defaultValue={1} className={inputClass}>
                            <option value={0.5}>{t('retailForm.g500')}</option>
                            <option value={1}>{t('retailForm.kg1')}</option>
                            <option value={2}>{t('retailForm.kg2')}</option>
                            <option value={5}>{t('retailForm.kg5')}</option>
                          </select>
                        </Field>
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
