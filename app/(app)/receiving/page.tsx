import Link from 'next/link';
import { DealStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { confirmPickup, receiveProduce } from '@/lib/actions/deals';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
  statusTone,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

const INBOUND: DealStatus[] = [
  DealStatus.PICKUP_SCHEDULED,
  DealStatus.PICKED_UP,
  DealStatus.IN_TRANSIT,
];

export default async function ReceivingPage() {
  const user = await requireCapability('arhti.receive.produce');
  const { t, crop, place, status, kg, perKg, date, dateTime, isUrdu } = await getI18n();

  const [inbound, recent] = await Promise.all([
    prisma.farmerArhtiDeal.findMany({
      where: { arhtiId: user.id, status: { in: INBOUND } },
      include: {
        crop: true,
        farmer: { select: { name: true, phone: true } },
        destinationMandi: { select: { name: true, city: true } },
        pickup: { include: { tracking: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.farmerArhtiDeal.findMany({
      where: { arhtiId: user.id, receivedAt: { not: null } },
      include: {
        crop: true,
        farmer: { select: { name: true } },
        inventoryLot: { select: { id: true, lotNumber: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 6,
    }),
  ]);

  const expectedKg = inbound.reduce((sum, d) => sum + d.agreedQuantityKg, 0);
  const onTruck = inbound.filter((d) => d.status !== DealStatus.PICKUP_SCHEDULED).length;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('receiving.title')}
        subtitle={t('receiving.subtitle')}
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label={t('receiving.statInbound')} value={String(inbound.length)} tone="accent" />
        <StatCard label={t('receiving.statExpected')} value={kg(expectedKg)} />
        <StatCard label={t('receiving.statOnRoad')} value={String(onTruck)} />
      </div>

      {inbound.length === 0 ? (
        <EmptyState
          title={t('receiving.emptyTitle')}
          message={t('receiving.emptyMessage')}
          actionHref="/sourcing"
          actionLabel={t('receiving.emptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {inbound.map((deal) => {
            const awaitingLoad = deal.status === DealStatus.PICKUP_SCHEDULED;
            return (
              <Card key={deal.id}>
                <div className="flex items-start gap-3">
                  <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{crop(deal.crop)}</span>
                      <Badge tone={statusTone(deal.status)}>{status(deal.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {deal.farmer.name} · {place(deal.sourceCity)} {isUrdu ? '←' : '→'}{' '}
                      {place(deal.destinationMandi.city)}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('receiving.expected')}</div>
                        <div className="font-semibold text-charcoal">
                          {kg(deal.agreedQuantityKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('receiving.rate')}</div>
                        <div className="font-semibold text-agri-900">
                          {perKg(deal.agreedPricePerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('receiving.driver')}</div>
                        <div className="font-semibold text-charcoal truncate">
                          {deal.pickup?.driverName ?? t('receiving.notBooked')}
                        </div>
                        {deal.pickup?.vehiclePlate && (
                          <div className="text-[10px] text-[#636E72]">
                            {deal.pickup.vehiclePlate}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('receiving.eta')}</div>
                        <div className="font-semibold text-charcoal">
                          {deal.pickup?.tracking
                            ? t('receiving.minutes', { count: deal.pickup.tracking.etaMinutes ?? 0 })
                            : deal.pickup?.expectedArrivalAt
                              ? dateTime(deal.pickup.expectedArrivalAt, {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: 'numeric',
                                })
                              : '—'}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/deals/${deal.id}`}
                      className="inline-block mt-2 text-[11px] font-semibold text-agri-900 hover:underline"
                    >
                      {t('receiving.deal', { deal: deal.dealNumber })}
                    </Link>
                  </div>
                </div>

                {awaitingLoad ? (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <p className="text-[11px] text-[#636E72]">
                      {t('receiving.waitingLoad', { city: place(deal.sourceCity) })}
                    </p>
                    <ActionForm
                      action={confirmPickup}
                      submitLabel={t('receiving.confirmLoaded')}
                      variant="inline"
                      hidden={{ dealId: deal.id }}
                      className="inline-block"
                    />
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <h3 className="text-[11px] font-bold text-charcoal mb-2">
                      {t('receiving.kanta')}
                    </h3>
                    <ActionForm
                      action={receiveProduce}
                      submitLabel={t('receiving.record')}
                      successMessage={t('receiving.recorded')}
                      hidden={{ dealId: deal.id }}
                    >
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field
                          label={t('receiving.weighed')}
                          hint={t('receiving.max', { qty: kg(Math.round(deal.agreedQuantityKg * 1.05)) })}
                        >
                          <input
                            type="number"
                            name="receivedQuantityKg"
                            required
                            min="1"
                            step="1"
                            max={Math.round(deal.agreedQuantityKg * 1.05)}
                            className={inputClass}
                            placeholder={String(deal.agreedQuantityKg)}
                          />
                        </Field>
                        <Field label={t('receiving.operator')}>
                          <input
                            name="verifierName"
                            required
                            className={inputClass}
                            placeholder={t('deal.placeholderOperator')}
                          />
                        </Field>
                      </div>
                    </ActionForm>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-2">
            {t('receiving.recent')}
          </h2>
          <div className="space-y-2">
            {recent.map((deal) => (
              <Card key={deal.id} padded={false}>
                <div className="px-3 py-2.5 flex items-center gap-3 text-xs">
                  <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-charcoal truncate">
                      {t('receiving.qtyCrop', { qty: kg(deal.receivedQuantityKg ?? 0), crop: crop(deal.crop) })}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {t('receiving.from', {
                        name: deal.farmer.name,
                        date: deal.receivedAt ? date(deal.receivedAt, { day: 'numeric', month: 'short' }) : '',
                      })}
                    </div>
                  </div>
                  {deal.inventoryLot && (
                    <Link
                      href="/inventory"
                      className="text-[10px] font-mono font-semibold text-agri-900 hover:underline whitespace-nowrap"
                    >
                      {deal.inventoryLot.lotNumber}
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
