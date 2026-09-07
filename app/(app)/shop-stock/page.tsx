import Link from 'next/link';
import { OfferListingStatus, StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createRetailListing } from '@/lib/actions/retail';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
  humanStatus,
  money,
  qty,
  statusTone,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

export default async function ShopStockPage() {
  const user = await requireCapability('shopkeeper.stock.manage');

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
        title="Shop Stock"
        titleUrdu="دکان کا اسٹاک"
        subtitle="What you own behind the counter. Put a retail price on it and customers nearby can order it on the app."
        action={
          <Link
            href="/storefront"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            My Storefront
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Lots in shop" value={String(stocks.length)} />
        <StatCard label="Not yet priced" value={qty(unlisted)} tone="accent" />
        <StatCard label="On the counter" value={qty(onCounter)} />
        <StatCard label="Stock at cost" value={money(capital)} />
      </div>

      {stocks.length === 0 ? (
        <EmptyState
          title="Nothing in the shop yet"
          message="Buy from a vendor on the wholesale market and the stock arrives here with its farm and mandi history attached."
          actionHref="/wholesale"
          actionLabel="Browse Wholesale Market"
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
                      <span className="text-sm font-bold text-charcoal">{stock.crop.name}</span>
                      <Badge tone="neutral">{stock.grade}</Badge>
                      <Badge tone={statusTone(stock.status)}>{humanStatus(stock.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {stock.stockNumber}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      Grown in {origin.sourceFarmCity} · {origin.sourceMandiCity} mandi · bought from{' '}
                      {stock.sale.vendor.vendorProfile?.businessName ?? stock.sale.vendor.name}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Bought</div>
                        <div className="font-semibold text-charcoal">{qty(stock.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Unlisted</div>
                        <div className="font-semibold text-agri-900">{qty(stock.availableKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Your cost</div>
                        <div className="font-semibold text-charcoal">
                          {money(stock.costPerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Wholesale order</div>
                        <div className="font-semibold text-charcoal font-mono truncate">
                          {stock.sale.saleNumber}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {activeListings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB] space-y-1.5">
                    {activeListings.map((listing) => (
                      <div
                        key={listing.id}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="text-[#636E72] truncate">
                          {listing.title} · {qty(listing.remainingKg)} left at{' '}
                          {money(listing.pricePerKg)}/kg
                        </span>
                        <Badge
                          tone={listing.status === OfferListingStatus.ACTIVE ? 'green' : 'amber'}
                        >
                          {humanStatus(listing.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {canList && (
                  <details className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer">
                      Put this on the counter for customers
                    </summary>
                    <ActionForm
                      action={createRetailListing}
                      submitLabel="Publish listing"
                      submitLabelUrdu="لسٹنگ لگائیں"
                      hidden={{ stockId: stock.id }}
                      className="mt-3"
                    >
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <Field label="What customers see" labelUrdu="نام">
                            <input
                              name="title"
                              required
                              defaultValue={`Fresh ${stock.crop.name} — ${origin.sourceFarmCity}`}
                              className={inputClass}
                            />
                          </Field>
                        </div>
                        <Field
                          label="Quantity (kg)"
                          labelUrdu="مقدار"
                          hint={`Up to ${qty(stock.availableKg)}`}
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
                          label="Retail price (Rs/kg)"
                          labelUrdu="ریٹیل ریٹ"
                          hint={`Must be above your ${money(stock.costPerKg)}/kg cost`}
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
                        <Field label="Pack size (kg)" hint="How customers buy it — 1 kg, 5 kg crate.">
                          <select name="packSizeKg" defaultValue={1} className={inputClass}>
                            <option value={0.5}>500 g</option>
                            <option value={1}>1 kg</option>
                            <option value={2}>2 kg</option>
                            <option value={5}>5 kg</option>
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
