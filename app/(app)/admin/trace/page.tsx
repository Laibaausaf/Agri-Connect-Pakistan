import Link from 'next/link';
import { SupplyChainStage, UserRole } from '@prisma/client';
import { requireCapability } from '@/lib/authz';
import { getTraceBatches, getBatchTrace } from '@/lib/actions/admin';
import { Badge, Card, CropThumb, EmptyState, PageHeader, money, qty } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

const STAGE_LABEL: Record<SupplyChainStage, string> = {
  FARMER_HARVEST: 'Harvest logged',
  FARMER_ARHTI_OFFER: 'Arhti offer',
  FARMER_ARHTI_DEAL: 'Deal agreed',
  PICKUP: 'Pickup / transport',
  ARHTI_RECEIPT: 'Received at mandi',
  MANDI_AUCTION: 'Mandi auction',
  ARHTI_VENDOR_SALE: 'Sold to vendor',
  VENDOR_WHOLESALE_OFFER: 'Wholesale listing',
  VENDOR_SHOPKEEPER_SALE: 'Sold to shopkeeper',
  RETAIL_LISTING: 'Retail listing',
  CONSUMER_ORDER: 'Consumer order',
};

const ROLE_LABEL: Record<UserRole, string> = {
  FARMER: 'Farmer',
  ARHTI: 'Arhti',
  VENDOR: 'Vendor',
  SHOPKEEPER: 'Shopkeeper',
  CONSUMER: 'Consumer',
  ADMIN: 'Admin',
};

function when(date: Date) {
  return new Date(date).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function day(date: Date) {
  return new Date(date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function AdminTracePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; batch?: string }>;
}) {
  await requireCapability('admin.trace');
  const { q, batch: batchId } = await searchParams;

  const batches = await getTraceBatches(q);
  const selectedId = batchId ?? batches[0]?.id;
  const trace = selectedId ? await getBatchTrace(selectedId) : null;

  const keep = q ? `&q=${encodeURIComponent(q)}` : '';

  /**
   * Each price point is read off the event that actually recorded the ownership
   * transfer, so the journey is derived from transactions rather than narrated.
   */
  const priceAt = (stage: SupplyChainStage) =>
    trace?.chainEvents.find((e) => e.stage === stage && e.pricePerKg !== null)?.pricePerKg ?? null;

  const farmGate = priceAt(SupplyChainStage.FARMER_ARHTI_DEAL) ?? priceAt(SupplyChainStage.ARHTI_RECEIPT);
  const journey = [
    { label: 'Farm gate', role: 'Farmer → Arhti', price: farmGate },
    { label: 'Mandi auction', role: 'Arhti → Vendor', price: priceAt(SupplyChainStage.ARHTI_VENDOR_SALE) },
    { label: 'Wholesale', role: 'Vendor → Shopkeeper', price: priceAt(SupplyChainStage.VENDOR_SHOPKEEPER_SALE) },
    { label: 'Retail shelf', role: 'Shopkeeper → Consumer', price: priceAt(SupplyChainStage.RETAIL_LISTING) },
  ];
  const retail = journey[3].price;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Supply Chain Trace"
        titleUrdu="سپلائی چین ٹریس"
        subtitle="Follow one crop batch through every ownership transfer — farmer, arhti, vendor, shopkeeper, consumer — with the quantity, rate and transaction reference recorded at each handover."
        action={
          <Link
            href="/admin"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            Back to console
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-xs font-bold text-charcoal">Pick a batch</h2>
          <form action="/admin/trace" className="flex items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ''}
              placeholder="Batch no, crop, farmer, city"
              className="rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-agri-700"
            />
            <button type="submit" className="text-[11px] font-semibold text-agri-900 hover:underline">
              Search
            </button>
            {q && (
              <Link href="/admin/trace" className="text-[11px] text-[#636E72] hover:underline">
                Clear
              </Link>
            )}
          </form>
        </div>

        {batches.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-[#636E72]">
            No crop batches match that search.
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {batches.map((b) => {
              const active = b.id === selectedId;
              return (
                <Link
                  key={b.id}
                  href={`/admin/trace?batch=${b.id}${keep}`}
                  className={`shrink-0 w-52 rounded-xl border p-3 transition-colors ${
                    active
                      ? 'border-agri-900 bg-[#E8F3EE]'
                      : 'border-[#E5E7EB] bg-white hover:bg-[#F8F9F5]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CropThumb imageUrl={b.crop.imageUrl} name={b.crop.name} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-charcoal truncate">{b.crop.name}</div>
                      <div className="text-[10px] text-[#636E72] truncate">{b.batchNumber}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#636E72] mt-2">
                    {b.farmer.name} · {b.originCity}
                  </div>
                  <div className="text-[10px] text-[#636E72]">
                    {qty(b.quantityKg)} harvested · {b._count.chainEvents} events
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {!trace ? (
        <EmptyState
          title="Nothing to trace yet"
          message="Traces are built from real ownership transfers. Once a farmer logs a harvest and an arhti buys it, the chain appears here."
        />
      ) : (
        <>
          <Card className="mb-4">
            <div className="flex items-start gap-3">
              <CropThumb imageUrl={trace.crop.imageUrl} name={trace.crop.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-charcoal">
                    {trace.crop.name}
                    {trace.variety ? ` · ${trace.variety}` : ''}
                  </h2>
                  <Badge tone="neutral">Grade {trace.grade}</Badge>
                  <Badge tone="green">{trace.batchNumber}</Badge>
                </div>
                <div className="text-[11px] text-[#636E72] mt-1">
                  Grown by {trace.farmer.name}
                  {trace.farmer.farmerProfile?.businessName
                    ? ` · ${trace.farmer.farmerProfile.businessName}`
                    : ''}
                </div>
                <div className="text-[11px] text-[#636E72]">
                  {trace.originVillage ? `${trace.originVillage}, ` : ''}
                  {trace.originCity}, {trace.originProvince} · harvested {day(trace.harvestDate)}
                </div>
                <div className="flex gap-4 mt-2 text-[10px] text-[#636E72]">
                  <span>
                    Harvested <span className="font-semibold text-charcoal">{qty(trace.quantityKg)}</span>
                  </span>
                  <span>
                    Unsold <span className="font-semibold text-charcoal">{qty(trace.availableKg)}</span>
                  </span>
                  {trace.askingPricePerKg !== null && (
                    <span>
                      Asked{' '}
                      <span className="font-semibold text-charcoal">
                        {money(trace.askingPricePerKg)}/kg
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="mb-4">
            <h2 className="text-xs font-bold text-charcoal mb-3">Price journey</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {journey.map((step) => {
                const markup =
                  step.price !== null && farmGate ? Math.round(((step.price - farmGate) / farmGate) * 100) : null;
                return (
                  <div
                    key={step.label}
                    className="rounded-xl border border-[#E5E7EB] bg-[#F8F9F5] p-3"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[#636E72] font-bold">
                      {step.label}
                    </div>
                    <div className="text-base font-bold text-charcoal mt-0.5">
                      {step.price !== null ? `${money(step.price)}/kg` : '—'}
                    </div>
                    <div className="text-[10px] text-[#636E72]">{step.role}</div>
                    {markup !== null && markup > 0 && (
                      <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                        +{markup}% over farm gate
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {farmGate !== null && retail !== null && (
              <p className="text-[11px] text-[#636E72] mt-3">
                The farmer received {money(farmGate)}/kg; the consumer pays {money(retail)}/kg — the
                grower keeps {Math.round((farmGate / retail) * 100)}% of the shelf price.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-xs font-bold text-charcoal mb-3">
              Ownership history · {trace.chainEvents.length} recorded events
            </h2>
            {trace.chainEvents.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-[#636E72]">
                This batch has not moved yet.
              </div>
            ) : (
              <ol className="relative border-l border-[#E5E7EB] ml-2">
                {trace.chainEvents.map((event) => (
                  <li key={event.id} className="pl-4 pb-4 last:pb-0 relative">
                    <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-agri-900 border-2 border-white" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-charcoal">{event.title}</span>
                      <Badge tone="neutral">{STAGE_LABEL[event.stage]}</Badge>
                      {event.isConfidential && <Badge tone="amber">Confidential</Badge>}
                    </div>
                    <p className="text-[11px] text-[#636E72] mt-0.5">{event.description}</p>
                    <div className="flex flex-wrap gap-3 text-[10px] text-[#636E72] mt-1">
                      {event.actor && (
                        <span>
                          {event.actorRole ? `${ROLE_LABEL[event.actorRole]}: ` : ''}
                          <span className="font-semibold text-charcoal">{event.actor.name}</span>
                        </span>
                      )}
                      {event.quantityKg !== null && (
                        <span className="font-semibold text-charcoal">{qty(event.quantityKg)}</span>
                      )}
                      {event.pricePerKg !== null && (
                        <span className="font-semibold text-charcoal">{money(event.pricePerKg)}/kg</span>
                      )}
                      <span>{when(event.createdAt)}</span>
                      {event.refType && event.refId && (
                        <span className="font-mono text-[9px] text-[#636E72]/80">
                          {event.refType}#{event.refId.slice(-8)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
