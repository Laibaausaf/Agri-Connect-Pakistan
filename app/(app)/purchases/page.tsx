import Link from 'next/link';
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

export default async function PurchasesPage() {
  const user = await requireCapability('shopkeeper.wholesale.purchase');

  const purchases = await prisma.vendorShopkeeperSale.findMany({
    where: { shopkeeperId: user.id },
    include: {
      vendor: {
        select: { name: true, vendorProfile: { select: { businessName: true, warehouseCity: true } } },
      },
      offer: {
        select: {
          offerNumber: true,
          deliveryEtaHours: true,
          crop: { select: { name: true, imageUrl: true } },
          stock: { select: { sourceFarmCity: true, sourceMandiCity: true } },
        },
      },
      shopkeeperInventory: {
        select: { id: true, stockNumber: true, availableKg: true, quantityKg: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const spend = purchases.reduce((sum, p) => sum + p.grossAmount, 0);
  const boughtKg = purchases.reduce((sum, p) => sum + p.quantityKg, 0);
  const avgRate = boughtKg > 0 ? spend / boughtKg : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="My Purchases"
        titleUrdu="خریداری"
        subtitle="Every wholesale order you placed, with the vendor, the rate you paid and where the produce originally came from."
        action={
          <Link
            href="/wholesale"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            Wholesale Market
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Orders placed" value={String(purchases.length)} />
        <StatCard label="Quantity bought" value={qty(boughtKg)} tone="accent" />
        <StatCard
          label="Total spend"
          value={money(spend)}
          hint={avgRate ? `${money(avgRate)}/kg average` : undefined}
        />
      </div>

      {purchases.length === 0 ? (
        <EmptyState
          title="No purchases yet"
          message="Order from a vendor on the wholesale market and the stock, the payment record and the provenance trail all appear here."
          actionHref="/wholesale"
          actionLabel="Browse Wholesale Market"
        />
      ) : (
        <div className="space-y-3">
          {purchases.map((purchase) => {
            const stock = purchase.shopkeeperInventory;
            const soldOn = stock ? stock.quantityKg - stock.availableKg : 0;
            return (
              <Card key={purchase.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={purchase.offer.crop.imageUrl}
                    name={purchase.offer.crop.name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">
                        {purchase.offer.crop.name}
                      </span>
                      <Badge tone={statusTone(purchase.status)}>
                        {humanStatus(purchase.status)}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {purchase.saleNumber}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      From {purchase.vendor.vendorProfile?.businessName ?? purchase.vendor.name} ·
                      grown in {purchase.offer.stock.sourceFarmCity}, traded at{' '}
                      {purchase.offer.stock.sourceMandiCity} mandi
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Quantity</div>
                        <div className="font-semibold text-charcoal">{qty(purchase.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Rate paid</div>
                        <div className="font-semibold text-charcoal">
                          {money(purchase.ratePerKg)}/kg
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Order value</div>
                        <div className="font-semibold text-agri-900">
                          {money(purchase.grossAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Ordered</div>
                        <div className="font-semibold text-charcoal">
                          {purchase.createdAt.toLocaleDateString('en-PK', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {stock && (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#636E72]">
                      In shop as <span className="font-mono">{stock.stockNumber}</span> ·{' '}
                      {qty(stock.availableKg)} unlisted
                      {soldOn > 0 ? ` · ${qty(soldOn)} moved to the counter` : ''}
                    </span>
                    <Link
                      href="/shop-stock"
                      className="font-semibold text-agri-900 hover:underline whitespace-nowrap"
                    >
                      Open stock
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
