import Link from 'next/link';
import { CropBatchStatus, DealStatus, OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Badge, Card, CropThumb, EmptyState, StatCard, humanStatus, money, qty, statusTone } from '@/components/ui/kit';

/** What the farmer should do next about each deal, in the farmer's own terms. */
const FARMER_NEXT_STEP: Record<DealStatus, string> = {
  AGREED: 'Waiting for the arhti to schedule pickup',
  PICKUP_SCHEDULED: 'Have the crop bagged and ready for the driver',
  PICKED_UP: 'On its way to the mandi',
  IN_TRANSIT: 'On its way to the mandi',
  RECEIVED_BY_ARHTI: 'Arhti is weighing your delivery',
  WEIGHT_VERIFIED: 'Weight settled — payment being prepared',
  PAYMENT_PENDING: 'Payment is being released',
  PAID: 'Payment sent to you',
  COMPLETED: 'Closed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Weight disputed — talk to the arhti',
};

export default async function FarmerHome({ userId, name }: { userId: string; name: string }) {
  const openDealStatuses: DealStatus[] = [
    DealStatus.AGREED,
    DealStatus.PICKUP_SCHEDULED,
    DealStatus.PICKED_UP,
    DealStatus.IN_TRANSIT,
    DealStatus.RECEIVED_BY_ARHTI,
    DealStatus.WEIGHT_VERIFIED,
    DealStatus.PAYMENT_PENDING,
  ];

  const [batches, offers, deals, paid, awaiting, rates] = await Promise.all([
    prisma.farmerCropBatch.findMany({
      where: { farmerId: userId, status: { notIn: [CropBatchStatus.ARCHIVED, CropBatchStatus.SOLD_OUT] } },
      select: {
        id: true,
        batchNumber: true,
        quantityKg: true,
        availableKg: true,
        grade: true,
        status: true,
        originCity: true,
        askingPricePerKg: true,
        harvestDate: true,
        crop: { select: { name: true, imageUrl: true } },
        _count: { select: { offers: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.farmerArhtiOffer.findMany({
      where: { farmerId: userId, status: OfferStatus.PENDING },
      select: {
        id: true,
        quantityKg: true,
        pricePerKg: true,
        createdAt: true,
        arhti: { select: { name: true, arhtiProfile: { select: { businessName: true } } } },
        batch: { select: { crop: { select: { name: true, imageUrl: true } } } },
        destinationMandi: { select: { name: true, city: true } },
        transportResponsibility: true,
      },
      orderBy: { pricePerKg: 'desc' },
      take: 3,
    }),
    prisma.farmerArhtiDeal.findMany({
      where: { farmerId: userId, status: { in: openDealStatuses } },
      select: {
        id: true,
        dealNumber: true,
        agreedQuantityKg: true,
        agreedPricePerKg: true,
        grossAmount: true,
        status: true,
        crop: { select: { name: true, imageUrl: true } },
        arhti: { select: { name: true } },
        destinationMandi: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
    prisma.settlement.aggregate({ where: { farmerId: userId, status: 'paid' }, _sum: { netPayable: true } }),
    prisma.settlement.aggregate({ where: { farmerId: userId, status: 'pending' }, _sum: { netPayable: true } }),
    prisma.marketPrice.findMany({
      select: {
        id: true,
        ratePerKg: true,
        changePercent: true,
        trend: true,
        crop: { select: { name: true } },
        mandi: { select: { name: true, city: true } },
      },
      orderBy: { ratePerKg: 'desc' },
      take: 4,
    }),
  ]);

  const unsoldKg = batches.reduce((sum, b) => sum + b.availableKg, 0);

  return (
    <>
      <Card className="mb-4 bg-agri-900 border-agri-900">
        <div className="text-white">
          <div className="text-[11px] text-white/70">Assalam-o-Alaikum</div>
          <h1 className="text-lg font-bold">{name}</h1>
          <p className="text-[11px] text-white/80 mt-1 max-w-lg">
            You grow it and we help you sell it. Log a harvest, take the best arhti offer, and track
            your payment — no bidding, no mandi visit needed.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Unsold stock" value={qty(unsoldKg)} hint={`${batches.length} live batches`} />
        <StatCard
          label="Offers to answer"
          value={String(offers.length)}
          tone={offers.length ? 'warn' : 'default'}
          hint={offers.length ? 'Arhtis are waiting' : 'Nothing pending'}
        />
        <StatCard label="Deals running" value={String(deals.length)} tone="accent" />
        <StatCard
          label="Received"
          value={money(paid._sum.netPayable ?? 0)}
          hint={awaiting._sum.netPayable ? `${money(awaiting._sum.netPayable)} due` : 'All settled'}
        />
      </div>

      {offers.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">Best offers waiting for your answer</h2>
            <Link href="/arhti-requests" className="text-[11px] font-semibold text-agri-900 hover:underline">
              See all
            </Link>
          </div>
          <div className="space-y-2">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="flex items-start gap-3 rounded-xl border border-[#B7D4C8] bg-[#E8F3EE] p-3"
              >
                <CropThumb imageUrl={offer.batch.crop.imageUrl} name={offer.batch.crop.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-charcoal">
                    {money(offer.pricePerKg)}/kg for {qty(offer.quantityKg)}
                  </div>
                  <div className="text-[11px] text-[#636E72]">
                    {offer.arhti.arhtiProfile?.businessName ?? offer.arhti.name} · to{' '}
                    {offer.destinationMandi.name}
                  </div>
                  <div className="text-[10px] text-[#636E72]">
                    Transport arranged by {offer.transportResponsibility.toLowerCase()} · worth{' '}
                    <span className="font-semibold text-charcoal">
                      {money(offer.pricePerKg * offer.quantityKg)}
                    </span>
                  </div>
                </div>
                <Link
                  href="/arhti-requests"
                  className="bg-agri-900 hover:bg-agri-800 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">Deals in progress</h2>
            <Link href="/deals" className="text-[11px] font-semibold text-agri-900 hover:underline">
              All deals
            </Link>
          </div>
          {deals.length === 0 ? (
            <p className="text-[11px] text-[#636E72] py-4 text-center">
              No deal running. Accept an arhti offer to start one.
            </p>
          ) : (
            <div className="space-y-2">
              {deals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3 hover:bg-[#F8F9F5]"
                >
                  <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-charcoal">{deal.crop.name}</span>
                      <Badge tone={statusTone(deal.status)}>{humanStatus(deal.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {qty(deal.agreedQuantityKg)} at {money(deal.agreedPricePerKg)}/kg ={' '}
                      {money(deal.grossAmount)}
                    </div>
                    <div className="text-[10px] text-[#636E72]">{FARMER_NEXT_STEP[deal.status]}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-charcoal">Your crops</h2>
            <Link href="/crops" className="text-[11px] font-semibold text-agri-900 hover:underline">
              Manage
            </Link>
          </div>
          {batches.length === 0 ? (
            <EmptyState
              title="No crop logged yet"
              message="Add a harvest batch and arhtis across Pakistan can start making you offers."
              actionHref="/crops/new"
              actionLabel="Add crop batch"
            />
          ) : (
            <div className="space-y-2">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3"
                >
                  <CropThumb imageUrl={batch.crop.imageUrl} name={batch.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-charcoal">{batch.crop.name}</span>
                      <Badge tone={statusTone(batch.status)}>{humanStatus(batch.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {qty(batch.availableKg)} left of {qty(batch.quantityKg)} · grade {batch.grade}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {batch._count.offers > 0
                        ? `${batch._count.offers} arhti ${batch._count.offers === 1 ? 'offer' : 'offers'} received`
                        : 'No offers yet'}
                      {batch.askingPricePerKg ? ` · asking ${money(batch.askingPricePerKg)}/kg` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-xs font-bold text-charcoal mb-1">Today&apos;s mandi rates</h2>
        <p className="text-[11px] text-[#636E72] mb-3">
          Published market rates so you can judge an offer before accepting it.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {rates.map((rate) => (
            <div key={rate.id} className="rounded-xl border border-[#E5E7EB] bg-[#F8F9F5] p-3">
              <div className="text-xs font-semibold text-charcoal">{rate.crop.name}</div>
              <div className="text-base font-bold text-charcoal">{money(rate.ratePerKg)}/kg</div>
              <div className="text-[10px] text-[#636E72]">{rate.mandi.city}</div>
              <div
                className={`text-[10px] font-semibold ${
                  rate.changePercent >= 0 ? 'text-agri-900' : 'text-red-700'
                }`}
              >
                {rate.changePercent >= 0 ? '▲' : '▼'} {Math.abs(rate.changePercent).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
