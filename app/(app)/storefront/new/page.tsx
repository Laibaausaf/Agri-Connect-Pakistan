import Link from 'next/link';
import { StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createRetailListing } from '@/lib/actions/retail';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Card, EmptyState, PageHeader } from '@/components/ui/kit';
import { getI18n } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function NewRetailListingPage() {
  const user = await requireCapability('shopkeeper.retail.manage');
  const { t, crop, grade, kg, perKg } = await getI18n();

  const stocks = await prisma.shopkeeperInventory.findMany({
    where: {
      shopkeeperId: user.id,
      availableKg: { gt: 0 },
      status: { not: StockStatus.SOLD_OUT },
    },
    select: {
      id: true,
      stockNumber: true,
      availableKg: true,
      costPerKg: true,
      grade: true,
      crop: { select: { name: true, nameUrdu: true } },
      sale: {
        select: { offer: { select: { stock: { select: { sourceFarmCity: true } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title={t('storefrontNew.title')}
        subtitle={t('storefrontNew.subtitle')}
        action={
          <Link
            href="/storefront"
            className="inline-flex min-h-11 items-center text-sm font-bold hover:underline"
          >
            {t('storefrontNew.cancel')}
          </Link>
        }
      />

      {stocks.length === 0 ? (
        <EmptyState
          title={t('storefrontNew.emptyTitle')}
          message={t('storefrontNew.emptyMessage')}
          actionHref="/wholesale"
          actionLabel={t('purchases.emptyAction')}
        />
      ) : (
        <Card>
          <ActionForm
            action={createRetailListing}
            submitLabel={t('retailForm.publish')}
          >
            <div className="space-y-3">
              <Field
                label={t('storefrontNew.stock')}
                hint={t('storefrontNew.stockHint')}
              >
                <select name="stockId" required className={inputClass}>
                  <option value="">{t('storefrontNew.selectStock')}</option>
                  {stocks.map((stock) => (
                    <option key={stock.id} value={stock.id}>
                      {t('storefrontNew.stockOption', {
                        crop: crop(stock.crop),
                        grade: grade(stock.grade),
                        qty: kg(stock.availableKg),
                        rate: perKg(stock.costPerKg),
                        stock: stock.stockNumber,
                      })}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label={t('retailForm.title')}
                hint={t('storefrontNew.titleHint')}
              >
                <input
                  name="title"
                  required
                  placeholder={t('storefrontNew.titlePlaceholder')}
                  className={inputClass}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('common.qtyKg')}>
                  <input
                    type="number"
                    name="listedQuantityKg"
                    required
                    min="1"
                    step="1"
                    placeholder="150"
                    className={inputClass}
                  />
                </Field>
                <Field
                  label={t('retailForm.price')}
                  hint={t('storefrontNew.priceHint')}
                >
                  <input
                    type="number"
                    name="pricePerKg"
                    required
                    min="1"
                    step="1"
                    placeholder="145"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label={t('storefrontNew.pack')} hint={t('storefrontNew.packHint')}>
                <select name="packSizeKg" defaultValue={1} className={inputClass}>
                  <option value={0.5}>{t('retailForm.g500')}</option>
                  <option value={1}>{t('retailForm.kg1')}</option>
                  <option value={2}>{t('retailForm.kg2')}</option>
                  <option value={5}>{t('retailForm.kg5')}</option>
                </select>
              </Field>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
