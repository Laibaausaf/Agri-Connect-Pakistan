import Link from 'next/link';
import { StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createVendorOffer } from '@/lib/actions/wholesale';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Card, EmptyState, PageHeader } from '@/components/ui/kit';
import { getI18n } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function NewVendorOfferPage() {
  const user = await requireCapability('vendor.offers.manage');
  const { t, crop, place, grade, kg, perKg } = await getI18n();

  const [stocks, profile] = await Promise.all([
    prisma.vendorInventory.findMany({
      where: {
        vendorId: user.id,
        availableKg: { gt: 0 },
        status: { not: StockStatus.SOLD_OUT },
      },
      select: {
        id: true,
        stockNumber: true,
        availableKg: true,
        costPerKg: true,
        grade: true,
        sourceFarmCity: true,
        crop: { select: { name: true, nameUrdu: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vendorProfile.findUnique({
      where: { userId: user.id },
      select: { warehouseCity: true, servesCities: true, minOrderKg: true },
    }),
  ]);

  const defaultCities = Array.isArray(profile?.servesCities)
    ? profile.servesCities.filter((c): c is string => typeof c === 'string').join(', ')
    : (profile?.warehouseCity ?? '');

  const dearest = stocks.reduce((max, s) => Math.max(max, s.costPerKg), 0);

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title={t('wshopNew.title')}
        subtitle={t('wshopNew.subtitle')}
        action={
          <Link
            href="/wholesale-shop"
            className="inline-flex min-h-11 items-center text-sm font-bold hover:underline"
          >
            {t('wshopNew.cancel')}
          </Link>
        }
      />

      {stocks.length === 0 ? (
        <EmptyState
          title={t('wshopNew.emptyTitle')}
          message={t('wshopNew.emptyMessage')}
          actionHref="/auctions"
          actionLabel={t('stock.browse')}
        />
      ) : (
        <Card>
          <ActionForm
            action={createVendorOffer}
            submitLabel={t('wform.publish')}
          >
            <div className="space-y-3">
              <Field
                label={t('wshopNew.lot')}
                hint={t('wshopNew.lotHint')}
              >
                <select name="stockId" required className={inputClass}>
                  <option value="">{t('wshopNew.selectLot')}</option>
                  {stocks.map((stock) => (
                    <option key={stock.id} value={stock.id}>
                      {t('wshopNew.lotOption', {
                        crop: crop(stock.crop),
                        grade: grade(stock.grade),
                        qty: kg(stock.availableKg),
                        rate: perKg(stock.costPerKg),
                        city: place(stock.sourceFarmCity),
                        stock: stock.stockNumber,
                      })}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('wform.quantity')}>
                  <input
                    type="number"
                    name="offeredQuantityKg"
                    required
                    min="1"
                    step="1"
                    placeholder="500"
                    className={inputClass}
                  />
                </Field>
                <Field
                  label={t('wform.price')}
                  hint={t('wshopNew.priceHint', { rate: perKg(dearest) })}
                >
                  <input
                    type="number"
                    name="pricePerKg"
                    required
                    min="1"
                    step="0.5"
                    placeholder="104"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <Field label={t('wform.windowShort')}>
                  <select name="deliveryEtaHours" defaultValue={12} className={inputClass}>
                    <option value={6}>{t('wform.sameDay')}</option>
                    <option value={12}>{t('wform.nextMorning')}</option>
                    <option value={24}>{t('wform.within24')}</option>
                    <option value={48}>{t('wform.within48')}</option>
                  </select>
                </Field>
              </div>

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
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
