import Link from 'next/link';
import { AuctionStatus, InventoryLotStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createAuction } from '@/lib/actions/auctions';
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

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

export default async function InventoryPage() {
  const user = await requireCapability('arhti.inventory.manage');

  const lots = await prisma.arhtiInventoryLot.findMany({
    where: { arhtiId: user.id, status: { not: InventoryLotStatus.SPOILED } },
    include: {
      crop: true,
      mandi: { select: { name: true, city: true } },
      deal: { select: { id: true, dealNumber: true, farmer: { select: { name: true } } } },
      auctions: {
        select: {
          id: true,
          auctionNumber: true,
          quantityKg: true,
          status: true,
          currentHighestBid: true,
          reservePrice: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const held = lots.reduce((sum, lot) => sum + lot.availableQuantityKg, 0);
  const capital = lots.reduce(
    (sum, lot) => sum + lot.availableQuantityKg * lot.purchasePricePerKg,
    0
  );
  const inAuction = lots.reduce(
    (sum, lot) =>
      sum +
      lot.auctions
        .filter((a) => a.status === AuctionStatus.ACTIVE)
        .reduce((s, a) => s + a.quantityKg, 0),
    0
  );

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Mandi Inventory"
        titleUrdu="منڈی اسٹاک"
        subtitle="Produce you own after weighing it in. Put any uncommitted quantity into a mandi auction for vendors to bid on."
        action={
          <Link
            href="/auction-house"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            Auction House
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Lots held" value={String(lots.length)} />
        <StatCard label="Unsold stock" value={qty(held)} tone="accent" />
        <StatCard label="Locked in auctions" value={qty(inAuction)} />
        <StatCard label="Capital at cost" value={money(Math.round(capital))} />
      </div>

      {lots.length === 0 ? (
        <EmptyState
          title="No stock yet"
          message="Weigh in an inbound consignment on the Receiving screen and the lot appears here under your ownership."
          actionHref="/receiving"
          actionLabel="Open Receiving"
        />
      ) : (
        <div className="space-y-3">
          {lots.map((lot) => {
            const liveAuction = lot.auctions.find((a) => a.status === AuctionStatus.ACTIVE);
            const canAuction = lot.availableQuantityKg > 0;
            const floor = Math.ceil(lot.purchasePricePerKg * 1.05);
            return (
              <Card key={lot.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={firstPhoto(lot.photos) ?? lot.crop.imageUrl}
                    name={lot.crop.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{lot.crop.name}</span>
                      <Badge tone="neutral">{lot.grade}</Badge>
                      <Badge tone={statusTone(lot.status)}>{humanStatus(lot.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {lot.lotNumber}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      From {lot.deal.farmer.name}, {lot.sourceCity} · held at {lot.mandi.name}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Received</div>
                        <div className="font-semibold text-charcoal">
                          {qty(lot.receivedQuantityKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Available</div>
                        <div className="font-semibold text-agri-900">
                          {qty(lot.availableQuantityKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Your cost</div>
                        <div className="font-semibold text-charcoal">
                          {money(lot.purchasePricePerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Source deal</div>
                        <Link
                          href={`/deals/${lot.deal.id}`}
                          className="font-semibold text-agri-900 hover:underline truncate block"
                        >
                          {lot.deal.dealNumber}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {liveAuction && (
                  <div className="mt-3 p-2.5 rounded-lg bg-[#E8F3EE] border border-[#B7D4C8] text-[11px] flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-agri-900 font-semibold">
                      {qty(liveAuction.quantityKg)} live in {liveAuction.auctionNumber} —{' '}
                      {liveAuction.currentHighestBid
                        ? `top bid ${money(liveAuction.currentHighestBid)}/kg`
                        : `reserve ${money(liveAuction.reservePrice)}/kg, no bids yet`}
                    </span>
                    <Link
                      href="/auction-house"
                      className="font-semibold text-agri-900 hover:underline"
                    >
                      Manage
                    </Link>
                  </div>
                )}

                {canAuction && (
                  <details className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer">
                      Open a mandi auction on this lot
                    </summary>
                    <ActionForm
                      action={createAuction}
                      submitLabel="Start auction"
                      submitLabelUrdu="نیلامی شروع"
                      successMessage="Auction is live. Vendors in the mandi can bid now."
                      hidden={{ inventoryLotId: lot.id }}
                      className="mt-3"
                    >
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field
                          label="Quantity (kg)"
                          labelUrdu="مقدار"
                          hint={`Up to ${qty(lot.availableQuantityKg)}`}
                        >
                          <input
                            type="number"
                            name="quantityKg"
                            required
                            min="1"
                            step="1"
                            max={lot.availableQuantityKg}
                            defaultValue={lot.availableQuantityKg}
                            className={inputClass}
                          />
                        </Field>
                        <Field
                          label="Reserve price (Rs/kg)"
                          labelUrdu="کم از کم ریٹ"
                          hint={`Must cover your ${money(lot.purchasePricePerKg)}/kg cost`}
                        >
                          <input
                            type="number"
                            name="reservePrice"
                            required
                            min={lot.purchasePricePerKg}
                            step="0.5"
                            defaultValue={floor}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Minimum bid increment (Rs)">
                          <input
                            type="number"
                            name="minimumIncrement"
                            min="0.5"
                            step="0.5"
                            defaultValue={1}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Duration (minutes)">
                          <select name="durationMinutes" defaultValue={30} className={inputClass}>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={180}>3 hours</option>
                          </select>
                        </Field>
                      </div>
                    </ActionForm>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
