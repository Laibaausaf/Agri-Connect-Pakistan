import Link from 'next/link';
import { AuctionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { getI18n } from '@/lib/i18n/server';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

function minutesLeft(endTime: Date) {
  return Math.max(0, Math.round((endTime.getTime() - Date.now()) / 60000));
}

export default async function AuctionsPage() {
  const user = await requireCapability('vendor.auction.browse');
  const { t, plural, crop, place, grade, kg, perKg } = await getI18n();

  const [live, won] = await Promise.all([
    prisma.auction.findMany({
      where: { status: AuctionStatus.ACTIVE },
      include: {
        inventoryLot: {
          select: {
            lotNumber: true,
            sourceCity: true,
            sourceFarmerName: true,
            crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
          },
        },
        mandi: { select: { name: true, city: true } },
        arhti: { select: { name: true } },
        bids: {
          orderBy: { amountPerKg: 'desc' },
          take: 1,
          select: { bidderId: true, amountPerKg: true },
        },
      },
      orderBy: { endTime: 'asc' },
    }),
    prisma.auction.findMany({
      where: { status: AuctionStatus.SOLD, winnerId: user.id },
      include: {
        inventoryLot: { select: { crop: { select: { name: true, nameUrdu: true, imageUrl: true } } } },
        mandi: { select: { city: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const leading = live.filter((a) => a.bids[0]?.bidderId === user.id).length;
  const volume = live.reduce((sum, a) => sum + a.quantityKg, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('auctions.title')}
        subtitle={t('auctions.subtitle')}
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard
          label={t('auctions.statLive')}
          value={String(live.length)}
          tone={live.length ? 'accent' : 'default'}
        />
        <StatCard label={t('auctions.statVolume')} value={kg(volume)} />
        <StatCard
          label={t('auctions.statLeading')}
          value={String(leading)}
          tone={leading ? 'accent' : 'default'}
        />
      </div>

      {live.length === 0 ? (
        <EmptyState
          title={t('auctions.emptyTitle')}
          message={t('auctions.emptyMessage')}
          actionHref="/stock"
          actionLabel={t('auctions.emptyAction')}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {live.map((auction) => {
            const top = auction.bids[0];
            const isLeading = top?.bidderId === user.id;
            const left = minutesLeft(auction.endTime);
            return (
              <Link key={auction.id} href={`/auctions/${auction.id}`} className="block">
                <Card className="hover:border-[#B7D4C8] transition-colors h-full">
                  <div className="flex items-start gap-3">
                    <CropThumb
                      imageUrl={firstPhoto(auction.photos) ?? auction.inventoryLot.crop.imageUrl}
                      name={auction.inventoryLot.crop.name}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-charcoal">
                          {crop(auction.inventoryLot.crop)}
                        </span>
                        <Badge tone="live">{t('common.live')}</Badge>
                        {isLeading && <Badge tone="green">{t('auctions.leading')}</Badge>}
                      </div>
                      <div className="text-[11px] text-[#636E72] mt-0.5">
                        {auction.arhti.name} · {place(auction.mandi.name)}
                      </div>
                      <div className="text-[10px] text-[#636E72]">
                        {t('auctions.grownBy', { name: auction.inventoryLot.sourceFarmerName, city: place(auction.inventoryLot.sourceCity) })}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>
                          <div className="text-[10px] text-[#636E72]">{t('auctions.quantity')}</div>
                          <div className="font-semibold text-charcoal">
                            {kg(auction.quantityKg)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#636E72]">{t('auctions.grade')}</div>
                          <div className="font-semibold text-charcoal">{grade(auction.grade)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#636E72]">
                            {top ? t('auctions.topBid') : t('auctions.reserve')}
                          </div>
                          <div className="font-semibold text-agri-900">
                            {perKg(top?.amountPerKg ?? auction.reservePrice)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#636E72]">{t('auctions.closesIn')}</div>
                          <div className="font-semibold text-charcoal">
                            {left > 0 ? t('auctions.minutes', { count: left }) : t('auctions.closing')}
                          </div>
                          <div className="text-[10px] text-[#636E72]">
                            {plural('auctionHouse.bid', auction.bidCount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {won.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-2">
            {t('auctions.won')}
          </h2>
          <div className="space-y-2">
            {won.map((auction) => (
              <Card key={auction.id} padded={false}>
                <div className="px-3 py-2.5 flex items-center gap-3 text-xs">
                  <CropThumb
                    imageUrl={auction.inventoryLot.crop.imageUrl}
                    name={auction.inventoryLot.crop.name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-charcoal">
                      {kg(auction.quantityKg)} {crop(auction.inventoryLot.crop)}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {perKg(auction.currentHighestBid ?? 0)} · {place(auction.mandi.city)}
                    </div>
                  </div>
                  <Link
                    href="/stock"
                    className="text-[10px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
                  >
                    {t('auctions.inWarehouse')}
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
