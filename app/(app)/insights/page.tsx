import { UserRole, ConsumerOrderStatus, AuctionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { Badge, Card, PageHeader, StatCard, money, qty } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

type CropRow = { crop: string; kg: number; value: number; cost?: number };

function rate(value: number, kg: number) {
  return kg > 0 ? value / kg : 0;
}

function CropTable({
  title,
  rows,
  valueLabel,
  showMargin = false,
}: {
  title: string;
  rows: CropRow[];
  valueLabel: string;
  showMargin?: boolean;
}) {
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, 6);
  const max = sorted[0]?.value ?? 0;

  return (
    <Card>
      <h2 className="text-xs font-bold text-charcoal mb-3">{title}</h2>
      {sorted.length === 0 ? (
        <p className="text-[11px] text-[#636E72] py-4 text-center">Nothing traded yet.</p>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((row) => (
            <div key={row.crop}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-charcoal">{row.crop}</span>
                <span className="text-[#636E72]">
                  {qty(row.kg)} · <span className="font-semibold text-charcoal">{money(row.value)}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F2F4F7] mt-1">
                <div
                  className="h-1.5 rounded-full bg-agri-900"
                  style={{ width: `${max > 0 ? Math.max(4, (row.value / max) * 100) : 0}%` }}
                />
              </div>
              <div className="text-[10px] text-[#636E72] mt-0.5">
                {money(rate(row.value, row.kg))}/kg {valueLabel}
                {showMargin && row.cost !== undefined && row.kg > 0
                  ? ` · ${money(rate(row.value - row.cost, row.kg))}/kg margin`
                  : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

async function ArhtiInsights({ userId }: { userId: string }) {
  const [deals, sales, auctions] = await Promise.all([
    prisma.farmerArhtiDeal.findMany({
      where: { arhtiId: userId, receivedQuantityKg: { not: null } },
      select: {
        receivedQuantityKg: true,
        agreedPricePerKg: true,
        grossAmount: true,
        crop: { select: { name: true } },
      },
    }),
    prisma.arhtiVendorSale.findMany({
      where: { arhtiId: userId },
      select: {
        quantityKg: true,
        ratePerKg: true,
        grossAmount: true,
        commission: true,
        auction: { select: { reservePrice: true, inventoryLot: { select: { crop: { select: { name: true } }, purchasePricePerKg: true } } } },
      },
    }),
    prisma.auction.groupBy({ by: ['status'], where: { arhtiId: userId }, _count: { status: true } }),
  ]);

  const boughtKg = deals.reduce((sum, d) => sum + (d.receivedQuantityKg ?? 0), 0);
  const boughtValue = deals.reduce((sum, d) => sum + (d.receivedQuantityKg ?? 0) * d.agreedPricePerKg, 0);
  const soldKg = sales.reduce((sum, s) => sum + s.quantityKg, 0);
  const soldValue = sales.reduce((sum, s) => sum + s.grossAmount, 0);
  const commission = sales.reduce((sum, s) => sum + s.commission, 0);
  const aboveReserve = sales.filter((s) => s.ratePerKg > s.auction.reservePrice).length;

  const byCrop = new Map<string, CropRow>();
  for (const sale of sales) {
    const name = sale.auction.inventoryLot.crop.name;
    const row = byCrop.get(name) ?? { crop: name, kg: 0, value: 0, cost: 0 };
    row.kg += sale.quantityKg;
    row.value += sale.grossAmount;
    row.cost = (row.cost ?? 0) + sale.quantityKg * sale.auction.inventoryLot.purchasePricePerKg;
    byCrop.set(name, row);
  }

  const sold = auctions.find((a) => a.status === AuctionStatus.SOLD)?._count.status ?? 0;
  const expired = auctions.find((a) => a.status === AuctionStatus.EXPIRED)?._count.status ?? 0;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Bought from farmers" value={money(boughtValue)} hint={qty(boughtKg)} />
        <StatCard label="Sold to vendors" value={money(soldValue)} hint={qty(soldKg)} tone="accent" />
        <StatCard
          label="Avg spread"
          value={`${money(rate(soldValue, soldKg) - rate(boughtValue, boughtKg))}/kg`}
          hint={`Buy ${money(rate(boughtValue, boughtKg))} → sell ${money(rate(soldValue, soldKg))}`}
        />
        <StatCard label="Commission earned" value={money(commission)} hint={`${sales.length} auction sales`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CropTable title="Auction sales by crop" rows={[...byCrop.values()]} valueLabel="realized" showMargin />
        <Card>
          <h2 className="text-xs font-bold text-charcoal mb-3">Auction performance</h2>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">Lots sold</span>
              <span className="font-semibold text-charcoal">{sold}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">Expired unsold</span>
              <span className="font-semibold text-charcoal">{expired}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">Closed above reserve</span>
              <span className="font-semibold text-agri-900">
                {aboveReserve} of {sales.length}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#636E72]">Weight shrinkage absorbed</span>
              <span className="font-semibold text-charcoal">
                {qty(Math.max(0, boughtKg - soldKg))}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

async function VendorInsights({ userId }: { userId: string }) {
  const [purchases, sales, stock] = await Promise.all([
    prisma.arhtiVendorSale.aggregate({
      where: { vendorId: userId },
      _sum: { grossAmount: true, quantityKg: true },
      _count: true,
    }),
    prisma.vendorShopkeeperSale.findMany({
      where: { vendorId: userId },
      select: {
        quantityKg: true,
        ratePerKg: true,
        grossAmount: true,
        offer: { select: { crop: { select: { name: true } }, stock: { select: { costPerKg: true } } } },
      },
    }),
    prisma.vendorInventory.aggregate({
      where: { vendorId: userId },
      _sum: { availableKg: true, quantityKg: true },
    }),
  ]);

  const soldKg = sales.reduce((sum, s) => sum + s.quantityKg, 0);
  const soldValue = sales.reduce((sum, s) => sum + s.grossAmount, 0);
  const cogs = sales.reduce((sum, s) => sum + s.quantityKg * s.offer.stock.costPerKg, 0);
  const boughtKg = purchases._sum.quantityKg ?? 0;
  const heldKg = stock._sum.availableKg ?? 0;

  const byCrop = new Map<string, CropRow>();
  for (const sale of sales) {
    const name = sale.offer.crop.name;
    const row = byCrop.get(name) ?? { crop: name, kg: 0, value: 0, cost: 0 };
    row.kg += sale.quantityKg;
    row.value += sale.grossAmount;
    row.cost = (row.cost ?? 0) + sale.quantityKg * sale.offer.stock.costPerKg;
    byCrop.set(name, row);
  }

  const turnover = boughtKg > 0 ? Math.round((soldKg / boughtKg) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Bought at mandi"
          value={money(purchases._sum.grossAmount ?? 0)}
          hint={`${qty(boughtKg)} in ${purchases._count} lots`}
        />
        <StatCard label="Wholesale revenue" value={money(soldValue)} hint={qty(soldKg)} tone="accent" />
        <StatCard
          label="Gross margin"
          value={money(soldValue - cogs)}
          hint={soldKg > 0 ? `${money(rate(soldValue - cogs, soldKg))}/kg` : 'No sales yet'}
        />
        <StatCard
          label="Stock turned"
          value={`${turnover}%`}
          tone={heldKg > 0 ? 'warn' : 'default'}
          hint={`${qty(heldKg)} still in warehouse`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CropTable title="Wholesale sales by crop" rows={[...byCrop.values()]} valueLabel="sold" showMargin />
        <Card>
          <h2 className="text-xs font-bold text-charcoal mb-3">Where the money went</h2>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">Avg mandi cost</span>
              <span className="font-semibold text-charcoal">
                {money(rate(purchases._sum.grossAmount ?? 0, boughtKg))}/kg
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">Avg wholesale price</span>
              <span className="font-semibold text-charcoal">{money(rate(soldValue, soldKg))}/kg</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">Markup</span>
              <span className="font-semibold text-agri-900">
                {cogs > 0 ? `${Math.round(((soldValue - cogs) / cogs) * 100)}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#636E72]">Capital still on the floor</span>
              <span className="font-semibold text-charcoal">{qty(heldKg)}</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

async function ShopkeeperInsights({ userId }: { userId: string }) {
  const [purchases, items, orders, listings] = await Promise.all([
    prisma.vendorShopkeeperSale.aggregate({
      where: { shopkeeperId: userId },
      _sum: { grossAmount: true, quantityKg: true },
      _count: true,
    }),
    prisma.consumerOrderItem.findMany({
      where: { order: { shopkeeperId: userId, status: { not: ConsumerOrderStatus.CANCELLED } } },
      select: {
        quantityKg: true,
        lineTotal: true,
        listing: { select: { crop: { select: { name: true } }, stock: { select: { costPerKg: true } } } },
      },
    }),
    prisma.consumerOrder.groupBy({
      by: ['status'],
      where: { shopkeeperId: userId },
      _count: { status: true },
    }),
    prisma.shopkeeperInventory.aggregate({
      where: { shopkeeperId: userId },
      _sum: { availableKg: true },
    }),
  ]);

  const soldKg = items.reduce((sum, i) => sum + i.quantityKg, 0);
  const revenue = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const cogs = items.reduce((sum, i) => sum + i.quantityKg * i.listing.stock.costPerKg, 0);
  const delivered = orders.find((o) => o.status === ConsumerOrderStatus.DELIVERED)?._count.status ?? 0;
  const cancelled = orders.find((o) => o.status === ConsumerOrderStatus.CANCELLED)?._count.status ?? 0;
  const totalOrders = orders.reduce((sum, o) => sum + o._count.status, 0);

  const byCrop = new Map<string, CropRow>();
  for (const item of items) {
    const name = item.listing.crop.name;
    const row = byCrop.get(name) ?? { crop: name, kg: 0, value: 0, cost: 0 };
    row.kg += item.quantityKg;
    row.value += item.lineTotal;
    row.cost = (row.cost ?? 0) + item.quantityKg * item.listing.stock.costPerKg;
    byCrop.set(name, row);
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Wholesale spend"
          value={money(purchases._sum.grossAmount ?? 0)}
          hint={`${qty(purchases._sum.quantityKg ?? 0)} in ${purchases._count} purchases`}
        />
        <StatCard label="Counter revenue" value={money(revenue)} hint={qty(soldKg)} tone="accent" />
        <StatCard
          label="Gross profit"
          value={money(revenue - cogs)}
          hint={soldKg > 0 ? `${money(rate(revenue - cogs, soldKg))}/kg` : 'No sales yet'}
        />
        <StatCard
          label="Orders delivered"
          value={String(delivered)}
          hint={totalOrders ? `${cancelled} cancelled of ${totalOrders}` : 'No orders yet'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CropTable title="Best sellers" rows={[...byCrop.values()]} valueLabel="retail" showMargin />
        <Card>
          <h2 className="text-xs font-bold text-charcoal mb-3">Shop health</h2>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">Avg wholesale cost</span>
              <span className="font-semibold text-charcoal">
                {money(rate(purchases._sum.grossAmount ?? 0, purchases._sum.quantityKg ?? 0))}/kg
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">Avg shelf price</span>
              <span className="font-semibold text-charcoal">{money(rate(revenue, soldKg))}/kg</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">Markup</span>
              <span className="font-semibold text-agri-900">
                {cogs > 0 ? `${Math.round(((revenue - cogs) / cogs) * 100)}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#636E72]">Unsold stock</span>
              <span className="font-semibold text-charcoal">{qty(listings._sum.availableKg ?? 0)}</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

async function AdminInsights() {
  const [farmGate, mandi, wholesale, retailItems, batches] = await Promise.all([
    prisma.farmerArhtiDeal.aggregate({
      where: { receivedQuantityKg: { not: null } },
      _sum: { grossAmount: true, receivedQuantityKg: true },
    }),
    prisma.arhtiVendorSale.aggregate({ _sum: { grossAmount: true, quantityKg: true } }),
    prisma.vendorShopkeeperSale.aggregate({ _sum: { grossAmount: true, quantityKg: true } }),
    prisma.consumerOrderItem.findMany({
      where: { order: { status: { not: ConsumerOrderStatus.CANCELLED } } },
      select: { quantityKg: true, lineTotal: true, listing: { select: { crop: { select: { name: true } } } } },
    }),
    prisma.farmerCropBatch.aggregate({ _sum: { quantityKg: true }, _count: true }),
  ]);

  const farmRate = rate(farmGate._sum.grossAmount ?? 0, farmGate._sum.receivedQuantityKg ?? 0);
  const mandiRate = rate(mandi._sum.grossAmount ?? 0, mandi._sum.quantityKg ?? 0);
  const wholesaleRate = rate(wholesale._sum.grossAmount ?? 0, wholesale._sum.quantityKg ?? 0);
  const retailKg = retailItems.reduce((sum, i) => sum + i.quantityKg, 0);
  const retailValue = retailItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const retailRate = rate(retailValue, retailKg);

  const byCrop = new Map<string, CropRow>();
  for (const item of retailItems) {
    const name = item.listing.crop.name;
    const row = byCrop.get(name) ?? { crop: name, kg: 0, value: 0 };
    row.kg += item.quantityKg;
    row.value += item.lineTotal;
    byCrop.set(name, row);
  }

  const stages = [
    { label: 'Farm gate', rate: farmRate, who: 'Farmer receives' },
    { label: 'Mandi auction', rate: mandiRate, who: 'Arhti realizes' },
    { label: 'Wholesale', rate: wholesaleRate, who: 'Vendor charges' },
    { label: 'Retail', rate: retailRate, who: 'Consumer pays' },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Harvest logged" value={qty(batches._sum.quantityKg ?? 0)} hint={`${batches._count} batches`} />
        <StatCard label="Mandi turnover" value={money(mandi._sum.grossAmount ?? 0)} hint={qty(mandi._sum.quantityKg ?? 0)} />
        <StatCard label="Retail turnover" value={money(retailValue)} hint={qty(retailKg)} tone="accent" />
        <StatCard
          label="Farmer share"
          value={retailRate > 0 ? `${Math.round((farmRate / retailRate) * 100)}%` : '—'}
          hint="Of the shelf price"
          tone="warn"
        />
      </div>

      <Card className="mb-4">
        <h2 className="text-xs font-bold text-charcoal mb-1">Average rate at each stage</h2>
        <p className="text-[11px] text-[#636E72] mb-3">
          Network-wide averages. Only admins see the whole ladder in one place.
        </p>
        <div className="space-y-2.5">
          {stages.map((stage) => (
            <div key={stage.label}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-charcoal">{stage.label}</span>
                <span className="text-[#636E72]">
                  {stage.who} <span className="font-semibold text-charcoal">{money(stage.rate)}/kg</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F2F4F7] mt-1">
                <div
                  className="h-1.5 rounded-full bg-agri-900"
                  style={{ width: `${retailRate > 0 ? Math.max(4, (stage.rate / retailRate) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <CropTable title="Retail demand by crop" rows={[...byCrop.values()]} valueLabel="consumer spend" />
    </>
  );
}

export default async function InsightsPage() {
  const user = await requireCapability('shared.insights');

  const prices = await prisma.marketPrice.findMany({
    select: {
      id: true,
      ratePerKg: true,
      changePercent: true,
      trend: true,
      dailyArrivalTonnes: true,
      crop: { select: { name: true } },
      mandi: { select: { name: true, city: true } },
    },
    orderBy: { ratePerKg: 'desc' },
    take: 6,
  });

  const title =
    user.role === UserRole.SHOPKEEPER
      ? 'Shop Insights'
      : user.role === UserRole.ADMIN
        ? 'Market Insights'
        : 'Trade Insights';

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={title}
        titleUrdu="رپورٹ"
        subtitle="Your own trading numbers, plus the published mandi rates. Other participants' costs and margins stay private to them."
      />

      {user.role === UserRole.ARHTI && <ArhtiInsights userId={user.id} />}
      {user.role === UserRole.VENDOR && <VendorInsights userId={user.id} />}
      {user.role === UserRole.SHOPKEEPER && <ShopkeeperInsights userId={user.id} />}
      {user.role === UserRole.ADMIN && <AdminInsights />}

      <Card className="mt-4">
        <h2 className="text-xs font-bold text-charcoal mb-3">Published mandi rates</h2>
        <div className="divide-y divide-[#E5E7EB]">
          {prices.length === 0 && (
            <p className="text-[11px] text-[#636E72] py-4 text-center">No market price data yet.</p>
          )}
          {prices.map((price) => (
            <div key={price.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-charcoal">{price.crop.name}</div>
                <div className="text-[10px] text-[#636E72]">
                  {price.mandi.name}, {price.mandi.city}
                  {price.dailyArrivalTonnes ? ` · ${price.dailyArrivalTonnes}t arrivals` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-charcoal">{money(price.ratePerKg)}/kg</div>
                <Badge tone={price.changePercent >= 0 ? 'green' : 'red'}>
                  {price.changePercent >= 0 ? '▲' : '▼'} {Math.abs(price.changePercent).toFixed(1)}%
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
