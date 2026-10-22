import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  DealStatus,
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
import {
  Badge,
  Card,
  CropThumb,
  PageHeader,
  StatCard,
  statusTone,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

const STAGES = [
  { status: DealStatus.AGREED, label: 'deal.stage.agreed' },
  { status: DealStatus.PICKUP_SCHEDULED, label: 'deal.stage.booked' },
  { status: DealStatus.IN_TRANSIT, label: 'deal.stage.transit' },
  { status: DealStatus.PAYMENT_PENDING, label: 'deal.stage.weighed' },
  { status: DealStatus.COMPLETED, label: 'deal.stage.paid' },
] as const;

function stageIndex(status: DealStatus) {
  switch (status) {
    case DealStatus.AGREED:
      return 0;
    case DealStatus.PICKUP_SCHEDULED:
      return 1;
    case DealStatus.PICKED_UP:
    case DealStatus.IN_TRANSIT:
      return 2;
    case DealStatus.RECEIVED_BY_ARHTI:
    case DealStatus.WEIGHT_VERIFIED:
    case DealStatus.PAYMENT_PENDING:
      return 3;
    case DealStatus.PAID:
    case DealStatus.COMPLETED:
      return 4;
    default:
      return -1;
  }
}

function dateTimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCapability('farmer.deals.view', 'arhti.deals.manage');
  const { t, crop, place, status, grade, kg, perKg, money, dateTime, deduction, isUrdu } = await getI18n();

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

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={`${crop(deal.crop)} — ${kg(deal.agreedQuantityKg)}`}
        subtitle={
          isUrdu
            ? `${place(deal.sourceCity)}، ${place(deal.sourceProvince)} ← ${place(deal.destinationMandi.name)}`
            : `${deal.sourceCity}, ${deal.sourceProvince} → ${deal.destinationMandi.name}`
        }
        action={
          <Link
            href="/deals"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            {t('deal.allDeals')}
          </Link>
        }
      />
      <div className="-mt-4 mb-4 text-[11px] text-[#636E72] font-mono">{deal.dealNumber}</div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('deal.agreedRate')} value={perKg(deal.agreedPricePerKg)} tone="accent" />
        <StatCard
          label={t('deal.agreedQty')}
          value={kg(deal.agreedQuantityKg)}
          hint={grade(deal.batch.grade)}
        />
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

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3">
              <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-charcoal">{crop(deal.crop)}</span>
                  {/* Variety is typed by the farmer and shown as stored. */}
                  {deal.batch.variety && (
                    <span className="text-[11px] text-[#636E72]">{deal.batch.variety}</span>
                  )}
                  <Badge tone={statusTone(deal.status)}>{status(deal.status)}</Badge>
                </div>
                <div className="text-[11px] text-[#636E72] mt-0.5">
                  {t('deal.batch', { batch: deal.batch.batchNumber })}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                  <div>
                    <div className="text-[10px] text-[#636E72]">
                      {isFarmer ? t('deal.buyingArhti') : t('deal.sellingFarmer')}
                    </div>
                    <div className="font-semibold text-charcoal">{counterparty.name}</div>
                    {!isFarmer && 'location' in counterparty && counterparty.location && (
                      <div className="text-[10px] text-[#636E72]">{place(counterparty.location)}</div>
                    )}
                    {isFarmer && deal.arhti.arhtiProfile?.businessName && (
                      <div className="text-[10px] text-[#636E72]">
                        {deal.arhti.arhtiProfile.businessName}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] text-[#636E72]">{t('deal.contact')}</div>
                    <div className="font-semibold text-charcoal" dir="ltr">{counterparty.phone ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#636E72]">{t('deal.destinationMandi')}</div>
                    <div className="font-semibold text-charcoal">{place(deal.destinationMandi.name)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#636E72]">{t('deal.transport')}</div>
                    <div className="font-semibold text-charcoal">{responsibleParty}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-3">
              {t('deal.progress')}
            </h2>
            <ol className="space-y-3">
              {STAGES.map((stage, index) => {
                const done = current > index;
                const active = current === index;
                return (
                  <li key={stage.status} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                        done
                          ? 'bg-agri-900 text-white'
                          : active
                            ? 'bg-[#E8F3EE] text-agri-900 border border-[#B7D4C8]'
                            : 'bg-[#F2F4F7] text-[#636E72]'
                      }`}
                    >
                      {done ? '✓' : index + 1}
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-semibold ${
                          done || active ? 'text-charcoal' : 'text-[#636E72]'
                        }`}
                      >
                        {t(stage.label)}
                      </div>
                      {active && (
                        <div className="text-[10px] text-agri-900 font-semibold">{t('deal.inProgressNow')}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {deal.pickup && (
            <Card>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-3">
                {t('deal.transport')}
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-[#636E72]">{t('deal.driver')}</div>
                  <div className="font-semibold text-charcoal">{deal.pickup.driverName}</div>
                  <div className="text-[10px] text-[#636E72]" dir="ltr">{deal.pickup.driverPhone}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#636E72]">{t('deal.vehicle')}</div>
                  {/* Plate and vehicle type are typed text, shown as stored. */}
                  <div className="font-semibold text-charcoal">
                    {deal.pickup.vehiclePlate ?? deal.pickup.vehicleType ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#636E72]">{t('deal.scheduled')}</div>
                  <div className="font-semibold text-charcoal">{when(deal.pickup.scheduledAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#636E72]">{t('deal.loaded')}</div>
                  <div className="font-semibold text-charcoal">
                    {when(deal.pickup.confirmedAt) ?? t('common.notYet')}
                  </div>
                </div>
                {deal.pickup.estimatedCost != null && (
                  <div>
                    <div className="text-[10px] text-[#636E72]">{t('deal.freight')}</div>
                    <div className="font-semibold text-charcoal">
                      {money(deal.pickup.estimatedCost)}
                    </div>
                  </div>
                )}
                {deal.pickup.tracking && (
                  <div>
                    <div className="text-[10px] text-[#636E72]">{t('deal.deliveryStatus')}</div>
                    <div className="font-semibold text-charcoal">
                      {status(deal.pickup.tracking.stage)}
                    </div>
                    {/* Tracking notes are typed text, shown as stored. */}
                    <div className="text-[10px] text-[#636E72]">
                      {deal.pickup.tracking.statusNotes}
                    </div>
                  </div>
                )}
              </div>
              {deal.pickup.notes && (
                <p className="text-[11px] text-[#636E72] mt-3">{deal.pickup.notes}</p>
              )}
            </Card>
          )}

          {deal.settlement && (
            <Card>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-3">
                {t('deal.settlement')}
              </h2>
              <dl className="text-xs space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-[#636E72]">
                    {t('deal.gross', {
                      qty: kg(deal.receivedQuantityKg ?? deal.agreedQuantityKg),
                      rate: money(deal.agreedPricePerKg),
                    })}
                  </dt>
                  <dd className="font-semibold text-charcoal">
                    {money(deal.settlement.grossAmount)}
                  </dd>
                </div>
                {deal.settlement.deductions.map((d) => (
                  <div key={d.id} className="flex justify-between">
                    <dt className="text-[#636E72]">{deduction(d.type, d.description)}</dt>
                    <dd className="text-red-700">− {money(d.amount)}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-[#E5E7EB] pt-2 mt-2">
                  <dt className="font-bold text-charcoal">{t('deal.netPayable')}</dt>
                  <dd className="font-bold text-agri-900">{money(deal.settlement.netPayable)}</dd>
                </div>
              </dl>
              {deal.weightVerifierName && (
                <p className="text-[10px] text-[#636E72] mt-3">
                  {t('deal.weighedBy', { name: deal.weightVerifierName, date: when(deal.weightVerifiedAt) ?? '' })}
                </p>
              )}
            </Card>
          )}

          <Card>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-3">
              {t('deal.trace')}
            </h2>
            {/* Event titles and descriptions are written in English when the
                event is recorded and are shown as stored for now. */}
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#B7D4C8] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-charcoal">{event.title}</div>
                    <div className="text-[11px] text-[#636E72]">{event.description}</div>
                    <div className="text-[10px] text-[#636E72] mt-0.5">
                      {when(event.createdAt)}
                      {event.quantityKg != null && ` · ${kg(event.quantityKg)}`}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          {canSchedule && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">{t('deal.bookTruck')}</h2>
              <p className="text-[11px] text-[#636E72] mb-3">
                {t('deal.noAccountNeeded', { who: responsibleParty })}
              </p>
              <ActionForm
                action={schedulePickup}
                submitLabel={t('deal.saveTransport')}
                successMessage={t('deal.transportSaved')}
                hidden={{ dealId: deal.id }}
              >
                <div className="space-y-3">
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
                    <input
                      type="datetime-local"
                      name="scheduledAt"
                      required
                      defaultValue={dateTimeLocal(defaultPickup)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label={t('deal.freightCost')} hint={t('deal.freightHint')}>
                    <input
                      type="number"
                      name="estimatedCost"
                      min="0"
                      step="100"
                      className={inputClass}
                      placeholder="18000"
                    />
                  </Field>
                  <Field label={t('deal.notes')}>
                    <input name="notes" className={inputClass} placeholder={t('deal.placeholderNotes')} />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          )}

          {deal.status === DealStatus.AGREED && !canSchedule && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">{t('deal.waitingTransport')}</h2>
              <p className="text-[11px] text-[#636E72]">
                {t('deal.waitingTransportText', { who: responsibleParty, name: counterparty.name })}
              </p>
            </Card>
          )}

          {canConfirmPickup && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">{t('deal.confirmLoading')}</h2>
              <p className="text-[11px] text-[#636E72] mb-3">
                {t('deal.confirmLoadingText', {
                  driver: deal.pickup?.driverName ?? '',
                  qty: kg(deal.agreedQuantityKg),
                  city: place(deal.destinationMandi.city),
                })}
              </p>
              <ActionForm
                action={confirmPickup}
                submitLabel={t('deal.produceLoaded')}
                successMessage={t('deal.markedTransit')}
                hidden={{ dealId: deal.id }}
                variant="secondary"
              />
            </Card>
          )}

          {canReceive && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">{t('deal.receive')}</h2>
              <p className="text-[11px] text-[#636E72] mb-3">{t('deal.receiveText')}</p>
              <ActionForm
                action={receiveProduce}
                submitLabel={t('deal.recordWeight')}
                successMessage={t('deal.received')}
                hidden={{ dealId: deal.id }}
              >
                <div className="space-y-3">
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
              </ActionForm>
            </Card>
          )}

          {canPay && deal.settlement && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">{t('deal.releasePayment')}</h2>
              <p className="text-[11px] text-[#636E72] mb-3">
                {t('deal.releaseText', {
                  net: money(deal.settlement.netPayable),
                  name: deal.farmer.name,
                  deductions: money(deal.settlement.deductionsTotal),
                })}
              </p>
              <ActionForm
                action={payFarmer}
                submitLabel={t('deal.pay', { amount: money(deal.settlement.netPayable) })}
                successMessage={t('deal.paid')}
                hidden={{ dealId: deal.id }}
              />
            </Card>
          )}

          {isFarmer && deal.status === DealStatus.PAYMENT_PENDING && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">{t('deal.awaitingPayment')}</h2>
              <p className="text-[11px] text-[#636E72]">
                {t('deal.awaitingPaymentText', {
                  name: deal.arhti.name,
                  amount: deal.settlement ? money(deal.settlement.netPayable) : t('deal.settledAmount'),
                })}
              </p>
            </Card>
          )}

          {deal.status === DealStatus.COMPLETED && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">{t('deal.complete')}</h2>
              <p className="text-[11px] text-[#636E72]">
                {isFarmer
                  ? t('deal.completeFarmer')
                  : t('deal.completeArhti', { lot: deal.inventoryLot?.lotNumber ?? '' })}
              </p>
              <Link
                href={isFarmer ? '/records' : '/inventory'}
                className="inline-block mt-3 text-[11px] font-semibold text-agri-900 hover:underline"
              >
                {isFarmer ? t('deal.openRecords') : t('deal.openInventory')}
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
