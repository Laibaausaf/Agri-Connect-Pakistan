import Link from 'next/link';
import { CropBatchStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { archiveCropBatch } from '@/lib/actions/crops';
import { getI18n } from '@/lib/i18n/server';
import ActionForm from '@/components/ui/ActionForm';
import Icon from '@/components/ui/Icon';
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
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('crops.title')}
        subtitle={t('crops.subtitle')}
        action={
          <Link href="/crops/new" className="btn btn-primary hidden px-6 sm:inline-flex">
            <Icon name="pluscircle" size={20} />
            {t('crops.add')}
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <div className="grid gap-4 lg:grid-cols-2">
          {batches.map((batch) => {
            const committed = batch.quantityKg - batch.availableKg;
            const photo = firstPhoto(batch.photos) ?? batch.crop.imageUrl;
            return (
              <div key={batch.id} className="card flex flex-col overflow-hidden">
                <div className="flex gap-4 p-4">
                  <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-sage">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={crop(batch.crop)} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-forest">
                        <Icon name="sprout" size={34} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      {/* Variety is typed by the farmer and shown as stored. */}
                      <h3 className="text-[17px] font-bold leading-snug">
                        {crop(batch.crop)}
                        {batch.variety ? ` · ${batch.variety}` : ''}
                      </h3>
                      <span className="tabular shrink-0 text-lg font-extrabold">{kg(batch.quantityKg)}</span>
                    </div>
                    <div className="font-mono text-[13px] text-muted">{batch.batchNumber}</div>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
                      <span className="tabular text-xl font-extrabold text-goldtext">
                        {batch.askingPricePerKg ? perKg(batch.askingPricePerKg) : t('common.openToOffers')}
                      </span>
                      <span className="text-[13px] text-muted">{t('crops.asking')}</span>
                    </div>
                  </div>
                </div>

                <dl className="grid grid-cols-3 gap-3 border-t border-line px-4 py-3 text-sm">
                  <div>
                    <dt className="text-[13px] text-muted">{t('crops.harvested')}</dt>
                    <dd className="font-bold">{kg(batch.quantityKg)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-muted">{t('crops.uncommitted')}</dt>
                    <dd className="font-bold text-forest">{kg(batch.availableKg)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[13px] text-muted">{t('crops.origin')}</dt>
                    <dd className="truncate font-bold">{place([batch.originVillage, batch.originCity].filter(Boolean).join(', '))}</dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line bg-paper px-4 py-3">
                  <Badge tone={statusTone(batch.status)}>{status(batch.status)}</Badge>
                  <Badge>{grade(batch.grade)}</Badge>
                  <span className="flex-1" />
                  {batch.offers.length > 0 && (
                    <Link href="/arhti-requests" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-forest">
                      {plural('crops.pendingOffers', batch.offers.length)}
                      <Icon name="chevronright" size={16} />
                    </Link>
                  )}
                  {committed === 0 && (
                    <ActionForm
                      action={archiveCropBatch}
                      hidden={{ batchId: batch.id }}
                      submitLabel={t('crops.archive')}
                      variant="inline"
                      className="[&>button]:mt-0"
                    />
                  )}
                </div>
                {batch.deals.length > 0 && (
                  <div className="flex flex-col border-t border-line">
                    {batch.deals.map((deal) => (
                      <Link
                        key={deal.id}
                        href={`/deals/${deal.id}`}
                        className="flex min-h-12 items-center gap-2 px-4 text-sm hover:bg-sage"
                      >
                        <Icon name="deal" size={16} className="text-forest" />
                        <span className="font-mono text-[13px]">{deal.dealNumber}</span>
                        <span className="text-muted">· {perKg(deal.agreedPricePerKg)} · {status(deal.status)}</span>
                        <span className="flex-1" />
                        <Icon name="chevronright" size={16} className="text-muted" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link href="/crops/new" className="btn btn-primary mt-6 w-full sm:hidden">
        <Icon name="pluscircle" size={20} />
        {t('crops.add')}
      </Link>
    </div>
  );
}
