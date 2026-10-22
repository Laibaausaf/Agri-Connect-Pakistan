import Link from 'next/link';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { getI18n } from '@/lib/i18n/server';
import type { I18n } from '@/lib/i18n';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  statusTone,
} from '@/components/ui/kit';

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
    <div className="max-w-4xl mx-auto">
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
        <div className="space-y-6">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-2">
              {t('deals.inProgress', { count: open.length })}
            </h2>
            <div className="space-y-3">
              {open.map((deal) => (
                <DealRow key={deal.id} deal={deal} isFarmer={isFarmer} i18n={i18n} />
              ))}
              {open.length === 0 && (
                <Card>
                  <p className="text-xs text-[#636E72]">{t('deals.nothingInProgress')}</p>
                </Card>
              )}
            </div>
          </section>

          {closed.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-2">
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
  return (
    <Link href={`/deals/${deal.id}`} className="block">
      <Card className="hover:border-[#B7D4C8] transition-colors">
        <div className="flex items-start gap-3">
          <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-charcoal">{crop(deal.crop)}</span>
              <Badge tone={statusTone(deal.status)}>{status(deal.status)}</Badge>
            </div>
            <div className="text-[11px] text-[#636E72] font-mono mt-0.5">{deal.dealNumber}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
              <div>
                <div className="text-[10px] text-[#636E72]">{isFarmer ? t('deals.arhti') : t('deals.farmer')}</div>
                <div className="font-semibold text-charcoal truncate">
                  {isFarmer ? deal.arhti.name : deal.farmer.name}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#636E72]">{t('deals.quantity')}</div>
                <div className="font-semibold text-charcoal">{kg(quantity)}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#636E72]">{t('deals.rate')}</div>
                <div className="font-semibold text-agri-900">{perKg(deal.agreedPricePerKg)}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#636E72]">
                  {isFarmer ? t('deals.youGet') : t('deals.destination')}
                </div>
                <div className="font-semibold text-charcoal truncate">
                  {isFarmer
                    ? deal.settlement
                      ? money(deal.settlement.netPayable)
                      : t('deals.afterWeighing')
                    : place(deal.destinationMandi.city)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
