import Link from 'next/link';
import {
  AuctionStatus,
  CropBatchStatus,
  DealStatus,
  DemandStatus,
  InventoryLotStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Badge, Card, CropThumb, StatCard, humanStatus, money, qty, statusTone } from '@/components/ui/kit';

const INCOMING: DealStatus[] = [
  DealStatus.PICKUP_SCHEDULED,
  DealStatus.PICKED_UP,
  DealStatus.IN_TRANSIT,
];

export default async function ArhtiHome({ userId, name }: { userId: string; name: string }) {
  const [profile, incoming, lots, liveAuctions, freshBatches, openDemand, sales] = await Promise.all([
    prisma.arhtiProfile.findUnique({
      where: { userId },
      select: { businessName: true, commissionRate: true, mandi: { select: { name: true, city: true } } },
    }),
    prisma.farmerArhtiDeal.findMany({
      where: { arhtiId: userId, status: { in: INCOMING } },
      select: {
        id: true,
        dealNumber: true,
        agreedQuantityKg: true,
        agreedPricePerKg: true,
        status: true,
        sourceCity: true,
        crop: { select: { name: true, imageUrl: true } },
        farmer: { select: { name: true } },
        pickup: { select: { driverName: true, vehiclePlate: true, expectedArrivalAt: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
    prisma.arhtiInventoryLot.findMany({
      where: {
        arhtiId: userId,
        availableQuantityKg: { gt: 0 },
        status: { in: [InventoryLotStatus.IN_STOCK, InventoryLotStatus.PARTIALLY_AUCTIONED] },
      },
      select: {
        id: true,
        lotNumber: true,
        availableQuantityKg: true,
        receivedQuantityKg: true,
        purchasePricePerKg: true,
        grade: true,
        sourceCity: true,
        sourceFarmerName: true,
        crop: { select: { name: true, imageUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 4,
    }),
    prisma.auction.findMany({
      where: { arhtiId: userId, status: AuctionStatus.ACTIVE },
      select: {
        id: true,
        auctionNumber: true,
        quantityKg: true,
        reservePrice: true,
        currentHighestBid: true,
        bidCount: true,
        endTime: true,
        inventoryLot: { select: { crop: { select: { name: true, imageUrl: true } }, purchasePricePerKg: true } },
      },
      orderBy: { endTime: 'asc' },
      take: 4,
    }),
    prisma.farmerCropBatch.findMany({
      where: { status: CropBatchStatus.READY_FOR_SALE, availableKg: { gt: 0 } },
      select: {
        id: true,
        availableKg: true,
        grade: true,
        originCity: true,
        askingPricePerKg: true,
        harvestDate: true,
        crop: { select: { name: true, imageUrl: true } },
        farmer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.arhtiDemandRequest.count({
      where: { arhtiId: userId, status: { in: [DemandStatus.OPEN, DemandStatus.PARTIALLY_FULFILLED] } },
    }),
    prisma.arhtiVendorSale.aggregate({
      where: { arhtiId: userId },
      _sum: { grossAmount: true, commission: true, quantityKg: true },
    }),
  ]);

  const stockKg = lots.reduce((sum, l) => sum + l.availableQuantityKg, 0);
  const stockCost = lots.reduce((sum, l) => sum + l.availableQuantityKg * l.purchasePricePerKg, 0);

  return (
    <>
      <Card className="mb-4 bg-agri-900 border-agri-900">
        <div className="text-white">
          <div className="text-[11px] text-white/70">Commission agent</div>
          <h1 className="text-lg font-bold">{profile?.businessName ?? name}</h1>
          <p className="text-[11px] text-white/80 mt-1 max-w-lg">
            {profile?.mandi
              ? `Trading at ${profile.mandi.name}, ${profile.mandi.city}.`
              : 'No mandi set on your profile yet.'}{' '}
            Buy from farmers on the left, auction to vendors on the right.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Trucks incoming"
          value={String(incoming.length)}
          tone={incoming.length ? 'warn' : 'default'}
          hint="Awaiting weighing"
        />
        <StatCard label="Mandi stock" value={qty(stockKg)} hint={`${money(stockCost)} tied up`} />
        <StatCard
          label="Live auctions"
          value={String(liveAuctions.length)}
          tone="accent"
          hint={`${openDemand} open buy requests`}
        />
        <StatCard
          label="Commission earned"
          value={money(sales._sum.commission ?? 0)}
          hint={`on ${qty(sales._sum.quantityKg ?? 0)} sold`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">Arriving at your mandi</h2>
            <Link href="/receiving" className="text-[11px] font-semibold text-agri-900 hover:underline">
              Receive &amp; verify
            </Link>
          </div>
          {incoming.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">
              No consignment on the road. Buy from the farmer market to fill your stock.
            </p>
          ) : (
            <div className="space-y-2">
              {incoming.map((deal) => (
                <Link
                  key={deal.id}
                  href="/receiving"
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 hover:bg-amber-100"
                >
                  <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-charcoal">{deal.crop.name}</span>
                      <Badge tone={statusTone(deal.status)}>{humanStatus(deal.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {qty(deal.agreedQuantityKg)} from {deal.farmer.name} · {deal.sourceCity}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {deal.pickup
                        ? `${deal.pickup.driverName}${deal.pickup.vehiclePlate ? ` · ${deal.pickup.vehiclePlate}` : ''}`
                        : 'Pickup not arranged yet'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">Live in the auction house</h2>
            <Link href="/auction-house" className="text-[11px] font-semibold text-agri-900 hover:underline">
              Auction house
            </Link>
          </div>
          {liveAuctions.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">
              Nothing under the hammer. Put a stock lot up for auction.
            </p>
          ) : (
            <div className="space-y-2">
              {liveAuctions.map((auction) => {
                const top = auction.currentHighestBid ?? auction.reservePrice;
                const cost = auction.inventoryLot.purchasePricePerKg;
                const spread = Math.round(((top - cost) / cost) * 100);
                return (
                  <Link
                    key={auction.id}
                    href={`/auctions/${auction.id}`}
                    className="flex items-start gap-3 rounded-xl border border-[#B7D4C8] bg-[#E8F3EE] p-3 hover:bg-[#D8EBE1]"
                  >
                    <CropThumb
                      imageUrl={auction.inventoryLot.crop.imageUrl}
                      name={auction.inventoryLot.crop.name}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-charcoal">
                          {auction.inventoryLot.crop.name}
                        </span>
                        <Badge tone="live">Live</Badge>
                      </div>
                      <div className="text-[11px] text-[#636E72]">
                        {qty(auction.quantityKg)} · top bid{' '}
                        <span className="font-semibold text-charcoal">{money(top)}/kg</span> ·{' '}
                        {auction.bidCount} bids
                      </div>
                      <div className="text-[10px] text-[#636E72]">
                        Bought at {money(cost)}/kg · {spread >= 0 ? '+' : ''}
                        {spread}% on cost
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">Stock waiting to be auctioned</h2>
            <Link href="/inventory" className="text-[11px] font-semibold text-agri-900 hover:underline">
              Inventory
            </Link>
          </div>
          {lots.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">Godown is empty.</p>
          ) : (
            <div className="space-y-2">
              {lots.map((lot) => (
                <div key={lot.id} className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3">
                  <CropThumb imageUrl={lot.crop.imageUrl} name={lot.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-charcoal">{lot.crop.name}</div>
                    <div className="text-[11px] text-[#636E72]">
                      {qty(lot.availableQuantityKg)} unsold of {qty(lot.receivedQuantityKg)} · grade{' '}
                      {lot.grade}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {lot.sourceFarmerName}, {lot.sourceCity} · cost {money(lot.purchasePricePerKg)}/kg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">Fresh from the farms</h2>
            <Link href="/sourcing" className="text-[11px] font-semibold text-agri-900 hover:underline">
              Farmer market
            </Link>
          </div>
          {freshBatches.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">No batch on the market today.</p>
          ) : (
            <div className="space-y-2">
              {freshBatches.map((batch) => (
                <Link
                  key={batch.id}
                  href="/sourcing"
                  className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3 hover:bg-[#F8F9F5]"
                >
                  <CropThumb imageUrl={batch.crop.imageUrl} name={batch.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-charcoal">{batch.crop.name}</div>
                    <div className="text-[11px] text-[#636E72]">
                      {qty(batch.availableKg)} · grade {batch.grade} · {batch.originCity}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {batch.farmer.name}
                      {batch.askingPricePerKg ? ` · asking ${money(batch.askingPricePerKg)}/kg` : ''}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
