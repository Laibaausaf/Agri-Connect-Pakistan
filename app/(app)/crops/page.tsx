import Link from 'next/link';
import { CropBatchStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { archiveCropBatch } from '@/lib/actions/crops';
import { getI18n } from '@/lib/i18n/server';
import ActionForm from '@/components/ui/ActionForm';
import {
  Badge,
  EmptyState,
  PageHeader,
  StatCard,
  statusTone,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

export default async function MyCropsPage() {
  const user = await requireCapability('farmer.batch.manage');
  const { t, plural, crop, place, status, grade, kg, perKg } = await getI18n();

  const batches = await prisma.farmerCropBatch.findMany({
    where: { farmerId: user.id, status: { not: CropBatchStatus.ARCHIVED } },
    include: {
      crop: true,
      offers: { where: { status: 'PENDING' }, select: { id: true } },
      deals: { select: { id: true, dealNumber: true, status: true, agreedPricePerKg: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalKg = batches.reduce((sum, b) => sum + b.quantityKg, 0);
  const availableKg = batches.reduce((sum, b) => sum + b.availableKg, 0);
  const soldKg = totalKg - availableKg;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title={t('crops.title')}
        subtitle={t('crops.subtitle')}
        action={
          <Link
            href="/crops/new"
            className="bg-agri-900 hover:bg-agri-800 text-white text-base font-semibold px-5 py-3 rounded-xl"
          >
            {t('crops.add')}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={t('crops.statBatches')} value={batches.length} />
        <StatCard label={t('crops.statHarvested')} value={kg(totalKg)} />
        <StatCard label={t('crops.statUncommitted')} value={kg(availableKg)} tone="accent" />
        <StatCard label={t('crops.statCommitted')} value={kg(soldKg)} />
      </div>

      {batches.length === 0 ? (
        <EmptyState
          title={t('crops.emptyTitle')}
          message={t('crops.emptyMessage')}
          actionHref="/crops/new"
          actionLabel={t('crops.emptyAction')}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {batches.map((batch) => {
            const committed = batch.quantityKg - batch.availableKg;
            const photo = firstPhoto(batch.photos) ?? batch.crop.imageUrl;
            return (
              <div
                key={batch.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm"
              >
                <div className="relative h-56 w-full bg-[#E8F3EE]">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={crop(batch.crop)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">🌾</div>
                  )}
                  <div className="absolute start-3 top-3 flex gap-2">
                    <Badge tone={statusTone(batch.status)}>{status(batch.status)}</Badge>
                    <Badge>{grade(batch.grade)}</Badge>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  {/* Variety is typed by the farmer and shown as stored. */}
                  <h3 className="text-xl font-bold text-charcoal">
                    {crop(batch.crop)}
                    {batch.variety ? ` • ${batch.variety}` : ''}
                  </h3>
                  <div className="mt-0.5 font-mono text-xs text-[#636E72]">{batch.batchNumber}</div>

                  <div className="mt-4 text-3xl font-extrabold text-agri-900">
                    {batch.askingPricePerKg ? perKg(batch.askingPricePerKg) : t('common.openToOffers')}
                    <span className="ms-2 text-sm font-medium text-[#636E72]">{t('crops.asking')}</span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-base">
                    <div>
                      <dt className="text-sm text-[#636E72]">{t('crops.harvested')}</dt>
                      <dd className="font-semibold text-charcoal">{kg(batch.quantityKg)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-[#636E72]">{t('crops.uncommitted')}</dt>
                      <dd className="font-semibold text-agri-900">{kg(batch.availableKg)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-sm text-[#636E72]">{t('crops.origin')}</dt>
                      <dd className="font-semibold text-charcoal">
                        {place([batch.originVillage, batch.originCity].filter(Boolean).join(', '))}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    {batch.offers.length > 0 && (
                      <Link href="/arhti-requests" className="font-semibold text-agri-900 hover:underline">
                        {plural('crops.pendingOffers', batch.offers.length)}{' '}
                        <span className="inline-block rtl:-scale-x-100">→</span>
                      </Link>
                    )}
                    {batch.deals.map((deal) => (
                      <Link key={deal.id} href={`/deals/${deal.id}`} className="text-[#636E72] hover:text-charcoal">
                        {deal.dealNumber} • {perKg(deal.agreedPricePerKg)} • {status(deal.status)}
                      </Link>
                    ))}
                  </div>

                  {committed === 0 && (
                    <div className="mt-4">
                      <ActionForm
                        action={archiveCropBatch}
                        hidden={{ batchId: batch.id }}
                        submitLabel={t('crops.archive')}
                        variant="secondary"
                        className="inline-block"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
