import Link from 'next/link';
import { StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createVendorOffer } from '@/lib/actions/wholesale';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Card, EmptyState, PageHeader, money, qty } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

export default async function NewVendorOfferPage() {
  const user = await requireCapability('vendor.offers.manage');

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
        crop: { select: { name: true } },
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
        title="List a Wholesale Offer"
        titleUrdu="تھوک آفر"
        subtitle="Offer part of your warehouse stock to shopkeepers. The kilograms you list are reserved out of the lot, so the same stock can never be sold twice."
        action={
          <Link
            href="/wholesale-shop"
            className="text-[11px] font-semibold text-agri-900 hover:underline"
          >
            Cancel
          </Link>
        }
      />

      {stocks.length === 0 ? (
        <EmptyState
          title="No unlisted stock"
          message="Every kilogram in your warehouse is already on the shelf. Win another mandi auction to bring in fresh stock."
          actionHref="/auctions"
          actionLabel="Browse Live Auctions"
        />
      ) : (
        <Card>
          <ActionForm
            action={createVendorOffer}
            submitLabel="Publish offer"
            submitLabelUrdu="آفر لگائیں"
          >
            <div className="space-y-3">
              <Field
                label="Warehouse lot"
                labelUrdu="گودام کا لاٹ"
                hint="Only lots with unlisted kilograms appear here."
              >
                <select name="stockId" required className={inputClass}>
                  <option value="">Select a lot</option>
                  {stocks.map((stock) => (
                    <option key={stock.id} value={stock.id}>
                      {stock.crop.name} {stock.grade} · {qty(stock.availableKg)} · cost{' '}
                      {money(stock.costPerKg)}/kg · {stock.sourceFarmCity} ({stock.stockNumber})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity to offer (kg)" labelUrdu="مقدار">
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
                  label="Wholesale price (Rs/kg)"
                  labelUrdu="تھوک ریٹ"
                  hint={`Must be above the lot's cost (up to ${money(dearest)}/kg in your warehouse).`}
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
                <Field label="Minimum order (kg)" labelUrdu="کم از کم آرڈر">
                  <input
                    type="number"
                    name="minOrderKg"
                    min="1"
                    step="1"
                    defaultValue={profile?.minOrderKg ?? 50}
                    className={inputClass}
                  />
                </Field>
                <Field label="Delivery window">
                  <select name="deliveryEtaHours" defaultValue={12} className={inputClass}>
                    <option value={6}>Same day (6 h)</option>
                    <option value={12}>Next morning (12 h)</option>
                    <option value={24}>Within 24 hours</option>
                    <option value={48}>Within 2 days</option>
                  </select>
                </Field>
              </div>

              <Field
                label="Delivery cities"
                hint="Comma separated. Shopkeepers in these cities see the offer first."
              >
                <input
                  type="text"
                  name="deliveryCities"
                  defaultValue={defaultCities}
                  placeholder="Islamabad, Rawalpindi"
                  className={inputClass}
                />
              </Field>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
