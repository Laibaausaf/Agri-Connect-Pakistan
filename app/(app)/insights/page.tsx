import { UserRole, ConsumerOrderStatus, AuctionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { getI18n } from '@/lib/i18n/server';
import type { I18n } from '@/lib/i18n';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

type CropRow = { crop: string; kg: number; value: number; cost?: number };

/** Crop name in the chosen language, looked up by the stored English name. */
type CropLabel = (name: string) => string;

function rate(value: number, kg: number) {
  return kg > 0 ? value / kg : 0;
}

function CropTable({
  title,
  rows,
  valueLabel,
  showMargin = false,
  i18n,
  cropLabel,
}: {
  title: string;
  rows: CropRow[];
  valueLabel: string;
  showMargin?: boolean;
  i18n: I18n;
  cropLabel: CropLabel;
}) {
  const { t, kg, money, perKg } = i18n;
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, 6);
  const max = sorted[0]?.value ?? 0;

  return (
    <Card>
      <h2 className="text-xs font-bold text-charcoal mb-3">{title}</h2>
      {sorted.length === 0 ? (
        <p className="text-[11px] text-[#636E72] py-4 text-center">{t('insights.nothingTraded')}</p>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((row) => (
            <div key={row.crop}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-charcoal">{cropLabel(row.crop)}</span>
                <span className="text-[#636E72]">
                  {kg(row.kg)} · <span className="font-semibold text-charcoal">{money(row.value)}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F2F4F7] mt-1">
                <div
                  className="h-1.5 rounded-full bg-agri-900"
                  style={{ width: `${max > 0 ? Math.max(4, (row.value / max) * 100) : 0}%` }}
                />
              </div>
              <div className="text-[10px] text-[#636E72] mt-0.5">
                {t('insights.rowRate', { rate: perKg(rate(row.value, row.kg)), label: valueLabel })}
                {showMargin && row.cost !== undefined && row.kg > 0
                  ? ` · ${t('insights.rowMargin', { rate: perKg(rate(row.value - row.cost, row.kg)) })}`
                  : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

async function ArhtiInsights({ userId, i18n, cropLabel }: { userId: string; i18n: I18n; cropLabel: CropLabel }) {
  const { t, kg, money, perKg } = i18n;
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
        <StatCard label={t('insights.boughtFarmers')} value={money(boughtValue)} hint={kg(boughtKg)} />
        <StatCard label={t('insights.soldVendors')} value={money(soldValue)} hint={kg(soldKg)} tone="accent" />
        <StatCard
          label={t('insights.avgSpread')}
          value={perKg(rate(soldValue, soldKg) - rate(boughtValue, boughtKg))}
          hint={t('insights.buySell', { buy: money(rate(boughtValue, boughtKg)), sell: money(rate(soldValue, soldKg)) })}
        />
        <StatCard label={t('insights.commission')} value={money(commission)} hint={t('insights.auctionSales', { count: sales.length })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CropTable
          title={t('insights.byCropAuction')}
          rows={[...byCrop.values()]}
          valueLabel={t('insights.realized')}
          showMargin
          i18n={i18n}
          cropLabel={cropLabel}
        />
        <Card>
          <h2 className="text-xs font-bold text-charcoal mb-3">{t('insights.auctionPerf')}</h2>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">{t('insights.lotsSold')}</span>
              <span className="font-semibold text-charcoal">{sold}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">{t('insights.expired')}</span>
              <span className="font-semibold text-charcoal">{expired}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">{t('insights.aboveReserve')}</span>
              <span className="font-semibold text-agri-900">
                {t('insights.ofTotal', { count: aboveReserve, total: sales.length })}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#636E72]">{t('insights.shrinkage')}</span>
              <span className="font-semibold text-charcoal">
                {kg(Math.max(0, boughtKg - soldKg))}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

async function VendorInsights({ userId, i18n, cropLabel }: { userId: string; i18n: I18n; cropLabel: CropLabel }) {
  const { t, kg, money, perKg } = i18n;
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
          label={t('insights.boughtMandi')}
          value={money(purchases._sum.grossAmount ?? 0)}
          hint={t('insights.inLots', { qty: kg(boughtKg), count: purchases._count })}
        />
        <StatCard label={t('insights.wholesaleRevenue')} value={money(soldValue)} hint={kg(soldKg)} tone="accent" />
        <StatCard
          label={t('insights.grossMargin')}
          value={money(soldValue - cogs)}
          hint={soldKg > 0 ? perKg(rate(soldValue - cogs, soldKg)) : t('insights.noSales')}
        />
        <StatCard
          label={t('insights.stockTurned')}
          value={`${turnover}%`}
          tone={heldKg > 0 ? 'warn' : 'default'}
          hint={t('insights.inWarehouse', { qty: kg(heldKg) })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CropTable
          title={t('insights.byCropWholesale')}
          rows={[...byCrop.values()]}
          valueLabel={t('insights.sold')}
          showMargin
          i18n={i18n}
          cropLabel={cropLabel}
        />
        <Card>
          <h2 className="text-xs font-bold text-charcoal mb-3">{t('insights.moneyWent')}</h2>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">{t('insights.avgMandiCost')}</span>
              <span className="font-semibold text-charcoal">
                {perKg(rate(purchases._sum.grossAmount ?? 0, boughtKg))}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">{t('insights.avgWholesale')}</span>
              <span className="font-semibold text-charcoal">{perKg(rate(soldValue, soldKg))}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">{t('insights.markup')}</span>
              <span className="font-semibold text-agri-900">
                {cogs > 0 ? `${Math.round(((soldValue - cogs) / cogs) * 100)}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#636E72]">{t('insights.capitalFloor')}</span>
              <span className="font-semibold text-charcoal">{kg(heldKg)}</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

async function ShopkeeperInsights({ userId, i18n, cropLabel }: { userId: string; i18n: I18n; cropLabel: CropLabel }) {
  const { t, kg, money, perKg } = i18n;
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
          label={t('insights.wholesaleSpend')}
          value={money(purchases._sum.grossAmount ?? 0)}
          hint={t('insights.inPurchases', { qty: kg(purchases._sum.quantityKg ?? 0), count: purchases._count })}
        />
        <StatCard label={t('insights.counterRevenue')} value={money(revenue)} hint={kg(soldKg)} tone="accent" />
        <StatCard
          label={t('insights.grossProfit')}
          value={money(revenue - cogs)}
          hint={soldKg > 0 ? perKg(rate(revenue - cogs, soldKg)) : t('insights.noSales')}
        />
        <StatCard
          label={t('insights.ordersDelivered')}
          value={String(delivered)}
          hint={totalOrders ? t('insights.cancelledOf', { cancelled, total: totalOrders }) : t('insights.noOrders')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CropTable
          title={t('insights.bestSellers')}
          rows={[...byCrop.values()]}
          valueLabel={t('insights.retail')}
          showMargin
          i18n={i18n}
          cropLabel={cropLabel}
        />
        <Card>
          <h2 className="text-xs font-bold text-charcoal mb-3">{t('insights.shopHealth')}</h2>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">{t('insights.avgWholesaleCost')}</span>
              <span className="font-semibold text-charcoal">
                {perKg(rate(purchases._sum.grossAmount ?? 0, purchases._sum.quantityKg ?? 0))}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">{t('insights.avgShelf')}</span>
              <span className="font-semibold text-charcoal">{perKg(rate(revenue, soldKg))}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
              <span className="text-[#636E72]">{t('insights.markup')}</span>
              <span className="font-semibold text-agri-900">
                {cogs > 0 ? `${Math.round(((revenue - cogs) / cogs) * 100)}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#636E72]">{t('insights.unsold')}</span>
              <span className="font-semibold text-charcoal">{kg(listings._sum.availableKg ?? 0)}</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

async function AdminInsights({ i18n, cropLabel }: { i18n: I18n; cropLabel: CropLabel }) {
  const { t, kg, money, perKg } = i18n;
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
    { label: t('insights.stage.farm'), rate: farmRate, who: t('insights.who.farm') },
    { label: t('insights.stage.mandi'), rate: mandiRate, who: t('insights.who.mandi') },
    { label: t('insights.stage.wholesale'), rate: wholesaleRate, who: t('insights.who.wholesale') },
    { label: t('insights.stage.retail'), rate: retailRate, who: t('insights.who.retail') },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('insights.harvest')} value={kg(batches._sum.quantityKg ?? 0)} hint={t('insights.batches', { count: batches._count })} />
        <StatCard label={t('insights.mandiTurnover')} value={money(mandi._sum.grossAmount ?? 0)} hint={kg(mandi._sum.quantityKg ?? 0)} />
        <StatCard label={t('insights.retailTurnover')} value={money(retailValue)} hint={kg(retailKg)} tone="accent" />
        <StatCard
          label={t('insights.farmerShare')}
          value={retailRate > 0 ? `${Math.round((farmRate / retailRate) * 100)}%` : '—'}
          hint={t('insights.ofShelf')}
          tone="warn"
        />
      </div>

      <Card className="mb-4">
        <h2 className="text-xs font-bold text-charcoal mb-1">{t('insights.avgRate')}</h2>
        <p className="text-[11px] text-[#636E72] mb-3">{t('insights.networkAvg')}</p>
        <div className="space-y-2.5">
          {stages.map((stage) => (
            <div key={stage.label}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-charcoal">{stage.label}</span>
                <span className="text-[#636E72]">
                  {stage.who} <span className="font-semibold text-charcoal">{perKg(stage.rate)}</span>
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

      <CropTable
        title={t('insights.byCropRetail')}
        rows={[...byCrop.values()]}
        valueLabel={t('insights.consumerSpend')}
        i18n={i18n}
        cropLabel={cropLabel}
      />
    </>
  );
}

export default async function InsightsPage() {
  const user = await requireCapability('shared.insights');
  const i18n = await getI18n();
  const { t, crop, place, perKg } = i18n;

  const [prices, crops] = await Promise.all([
    prisma.marketPrice.findMany({
      select: {
        id: true,
        ratePerKg: true,
        changePercent: true,
        trend: true,
        dailyArrivalTonnes: true,
        crop: { select: { name: true, nameUrdu: true } },
        mandi: { select: { name: true, city: true } },
      },
      orderBy: { ratePerKg: 'desc' },
      take: 6,
    }),
    prisma.crop.findMany({ select: { name: true, nameUrdu: true } }),
  ]);

  const cropByName = new Map(crops.map((item) => [item.name, item]));
  const cropLabel: CropLabel = (name) => {
    const found = cropByName.get(name);
    return found ? crop(found) : name;
  };

  const title =
    user.role === UserRole.SHOPKEEPER
      ? t('insights.titleShop')
      : user.role === UserRole.ADMIN
        ? t('insights.titleMarket')
        : t('insights.titleTrade');

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title={title} subtitle={t('insights.subtitle')} />

      {user.role === UserRole.ARHTI && <ArhtiInsights userId={user.id} i18n={i18n} cropLabel={cropLabel} />}
      {user.role === UserRole.VENDOR && <VendorInsights userId={user.id} i18n={i18n} cropLabel={cropLabel} />}
      {user.role === UserRole.SHOPKEEPER && <ShopkeeperInsights userId={user.id} i18n={i18n} cropLabel={cropLabel} />}
      {user.role === UserRole.ADMIN && <AdminInsights i18n={i18n} cropLabel={cropLabel} />}

      <Card className="mt-4">
        <h2 className="text-xs font-bold text-charcoal mb-3">{t('insights.published')}</h2>
        <div className="divide-y divide-[#E5E7EB]">
          {prices.length === 0 && (
            <p className="text-[11px] text-[#636E72] py-4 text-center">{t('insights.noPrices')}</p>
          )}
          {prices.map((price) => (
            <div key={price.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-charcoal">{crop(price.crop)}</div>
                <div className="text-[10px] text-[#636E72]">
                  {place(`${price.mandi.name}, ${price.mandi.city}`)}
                  {price.dailyArrivalTonnes ? ` · ${t('insights.arrivals', { tonnes: price.dailyArrivalTonnes })}` : ''}
                </div>
              </div>
              <div className="text-end">
                <div className="text-xs font-bold text-charcoal">{perKg(price.ratePerKg)}</div>
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
