import Link from 'next/link';
import { OfferListingStatus, StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createVendorOffer } from '@/lib/actions/wholesale';
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

export default async function VendorStockPage() {
  const user = await requireCapability('vendor.stock.manage');

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
        title="My Warehouse"
        titleUrdu="گودام"
        subtitle="Every lot you won in a mandi auction lands here under your ownership. List any uncommitted kilograms on your wholesale shop for shopkeepers to buy."
        action={
          <Link
            href="/wholesale-shop"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            My Wholesale Shop
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Lots in warehouse" value={String(stocks.length)} />
        <StatCard label="Unlisted stock" value={qty(unlisted)} tone="accent" />
        <StatCard label="Live on shop" value={qty(listed)} />
        <StatCard
          label="Capital at cost"
          value={money(capital)}
          hint={profile?.warehouseCity ? `${profile.warehouseCity} warehouse` : undefined}
        />
      </div>

      {stocks.length === 0 ? (
        <EmptyState
          title="Warehouse is empty"
          message="Win a mandi auction and the arhti's lot transfers into your warehouse automatically, with the farm and mandi it came from attached."
          actionHref="/auctions"
          actionLabel="Browse Live Auctions"
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
                      <span className="text-sm font-bold text-charcoal">{stock.crop.name}</span>
                      <Badge tone="neutral">{stock.grade}</Badge>
                      <Badge tone={statusTone(stock.status)}>{humanStatus(stock.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {stock.stockNumber}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      Grown in {stock.sourceFarmCity} · bought at {stock.sourceMandiCity} mandi from{' '}
                      {stock.sale.auction.arhti.name}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Won</div>
                        <div className="font-semibold text-charcoal">{qty(stock.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Unlisted</div>
                        <div className="font-semibold text-agri-900">{qty(stock.availableKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Auction cost</div>
                        <div className="font-semibold text-charcoal">
                          {money(stock.costPerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Auction</div>
                        <div className="font-semibold text-charcoal font-mono truncate">
                          {stock.sale.auction.auctionNumber}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {activeOffers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB] space-y-1.5">
                    {activeOffers.map((offer) => (
                      <div
                        key={offer.id}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="text-[#636E72]">
                          <span className="font-mono">{offer.offerNumber}</span> ·{' '}
                          {qty(offer.remainingKg)} left of {qty(offer.offeredQuantityKg)} at{' '}
                          {money(offer.pricePerKg)}/kg
                        </span>
                        <Badge tone={offer.status === OfferListingStatus.ACTIVE ? 'green' : 'amber'}>
                          {humanStatus(offer.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {canList && (
                  <details className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer">
                      List this stock on my wholesale shop
                    </summary>
                    <ActionForm
                      action={createVendorOffer}
                      submitLabel="Publish offer"
                      submitLabelUrdu="آفر لگائیں"
                      hidden={{ stockId: stock.id }}
                      className="mt-3"
                    >
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field
                          label="Quantity to offer (kg)"
                          labelUrdu="مقدار"
                          hint={`Up to ${qty(stock.availableKg)}`}
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
                          label="Wholesale price (Rs/kg)"
                          labelUrdu="تھوک ریٹ"
                          hint={`Must be above your ${money(stock.costPerKg)}/kg cost`}
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
                        <Field label="Minimum order (kg)">
                          <input
                            type="number"
                            name="minOrderKg"
                            min="1"
                            step="1"
                            defaultValue={profile?.minOrderKg ?? 50}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Delivery window (hours)">
                          <select name="deliveryEtaHours" defaultValue={12} className={inputClass}>
                            <option value={6}>Same day (6 h)</option>
                            <option value={12}>Next morning (12 h)</option>
                            <option value={24}>Within 24 hours</option>
                            <option value={48}>Within 2 days</option>
                          </select>
                        </Field>
                        <div className="sm:col-span-2">
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
