import {
  AuctionStatus,
  CropBatchStatus,
  DealStatus,
  DemandStatus,
  InventoryLotStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import { getArhtiEarnings } from '@/lib/earnings';
import ArhtiEarnings from '@/components/dashboards/ArhtiEarnings';
import Link from 'next/link';
import { Badge, CropThumb, statusTone } from '@/components/ui/kit';
import Icon, { type IconName } from '@/components/ui/Icon';

const INCOMING: DealStatus[] = [
  DealStatus.PICKUP_SCHEDULED,
  DealStatus.PICKED_UP,
  DealStatus.IN_TRANSIT,
];

export default async function ArhtiHome({ userId, name }: { userId: string; name: string }) {
  const i18n = await getI18n();
  const { t, crop, place, status, grade, kg, perKg, money, isUrdu } = i18n;

  const [profile, incoming, lots, liveAuctions, freshBatches, openDemand, earnings] = await Promise.all([
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
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
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
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
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
        inventoryLot: { select: { crop: { select: { name: true, nameUrdu: true, imageUrl: true } }, purchasePricePerKg: true } },
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
        crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
        farmer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.arhtiDemandRequest.count({
      where: { arhtiId: userId, status: { in: [DemandStatus.OPEN, DemandStatus.PARTIALLY_FULFILLED] } },
    }),
    getArhtiEarnings(userId),
  ]);

  const stockKg = lots.reduce((sum, l) => sum + l.availableQuantityKg, 0);
  const stockCost = lots.reduce((sum, l) => sum + l.availableQuantityKg * l.purchasePricePerKg, 0);
  // English keeps the stored grade after "grade"; Urdu shows the translated grade.
  const gradeText = (value: string) => (isUrdu ? grade(value) : t('common.grade', { grade: value }));

  // Worked out from times the page already loads.
  const now = Date.now();
  const closesIn = (end: Date) => {
    const minutes = Math.max(0, Math.round((end.getTime() - now) / 60000));
    return minutes <= 0 ? t('ahome.closingNow') : t('ahome.closesIn', { h: Math.floor(minutes / 60), m: minutes % 60 });
  };
  const arrivesIn = (at: Date | null | undefined) => {
    if (!at) return null;
    const hours = Math.round((at.getTime() - now) / 3600000);
    return hours >= 1 ? t('ahome.aboutHours', { hours }) : null;
  };
  const spreadOf = (top: number, cost: number) => Math.round(((top - cost) / cost) * 100);
  const [arriving, ...moreIncoming] = incoming;
  const today = i18n.date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });

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
      <div className="ac-up flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[15px] text-muted">
            {t('home.greeting')}, {name}
          </p>
          <h1 className="font-display h-page font-semibold">{profile?.businessName ?? name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {t('ahome.role')} ·{' '}
            {profile?.mandi ? t('ahome.tradingAt', { mandi: place(profile.mandi.name), city: place(profile.mandi.city) }) : t('ahome.noMandi')}{' '}
            {t('ahome.tagline')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
          <Icon name="calendar" size={16} />
          {today}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="ac-up ac-d1">
          <ArhtiEarnings
            earnings={earnings}
            i18n={i18n}
            footer={
              <Link href="/sales" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold underline-offset-4 hover:underline">
                {i18n.nav('Sales & Commission')}
                <Icon name="chevronright" size={16} />
              </Link>
            }
          />
        </div>

        {/* The one thing that needs doing: a truck to weigh */}
        <section className="ac-up ac-d2 rounded-hero bg-warn-bg p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[15px] font-bold text-warn-fg">
              <Icon name="truck" size={18} />
              {t('ahome.arriving')}
            </span>
            {arriving && <Badge tone="info" icon="truck">{status(arriving.status)}</Badge>}
          </div>
          {arriving ? (
            <>
              <div className="mt-4 flex items-start gap-3">
                <CropThumb imageUrl={arriving.crop.imageUrl} name={arriving.crop.name} size="lg" />
                <div className="min-w-0">
                  <div className="text-[17px] font-extrabold">
                    {crop(arriving.crop)} · {kg(arriving.agreedQuantityKg)}
                  </div>
                  <div className="text-sm">
                    {t('ahome.fromFarmer', { qty: kg(arriving.agreedQuantityKg), name: arriving.farmer.name, city: place(arriving.sourceCity) })} · {perKg(arriving.agreedPricePerKg)}
                  </div>
                  <div className="text-[13px] text-muted">
                    {arriving.pickup
                      ? [arriving.pickup.driverName, arriving.pickup.vehiclePlate, arrivesIn(arriving.pickup.expectedArrivalAt)].filter(Boolean).join(' · ')
                      : t('ahome.noPickup')}
                  </div>
                  <div className="font-mono text-[12px] text-muted">{arriving.dealNumber}</div>
                </div>
              </div>
              <Link href="/receiving" className="btn btn-primary mt-5 w-full">
                <Icon name="scale" size={20} />
                {t('ahome.weighCta')}
              </Link>
              {moreIncoming.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-black/10 pt-3">
                  {moreIncoming.map((deal) => (
                    <li key={deal.id}>
                      <Link href="/receiving" className="flex items-center gap-2 text-sm">
                        <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="sm" />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-bold">{crop(deal.crop)}</span> ·{' '}
                          {t('ahome.fromFarmer', { qty: kg(deal.agreedQuantityKg), name: deal.farmer.name, city: place(deal.sourceCity) })}
                        </span>
                        <Badge tone={statusTone(deal.status)}>{status(deal.status)}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-muted">{t('ahome.noIncoming')}</p>
              <Link href="/sourcing" className="btn btn-primary mt-4 w-full">
                <Icon name="sprout" size={20} />
                {t('ahome.farmerMarket')}
              </Link>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
        <div className="card grid grid-cols-3 divide-x divide-line overflow-hidden rtl:divide-x-reverse">
          {stat('truck', String(incoming.length), t('ahome.trucks'), t('ahome.awaitingWeighing'))}
          {stat('warehouse', kg(stockKg), t('ahome.stock'), t('ahome.tiedUp', { amount: money(stockCost) }))}
          {stat('list', String(openDemand), t('ahome.openRequestsLabel'), t('ahome.openRequests', { count: openDemand }))}
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-display h-card font-semibold">{t('ahome.liveHouse')}</h2>
            {liveAuctions.length > 0 ? (
              <Badge tone="live">{t('common.live')}</Badge>
            ) : (
              <Link href="/auction-house" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold">
                {t('ahome.auctionHouse')}
                <Icon name="chevronright" size={16} />
              </Link>
            )}
          </div>
          {liveAuctions.length === 0 ? (
            <p className="card p-4 text-sm text-muted">{t('ahome.nothingHammer')}</p>
          ) : (
            <div className="space-y-3">
              {liveAuctions.map((auction) => {
                const top = auction.currentHighestBid ?? auction.reservePrice;
                const cost = auction.inventoryLot.purchasePricePerKg;
                const spread = spreadOf(top, cost);
                return (
                  <Link key={auction.id} href={`/auctions/${auction.id}`} className="card ac-press block border-[1.5px] border-gold p-4">
                    <div className="flex items-start gap-3">
                      <CropThumb imageUrl={auction.inventoryLot.crop.imageUrl} name={auction.inventoryLot.crop.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-extrabold">
                          {crop(auction.inventoryLot.crop)} · {kg(auction.quantityKg)}
                        </div>
                        <div className="text-[13px] text-muted">
                          <span className="font-mono">{auction.auctionNumber}</span> · {closesIn(auction.endTime)}
                        </div>
                      </div>
                      <span className="hidden shrink-0 items-center gap-1 rounded-xl bg-sage px-3 py-2 text-sm font-bold sm:inline-flex">
                        <Icon name="gavel" size={16} />
                        {t('ahome.open')}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-3">
                      <div>
                        <dt className="text-[12.5px] text-muted">{t('auctionHouse.topBid')}</dt>
                        <dd className="tabular text-xl font-extrabold">{perKg(top)}</dd>
                      </div>
                      <div>
                        <dt className="text-[12.5px] text-muted">{t('ahome.bids')}</dt>
                        <dd className="tabular text-xl font-extrabold">{auction.bidCount}</dd>
                      </div>
                      <div>
                        <dt className="text-[12.5px] text-muted">{t('ahome.onCost')}</dt>
                        <dd className={`tabular text-xl font-extrabold ${spread >= 0 ? 'text-ok-fg' : 'text-err-fg'}`} dir="ltr">
                          {`${spread >= 0 ? '+' : ''}${spread}%`}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-1 text-[13px] text-muted">
                      {t('ahome.boughtAt', { rate: perKg(cost), spread: `${spread >= 0 ? '+' : ''}${spread}` })} · {t('common.bids', { count: auction.bidCount })}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          {sectionHead(t('ahome.waitingStock'), '/inventory', t('ahome.inventory'))}
          {lots.length === 0 ? (
            <p className="card p-4 text-sm text-muted">{t('ahome.godownEmpty')}</p>
          ) : (
            <div className="divide-y divide-line">
              {lots.map((lot) => (
                <div key={lot.id} className="flex items-center gap-3 py-3">
                  <CropThumb imageUrl={lot.crop.imageUrl} name={lot.crop.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold">
                      {crop(lot.crop)} · {t('ahome.unsoldShort', { qty: kg(lot.availableQuantityKg) })}
                    </div>
                    <div className="text-[13px] text-muted">
                      {t('ahome.unsoldOf', { available: kg(lot.availableQuantityKg), received: kg(lot.receivedQuantityKg) })} · {gradeText(lot.grade)}
                    </div>
                    <div className="text-[13px] text-muted">
                      {lot.sourceFarmerName}, {place(lot.sourceCity)} · {t('ahome.cost', { rate: perKg(lot.purchasePricePerKg) })}
                    </div>
                  </div>
                  <Link href="/inventory" className="btn btn-secondary btn-sm shrink-0">
                    <Icon name="gavel" size={16} />
                    {t('ahome.auctionCta')}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          {sectionHead(t('ahome.fresh'), '/sourcing', t('ahome.farmerMarket'))}
          {freshBatches.length === 0 ? (
            <p className="card p-4 text-sm text-muted">{t('ahome.noBatch')}</p>
          ) : (
            <div className="divide-y divide-line">
              {freshBatches.map((batch) => (
                <Link key={batch.id} href="/sourcing" className="flex items-center gap-3 py-3">
                  <CropThumb imageUrl={batch.crop.imageUrl} name={batch.crop.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold">
                      {crop(batch.crop)} · {kg(batch.availableKg)}
                    </div>
                    <div className="text-[13px] text-muted">
                      {gradeText(batch.grade)} · {place(batch.originCity)} · {batch.farmer.name}
                    </div>
                  </div>
                  {batch.askingPricePerKg ? (
                    <div className="shrink-0 text-end">
                      <div className="tabular text-base font-extrabold">{perKg(batch.askingPricePerKg)}</div>
                      <div className="text-[12.5px] text-muted">{t('crops.asking')}</div>
                    </div>
                  ) : (
                    <span className="shrink-0 text-[13px] text-muted">{t('common.openToOffers')}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
