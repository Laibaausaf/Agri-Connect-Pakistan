import Link from 'next/link';
import { CropBatchStatus, OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createOffer } from '@/lib/actions/sourcing';
import { getI18n } from '@/lib/i18n/server';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Badge, CropThumb, EmptyState, PageHeader, StatCard, statusTone } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';

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
  const { t, crop, place, grade, packaging, kg, perKg, date, status } = await getI18n();

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
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('sourcing.title')}
        subtitle={t('sourcing.subtitle')}
        action={
          <Link href="/demand/new" className="btn btn-outline btn-sm hidden sm:inline-flex">
            <Icon name="send" size={16} />
            {t('sourcing.postRequest')}
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('sourcing.statBatches')} value={String(batches.length)} />
        <StatCard label={t('sourcing.statVolume')} value={kg(totalAvailable)} tone="accent" />
        <StatCard label={t('sourcing.statPending')} value={String(batches.filter((b) => b.offers.length > 0).length)} />
        <StatCard
          label={t('sourcing.statCommission')}
          value={`${((profile?.commissionRate ?? 0.02) * 100).toFixed(1)}%`}
          hint={t('sourcing.deducted')}
        />
      </div>

      <form className="mb-5 flex flex-wrap items-end gap-2">
        <select name="crop" defaultValue={filters.crop ?? ''} className={`field-input w-auto min-w-[160px]`} aria-label={t('common.allCrops')}>
          <option value="">{t('common.allCrops')}</option>
          {crops.map((item) => (
            <option key={item.id} value={item.id}>
              {crop(item)}
            </option>
          ))}
        </select>
        <select name="province" defaultValue={filters.province ?? ''} className={`field-input w-auto min-w-[180px]`} aria-label={t('sourcing.allProvinces')}>
          <option value="">{t('sourcing.allProvinces')}</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {place(province)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary min-h-[52px]">
          <Icon name="search" size={18} />
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
        <div className="grid items-start gap-4 md:grid-cols-2">
          {batches.map((batch) => {
            const existing = batch.offers[0];
            const suggested = batch.askingPricePerKg ?? undefined;
            return (
              <article key={batch.id} className="card overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <CropThumb imageUrl={firstPhoto(batch.photos) ?? batch.crop.imageUrl} name={batch.crop.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[17px] font-bold leading-snug">
                        {crop(batch.crop)} · {kg(batch.availableKg)}
                      </span>
                      <span className="tabular shrink-0 text-lg font-extrabold">
                        {batch.askingPricePerKg ? perKg(batch.askingPricePerKg) : t('sourcing.open')}
                      </span>
                    </div>
                    <div className="text-[13px] text-muted">
                      <span className="font-mono">{batch.batchNumber}</span> · {batch.farmer.name}
                    </div>
                    <div className="text-[13px] text-muted">{place([batch.originCity, batch.originProvince].join(', '))}</div>
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-[12.5px] text-muted">{t('sourcing.uncommitted')}</dt>
                        <dd className="font-bold">{kg(batch.availableKg)}</dd>
                      </div>
                      <div>
                        <dt className="text-[12.5px] text-muted">{t('sourcing.harvested')}</dt>
                        <dd className="font-bold">{date(batch.harvestDate, { day: 'numeric', month: 'short' })}</dd>
                      </div>
                      <div>
                        <dt className="text-[12.5px] text-muted">{t('sourcing.packing')}</dt>
                        <dd className="truncate font-bold">{batch.packaging ? packaging(batch.packaging) : '—'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {existing ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper px-4 py-3">
                    <Badge tone="neutral">{grade(batch.grade)}</Badge>
                    <Badge tone="amber">{t('sourcing.offerSent')}</Badge>
                    <p className="w-full text-[13px] text-muted">
                      {t('sourcing.youOffered', { rate: perKg(existing.pricePerKg), qty: kg(existing.quantityKg), name: batch.farmer.name })}
                    </p>
                  </div>
                ) : (
                  <details className="border-t border-line [&[open]>summary_.chev]:rotate-90">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 bg-paper px-4">
                      <Badge tone={statusTone(batch.status)}>{status(batch.status)}</Badge>
                      <Badge tone="neutral">{grade(batch.grade)}</Badge>
                      <span className="flex-1" />
                      <span className="text-sm font-bold">{t('sourcing.sendOffer')}</span>
                      <Icon name="chevronright" size={18} className="chev transition-transform" />
                    </summary>
                    <div className="border-t border-line p-4">
                      <p className="mb-3 text-sm font-bold">{t('sourcing.sendRate')}</p>
                      <ActionForm
                        action={createOffer}
                        submitLabel={t('sourcing.sendOffer')}
                        successMessage={t('sourcing.sent')}
                        hidden={{ batchId: batch.id }}
                        icon="send"
                      >
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <Field label={t('common.qtyKg')}>
                              <input type="number" name="quantityKg" required min="1" step="1" max={batch.availableKg} defaultValue={batch.availableKg} className={inputClass} />
                            </Field>
                            <Field label={t('common.rateRsKg')}>
                              <input type="number" name="pricePerKg" required min="1" step="0.5" defaultValue={suggested} className={inputClass} />
                            </Field>
                          </div>
                          <Field label={t('common.destinationMandi')}>
                            <select name="destinationMandiId" required defaultValue={profile?.mandiId ?? ''} className={inputClass}>
                              <option value="">{t('common.selectMandi')}</option>
                              {mandis.map((mandi) => (
                                <option key={mandi.id} value={mandi.id}>
                                  {place(mandi.name)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={t('sourcing.whoTransport')} hint={t('sourcing.transportHint')}>
                            <select name="transportResponsibility" defaultValue="ARHTI" className={inputClass}>
                              <option value="ARHTI">{t('sourcing.tArhti')}</option>
                              <option value="FARMER">{t('sourcing.tFarmer')}</option>
                              <option value="MUTUAL">{t('sourcing.tShared')}</option>
                            </select>
                          </Field>
                          <Field label={t('sourcing.note')}>
                            <input name="note" className={inputClass} placeholder={t('sourcing.notePlaceholder')} />
                          </Field>
                        </div>
                      </ActionForm>
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Link href="/demand/new" className="btn btn-primary mt-6 w-full sm:hidden">
        <Icon name="send" size={20} />
        {t('sourcing.postRequest')}
      </Link>
    </div>
  );
}
