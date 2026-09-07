import Link from 'next/link';
import { DealStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { confirmPickup, receiveProduce } from '@/lib/actions/deals';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
  humanStatus,
  money,
  qty,
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
        title="Receiving"
        titleUrdu="آمد اور وزن"
        subtitle="Produce heading to your mandi. Weighing on the kanta is the moment ownership transfers to you and the farmer's settlement is generated."
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Inbound deals" value={String(inbound.length)} tone="accent" />
        <StatCard label="Expected volume" value={qty(expectedKg)} />
        <StatCard label="On the road now" value={String(onTruck)} />
      </div>

      {inbound.length === 0 ? (
        <EmptyState
          title="Nothing inbound"
          message="Once a farmer accepts your rate and the truck is booked, the consignment appears here for weighing."
          actionHref="/sourcing"
          actionLabel="Open Farmer Market"
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
                      <span className="text-sm font-bold text-charcoal">{deal.crop.name}</span>
                      <Badge tone={statusTone(deal.status)}>{humanStatus(deal.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {deal.farmer.name} · {deal.sourceCity} →{' '}
                      {deal.destinationMandi.city}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Expected</div>
                        <div className="font-semibold text-charcoal">
                          {qty(deal.agreedQuantityKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Rate</div>
                        <div className="font-semibold text-agri-900">
                          {money(deal.agreedPricePerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Driver</div>
                        <div className="font-semibold text-charcoal truncate">
                          {deal.pickup?.driverName ?? 'Not booked'}
                        </div>
                        {deal.pickup?.vehiclePlate && (
                          <div className="text-[10px] text-[#636E72]">
                            {deal.pickup.vehiclePlate}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">ETA</div>
                        <div className="font-semibold text-charcoal">
                          {deal.pickup?.tracking
                            ? `${deal.pickup.tracking.etaMinutes} min`
                            : deal.pickup?.expectedArrivalAt
                              ? deal.pickup.expectedArrivalAt.toLocaleString('en-PK', {
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
                      Deal {deal.dealNumber}
                    </Link>
                  </div>
                </div>

                {awaitingLoad ? (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <p className="text-[11px] text-[#636E72]">
                      Waiting for loading confirmation at {deal.sourceCity}.
                    </p>
                    <ActionForm
                      action={confirmPickup}
                      submitLabel="Confirm produce is loaded"
                      variant="inline"
                      hidden={{ dealId: deal.id }}
                      className="inline-block"
                    />
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <h3 className="text-[11px] font-bold text-charcoal mb-2">
                      Kanta entry — take ownership
                    </h3>
                    <ActionForm
                      action={receiveProduce}
                      submitLabel="Record weight & create lot"
                      submitLabelUrdu="وزن درج کریں"
                      successMessage="Lot created in your mandi inventory and the farmer's settlement is ready."
                      hidden={{ dealId: deal.id }}
                    >
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field
                          label="Weighed quantity (kg)"
                          labelUrdu="وزن"
                          hint={`Max ${qty(Math.round(deal.agreedQuantityKg * 1.05))}`}
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
                          <input
                            name="verifierName"
                            required
                            className={inputClass}
                            placeholder="Rashid Ali"
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
            Recently received
          </h2>
          <div className="space-y-2">
            {recent.map((deal) => (
              <Card key={deal.id} padded={false}>
                <div className="px-3 py-2.5 flex items-center gap-3 text-xs">
                  <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-charcoal truncate">
                      {qty(deal.receivedQuantityKg ?? 0)} {deal.crop.name}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      from {deal.farmer.name} ·{' '}
                      {deal.receivedAt?.toLocaleDateString('en-PK', {
                        day: 'numeric',
                        month: 'short',
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
