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
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import {
  Badge,
  Card,
  CropThumb,
  PageHeader,
  StatCard,
  humanStatus,
  money,
  qty,
  statusTone,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

const STAGES: Array<{ status: DealStatus; label: string; labelUrdu: string }> = [
  { status: DealStatus.AGREED, label: 'Deal agreed', labelUrdu: 'سودا طے' },
  { status: DealStatus.PICKUP_SCHEDULED, label: 'Transport booked', labelUrdu: 'گاڑی بک' },
  { status: DealStatus.IN_TRANSIT, label: 'In transit', labelUrdu: 'راستے میں' },
  { status: DealStatus.PAYMENT_PENDING, label: 'Weighed at mandi', labelUrdu: 'منڈی میں وزن' },
  { status: DealStatus.COMPLETED, label: 'Farmer paid', labelUrdu: 'ادائیگی' },
];

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

function when(date: Date | null | undefined) {
  if (!date) return null;
  return date.toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCapability('farmer.deals.view', 'arhti.deals.manage');

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
      ? 'Farmer arranges transport'
      : deal.transportResponsibility === TransportResponsibility.ARHTI
        ? 'Arhti arranges transport'
        : 'Transport cost shared 50/50';

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
        title={`${deal.crop.name} — ${qty(deal.agreedQuantityKg)}`}
        titleUrdu={deal.dealNumber}
        subtitle={`${deal.sourceCity}, ${deal.sourceProvince} → ${deal.destinationMandi.name}`}
        action={
          <Link
            href="/deals"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            All deals
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Agreed rate" value={`${money(deal.agreedPricePerKg)}/kg`} tone="accent" />
        <StatCard
          label="Agreed quantity"
          value={qty(deal.agreedQuantityKg)}
          hint={deal.batch.grade}
        />
        <StatCard
          label="Weighed at mandi"
          value={deal.receivedQuantityKg ? qty(deal.receivedQuantityKg) : '—'}
          hint={
            deal.weightDifferenceKg != null
              ? `${deal.weightDifferenceKg >= 0 ? '+' : ''}${deal.weightDifferenceKg} kg vs agreed`
              : 'Pending kanta'
          }
          tone={deal.weightDifferenceKg != null && deal.weightDifferenceKg < 0 ? 'warn' : 'default'}
        />
        <StatCard
          label={isFarmer ? 'Net payable to you' : 'Net payable to farmer'}
          value={deal.settlement ? money(deal.settlement.netPayable) : '—'}
          hint={deal.settlement ? humanStatus(deal.settlement.status) : 'After weighing'}
        />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3">
              <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-charcoal">{deal.crop.name}</span>
                  {deal.batch.variety && (
                    <span className="text-[11px] text-[#636E72]">{deal.batch.variety}</span>
                  )}
                  <Badge tone={statusTone(deal.status)}>{humanStatus(deal.status)}</Badge>
                </div>
                <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                  Batch {deal.batch.batchNumber}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                  <div>
                    <div className="text-[10px] text-[#636E72]">
                      {isFarmer ? 'Buying arhti' : 'Selling farmer'}
                    </div>
                    <div className="font-semibold text-charcoal">{counterparty.name}</div>
                    {!isFarmer && 'location' in counterparty && counterparty.location && (
                      <div className="text-[10px] text-[#636E72]">{counterparty.location}</div>
                    )}
                    {isFarmer && deal.arhti.arhtiProfile?.businessName && (
                      <div className="text-[10px] text-[#636E72]">
                        {deal.arhti.arhtiProfile.businessName}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] text-[#636E72]">Contact</div>
                    <div className="font-semibold text-charcoal">{counterparty.phone ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#636E72]">Destination mandi</div>
                    <div className="font-semibold text-charcoal">{deal.destinationMandi.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#636E72]">Transport</div>
                    <div className="font-semibold text-charcoal">{responsibleParty}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-3">
              Deal progress
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
                        {stage.label}
                        <span className="font-normal text-[#636E72] ml-1">{stage.labelUrdu}</span>
                      </div>
                      {active && (
                        <div className="text-[10px] text-agri-900 font-semibold">In progress now</div>
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
                Transport
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-[#636E72]">Driver</div>
                  <div className="font-semibold text-charcoal">{deal.pickup.driverName}</div>
                  <div className="text-[10px] text-[#636E72]">{deal.pickup.driverPhone}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#636E72]">Vehicle</div>
                  <div className="font-semibold text-charcoal">
                    {deal.pickup.vehiclePlate ?? deal.pickup.vehicleType ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#636E72]">Scheduled</div>
                  <div className="font-semibold text-charcoal">{when(deal.pickup.scheduledAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#636E72]">Loaded</div>
                  <div className="font-semibold text-charcoal">
                    {when(deal.pickup.confirmedAt) ?? 'Not yet confirmed'}
                  </div>
                </div>
                {deal.pickup.estimatedCost != null && (
                  <div>
                    <div className="text-[10px] text-[#636E72]">Freight</div>
                    <div className="font-semibold text-charcoal">
                      {money(deal.pickup.estimatedCost)}
                    </div>
                  </div>
                )}
                {deal.pickup.tracking && (
                  <div>
                    <div className="text-[10px] text-[#636E72]">Delivery status</div>
                    <div className="font-semibold text-charcoal">
                      {humanStatus(deal.pickup.tracking.stage)}
                    </div>
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
                Settlement (parchee)
              </h2>
              <dl className="text-xs space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-[#636E72]">
                    Gross — {qty(deal.receivedQuantityKg ?? deal.agreedQuantityKg)} ×{' '}
                    {money(deal.agreedPricePerKg)}
                  </dt>
                  <dd className="font-semibold text-charcoal">
                    {money(deal.settlement.grossAmount)}
                  </dd>
                </div>
                {deal.settlement.deductions.map((d) => (
                  <div key={d.id} className="flex justify-between">
                    <dt className="text-[#636E72]">{d.description}</dt>
                    <dd className="text-red-700">− {money(d.amount)}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-[#E5E7EB] pt-2 mt-2">
                  <dt className="font-bold text-charcoal">Net payable</dt>
                  <dd className="font-bold text-agri-900">{money(deal.settlement.netPayable)}</dd>
                </div>
              </dl>
              {deal.weightVerifierName && (
                <p className="text-[10px] text-[#636E72] mt-3">
                  Weighed by {deal.weightVerifierName} on {when(deal.weightVerifiedAt)}
                </p>
              )}
            </Card>
          )}

          <Card>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-3">
              Traceability record
            </h2>
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#B7D4C8] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-charcoal">{event.title}</div>
                    <div className="text-[11px] text-[#636E72]">{event.description}</div>
                    <div className="text-[10px] text-[#636E72] mt-0.5">
                      {when(event.createdAt)}
                      {event.quantityKg != null && ` · ${qty(event.quantityKg)}`}
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
              <h2 className="text-xs font-bold text-charcoal mb-1">Book the truck</h2>
              <p className="text-[11px] text-[#636E72] mb-3">
                {responsibleParty}. The driver does not need an AgriConnect account.
              </p>
              <ActionForm
                action={schedulePickup}
                submitLabel="Save transport"
                submitLabelUrdu="گاڑی محفوظ کریں"
                successMessage="Transport booked. Confirm loading once the produce is on the truck."
                hidden={{ dealId: deal.id }}
              >
                <div className="space-y-3">
                  <Field label="Driver name" labelUrdu="ڈرائیور">
                    <input name="driverName" required className={inputClass} placeholder="Ilyas Khan" />
                  </Field>
                  <Field label="Driver phone" labelUrdu="فون">
                    <input name="driverPhone" required className={inputClass} placeholder="03001234567" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Vehicle type">
                      <input name="vehicleType" className={inputClass} placeholder="Mazda 16ft" />
                    </Field>
                    <Field label="Plate">
                      <input name="vehiclePlate" className={inputClass} placeholder="LES-4471" />
                    </Field>
                  </div>
                  <Field label="Pickup time" labelUrdu="وقت">
                    <input
                      type="datetime-local"
                      name="scheduledAt"
                      required
                      defaultValue={dateTimeLocal(defaultPickup)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Freight cost (Rs)" hint="Deducted from the farmer's settlement only if the farmer or both parties bear transport.">
                    <input
                      type="number"
                      name="estimatedCost"
                      min="0"
                      step="100"
                      className={inputClass}
                      placeholder="18000"
                    />
                  </Field>
                  <Field label="Notes">
                    <input name="notes" className={inputClass} placeholder="Load from the link road gate" />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          )}

          {deal.status === DealStatus.AGREED && !canSchedule && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">Waiting on transport</h2>
              <p className="text-[11px] text-[#636E72]">
                {responsibleParty}, so {counterparty.name} books the vehicle for this deal.
              </p>
            </Card>
          )}

          {canConfirmPickup && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">Confirm loading</h2>
              <p className="text-[11px] text-[#636E72] mb-3">
                Confirm once {deal.pickup?.driverName} has loaded {qty(deal.agreedQuantityKg)} and left
                for {deal.destinationMandi.city}.
              </p>
              <ActionForm
                action={confirmPickup}
                submitLabel="Produce is loaded"
                submitLabelUrdu="گاڑی روانہ"
                successMessage="Marked in transit."
                hidden={{ dealId: deal.id }}
                variant="secondary"
              />
            </Card>
          )}

          {canReceive && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">Receive at the mandi</h2>
              <p className="text-[11px] text-[#636E72] mb-3">
                Enter the kanta weight. This creates your inventory lot and generates the farmer&apos;s
                settlement.
              </p>
              <ActionForm
                action={receiveProduce}
                submitLabel="Record weight & take ownership"
                submitLabelUrdu="وزن درج کریں"
                successMessage="Received. The lot is now in your mandi inventory."
                hidden={{ dealId: deal.id }}
              >
                <div className="space-y-3">
                  <Field
                    label="Weighed quantity (kg)"
                    labelUrdu="وزن"
                    hint={`Agreed ${qty(deal.agreedQuantityKg)}. Cannot exceed ${qty(
                      Math.round(deal.agreedQuantityKg * 1.05)
                    )}.`}
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
                  <Field label="Kanta operator" labelUrdu="کانٹا آپریٹر">
                    <input name="verifierName" required className={inputClass} placeholder="Rashid Ali" />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          )}

          {canPay && deal.settlement && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">Release payment</h2>
              <p className="text-[11px] text-[#636E72] mb-3">
                {money(deal.settlement.netPayable)} to {deal.farmer.name} over RAAST, after{' '}
                {money(deal.settlement.deductionsTotal)} in deductions.
              </p>
              <ActionForm
                action={payFarmer}
                submitLabel={`Pay ${money(deal.settlement.netPayable)}`}
                submitLabelUrdu="ادائیگی کریں"
                successMessage="Paid. A parchee receipt has been issued."
                hidden={{ dealId: deal.id }}
              />
            </Card>
          )}

          {isFarmer && deal.status === DealStatus.PAYMENT_PENDING && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">Awaiting payment</h2>
              <p className="text-[11px] text-[#636E72]">
                {deal.arhti.name} has your produce and owes{' '}
                {deal.settlement ? money(deal.settlement.netPayable) : 'the settled amount'}.
              </p>
            </Card>
          )}

          {deal.status === DealStatus.COMPLETED && (
            <Card>
              <h2 className="text-xs font-bold text-charcoal mb-1">Deal complete</h2>
              <p className="text-[11px] text-[#636E72]">
                {isFarmer
                  ? 'Payment received. The parchee is in your records.'
                  : `Farmer paid. Lot ${deal.inventoryLot?.lotNumber ?? ''} is in your mandi inventory.`}
              </p>
              <Link
                href={isFarmer ? '/records' : '/inventory'}
                className="inline-block mt-3 text-[11px] font-semibold text-agri-900 hover:underline"
              >
                {isFarmer ? 'Open my records' : 'Open mandi inventory'}
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
