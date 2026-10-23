import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  DealStatus,
  SupplyChainStage,
  TransportResponsibility,
  UserRole,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import {
  confirmPickup,
  payFarmer,
  receiveProduce,
  schedulePickup,
} from '@/lib/actions/deals';
import { getI18n } from '@/lib/i18n/server';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Badge, CropThumb, StatCard, statusTone } from '@/components/ui/kit';
import Icon, { type IconName } from '@/components/ui/Icon';
import { DEAL_STAGES, dealStageIndex } from '@/components/deals/stages';

export const dynamic = 'force-dynamic';

const STAGES = DEAL_STAGES;
const stageIndex = dealStageIndex;

/** Icon for each recorded supply-chain step. */
const EVENT_ICONS: Record<SupplyChainStage, IconName> = {
  FARMER_HARVEST: 'sprout',
  FARMER_ARHTI_OFFER: 'tag',
  FARMER_ARHTI_DEAL: 'handshake',
  PICKUP: 'truck',
  ARHTI_RECEIPT: 'scale',
  MANDI_AUCTION: 'gavel',
  ARHTI_VENDOR_SALE: 'checkcircle',
  VENDOR_WHOLESALE_OFFER: 'store',
  VENDOR_SHOPKEEPER_SALE: 'cart',
  RETAIL_LISTING: 'tag',
  CONSUMER_ORDER: 'user',
};

/** How far along the road the truck is, from the delivery stage. */
const ROAD_PROGRESS: Record<string, number> = { PENDING: 0.05, PICKUP: 0.2, IN_TRANSIT: 0.5, MANDI_ARRIVAL: 0.85, DELIVERED: 1 };

/** Phone number as a tap-to-call link. */
function PhoneLink({ phone, label }: { phone: string; label: string }) {
  return (
    <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="btn btn-secondary btn-sm shrink-0" aria-label={`${label} ${phone}`}>
      <Icon name="phone" size={16} />
      {label}
    </a>
  );
}

function dateTimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCapability('farmer.deals.view', 'arhti.deals.manage');
  const { t, crop, place, status, grade, kg, perKg, money, dateTime, deduction, isUrdu, storedText } = await getI18n();

  const when = (date: Date | null | undefined) =>
    date ? dateTime(date, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null;

  const deal = await prisma.farmerArhtiDeal.findFirst({
    where: { id, OR: [{ farmerId: user.id }, { arhtiId: user.id }] },
    include: {
      crop: true,
      batch: { select: { id: true, batchNumber: true, grade: true, variety: true } },
      farmer: { select: { name: true, phone: true, location: true } },
      arhti: {
        select: {
          name: true,
          phone: true,
          arhtiProfile: { select: { businessName: true, commissionRate: true } },
        },
      },
      destinationMandi: { select: { name: true, city: true } },
      pickup: { include: { tracking: true } },
      settlement: { include: { deductions: true } },
      inventoryLot: { select: { id: true, lotNumber: true } },
    },
  });

  if (!deal) notFound();

  const isFarmer = user.role === UserRole.FARMER;
  const current = stageIndex(deal.status);
  const counterparty = isFarmer ? deal.arhti : deal.farmer;

  const responsibleParty =
    deal.transportResponsibility === TransportResponsibility.FARMER
      ? t('deal.transportFarmer')
      : deal.transportResponsibility === TransportResponsibility.ARHTI
        ? t('deal.transportArhti')
        : t('deal.transportShared');

  const canSchedule =
    deal.status === DealStatus.AGREED &&
    (deal.transportResponsibility === TransportResponsibility.MUTUAL ||
      (deal.transportResponsibility === TransportResponsibility.FARMER && isFarmer) ||
      (deal.transportResponsibility === TransportResponsibility.ARHTI && !isFarmer));

  const canConfirmPickup = deal.status === DealStatus.PICKUP_SCHEDULED && Boolean(deal.pickup);

  const canReceive =
    !isFarmer &&
    (deal.status === DealStatus.IN_TRANSIT || deal.status === DealStatus.PICKED_UP);

  const canPay = !isFarmer && deal.status === DealStatus.PAYMENT_PENDING && Boolean(deal.settlement);

  const cropNames = isUrdu
    ? Object.fromEntries(
        (await prisma.crop.findMany({ select: { name: true, nameUrdu: true } }))
          .filter((c) => c.nameUrdu)
          .map((c) => [c.name, c.nameUrdu as string])
      )
    : {};

  const events = await prisma.supplyChainEvent.findMany({
    where: {
      batchId: deal.batchId,
      ...(isFarmer ? { isConfidential: false } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      stage: true,
      quantityKg: true,
      createdAt: true,
    },
  });

  const defaultPickup = new Date(Date.now() + 24 * 60 * 60 * 1000);
  defaultPickup.setMinutes(0, 0, 0);

  // Dates already on the deal, shown under each step of the timeline.
  const stageDates: (string | null)[] = [
    when(deal.createdAt),
    when(deal.pickup?.createdAt),
    when(deal.pickup?.confirmedAt),
    when(deal.weightVerifiedAt ?? deal.receivedAt),
    null,
  ];
  const isClosed = deal.status === DealStatus.COMPLETED;
  const onRoad = current === 2 && deal.pickup?.tracking;
  const firstEvents = events.slice(0, 5);
  const moreEvents = events.slice(5);

  const eventItem = (event: (typeof events)[number]) => (
    <li key={event.id} className="flex gap-3 border-b border-line py-3 last:border-b-0">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage text-forest">
        <Icon name={EVENT_ICONS[event.stage] ?? 'dot'} size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-[15px] font-bold">{storedText(event.title, cropNames)}</div>
        <div className="text-sm text-muted">{storedText(event.description, cropNames)}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          {when(event.createdAt)}
          {event.quantityKg != null && ` · ${kg(event.quantityKg)}`}
        </div>
      </div>
    </li>
  );

  const actionCard = (title: string, text: string | null, children?: React.ReactNode, tone: 'gold' | 'plain' = 'plain') => (
    <section className={`card p-5 ${tone === 'gold' ? 'border-[1.5px] border-gold' : ''}`}>
      <h2 className="text-[17px] font-bold">{title}</h2>
      {text && <p className="mt-1 text-sm text-muted">{text}</p>}
      {children}
    </section>
  );

  const actions = (
    <>
      {canSchedule &&
        actionCard(
          t('deal.bookTruck'),
          t('deal.noAccountNeeded', { who: responsibleParty }),
          <ActionForm
            action={schedulePickup}
            submitLabel={t('deal.saveTransport')}
            successMessage={t('deal.transportSaved')}
            hidden={{ dealId: deal.id }}
            icon="truck"
            className="mt-4"
          >
            <div className="space-y-4">
              <Field label={t('deal.driverName')}>
                <input name="driverName" required className={inputClass} placeholder={t('deal.placeholderDriver')} />
              </Field>
              <Field label={t('deal.driverPhone')}>
                <input name="driverPhone" required className={inputClass} placeholder="03001234567" dir="ltr" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('deal.vehicleType')}>
                  <input name="vehicleType" className={inputClass} placeholder={t('deal.placeholderVehicle')} />
                </Field>
                <Field label={t('deal.plate')}>
                  <input name="vehiclePlate" className={inputClass} placeholder="LES-4471" dir="ltr" />
                </Field>
              </div>
              <Field label={t('deal.pickupTime')}>
                <input type="datetime-local" name="scheduledAt" required defaultValue={dateTimeLocal(defaultPickup)} className={inputClass} />
              </Field>
              <Field label={t('deal.freightCost')} hint={t('deal.freightHint')}>
                <input type="number" name="estimatedCost" min="0" step="100" className={inputClass} placeholder="18000" />
              </Field>
              <Field label={t('deal.notes')}>
                <input name="notes" className={inputClass} placeholder={t('deal.placeholderNotes')} />
              </Field>
            </div>
          </ActionForm>,
          'gold'
        )}

      {deal.status === DealStatus.AGREED &&
        !canSchedule &&
        actionCard(t('deal.waitingTransport'), t('deal.waitingTransportText', { who: responsibleParty, name: counterparty.name }))}

      {canConfirmPickup &&
        actionCard(
          t('deal.confirmLoading'),
          t('deal.confirmLoadingText', {
            driver: deal.pickup?.driverName ?? '',
            qty: kg(deal.agreedQuantityKg),
            city: place(deal.destinationMandi.city),
          }),
          <ActionForm
            action={confirmPickup}
            submitLabel={t('deal.produceLoaded')}
            successMessage={t('deal.markedTransit')}
            hidden={{ dealId: deal.id }}
            icon="truck"
          />,
          'gold'
        )}

      {canReceive &&
        actionCard(
          t('deal.receive'),
          t('deal.receiveText'),
          <ActionForm
            action={receiveProduce}
            submitLabel={t('deal.recordWeight')}
            successMessage={t('deal.received')}
            hidden={{ dealId: deal.id }}
            icon="scale"
            className="mt-4"
          >
            <div className="space-y-4">
              <Field
                label={t('deal.weighedQty')}
                hint={t('deal.weighedHint', {
                  agreed: kg(deal.agreedQuantityKg),
                  max: kg(Math.round(deal.agreedQuantityKg * 1.05)),
                })}
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
              <Field label={t('deal.kantaOperator')}>
                <input name="verifierName" required className={inputClass} placeholder={t('deal.placeholderOperator')} />
              </Field>
            </div>
          </ActionForm>,
          'gold'
        )}

      {canPay &&
        deal.settlement &&
        actionCard(
          t('deal.releasePayment'),
          t('deal.releaseText', {
            net: money(deal.settlement.netPayable),
            name: deal.farmer.name,
            deductions: money(deal.settlement.deductionsTotal),
          }),
          <ActionForm
            action={payFarmer}
            submitLabel={t('deal.pay', { amount: money(deal.settlement.netPayable) })}
            successMessage={t('deal.paid')}
            hidden={{ dealId: deal.id }}
            icon="banknote"
          />,
          'gold'
        )}

      {isFarmer &&
        deal.status === DealStatus.PAYMENT_PENDING &&
        actionCard(
          t('deal.awaitingPayment'),
          t('deal.awaitingPaymentText', {
            name: deal.arhti.name,
            amount: deal.settlement ? money(deal.settlement.netPayable) : t('deal.settledAmount'),
          })
        )}
    </>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/deals" className="mb-4 inline-flex min-h-12 items-center gap-1.5 text-[15px] font-bold">
        <Icon name="arrowleft" size={20} />
        {t('deal.allDeals')}
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="ac-up min-w-0">
          <Badge tone={statusTone(deal.status)}>{status(deal.status)}</Badge>
          <h1 className="font-display h-page mt-3 font-semibold">
            {crop(deal.crop)} · {kg(deal.agreedQuantityKg)}
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {isUrdu
              ? `${place(deal.sourceCity)}، ${place(deal.sourceProvince)} ← ${place(deal.destinationMandi.name)}`
              : `${deal.sourceCity}, ${deal.sourceProvince} → ${deal.destinationMandi.name}`}
          </p>
          <p className="mt-0.5 font-mono text-[13px] text-muted">
            {deal.dealNumber} · {t('deal.batch', { batch: deal.batch.batchNumber })}
          </p>
        </div>

        {isClosed && (
          <section className="ac-up ac-d1 rounded-hero bg-ok-bg p-5 lg:min-w-[340px]">
            <div className="flex items-center gap-2 text-[15px] font-bold text-ok-fg">
              <Icon name="checkcircle" size={18} />
              {t('deal.complete')}
            </div>
            {deal.settlement && <div className="tabular mt-1 text-[34px] font-extrabold leading-tight">{money(deal.settlement.netPayable)}</div>}
            <p className="mt-1 text-sm text-muted">
              {isFarmer ? t('deal.completeFarmer') : t('deal.completeArhti', { lot: deal.inventoryLot?.lotNumber ?? '' })}
            </p>
            <Link href={isFarmer ? '/records' : '/inventory'} className="btn btn-primary mt-4 w-full">
              <Icon name="receipt" size={18} />
              {isFarmer ? t('deal.openRecords') : t('deal.openInventory')}
            </Link>
          </section>
        )}
      </div>

      {onRoad && deal.pickup?.tracking && (
        <section className="ac-up ac-d1 mt-5 rounded-hero bg-info-bg p-5 text-info-fg">
          <div className="flex items-center gap-2 text-[15px] font-bold">
            <Icon name="truck" size={18} />
            {t('deal.deliveryStatus')}: {status(deal.pickup.tracking.stage)}
          </div>
          <div className="relative mt-4 h-1.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--inf) 20%, transparent)' }}>
            <span
              className="ac-grow absolute inset-y-0 start-0 rounded-full bg-info-fg"
              style={{ width: `${(ROAD_PROGRESS[deal.pickup.tracking.stage] ?? 0) * 100}%` }}
            />
            <span
              className="ac-drive absolute -top-3.5 inline-flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-gold text-ongold rtl:translate-x-1/2"
              style={{ insetInlineStart: `${(ROAD_PROGRESS[deal.pickup.tracking.stage] ?? 0) * 100}%` }}
            >
              <Icon name="truck" size={16} />
            </span>
          </div>
          <div className="mt-4 flex justify-between gap-2 text-[13px] font-bold">
            {/* Origin and destination are stored text, shown in the chosen language where known. */}
            <span>{place(deal.pickup.tracking.origin)}</span>
            <span>{t('deal.eta', { hours: Math.max(1, Math.round(deal.pickup.tracking.etaMinutes / 60)) })}</span>
            <span>{place(deal.pickup.tracking.destination)}</span>
          </div>
          {deal.pickup.tracking.statusNotes && <p className="mt-2 text-sm">{deal.pickup.tracking.statusNotes}</p>}
        </section>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('deal.agreedRate')} value={perKg(deal.agreedPricePerKg)} tone="accent" />
        <StatCard label={t('deal.agreedQty')} value={kg(deal.agreedQuantityKg)} hint={grade(deal.batch.grade)} />
        <StatCard
          label={t('deal.weighed')}
          value={deal.receivedQuantityKg ? kg(deal.receivedQuantityKg) : '—'}
          hint={
            deal.weightDifferenceKg != null
              ? t('deal.weightDiff', {
                  diff: `${deal.weightDifferenceKg >= 0 ? '+' : '-'}${kg(Math.abs(deal.weightDifferenceKg))}`,
                })
              : t('deal.pendingKanta')
          }
          tone={deal.weightDifferenceKg != null && deal.weightDifferenceKg < 0 ? 'warn' : 'default'}
        />
        <StatCard
          label={isFarmer ? t('deal.netToYou') : t('deal.netToFarmer')}
          value={deal.settlement ? money(deal.settlement.netPayable) : '—'}
          hint={deal.settlement ? status(deal.settlement.status) : t('deal.afterWeighing')}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.35fr_1fr] lg:grid-rows-[auto_1fr]">
        {/* Actions come first on phones and top-right on desktop. */}
        <div className="space-y-4 empty:hidden lg:col-start-2 lg:row-start-1">{actions}</div>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 lg:row-end-3">

          {/* One timeline: agreed, truck booked, on the road, weighed, paid */}
          <section>
            <h2 className="font-display h-section mb-4 font-semibold">{t('deal.progress')}</h2>
            <ol className="relative">
              {STAGES.map((stage, index) => {
                const done = current > index || (isClosed && index === STAGES.length - 1);
                const active = current === index && !done;
                return (
                  <li key={stage.status} className="relative flex gap-3 pb-5 last:pb-0">
                    {index < STAGES.length - 1 && (
                      <span aria-hidden="true" className={`ac-fill absolute start-[15px] top-8 h-[calc(100%-24px)] w-0.5 ${current > index ? 'bg-gold' : 'bg-line'}`} />
                    )}
                    <span
                      className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                        done ? 'bg-gold text-ongold' : active ? 'ac-pulse border-2 border-gold bg-sf text-ink' : 'border-2 border-line bg-sf text-muted'
                      }`}
                    >
                      {done ? <Icon name="check" size={16} stroke={3} /> : index + 1}
                    </span>
                    <div className="min-w-0 pt-1">
                      <div className={`text-[15px] font-bold ${done || active ? '' : 'text-muted'}`}>{t(stage.label)}</div>
                      {active && <div className="text-[13px] font-bold text-goldtext">{t('deal.inProgressNow')}</div>}
                      {done && stageDates[index] && <div className="text-[13px] text-muted">{stageDates[index]}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {deal.settlement && (
            <section className="card overflow-hidden">
              <h2 className="flex items-center gap-2 bg-sage px-5 py-4 text-[17px] font-bold">
                <Icon name="receipt" size={20} />
                {t('deal.settlement')}
              </h2>
              <dl className="divide-y divide-line text-sm">
                <div className="flex justify-between gap-3 px-5 py-3">
                  <dt className="text-muted">
                    {t('deal.gross', {
                      qty: kg(deal.receivedQuantityKg ?? deal.agreedQuantityKg),
                      rate: money(deal.agreedPricePerKg),
                    })}
                  </dt>
                  <dd className="tabular font-bold">{money(deal.settlement.grossAmount)}</dd>
                </div>
                {deal.settlement.deductions.map((d) => (
                  <div key={d.id} className="flex justify-between gap-3 px-5 py-3">
                    <dt className="text-muted">{deduction(d.type, d.description)}</dt>
                    <dd className="tabular font-bold text-err-fg">− {money(d.amount)}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 px-5 py-4">
                  <dt className="text-[15px] font-bold">{t('deal.netPayable')}</dt>
                  <dd className="tabular text-[26px] font-extrabold text-goldtext">{money(deal.settlement.netPayable)}</dd>
                </div>
              </dl>
              {deal.weightVerifierName && (
                <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-[13px] text-muted">
                  <Icon name="scale" size={15} />
                  {t('deal.weighedBy', { name: deal.weightVerifierName, date: when(deal.weightVerifiedAt) ?? '' })}
                </p>
              )}
            </section>
          )}

          <section>
            <h2 className="font-display h-section mb-2 font-semibold">{t('deal.trace')}</h2>
            {/* Event titles and descriptions are stored in English; known
                templates are translated for display in Urdu mode. */}
            <ol className="card px-4">{firstEvents.map(eventItem)}</ol>
            {moreEvents.length > 0 && (
              <details className="mt-3 [&[open]>summary]:hidden">
                <summary className="btn btn-outline w-full cursor-pointer list-none">
                  <Icon name="chevrondown" size={18} />
                  {t('deal.showAllSteps', { count: events.length })}
                </summary>
                <ol className="card px-4">{moreEvents.map(eventItem)}</ol>
              </details>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:col-start-2 lg:row-start-2">
          <h2 className="font-display h-section font-semibold">{t('deal.people')}</h2>
          <section className="card flex items-start gap-3 p-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage text-forest">
              <Icon name={isFarmer ? 'store' : 'sprout'} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-muted">{isFarmer ? t('deal.buyingArhti') : t('deal.sellingFarmer')}</div>
              <div className="text-[15px] font-bold">{counterparty.name}</div>
              {!isFarmer && 'location' in counterparty && counterparty.location && (
                <div className="text-[13px] text-muted">{place(counterparty.location)}</div>
              )}
              {isFarmer && deal.arhti.arhtiProfile?.businessName && (
                <div className="text-[13px] text-muted">{deal.arhti.arhtiProfile.businessName}</div>
              )}
              <div className="text-[13px] text-muted">
                {t('deal.contact')}: <span dir="ltr">{counterparty.phone ?? '—'}</span>
              </div>
            </div>
            {counterparty.phone && <PhoneLink phone={counterparty.phone} label={t('deal.call')} />}
          </section>

          {deal.pickup && (
            <section className="card flex items-start gap-3 p-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage text-forest">
                <Icon name="truck" size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-muted">{t('deal.driver')}</div>
                <div className="text-[15px] font-bold">{deal.pickup.driverName}</div>
                {/* Plate and vehicle type are typed text, shown as stored. */}
                <div className="text-[13px] text-muted">
                  {t('deal.vehicle')}: {deal.pickup.vehiclePlate ?? deal.pickup.vehicleType ?? '—'}
                </div>
                <div className="text-[13px] text-muted" dir="ltr">
                  {deal.pickup.driverPhone}
                </div>
              </div>
              <PhoneLink phone={deal.pickup.driverPhone} label={t('deal.call')} />
            </section>
          )}

          <dl className="card divide-y divide-line text-sm">
            <div className="flex justify-between gap-3 px-4 py-3">
              <dt className="text-muted">{t('deal.destinationMandi')}</dt>
              <dd className="text-end font-bold">{place(deal.destinationMandi.name)}</dd>
            </div>
            <div className="flex justify-between gap-3 px-4 py-3">
              <dt className="text-muted">{t('deal.transport')}</dt>
              <dd className="text-end font-bold">{responsibleParty}</dd>
            </div>
            {deal.pickup && (
              <>
                <div className="flex justify-between gap-3 px-4 py-3">
                  <dt className="text-muted">{t('deal.scheduled')}</dt>
                  <dd className="text-end font-bold">{when(deal.pickup.scheduledAt)}</dd>
                </div>
                <div className="flex justify-between gap-3 px-4 py-3">
                  <dt className="text-muted">{t('deal.loaded')}</dt>
                  <dd className="text-end font-bold">{when(deal.pickup.confirmedAt) ?? t('common.notYet')}</dd>
                </div>
                {deal.pickup.estimatedCost != null && (
                  <div className="flex justify-between gap-3 px-4 py-3">
                    <dt className="text-muted">{t('deal.freight')}</dt>
                    <dd className="tabular text-end font-bold">{money(deal.pickup.estimatedCost)}</dd>
                  </div>
                )}
                {deal.pickup.tracking && (
                  <div className="flex justify-between gap-3 px-4 py-3">
                    <dt className="text-muted">{t('deal.deliveryStatus')}</dt>
                    <dd className="text-end">
                      <span className="font-bold">{status(deal.pickup.tracking.stage)}</span>
                      {/* Tracking notes are typed text, shown as stored. */}
                      {deal.pickup.tracking.statusNotes && (
                        <span className="block text-[13px] text-muted">{deal.pickup.tracking.statusNotes}</span>
                      )}
                    </dd>
                  </div>
                )}
              </>
            )}
            {deal.pickup?.notes && <p className="px-4 py-3 text-[13px] text-muted">{deal.pickup.notes}</p>}
          </dl>

          <div className="flex items-center gap-3 rounded-2xl bg-sage p-3">
            <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="sm" />
            <div className="min-w-0 text-sm">
              <div className="font-bold">
                {crop(deal.crop)}
                {/* Variety is typed by the farmer and shown as stored. */}
                {deal.batch.variety && <span className="font-semibold text-muted"> · {deal.batch.variety}</span>}
              </div>
              <div className="text-[13px] text-muted">{t('deal.batch', { batch: deal.batch.batchNumber })}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
