import Link from 'next/link';
import { StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createRetailListing } from '@/lib/actions/retail';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Card, EmptyState, PageHeader, money, qty } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

export default async function NewRetailListingPage() {
  const user = await requireCapability('shopkeeper.retail.manage');

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
      crop: { select: { name: true } },
      sale: {
        select: { offer: { select: { stock: { select: { sourceFarmCity: true } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title="Add a Retail Listing"
        titleUrdu="ریٹیل لسٹنگ"
        subtitle="Price shop stock for customers. The kilograms you list move out of your back-room stock, so the counter can never sell more than you hold."
        action={
          <Link
            href="/storefront"
            className="text-[11px] font-semibold text-agri-900 hover:underline"
          >
            Cancel
          </Link>
        }
      />

      {stocks.length === 0 ? (
        <EmptyState
          title="No unpriced stock"
          message="Everything you hold is already on the counter. Buy more from a vendor to restock the shop."
          actionHref="/wholesale"
          actionLabel="Browse Wholesale Market"
        />
      ) : (
        <Card>
          <ActionForm
            action={createRetailListing}
            submitLabel="Publish listing"
            submitLabelUrdu="لسٹنگ لگائیں"
          >
            <div className="space-y-3">
              <Field
                label="Shop stock"
                labelUrdu="اسٹاک"
                hint="Only lots with unpriced kilograms appear here."
              >
                <select name="stockId" required className={inputClass}>
                  <option value="">Select stock</option>
                  {stocks.map((stock) => (
                    <option key={stock.id} value={stock.id}>
                      {stock.crop.name} {stock.grade} · {qty(stock.availableKg)} · cost{' '}
                      {money(stock.costPerKg)}/kg ({stock.stockNumber})
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="What customers see"
                labelUrdu="نام"
                hint="Mention the origin — customers pay more for produce they can place."
              >
                <input
                  name="title"
                  required
                  placeholder="Fresh Swabi Tomatoes"
                  className={inputClass}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity (kg)" labelUrdu="مقدار">
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
                  label="Retail price (Rs/kg)"
                  labelUrdu="ریٹیل ریٹ"
                  hint="Must be above the lot's cost."
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

              <Field label="Pack size" hint="How customers buy it at the counter.">
                <select name="packSizeKg" defaultValue={1} className={inputClass}>
                  <option value={0.5}>500 g</option>
                  <option value={1}>1 kg</option>
                  <option value={2}>2 kg</option>
                  <option value={5}>5 kg</option>
                </select>
              </Field>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
