import Link from 'next/link';
import { CropBatchStatus, OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createOffer } from '@/lib/actions/sourcing';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
  money,
  qty,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

export default async function SourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ crop?: string; province?: string }>;
}) {
  const user = await requireCapability('arhti.farmerMarket.browse');
  const filters = await searchParams;

  const [batches, mandis, crops, profile] = await Promise.all([
    prisma.farmerCropBatch.findMany({
      where: {
        status: { in: [CropBatchStatus.READY_FOR_SALE, CropBatchStatus.NEGOTIATING] },
        availableKg: { gt: 0 },
        ...(filters.crop ? { cropId: filters.crop } : {}),
        ...(filters.province ? { originProvince: filters.province } : {}),
      },
      include: {
        crop: true,
        farmer: {
          select: {
            id: true,
            name: true,
            location: true,
            farmerProfile: { select: { village: true, farmAreaAcres: true } },
          },
        },
        offers: {
          where: { arhtiId: user.id, status: OfferStatus.PENDING },
          select: { id: true, pricePerKg: true, quantityKg: true },
        },
      },
      orderBy: { harvestDate: 'desc' },
      take: 40,
    }),
    prisma.mandi.findMany({
      where: { isActive: true },
      select: { id: true, name: true, city: true },
      orderBy: { city: 'asc' },
    }),
    prisma.crop.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.arhtiProfile.findUnique({
      where: { userId: user.id },
      select: { mandiId: true, commissionRate: true },
    }),
  ]);

  const totalAvailable = batches.reduce((sum, b) => sum + b.availableKg, 0);
  const provinces = Array.from(new Set(batches.map((b) => b.originProvince)));

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Farmer Market"
        titleUrdu="کسان منڈی"
        subtitle="Standing produce offered directly by farmers. Send a rate and the farmer accepts or declines — no auction at this stage."
        action={
          <Link
            href="/demand/new"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            Post a buy request
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Batches available" value={String(batches.length)} />
        <StatCard label="Uncommitted volume" value={qty(totalAvailable)} tone="accent" />
        <StatCard
          label="Your pending offers"
          value={String(batches.filter((b) => b.offers.length > 0).length)}
        />
        <StatCard
          label="Your commission"
          value={`${((profile?.commissionRate ?? 0.02) * 100).toFixed(1)}%`}
          hint="Deducted at settlement"
        />
      </div>

      <form className="flex flex-wrap gap-2 mb-4">
        <select name="crop" defaultValue={filters.crop ?? ''} className={`${inputClass} w-auto`}>
          <option value="">All crops</option>
          {crops.map((crop) => (
            <option key={crop.id} value={crop.id}>
              {crop.name}
            </option>
          ))}
        </select>
        <select
          name="province"
          defaultValue={filters.province ?? ''}
          className={`${inputClass} w-auto`}
        >
          <option value="">All provinces</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-3 py-2 text-[11px] font-semibold rounded-xl bg-[#F2F4F7] border border-[#E5E7EB] text-charcoal"
        >
          Filter
        </button>
      </form>

      {batches.length === 0 ? (
        <EmptyState
          title="No farmer produce matches this filter"
          message="Clear the filters or post a buy request so farmers can bring produce to you."
          actionHref="/demand/new"
          actionLabel="Post a buy request"
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {batches.map((batch) => {
            const existing = batch.offers[0];
            const suggested = batch.askingPricePerKg ?? undefined;
            return (
              <Card key={batch.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={firstPhoto(batch.photos) ?? batch.crop.imageUrl}
                    name={batch.crop.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{batch.crop.name}</span>
                      <Badge tone="neutral">{batch.grade}</Badge>
                      {existing && <Badge tone="amber">Offer sent</Badge>}
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {batch.farmer.name} · {batch.originCity}, {batch.originProvince}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Uncommitted</div>
                        <div className="font-semibold text-charcoal">{qty(batch.availableKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Farmer asking</div>
                        <div className="font-semibold text-agri-900">
                          {batch.askingPricePerKg ? `${money(batch.askingPricePerKg)}/kg` : 'Open'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Harvested</div>
                        <div className="font-semibold text-charcoal">
                          {batch.harvestDate.toLocaleDateString('en-PK', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Packing</div>
                        <div className="font-semibold text-charcoal">{batch.packaging ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {existing ? (
                  <div className="mt-3 p-2.5 rounded-lg bg-[#F8F9F5] text-[11px] text-[#636E72]">
                    You offered {money(existing.pricePerKg)}/kg for {qty(existing.quantityKg)}.
                    Waiting on {batch.farmer.name}.
                  </div>
                ) : (
                  <details className="mt-3 group">
                    <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer">
                      Send a rate to this farmer
                    </summary>
                    <ActionForm
                      action={createOffer}
                      submitLabel="Send offer"
                      submitLabelUrdu="ریٹ بھیجیں"
                      successMessage="Offer sent. The farmer will accept or decline it."
                      hidden={{ batchId: batch.id }}
                      className="mt-3"
                    >
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Quantity (kg)" labelUrdu="مقدار">
                            <input
                              type="number"
                              name="quantityKg"
                              required
                              min="1"
                              step="1"
                              max={batch.availableKg}
                              defaultValue={batch.availableKg}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Rate (Rs/kg)" labelUrdu="ریٹ">
                            <input
                              type="number"
                              name="pricePerKg"
                              required
                              min="1"
                              step="0.5"
                              defaultValue={suggested}
                              className={inputClass}
                            />
                          </Field>
                        </div>
                        <Field label="Destination mandi" labelUrdu="منڈی">
                          <select
                            name="destinationMandiId"
                            required
                            defaultValue={profile?.mandiId ?? ''}
                            className={inputClass}
                          >
                            <option value="">Select mandi</option>
                            {mandis.map((mandi) => (
                              <option key={mandi.id} value={mandi.id}>
                                {mandi.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label="Who arranges transport?"
                          hint="This decides who books the truck and who bears the freight."
                        >
                          <select
                            name="transportResponsibility"
                            defaultValue="ARHTI"
                            className={inputClass}
                          >
                            <option value="ARHTI">I arrange and pay</option>
                            <option value="FARMER">Farmer arranges</option>
                            <option value="MUTUAL">Shared 50/50</option>
                          </select>
                        </Field>
                        <Field label="Note to farmer">
                          <input
                            name="note"
                            className={inputClass}
                            placeholder="Rate holds till tomorrow evening"
                          />
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
