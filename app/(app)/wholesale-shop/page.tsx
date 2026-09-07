import Link from 'next/link';
import { OfferListingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { setVendorOfferStatus } from '@/lib/actions/wholesale';
import ActionForm from '@/components/ui/ActionForm';
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
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

function cities(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

export default async function WholesaleShopPage() {
  const user = await requireCapability('vendor.offers.manage');

  const offers = await prisma.vendorOffer.findMany({
    where: { vendorId: user.id },
    include: {
      crop: true,
      stock: {
        select: { stockNumber: true, costPerKg: true, sourceFarmCity: true, sourceMandiCity: true },
      },
      sales: {
        select: {
          id: true,
          saleNumber: true,
          quantityKg: true,
          ratePerKg: true,
          grossAmount: true,
          createdAt: true,
          shopkeeper: {
            select: { name: true, shopkeeperProfile: { select: { shopName: true, city: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const open = offers.filter(
    (o) => o.status === OfferListingStatus.ACTIVE || o.status === OfferListingStatus.PAUSED
  );
  const closed = offers.filter(
    (o) => o.status === OfferListingStatus.SOLD_OUT || o.status === OfferListingStatus.CLOSED
  );

  const onShelf = open.reduce((sum, o) => sum + o.remainingKg, 0);
  const soldKg = offers.reduce(
    (sum, o) => sum + o.sales.reduce((acc, s) => acc + s.quantityKg, 0),
    0
  );
  const revenue = offers.reduce(
    (sum, o) => sum + o.sales.reduce((acc, s) => acc + s.grossAmount, 0),
    0
  );
  const margin = offers.reduce(
    (sum, o) =>
      sum + o.sales.reduce((acc, s) => acc + s.quantityKg * (s.ratePerKg - o.stock.costPerKg), 0),
    0
  );

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="My Wholesale Shop"
        titleUrdu="تھوک دکان"
        subtitle="What shopkeepers see when they browse the wholesale market. Pause an offer to take it off the shelf without losing the stock."
        action={
          <Link
            href="/wholesale-shop/new"
            className="bg-agri-900 hover:bg-agri-800 text-white text-[11px] font-semibold px-3 py-2 rounded-xl whitespace-nowrap"
          >
            List Wholesale Offer
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Offers on shelf" value={String(open.length)} />
        <StatCard label="Available to sell" value={qty(onShelf)} tone="accent" />
        <StatCard label="Sold to shopkeepers" value={qty(soldKg)} />
        <StatCard
          label="Revenue"
          value={money(revenue)}
          hint={soldKg > 0 ? `${money(margin)} margin over mandi cost` : undefined}
        />
      </div>

      {offers.length === 0 ? (
        <EmptyState
          title="Your shop shelf is empty"
          message="List warehouse stock as a wholesale offer and shopkeepers in your delivery cities can order it straight away."
          actionHref="/stock"
          actionLabel="Open My Warehouse"
        />
      ) : (
        <div className="space-y-3">
          {open.map((offer) => {
            const sold = offer.offeredQuantityKg - offer.remainingKg;
            const marginPerKg = offer.pricePerKg - offer.stock.costPerKg;
            const isActive = offer.status === OfferListingStatus.ACTIVE;
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
                      <Badge tone={isActive ? 'green' : 'amber'}>{humanStatus(offer.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {offer.offerNumber} · {offer.stock.stockNumber}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      From {offer.stock.sourceFarmCity} via {offer.stock.sourceMandiCity} mandi ·
                      delivers in {offer.deliveryEtaHours} h to{' '}
                      {cities(offer.deliveryCities).join(', ') || 'any city'}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Your price</div>
                        <div className="font-semibold text-agri-900">
                          {money(offer.pricePerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Mandi cost</div>
                        <div className="font-semibold text-charcoal">
                          {money(offer.stock.costPerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Margin</div>
                        <div className="font-semibold text-charcoal">
                          +{money(marginPerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Remaining</div>
                        <div className="font-semibold text-charcoal">
                          {qty(offer.remainingKg)}
                          <span className="text-[10px] font-normal text-[#636E72]">
                            {' '}
                            of {qty(offer.offeredQuantityKg)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[#F2F4F7] overflow-hidden">
                      <div
                        className="h-full bg-agri-900"
                        style={{
                          width: `${Math.min(100, Math.round((sold / offer.offeredQuantityKg) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-[#636E72] mt-1">
                      {qty(sold)} sold · minimum order {qty(offer.minOrderKg)}
                    </div>
                  </div>
                </div>

                {offer.sales.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB] space-y-1.5">
                    {offer.sales.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="text-[#636E72] truncate">
                          {sale.shopkeeper.shopkeeperProfile?.shopName ?? sale.shopkeeper.name}
                          {sale.shopkeeper.shopkeeperProfile?.city
                            ? `, ${sale.shopkeeper.shopkeeperProfile.city}`
                            : ''}{' '}
                          · {qty(sale.quantityKg)}
                        </span>
                        <span className="font-semibold text-charcoal whitespace-nowrap">
                          {money(sale.grossAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                  <ActionForm
                    action={setVendorOfferStatus}
                    submitLabel={isActive ? 'Take off shelf' : 'Put back on shelf'}
                    variant={isActive ? 'secondary' : 'inline'}
                    hidden={{ offerId: offer.id, status: isActive ? 'PAUSED' : 'ACTIVE' }}
                  />
                </div>
              </Card>
            );
          })}

          {closed.length > 0 && (
            <div className="pt-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#636E72] mb-2">
                Cleared offers
              </h2>
              <Card padded={false}>
                <div className="divide-y divide-[#E5E7EB]">
                  {closed.map((offer) => (
                    <div
                      key={offer.id}
                      className="p-3 flex items-center justify-between gap-3 text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-charcoal">
                          {offer.crop.name} · {qty(offer.offeredQuantityKg)}
                        </div>
                        <div className="text-[#636E72] font-mono">{offer.offerNumber}</div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="font-semibold text-charcoal">
                          {money(offer.pricePerKg)}/kg
                        </div>
                        <Badge tone="neutral">{humanStatus(offer.status)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
