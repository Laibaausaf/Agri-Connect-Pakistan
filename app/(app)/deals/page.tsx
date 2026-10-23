import Link from 'next/link';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { getI18n } from '@/lib/i18n/server';
import type { I18n } from '@/lib/i18n';
import {
  Badge,
  CropThumb,
  EmptyState,
  PageHeader,
  statusTone,
} from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';
import { DEAL_STAGES, dealStageIndex } from '@/components/deals/stages';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  const user = await requireCapability('farmer.deals.view', 'arhti.deals.manage');
  const isFarmer = user.role === UserRole.FARMER;
  const i18n = await getI18n();
  const { t } = i18n;

  const deals = await prisma.farmerArhtiDeal.findMany({
    where: isFarmer ? { farmerId: user.id } : { arhtiId: user.id },
    include: {
      crop: true,
      farmer: { select: { name: true } },
      arhti: { select: { name: true } },
      destinationMandi: { select: { name: true, city: true } },
      settlement: true,
      pickup: { select: { driverName: true, scheduledAt: true, confirmedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const open = deals.filter((d) => d.status !== 'COMPLETED' && d.status !== 'CANCELLED');
  const closed = deals.filter((d) => d.status === 'COMPLETED' || d.status === 'CANCELLED');

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isFarmer ? t('deals.titleFarmer') : t('deals.titleArhti')}
        subtitle={isFarmer ? t('deals.subtitleFarmer') : t('deals.subtitleArhti')}
      />

      {deals.length === 0 ? (
        <EmptyState
          title={t('deals.emptyTitle')}
          message={isFarmer ? t('deals.emptyFarmer') : t('deals.emptyArhti')}
          actionHref={isFarmer ? '/arhti-requests' : '/sourcing'}
          actionLabel={isFarmer ? t('deals.emptyActionFarmer') : t('deals.emptyActionArhti')}
        />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[.08em] text-muted">
              {t('deals.inProgress', { count: open.length })}
            </h2>
            <div className="space-y-3">
              {open.map((deal) => (
                <DealRow key={deal.id} deal={deal} isFarmer={isFarmer} i18n={i18n} />
              ))}
              {open.length === 0 && (
                <div className="card p-4 text-sm text-muted">{t('deals.nothingInProgress')}</div>
              )}
            </div>
          </section>

          {closed.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[.08em] text-muted">
                {t('deals.closed', { count: closed.length })}
              </h2>
              <div className="space-y-3">
                {closed.map((deal) => (
                  <DealRow key={deal.id} deal={deal} isFarmer={isFarmer} i18n={i18n} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

type DealListItem = Prisma.FarmerArhtiDealGetPayload<{
  include: {
    crop: true;
    farmer: { select: { name: true } };
    arhti: { select: { name: true } };
    destinationMandi: { select: { name: true; city: true } };
    settlement: true;
    pickup: { select: { driverName: true; scheduledAt: true; confirmedAt: true } };
  };
}>;

function DealRow({ deal, isFarmer, i18n }: { deal: DealListItem; isFarmer: boolean; i18n: I18n }) {
  const { t, crop, place, status, kg, perKg, money } = i18n;
  const quantity = deal.receivedQuantityKg ?? deal.agreedQuantityKg;
  const stage = dealStageIndex(deal.status);
  return (
    <Link href={`/deals/${deal.id}`} className="card ac-press block overflow-hidden hover:border-forest">
      <div className="flex items-start gap-3 p-4">
        <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[17px] font-bold">{crop(deal.crop)}</span>
            <span className="tabular shrink-0 text-lg font-extrabold">{kg(quantity)}</span>
          </div>
          <div className="font-mono text-[13px] text-muted">{deal.dealNumber}</div>
          <div className="mt-1 text-sm text-muted">
            {isFarmer ? t('deals.arhti') : t('deals.farmer')}:{' '}
            <span className="font-semibold text-ink">{isFarmer ? deal.arhti.name : deal.farmer.name}</span> ·{' '}
            {t('deals.rate')}: <span className="font-semibold text-ink">{perKg(deal.agreedPricePerKg)}</span>
          </div>
          <div className="text-sm text-muted">
            {isFarmer ? t('deals.youGet') : t('deals.destination')}:{' '}
            <span className="font-bold text-ink">
              {isFarmer
                ? deal.settlement
                  ? money(deal.settlement.netPayable)
                  : t('deals.afterWeighing')
                : place(deal.destinationMandi.city)}
            </span>
          </div>
        </div>
      </div>
      {stage >= 0 && (
        <div className="flex gap-1.5 px-4 pb-3" aria-hidden="true">
          {DEAL_STAGES.map((s, i) => (
            <span key={s.status} className={`h-1.5 flex-1 rounded-full ${i <= stage ? 'bg-gold' : 'bg-sage'}`} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-line bg-paper px-4 py-2.5">
        <Badge tone={statusTone(deal.status)}>{status(deal.status)}</Badge>
        <Icon name="chevronright" size={18} className="text-muted" />
      </div>
    </Link>
  );
}
