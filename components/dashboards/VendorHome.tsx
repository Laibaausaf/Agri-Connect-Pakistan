import Link from 'next/link';
import { AuctionStatus, OfferListingStatus, SaleStatus, StockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import type { I18n } from '@/lib/i18n';
import { Badge, CropThumb, statusTone } from '@/components/ui/kit';
import Icon, { type IconName } from '@/components/ui/Icon';
import BrandGlow from '@/components/ui/BrandGlow';

function endsIn(endTime: Date, t: I18n['t']) {
  const mins = Math.round((new Date(endTime).getTime() - Date.now()) / 60000);
  if (mins <= 0) return t('vhome.closingNow');
  if (mins < 60) return t('vhome.minLeft', { count: mins });
  return t('vhome.hoursLeft', { count: Math.round(mins / 60) });
}

export default async function VendorHome({ userId, name }: { userId: string; name: string }) {
  const { t, plural, crop, place, status, kg, perKg, money } = await getI18n();

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
        inventoryLot: { select: { crop: { select: { name: true, nameUrdu: true, imageUrl: true } }, sourceCity: true } },
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
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
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
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
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
        offer: { select: { crop: { select: { name: true, nameUrdu: true, imageUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.arhtiVendorSale.aggregate({
      where: { vendorId: userId },
      _sum: { grossAmount: true, commission: true, quantityKg: true },
    }),
  ]);

  const bidByAuction = new Map(myBids.map((b) => [b.auctionId, b.amountPerKg]));
  const warehouseKg = stocks.reduce((sum, s) => sum + s.availableKg, 0);
  const capital = stocks.reduce((sum, s) => sum + s.availableKg * s.costPerKg, 0);
  const unlisted = stocks.filter((s) => s.availableKg > 0 && s.offers.length === 0);

  // The one thing that needs doing: the auction closing first.
  const [next, ...otherAuctions] = auctions;
  const nextTop = next ? next.currentHighestBid ?? next.reservePrice : 0;
  const nextMine = next ? bidByAuction.get(next.id) : undefined;
  const nextLeading = nextMine !== undefined && nextMine >= nextTop;
  const stat = (icon: IconName, value: string, label: string, hint: string) => (
    <div className="flex flex-col gap-1 p-4">
      <Icon name={icon} size={20} className="text-forest" />
      <span className="tabular mt-1 text-[22px] font-extrabold leading-none">{value}</span>
      <span className="text-[13.5px] font-bold">{label}</span>
      <span className="text-[12.5px] text-muted">{hint}</span>
    </div>
  );
  const sectionHead = (title: string, href: string, link: string) => (
    <div className="mb-2 flex items-end justify-between gap-3">
      <h2 className="font-display h-card font-semibold">{title}</h2>
      <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold">
        {link}
        <Icon name="chevronright" size={16} />
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="ac-up">
        <p className="text-[15px] text-muted">
          {t('home.greeting')}, {name}
        </p>
        <h1 className="font-display h-page font-semibold">{profile?.businessName ?? name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {t('vhome.role')} · {profile?.warehouseCity ? t('vhome.warehouseIn', { city: place(profile.warehouseCity) }) : ''}
          {t('vhome.tagline')}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {next ? (
          <section className="ac-up ac-d1 relative overflow-hidden rounded-hero bg-brand p-5 text-white sm:p-6">
            <BrandGlow />
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-bold text-[#D6E6D9]">{t('vhome.closingSoonOne')}</span>
                <Badge tone="live">{t('common.live')}</Badge>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <CropThumb imageUrl={next.inventoryLot.crop.imageUrl} name={next.inventoryLot.crop.name} size="lg" />
                <div className="min-w-0">
                  <div className="text-[19px] font-extrabold">
                    {crop(next.inventoryLot.crop)} · {kg(next.quantityKg)}
                  </div>
                  <div className="text-sm text-[#D6E6D9]">
                    {place(next.mandi.city)} · {t('vhome.from', { city: place(next.inventoryLot.sourceCity) })}
                  </div>
                  {nextMine !== undefined && (
                    <span className={`mt-1.5 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-bold ${nextLeading ? 'bg-white/[.14]' : 'bg-err-bg text-err-fg'}`}>
                      <Icon name={nextLeading ? 'trendup' : 'alert'} size={14} />
                      {nextLeading ? t('vhome.youLead') : t('vhome.outbid')}
                    </span>
                  )}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-[12.5px] text-[#D6E6D9]">{t('auctionHouse.topBid')}</dt>
                  <dd className="tabular text-[24px] font-extrabold text-[#F6C871]">{perKg(nextTop)}</dd>
                </div>
                <div>
                  <dt className="text-[12.5px] text-[#D6E6D9]">{t('ahome.bids')}</dt>
                  <dd className="tabular text-[24px] font-extrabold">{next.bidCount}</dd>
                </div>
                <div>
                  <dt className="text-[12.5px] text-[#D6E6D9]">{t('vhome.timeLeft')}</dt>
                  <dd className="tabular text-[24px] font-extrabold">{endsIn(next.endTime, t)}</dd>
                </div>
              </dl>
              <Link href={`/auctions/${next.id}`} className="btn btn-primary mt-5 w-full">
                <Icon name="gavel" size={20} />
                {t('vhome.goLive')}
              </Link>
            </div>
          </section>
        ) : (
          <section className="ac-up ac-d1 rounded-hero bg-sage p-5 sm:p-6">
            <h2 className="font-display h-card font-semibold">{t('vhome.closingSoon')}</h2>
            <p className="mt-2 text-sm text-muted">{t('vhome.noAuction')}</p>
            <Link href="/auctions" className="btn btn-primary mt-4 w-full">
              <Icon name="gavel" size={20} />
              {t('vhome.allAuctions')}
            </Link>
          </section>
        )}

        <div className="card grid grid-cols-2 overflow-hidden">
          <div className="border-b border-e border-line">
            {stat('gavel', String(auctions.length), t('vhome.auctionsLive'), myBids.length ? t('vhome.bidsIn', { count: myBids.length }) : t('vhome.noBids'))}
          </div>
          <div className="border-b border-line">{stat('warehouse', kg(warehouseKg), t('vhome.warehouse'), t('vhome.ofStock', { amount: money(capital) }))}</div>
          <div className="border-e border-line">{stat('store', String(unlisted.length), t('vhome.notOnShelf'), t('vhome.noLiveOffer'))}</div>
          {stat('list', String(orders.length), t('vhome.orders'), t('vhome.paidMandi', { amount: money((spend._sum.grossAmount ?? 0) + (spend._sum.commission ?? 0)) }))}
        </div>
      </div>

      {otherAuctions.length > 0 && (
        <section>
          {sectionHead(t('vhome.closingSoon'), '/auctions', t('vhome.allAuctions'))}
          <div className="grid gap-3 sm:grid-cols-2">
            {otherAuctions.map((auction) => {
              const top = auction.currentHighestBid ?? auction.reservePrice;
              const mine = bidByAuction.get(auction.id);
              const leading = mine !== undefined && mine >= top;
              return (
                <Link key={auction.id} href={`/auctions/${auction.id}`} className="card ac-press flex items-center gap-3 p-4">
                  <CropThumb imageUrl={auction.inventoryLot.crop.imageUrl} name={auction.inventoryLot.crop.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold">{crop(auction.inventoryLot.crop)}</span>
                      {mine !== undefined && <Badge tone={leading ? 'green' : 'red'}>{leading ? t('vhome.youLead') : t('vhome.outbid')}</Badge>}
                    </div>
                    <div className="text-[13px] text-muted">
                      {kg(auction.quantityKg)} · {perKg(top)} · {t('common.bids', { count: auction.bidCount })}
                    </div>
                    <div className="text-[13px] text-muted">
                      {place(auction.mandi.city)} · {endsIn(auction.endTime, t)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          {sectionHead(unlisted.length ? t('vhome.earningNothing') : t('vhome.warehouseStock'), '/stock', t('vhome.warehouse'))}
          {stocks.length === 0 ? (
            <p className="card p-4 text-sm text-muted">{t('vhome.winLot')}</p>
          ) : (
            <div className="divide-y divide-line">
              {(unlisted.length ? unlisted : stocks).slice(0, 4).map((stock) => (
                <div key={stock.id} className="flex items-center gap-3 py-3">
                  <CropThumb imageUrl={stock.crop.imageUrl} name={stock.crop.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold">{crop(stock.crop)}</div>
                    <div className="text-[13px] text-muted">{t('vhome.free', { qty: kg(stock.availableKg), rate: perKg(stock.costPerKg) })}</div>
                    <div className="text-[13px] text-muted">
                      {t('vhome.route', { farm: place(stock.sourceFarmCity), mandi: place(stock.sourceMandiCity) })}
                      {stock.offers.length === 0 ? t('vhome.notListed') : ''}
                    </div>
                  </div>
                  {stock.offers.length === 0 ? (
                    <Link href="/wholesale-shop/new" className="btn btn-secondary btn-sm shrink-0">
                      <Icon name="store" size={16} />
                      {t('vhome.listIt')}
                    </Link>
                  ) : (
                    <Badge tone="green" icon="store">{t('vhome.listed')}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          {sectionHead(t('vhome.orders'), '/sales', t('vhome.allOrders'))}
          {orders.length === 0 ? (
            <>
              <p className="mb-3 flex items-start gap-2 text-sm text-muted">
                <Icon name="info" size={16} className="mt-0.5" />
                {plural('vhome.noOrder', offers.length)}
              </p>
              <div className="space-y-3">
                {offers.map((offer) => (
                  <div key={offer.id} className="card p-4">
                    <div className="flex items-center gap-3">
                      <CropThumb imageUrl={offer.crop.imageUrl} name={offer.crop.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold">{t('vhome.onYourShop', { crop: crop(offer.crop) })}</div>
                        <div className="text-[13px] text-muted">{t('vhome.margin', { rate: perKg(offer.pricePerKg - offer.stock.costPerKg) })}</div>
                      </div>
                      <span className="tabular shrink-0 text-lg font-extrabold">{perKg(offer.pricePerKg)}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-sage" aria-hidden="true">
                      <div className="ac-grow h-full rounded-full bg-forest" style={{ width: `${offer.offeredQuantityKg > 0 ? (offer.remainingKg / offer.offeredQuantityKg) * 100 : 0}%` }} />
                    </div>
                    <div className="mt-1.5 text-[13px] text-muted">
                      {t('vhome.leftOf', { rate: perKg(offer.pricePerKg), left: kg(offer.remainingKg), total: kg(offer.offeredQuantityKg) })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="divide-y divide-line">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center gap-3 py-3">
                  <CropThumb imageUrl={order.offer.crop.imageUrl} name={order.offer.crop.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold">{crop(order.offer.crop)}</span>
                      <Badge tone={statusTone(order.status)}>{status(order.status)}</Badge>
                    </div>
                    <div className="text-[13px] text-muted">{t('vhome.orderLine', { qty: kg(order.quantityKg), rate: perKg(order.ratePerKg), total: money(order.grossAmount) })}</div>
                    <div className="text-[13px] text-muted">
                      {order.shopkeeper.shopkeeperProfile?.shopName ?? order.shopkeeper.name}
                      {order.deliveryCity ? t('vhome.deliverTo', { city: place(order.deliveryCity) }) : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
