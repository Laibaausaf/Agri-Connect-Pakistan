import Link from 'next/link';
import { DemandStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { closeDemandRequest } from '@/lib/actions/sourcing';
import ActionForm from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function origins(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

export default async function DemandPage() {
  const user = await requireCapability('arhti.demand.manage');
  const { t, crop, place, grade, kg, money, date } = await getI18n();

  const requests = await prisma.arhtiDemandRequest.findMany({
    where: { arhtiId: user.id },
    include: { crop: true, mandi: { select: { name: true, city: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const open = requests.filter((r) => r.status === DemandStatus.OPEN);
  const closed = requests.filter((r) => r.status !== DemandStatus.OPEN);
  const openVolume = open.reduce((sum, r) => sum + r.maxQuantityKg, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('demand.title')}
        subtitle={t('demand.subtitle')}
        action={
          <Link
            href="/demand/new"
            className="px-3 py-2 text-[11px] font-semibold rounded-xl bg-agri-900 text-white whitespace-nowrap"
          >
            {t('demand.post')}
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label={t('demand.statOpen')} value={String(open.length)} tone="accent" />
        <StatCard label={t('demand.statVolume')} value={kg(openVolume)} />
        <StatCard label={t('demand.statClosed')} value={String(closed.length)} />
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title={t('demand.emptyTitle')}
          message={t('demand.emptyMessage')}
          actionHref="/demand/new"
          actionLabel={t('demand.emptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {[...open, ...closed].map((request) => (
            <Card key={request.id}>
              <div className="flex items-start gap-3">
                <CropThumb imageUrl={request.crop.imageUrl} name={request.crop.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-charcoal">{crop(request.crop)}</span>
                    <Badge tone={request.status === DemandStatus.OPEN ? 'green' : 'neutral'}>
                      {request.status === DemandStatus.OPEN ? t('demand.open') : t('demand.closed')}
                    </Badge>
                    {request.transportOffered && <Badge tone="neutral">{t('demand.transportOffered')}</Badge>}
                  </div>
                  <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                    {request.requestNumber}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                    <div>
                      <div className="text-[10px] text-[#636E72]">{t('demand.quantity')}</div>
                      <div className="font-semibold text-charcoal">
                        {kg(request.minQuantityKg)} – {kg(request.maxQuantityKg)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#636E72]">{t('demand.rateBand')}</div>
                      <div className="font-semibold text-agri-900">
                        {request.targetPriceMin && request.targetPriceMax
                          ? `${money(request.targetPriceMin)}–${money(request.targetPriceMax)}`
                          : t('demand.rateOpen')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#636E72]">{t('demand.neededBy')}</div>
                      <div className="font-semibold text-charcoal">
                        {date(request.neededBy, { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#636E72]">{t('demand.deliverTo')}</div>
                      <div className="font-semibold text-charcoal truncate">
                        {place(request.mandi.city)}
                      </div>
                    </div>
                  </div>
                  {origins(request.preferredOrigins).length > 0 && (
                    <div className="text-[11px] text-[#636E72] mt-2">
                      {t('demand.origins', { list: origins(request.preferredOrigins).map(place).join(t('common.listSep')) })}
                    </div>
                  )}
                  {request.gradeWanted && (
                    <div className="text-[11px] text-[#636E72]">{t('demand.gradeLine', { grade: grade(request.gradeWanted) })}</div>
                  )}
                  {request.notes && (
                    <p className="text-[11px] text-[#636E72] mt-1">{request.notes}</p>
                  )}
                  {request.status === DemandStatus.OPEN && (
                    <ActionForm
                      action={closeDemandRequest}
                      submitLabel={t('demand.close')}
                      variant="inline"
                      hidden={{ requestId: request.id }}
                      className="inline-block"
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
