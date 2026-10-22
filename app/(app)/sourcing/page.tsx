import Link from 'next/link';
import { CropBatchStatus, OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createOffer } from '@/lib/actions/sourcing';
import { getI18n } from '@/lib/i18n/server';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
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
  const { t, crop, place, grade, packaging, kg, perKg, date } = await getI18n();

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
    prisma.crop.findMany({ select: { id: true, name: true, nameUrdu: true }, orderBy: { name: 'asc' } }),
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
        title={t('sourcing.title')}
        subtitle={t('sourcing.subtitle')}
        action={
          <Link
            href="/demand/new"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            {t('sourcing.postRequest')}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('sourcing.statBatches')} value={String(batches.length)} />
        <StatCard label={t('sourcing.statVolume')} value={kg(totalAvailable)} tone="accent" />
        <StatCard
          label={t('sourcing.statPending')}
          value={String(batches.filter((b) => b.offers.length > 0).length)}
        />
        <StatCard
          label={t('sourcing.statCommission')}
          value={`${((profile?.commissionRate ?? 0.02) * 100).toFixed(1)}%`}
          hint={t('sourcing.deducted')}
        />
      </div>

      <form className="flex flex-wrap gap-2 mb-4">
        <select name="crop" defaultValue={filters.crop ?? ''} className={`${inputClass} w-auto`}>
          <option value="">{t('common.allCrops')}</option>
          {crops.map((item) => (
            <option key={item.id} value={item.id}>
              {crop(item)}
            </option>
          ))}
        </select>
        <select
          name="province"
          defaultValue={filters.province ?? ''}
          className={`${inputClass} w-auto`}
        >
          <option value="">{t('sourcing.allProvinces')}</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {place(province)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-3 py-2 text-[11px] font-semibold rounded-xl bg-[#F2F4F7] border border-[#E5E7EB] text-charcoal"
        >
          {t('common.filter')}
        </button>
      </form>

      {batches.length === 0 ? (
        <EmptyState
          title={t('sourcing.emptyTitle')}
          message={t('sourcing.emptyMessage')}
          actionHref="/demand/new"
          actionLabel={t('sourcing.postRequest')}
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
                      <span className="text-sm font-bold text-charcoal">{crop(batch.crop)}</span>
                      <Badge tone="neutral">{grade(batch.grade)}</Badge>
                      {existing && <Badge tone="amber">{t('sourcing.offerSent')}</Badge>}
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {batch.farmer.name} · {place([batch.originCity, batch.originProvince].join(', '))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sourcing.uncommitted')}</div>
                        <div className="font-semibold text-charcoal">{kg(batch.availableKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sourcing.asking')}</div>
                        <div className="font-semibold text-agri-900">
                          {batch.askingPricePerKg ? perKg(batch.askingPricePerKg) : t('sourcing.open')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sourcing.harvested')}</div>
                        <div className="font-semibold text-charcoal">
                          {date(batch.harvestDate, { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sourcing.packing')}</div>
                        <div className="font-semibold text-charcoal">{batch.packaging ? packaging(batch.packaging) : '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {existing ? (
                  <div className="mt-3 p-2.5 rounded-lg bg-[#F8F9F5] text-[11px] text-[#636E72]">
                    {t('sourcing.youOffered', { rate: perKg(existing.pricePerKg), qty: kg(existing.quantityKg), name: batch.farmer.name })}
                  </div>
                ) : (
                  <details className="mt-3 group">
                    <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer">
                      {t('sourcing.sendRate')}
                    </summary>
                    <ActionForm
                      action={createOffer}
                      submitLabel={t('sourcing.sendOffer')}
                      successMessage={t('sourcing.sent')}
                      hidden={{ batchId: batch.id }}
                      className="mt-3"
                    >
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label={t('common.qtyKg')}>
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
                          <Field label={t('common.rateRsKg')}>
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
                        <Field label={t('common.destinationMandi')}>
                          <select
                            name="destinationMandiId"
                            required
                            defaultValue={profile?.mandiId ?? ''}
                            className={inputClass}
                          >
                            <option value="">{t('common.selectMandi')}</option>
                            {mandis.map((mandi) => (
                              <option key={mandi.id} value={mandi.id}>
                                {place(mandi.name)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label={t('sourcing.whoTransport')}
                          hint={t('sourcing.transportHint')}
                        >
                          <select
                            name="transportResponsibility"
                            defaultValue="ARHTI"
                            className={inputClass}
                          >
                            <option value="ARHTI">{t('sourcing.tArhti')}</option>
                            <option value="FARMER">{t('sourcing.tFarmer')}</option>
                            <option value="MUTUAL">{t('sourcing.tShared')}</option>
                          </select>
                        </Field>
                        <Field label={t('sourcing.note')}>
                          <input
                            name="note"
                            className={inputClass}
                            placeholder={t('sourcing.notePlaceholder')}
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
