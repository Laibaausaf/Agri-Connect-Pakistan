import Link from 'next/link';
import { AuctionStatus, OfferListingStatus, SaleStatus, StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Badge, Card, CropThumb, StatCard, humanStatus, money, qty, statusTone } from '@/components/ui/kit';

function endsIn(endTime: Date) {
  const mins = Math.round((new Date(endTime).getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'closing now';
  if (mins < 60) return `${mins} min left`;
  return `${Math.round(mins / 60)} h left`;
}

export default async function VendorHome({ userId, name }: { userId: string; name: string }) {
  const [profile, auctions, myBids, stocks, offers, orders, spend] = await Promise.all([
    prisma.vendorProfile.findUnique({
      where: { userId },
      select: { businessName: true, warehouseCity: true, minOrderKg: true, rating: true },
    }),
    prisma.auction.findMany({
      where: { status: AuctionStatus.ACTIVE },
      select: {
        id: true,
        quantityKg: true,
        grade: true,
        reservePrice: true,
        currentHighestBid: true,
        bidCount: true,
        endTime: true,
        mandi: { select: { name: true, city: true } },
        inventoryLot: { select: { crop: { select: { name: true, imageUrl: true } }, sourceCity: true } },
      },
      orderBy: { endTime: 'asc' },
      take: 4,
    }),
    prisma.bid.findMany({
      where: { bidderId: userId, auction: { status: AuctionStatus.ACTIVE } },
      select: { auctionId: true, amountPerKg: true },
    }),
    prisma.vendorInventory.findMany({
      where: { vendorId: userId, status: { not: StockStatus.SOLD_OUT } },
      select: {
        id: true,
        availableKg: true,
        quantityKg: true,
        costPerKg: true,
        grade: true,
        sourceFarmCity: true,
        sourceMandiCity: true,
        crop: { select: { name: true, imageUrl: true } },
        offers: {
          where: { status: OfferListingStatus.ACTIVE },
          select: { id: true, remainingKg: true, pricePerKg: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.vendorOffer.findMany({
      where: { vendorId: userId, status: OfferListingStatus.ACTIVE },
      select: {
        id: true,
        offerNumber: true,
        remainingKg: true,
        offeredQuantityKg: true,
        pricePerKg: true,
        crop: { select: { name: true, imageUrl: true } },
        stock: { select: { costPerKg: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.vendorShopkeeperSale.findMany({
      where: { vendorId: userId, status: { notIn: [SaleStatus.COMPLETED, SaleStatus.CANCELLED] } },
      select: {
        id: true,
        saleNumber: true,
        quantityKg: true,
        ratePerKg: true,
        grossAmount: true,
        status: true,
        deliveryCity: true,
        createdAt: true,
        shopkeeper: { select: { name: true, shopkeeperProfile: { select: { shopName: true } } } },
        offer: { select: { crop: { select: { name: true, imageUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.arhtiVendorSale.aggregate({
      where: { vendorId: userId },
      _sum: { grossAmount: true, quantityKg: true },
    }),
  ]);

  const bidByAuction = new Map(myBids.map((b) => [b.auctionId, b.amountPerKg]));
  const warehouseKg = stocks.reduce((sum, s) => sum + s.availableKg, 0);
  const capital = stocks.reduce((sum, s) => sum + s.availableKg * s.costPerKg, 0);
  const unlisted = stocks.filter((s) => s.availableKg > 0 && s.offers.length === 0);

  return (
    <>
      <Card className="mb-4 bg-agri-900 border-agri-900">
        <div className="text-white">
          <div className="text-[11px] text-white/70">Wholesale vendor</div>
          <h1 className="text-lg font-bold">{profile?.businessName ?? name}</h1>
          <p className="text-[11px] text-white/80 mt-1 max-w-lg">
            {profile?.warehouseCity ? `Warehouse in ${profile.warehouseCity}. ` : ''}Win lots in the
            mandi auctions, then move them through your wholesale shop to shopkeepers.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Auctions live"
          value={String(auctions.length)}
          tone="accent"
          hint={myBids.length ? `You have ${myBids.length} bids in` : 'No bids placed'}
        />
        <StatCard label="Warehouse" value={qty(warehouseKg)} hint={`${money(capital)} of stock`} />
        <StatCard
          label="Not on shelf"
          value={String(unlisted.length)}
          tone={unlisted.length ? 'warn' : 'default'}
          hint="Lots without a live offer"
        />
        <StatCard
          label="Shopkeeper orders"
          value={String(orders.length)}
          hint={`${money(spend._sum.grossAmount ?? 0)} bought at mandi`}
        />
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-charcoal">Auctions closing soon</h2>
          <Link href="/auctions" className="text-[11px] font-semibold text-agri-900 hover:underline">
            All auctions
          </Link>
        </div>
        {auctions.length === 0 ? (
          <p className="text-[11px] text-[#636E72] py-4 text-center">
            No mandi auction running right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {auctions.map((auction) => {
              const top = auction.currentHighestBid ?? auction.reservePrice;
              const mine = bidByAuction.get(auction.id);
              const leading = mine !== undefined && mine >= top;
              return (
                <Link
                  key={auction.id}
                  href={`/auctions/${auction.id}`}
                  className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3 hover:bg-[#F8F9F5]"
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
                      {mine !== undefined && (
                        <Badge tone={leading ? 'green' : 'red'}>
                          {leading ? 'You lead' : 'Outbid'}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {qty(auction.quantityKg)} · <span className="font-semibold text-charcoal">
                        {money(top)}/kg
                      </span>{' '}
                      · {auction.bidCount} bids
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {auction.mandi.city} · from {auction.inventoryLot.sourceCity} ·{' '}
                      {endsIn(auction.endTime)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">
              {unlisted.length ? 'Stock earning nothing yet' : 'Warehouse stock'}
            </h2>
            <Link href="/stock" className="text-[11px] font-semibold text-agri-900 hover:underline">
              Warehouse
            </Link>
          </div>
          {stocks.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">
              Win a mandi auction and the lot lands here.
            </p>
          ) : (
            <div className="space-y-2">
              {(unlisted.length ? unlisted : stocks).slice(0, 4).map((stock) => (
                <div
                  key={stock.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    stock.offers.length === 0 ? 'border-amber-200 bg-amber-50' : 'border-[#E5E7EB]'
                  }`}
                >
                  <CropThumb imageUrl={stock.crop.imageUrl} name={stock.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-charcoal">{stock.crop.name}</div>
                    <div className="text-[11px] text-[#636E72]">
                      {qty(stock.availableKg)} free · cost {money(stock.costPerKg)}/kg
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {stock.sourceFarmCity} → {stock.sourceMandiCity} mandi
                      {stock.offers.length === 0 ? ' · not listed for shopkeepers' : ''}
                    </div>
                  </div>
                  {stock.offers.length === 0 && (
                    <Link
                      href="/wholesale-shop/new"
                      className="bg-agri-900 hover:bg-agri-800 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
                    >
                      List it
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">Shopkeeper orders</h2>
            <Link href="/sales" className="text-[11px] font-semibold text-agri-900 hover:underline">
              All orders
            </Link>
          </div>
          {orders.length === 0 ? (
            <>
              <p className="text-[11px] text-[#636E72] py-2 text-center">
                No open order. {offers.length} live {offers.length === 1 ? 'offer' : 'offers'} on your
                shelf.
              </p>
              {offers.length > 0 && (
                <div className="space-y-2">
                  {offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3"
                    >
                      <CropThumb imageUrl={offer.crop.imageUrl} name={offer.crop.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-charcoal">{offer.crop.name}</div>
                        <div className="text-[11px] text-[#636E72]">
                          {money(offer.pricePerKg)}/kg · {qty(offer.remainingKg)} left of{' '}
                          {qty(offer.offeredQuantityKg)}
                        </div>
                        <div className="text-[10px] text-[#636E72]">
                          {money(offer.pricePerKg - offer.stock.costPerKg)}/kg margin
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3">
                  <CropThumb imageUrl={order.offer.crop.imageUrl} name={order.offer.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-charcoal">{order.offer.crop.name}</span>
                      <Badge tone={statusTone(order.status)}>{humanStatus(order.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {qty(order.quantityKg)} at {money(order.ratePerKg)}/kg ={' '}
                      {money(order.grossAmount)}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {order.shopkeeper.shopkeeperProfile?.shopName ?? order.shopkeeper.name}
                      {order.deliveryCity ? ` · deliver to ${order.deliveryCity}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
