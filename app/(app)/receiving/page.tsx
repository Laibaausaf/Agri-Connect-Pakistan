import Link from 'next/link';
import { DealStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { confirmPickup, receiveProduce } from '@/lib/actions/deals';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import { Badge, CropThumb, EmptyState, PageHeader, statusTone } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';

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

  const stat = (value: string, label: string) => (
    <div className="rounded-2xl bg-sage px-4 py-3">
      <div className="tabular text-xl font-extrabold leading-tight">{value}</div>
      <div className="text-[12.5px] font-semibold text-muted">{label}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={t('receiving.title')} subtitle={t('receiving.subtitle')} />
        <div className="mb-6 grid grid-cols-3 gap-2">
          {stat(String(inbound.length), t('receiving.statInbound'))}
          {stat(kg(expectedKg), t('receiving.statExpected'))}
          {stat(String(onTruck), t('receiving.statOnRoad'))}
        </div>
      </div>

      {inbound.length === 0 ? (
        <EmptyState
          title={t('receiving.emptyTitle')}
          message={t('receiving.emptyMessage')}
          actionHref="/sourcing"
          actionLabel={t('receiving.emptyAction')}
        />
      ) : (
        <div className="space-y-6">
          {inbound.map((deal) => {
            const awaitingLoad = deal.status === DealStatus.PICKUP_SCHEDULED;
            return (
              <div key={deal.id} className="grid items-start gap-5 lg:grid-cols-[1fr_1.15fr]">
                <article className="card overflow-hidden">
                  {deal.crop.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={deal.crop.imageUrl} alt={crop(deal.crop)} className="h-40 w-full object-cover" />
                  )}
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[19px] font-extrabold">
                        {crop(deal.crop)} · {kg(deal.agreedQuantityKg)}
                      </span>
                      <Badge tone={statusTone(deal.status)}>{status(deal.status)}</Badge>
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">
                      {deal.farmer.name} · {place(deal.sourceCity)} {isUrdu ? '←' : '→'} {place(deal.destinationMandi.city)}
                    </div>
                    <Link href={`/deals/${deal.id}`} className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-bold">
                      {t('receiving.deal', { deal: deal.dealNumber })}
                      <Icon name="chevronright" size={16} />
                    </Link>
                  </div>
                  <dl className="grid grid-cols-2 border-t border-line text-sm">
                    <div className="border-b border-e border-line p-4">
                      <dt className="text-[12.5px] text-muted">{t('receiving.expected')}</dt>
                      <dd className="text-base font-extrabold">{kg(deal.agreedQuantityKg)}</dd>
                    </div>
                    <div className="border-b border-line p-4">
                      <dt className="text-[12.5px] text-muted">{t('receiving.rate')}</dt>
                      <dd className="text-base font-extrabold">{perKg(deal.agreedPricePerKg)}</dd>
                    </div>
                    <div className="border-e border-line p-4">
                      <dt className="text-[12.5px] text-muted">{t('receiving.driver')}</dt>
                      <dd className="text-base font-extrabold">{deal.pickup?.driverName ?? t('receiving.notBooked')}</dd>
                      {deal.pickup?.vehiclePlate && <dd className="text-[12.5px] text-muted">{deal.pickup.vehiclePlate}</dd>}
                    </div>
                    <div className="p-4">
                      <dt className="text-[12.5px] text-muted">{t('receiving.eta')}</dt>
                      <dd className="text-base font-extrabold">
                        {deal.pickup?.tracking
                          ? t('receiving.minutes', { count: deal.pickup.tracking.etaMinutes ?? 0 })
                          : deal.pickup?.expectedArrivalAt
                            ? dateTime(deal.pickup.expectedArrivalAt, { day: 'numeric', month: 'short', hour: 'numeric' })
                            : '—'}
                      </dd>
                      {/* Tracking notes are typed text, shown as stored. */}
                      {deal.pickup?.tracking?.statusNotes && <dd className="text-[12.5px] text-muted">{deal.pickup.tracking.statusNotes}</dd>}
                    </div>
                  </dl>
                </article>

                {awaitingLoad ? (
                  <section className="card p-5">
                    <h3 className="flex items-center gap-2 text-[17px] font-bold">
                      <Icon name="truck" size={20} />
                      {t('receiving.confirmLoaded')}
                    </h3>
                    <p className="mt-1 text-sm text-muted">{t('receiving.waitingLoad', { city: place(deal.sourceCity) })}</p>
                    <ActionForm action={confirmPickup} submitLabel={t('receiving.confirmLoaded')} variant="secondary" icon="truck" hidden={{ dealId: deal.id }} />
                  </section>
                ) : (
                  <section className="card border-[1.5px] border-gold p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-[17px] font-bold">
                      <Icon name="scale" size={20} />
                      {t('receiving.kanta')}
                    </h3>
                    <ActionForm
                      action={receiveProduce}
                      submitLabel={t('receiving.record')}
                      successMessage={t('receiving.recorded')}
                      hidden={{ dealId: deal.id }}
                      icon="checkcircle"
                    >
                      <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
                        <Field label={t('receiving.weighed')} hint={t('receiving.max', { qty: kg(Math.round(deal.agreedQuantityKg * 1.05)) })}>
                          {/* The kanta read-out: large digits on a dark display. */}
                          <span className="relative block">
                            <input
                              type="number"
                              name="receivedQuantityKg"
                              required
                              min="1"
                              step="1"
                              max={Math.round(deal.agreedQuantityKg * 1.05)}
                              className="tabular h-[72px] w-full rounded-2xl border-0 bg-[#0B1A14] pe-14 ps-4 text-[34px] font-extrabold text-[#9FD8B1] placeholder:text-[#9FD8B1]/40 focus:outline-none focus:ring-4 focus:ring-gold/40"
                              placeholder={String(deal.agreedQuantityKg)}
                              dir="ltr"
                            />
                            <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-base font-bold text-[#9FD8B1]">{t('wizard.kgUnit')}</span>
                          </span>
                        </Field>
                        <Field label={t('receiving.operator')}>
                          <input name="verifierName" required className={`field-input bg-paper`} placeholder={t('deal.placeholderOperator')} />
                        </Field>
                      </div>
                    </ActionForm>
                  </section>
                )}
              </div>
            );
          })}
        </div>
      )}

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display h-section mb-2 font-semibold">{t('receiving.recent')}</h2>
          <div className="divide-y divide-line">
            {recent.map((deal) => (
              <div key={deal.id} className="flex items-center gap-3 py-3">
                <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{t('receiving.qtyCrop', { qty: kg(deal.receivedQuantityKg ?? 0), crop: crop(deal.crop) })}</div>
                  <div className="text-[13px] text-muted">
                    {t('receiving.from', {
                      name: deal.farmer.name,
                      date: deal.receivedAt ? date(deal.receivedAt, { day: 'numeric', month: 'short' }) : '',
                    })}
                  </div>
                </div>
                {deal.inventoryLot && (
                  <Link href="/inventory" className="hidden min-h-11 items-center font-mono text-[13px] font-semibold sm:inline-flex">
                    {deal.inventoryLot.lotNumber}
                  </Link>
                )}
                <Badge tone={statusTone(deal.status)}>{status(deal.status)}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
