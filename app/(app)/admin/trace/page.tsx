import Link from 'next/link';
import { SupplyChainStage, UserRole } from '@prisma/client';
import { requireCapability } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import { getTraceBatches, getBatchTrace } from '@/lib/actions/admin';
import { Badge, Card, CropThumb, EmptyState, PageHeader } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

const STAGE_LABEL = {
  FARMER_HARVEST: 'trace.stage.FARMER_HARVEST',
  FARMER_ARHTI_OFFER: 'trace.stage.FARMER_ARHTI_OFFER',
  FARMER_ARHTI_DEAL: 'trace.stage.FARMER_ARHTI_DEAL',
  PICKUP: 'trace.stage.PICKUP',
  ARHTI_RECEIPT: 'trace.stage.ARHTI_RECEIPT',
  MANDI_AUCTION: 'trace.stage.MANDI_AUCTION',
  ARHTI_VENDOR_SALE: 'trace.stage.ARHTI_VENDOR_SALE',
  VENDOR_WHOLESALE_OFFER: 'trace.stage.VENDOR_WHOLESALE_OFFER',
  VENDOR_SHOPKEEPER_SALE: 'trace.stage.VENDOR_SHOPKEEPER_SALE',
  RETAIL_LISTING: 'trace.stage.RETAIL_LISTING',
  CONSUMER_ORDER: 'trace.stage.CONSUMER_ORDER',
} as const satisfies Record<SupplyChainStage, string>;

const ROLE_LABEL = {
  FARMER: 'trace.role.FARMER',
  ARHTI: 'trace.role.ARHTI',
  VENDOR: 'trace.role.VENDOR',
  SHOPKEEPER: 'trace.role.SHOPKEEPER',
  CONSUMER: 'trace.role.CONSUMER',
  ADMIN: 'trace.role.ADMIN',
} as const satisfies Record<UserRole, string>;

export default async function AdminTracePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; batch?: string }>;
}) {
  await requireCapability('admin.trace');
  const { q, batch: batchId } = await searchParams;
  const { t, isUrdu, crop, place, grade, kg, perKg, number, dateTime, date, storedText } = await getI18n();
  const when = (value: Date) => dateTime(value, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const day = (value: Date) => date(value, { day: 'numeric', month: 'short', year: 'numeric' });

  const batches = await getTraceBatches(q);
  const selectedId = batchId ?? batches[0]?.id;
  const trace = selectedId ? await getBatchTrace(selectedId) : null;
  const cropNames = isUrdu
    ? Object.fromEntries(
        (await prisma.crop.findMany({ select: { name: true, nameUrdu: true } }))
          .filter((c) => c.nameUrdu)
          .map((c) => [c.name, c.nameUrdu as string])
      )
    : {};

  const keep = q ? `&q=${encodeURIComponent(q)}` : '';

  /**
   * Each price point is read off the event that actually recorded the ownership
   * transfer, so the journey is derived from transactions rather than narrated.
   */
  const priceAt = (stage: SupplyChainStage) =>
    trace?.chainEvents.find((e) => e.stage === stage && e.pricePerKg !== null)?.pricePerKg ?? null;

  const farmGate = priceAt(SupplyChainStage.FARMER_ARHTI_DEAL) ?? priceAt(SupplyChainStage.ARHTI_RECEIPT);

  // The auction price is what the lot sold for; the vendor also paid the
  // arhti's commission on top, read from the sale itself.
  const saleEvent = trace?.chainEvents.find((e) => e.stage === SupplyChainStage.ARHTI_VENDOR_SALE && e.refId);
  const sale = saleEvent?.refId
    ? await prisma.arhtiVendorSale.findUnique({
        where: { id: saleEvent.refId },
        select: { commission: true, quantityKg: true },
      })
    : null;
  const commissionNote =
    sale && sale.quantityKg > 0 && sale.commission > 0
      ? t('trace.commissionNote', { amount: number(sale.commission / sale.quantityKg, 2) })
      : null;

  const journey = [
    { label: t('trace.farmGate'), role: t('trace.farmerArhti'), price: farmGate },
    { label: t('trace.mandiAuction'), role: t('trace.arhtiVendor'), price: priceAt(SupplyChainStage.ARHTI_VENDOR_SALE), note: commissionNote },
    { label: t('trace.wholesale'), role: t('trace.vendorShop'), price: priceAt(SupplyChainStage.VENDOR_SHOPKEEPER_SALE) },
    { label: t('trace.retailShelf'), role: t('trace.shopConsumer'), price: priceAt(SupplyChainStage.RETAIL_LISTING) },
  ];
  const retail = journey[3].price;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={t('trace.title')}
        subtitle={t('trace.subtitle')}
        action={
          <Link
            href="/admin"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            {t('trace.back')}
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-xs font-bold text-charcoal">{t('trace.pick')}</h2>
          <form action="/admin/trace" className="flex items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ''}
              placeholder={t('trace.searchPlaceholder')}
              className="rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-agri-700"
            />
            <button type="submit" className="text-[11px] font-semibold text-agri-900 hover:underline">
              {t('admin.search')}
            </button>
            {q && (
              <Link href="/admin/trace" className="text-[11px] text-[#636E72] hover:underline">
                {t('admin.clear')}
              </Link>
            )}
          </form>
        </div>

        {batches.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-[#636E72]">
            {t('trace.noMatch')}
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
                      <div className="text-xs font-semibold text-charcoal truncate">{crop(b.crop)}</div>
                      <div className="text-[10px] text-[#636E72] truncate">{b.batchNumber}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#636E72] mt-2">
                    {b.farmer.name} · {place(b.originCity)}
                  </div>
                  <div className="text-[10px] text-[#636E72]">
                    {t('trace.batchLine', { qty: kg(b.quantityKg), count: b._count.chainEvents })}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {!trace ? (
        <EmptyState
          title={t('trace.emptyTitle')}
          message={t('trace.emptyMessage')}
        />
      ) : (
        <>
          <Card className="mb-4">
            <div className="flex items-start gap-3">
              <CropThumb imageUrl={trace.crop.imageUrl} name={trace.crop.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-charcoal">
                    {crop(trace.crop)}
                    {trace.variety ? ` · ${trace.variety}` : ''}
                  </h2>
                  <Badge tone="neutral">{isUrdu ? grade(trace.grade) : t('trace.grade', { grade: trace.grade })}</Badge>
                  <Badge tone="green">{trace.batchNumber}</Badge>
                </div>
                <div className="text-[11px] text-[#636E72] mt-1">
                  {t('trace.grownBy', { name: trace.farmer.name })}
                  {trace.farmer.farmerProfile?.businessName
                    ? ` · ${trace.farmer.farmerProfile.businessName}`
                    : ''}
                </div>
                <div className="text-[11px] text-[#636E72]">
                  {trace.originVillage ? `${place(trace.originVillage)}${t('common.listSep')}` : ''}
                  {place(trace.originCity)}{t('common.listSep')}{place(trace.originProvince)} ·{' '}
                  {t('trace.harvestedOn', { date: day(trace.harvestDate) })}
                </div>
                <div className="flex gap-4 mt-2 text-[10px] text-[#636E72]">
                  <span>
                    {t('trace.harvested')} <span className="font-semibold text-charcoal">{kg(trace.quantityKg)}</span>
                  </span>
                  <span>
                    {t('trace.unsold')} <span className="font-semibold text-charcoal">{kg(trace.availableKg)}</span>
                  </span>
                  {trace.askingPricePerKg !== null && (
                    <span>
                      {t('trace.asked')}{' '}
                      <span className="font-semibold text-charcoal">
                        {perKg(trace.askingPricePerKg)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="mb-4">
            <h2 className="text-xs font-bold text-charcoal mb-3">{t('trace.priceJourney')}</h2>
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
                      {step.price !== null ? perKg(step.price) : '—'}
                    </div>
                    <div className="text-[10px] text-[#636E72]">{step.role}</div>
                    {'note' in step && step.note && (
                      <div className="text-[10px] text-[#636E72]">{step.note}</div>
                    )}
                    {markup !== null && markup > 0 && (
                      <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                        {t('trace.markup', { pct: markup })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {farmGate !== null && retail !== null && (
              <p className="text-[11px] text-[#636E72] mt-3">
                {t('trace.summary', {
                  farm: perKg(farmGate),
                  retail: perKg(retail),
                  pct: Math.round((farmGate / retail) * 100),
                })}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-xs font-bold text-charcoal mb-3">
              {t('trace.history', { count: trace.chainEvents.length })}
            </h2>
            {trace.chainEvents.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-[#636E72]">
                {t('trace.notMoved')}
              </div>
            ) : (
              <ol className="relative border-s border-[#E5E7EB] ms-2">
                {trace.chainEvents.map((event) => (
                  <li key={event.id} className="ps-4 pb-4 last:pb-0 relative">
                    <span className="absolute -start-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-agri-900 border-2 border-white" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-charcoal">{storedText(event.title, cropNames)}</span>
                      <Badge tone="neutral">{t(STAGE_LABEL[event.stage])}</Badge>
                      {event.isConfidential && <Badge tone="amber">{t('trace.confidential')}</Badge>}
                    </div>
                    <p className="text-[11px] text-[#636E72] mt-0.5">{storedText(event.description, cropNames)}</p>
                    <div className="flex flex-wrap gap-3 text-[10px] text-[#636E72] mt-1">
                      {event.actor && (
                        <span>
                          {event.actorRole ? `${t(ROLE_LABEL[event.actorRole])}: ` : ''}
                          <span className="font-semibold text-charcoal">{event.actor.name}</span>
                        </span>
                      )}
                      {event.quantityKg !== null && (
                        <span className="font-semibold text-charcoal">{kg(event.quantityKg)}</span>
                      )}
                      {event.pricePerKg !== null && (
                        <span className="font-semibold text-charcoal">{perKg(event.pricePerKg)}</span>
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
