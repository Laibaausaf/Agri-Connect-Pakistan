import Link from 'next/link';
import { SaleStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
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

export default async function SalesPage() {
  const user = await requireCapability('arhti.sales.view', 'vendor.sales.view');

  if (user.role === UserRole.VENDOR) return <VendorSales userId={user.id} />;
  return <ArhtiSales userId={user.id} />;
}

async function ArhtiSales({ userId }: { userId: string }) {
  const sales = await prisma.arhtiVendorSale.findMany({
    where: { arhtiId: userId },
    include: {
      vendor: { select: { name: true, vendorProfile: { select: { businessName: true, warehouseCity: true } } } },
      auction: {
        select: {
          auctionNumber: true,
          grade: true,
          inventoryLot: {
            select: {
              lotNumber: true,
              sourceCity: true,
              sourceFarmerName: true,
              purchasePricePerKg: true,
              crop: { select: { name: true, imageUrl: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const revenue = sales.reduce((sum, s) => sum + s.grossAmount, 0);
  const volume = sales.reduce((sum, s) => sum + s.quantityKg, 0);
  const commission = sales.reduce((sum, s) => sum + s.commission, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Auction Sales"
        titleUrdu="نیلامی کی فروخت"
        subtitle="Produce you sold to vendors on the mandi floor, with your buying cost and the margin you made on each lot."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Sales" value={String(sales.length)} />
        <StatCard label="Volume sold" value={qty(volume)} />
        <StatCard label="Revenue" value={money(Math.round(revenue))} tone="accent" />
        <StatCard label="Commission earned" value={money(Math.round(commission))} />
      </div>

      {sales.length === 0 ? (
        <EmptyState
          title="No auction sales yet"
          message="Close a live auction in the Auction House and the sale is recorded here."
          actionHref="/auction-house"
          actionLabel="Open Auction House"
        />
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const lot = sale.auction.inventoryLot;
            const margin = sale.ratePerKg - lot.purchasePricePerKg;
            return (
              <Card key={sale.id}>
                <div className="flex items-start gap-3">
                  <CropThumb imageUrl={lot.crop.imageUrl} name={lot.crop.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{lot.crop.name}</span>
                      <Badge tone={statusTone(sale.status)}>{humanStatus(sale.status)}</Badge>
                      <Badge tone="neutral">{sale.auction.grade}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      Bought from {lot.sourceFarmerName}, {lot.sourceCity} · sold to{' '}
                      {sale.vendor.vendorProfile?.businessName ?? sale.vendor.name}
                    </div>
                    <div className="text-[10px] text-[#636E72] font-mono">
                      {sale.saleNumber} · {sale.auction.auctionNumber} · {lot.lotNumber}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Quantity</div>
                        <div className="font-semibold text-charcoal">{qty(sale.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Bought at</div>
                        <div className="font-semibold text-charcoal">
                          {money(lot.purchasePricePerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Sold at</div>
                        <div className="font-semibold text-agri-900">
                          {money(sale.ratePerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Margin</div>
                        <div
                          className={`font-semibold ${margin >= 0 ? 'text-agri-900' : 'text-red-700'}`}
                        >
                          {margin >= 0 ? '+' : ''}
                          {money(margin)}/kg
                        </div>
                        <div className="text-[10px] text-[#636E72]">
                          {money(Math.round(margin * sale.quantityKg))} total
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function VendorSales({ userId }: { userId: string }) {
  const sales = await prisma.vendorShopkeeperSale.findMany({
    where: { vendorId: userId },
    include: {
      shopkeeper: {
        select: {
          name: true,
          location: true,
          shopkeeperProfile: { select: { shopName: true, city: true } },
        },
      },
      offer: {
        select: {
          offerNumber: true,
          grade: true,
          crop: { select: { name: true, imageUrl: true } },
          stock: { select: { costPerKg: true, sourceFarmCity: true, sourceMandiCity: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const revenue = sales.reduce((sum, s) => sum + s.grossAmount, 0);
  const volume = sales.reduce((sum, s) => sum + s.quantityKg, 0);
  const openOrders = sales.filter(
    (s) => s.status !== SaleStatus.COMPLETED && s.status !== SaleStatus.CANCELLED
  ).length;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Shopkeeper Orders"
        titleUrdu="دکانداروں کے آرڈر"
        subtitle="Wholesale orders shopkeepers placed against your digital shop, with your mandi cost and per-kg margin."
        action={
          <Link
            href="/wholesale-shop"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            My wholesale shop
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Orders" value={String(sales.length)} />
        <StatCard label="Open" value={String(openOrders)} tone={openOrders ? 'accent' : 'default'} />
        <StatCard label="Volume sold" value={qty(volume)} />
        <StatCard label="Revenue" value={money(Math.round(revenue))} />
      </div>

      {sales.length === 0 ? (
        <EmptyState
          title="No shopkeeper orders yet"
          message="List stock in your wholesale shop and shopkeepers in your delivery cities can order it."
          actionHref="/wholesale-shop/new"
          actionLabel="List wholesale stock"
        />
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const margin = sale.ratePerKg - sale.offer.stock.costPerKg;
            const shop = sale.shopkeeper.shopkeeperProfile;
            return (
              <Card key={sale.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={sale.offer.crop.imageUrl}
                    name={sale.offer.crop.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">
                        {sale.offer.crop.name}
                      </span>
                      <Badge tone={statusTone(sale.status)}>{humanStatus(sale.status)}</Badge>
                      <Badge tone="neutral">{sale.offer.grade}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {shop?.shopName ?? sale.shopkeeper.name}
                      {shop?.city ? `, ${shop.city}` : ''} ·{' '}
                      {sale.deliveryCity ?? sale.shopkeeper.location ?? '—'}
                    </div>
                    <div className="text-[10px] text-[#636E72] font-mono">
                      {sale.saleNumber} · {sale.offer.offerNumber}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Quantity</div>
                        <div className="font-semibold text-charcoal">{qty(sale.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Mandi cost</div>
                        <div className="font-semibold text-charcoal">
                          {money(sale.offer.stock.costPerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Sold at</div>
                        <div className="font-semibold text-agri-900">
                          {money(sale.ratePerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Order value</div>
                        <div className="font-semibold text-charcoal">
                          {money(sale.grossAmount)}
                        </div>
                        <div className="text-[10px] text-[#636E72]">
                          {margin >= 0 ? '+' : ''}
                          {money(margin)}/kg margin
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
