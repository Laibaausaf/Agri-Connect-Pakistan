import { notFound } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { AuctionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { can } from '@/lib/permissions';
import AuctionBidPanel from '@/components/auctions/AuctionBidPanel';
import { getI18n } from '@/lib/i18n/server';
import { DEFAULT_COMMISSION_RATE } from '@/lib/commission';

export const dynamic = 'force-dynamic';

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCapability('vendor.auction.browse', 'arhti.auction.manage');
  const { t } = await getI18n();

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      inventoryLot: { include: { crop: true } },
      mandi: true,
      arhti: true,
      bids: { include: { bidder: true }, orderBy: { amountPerKg: 'desc' } },
    },
  });

  if (!auction) notFound();

  const arhtiProfile = await prisma.arhtiProfile.findUnique({
    where: { userId: auction.arhtiId },
    select: { commissionRate: true },
  });
  const commissionRate = arhtiProfile?.commissionRate ?? DEFAULT_COMMISSION_RATE;

  const canBid =
    can(user.role, 'vendor.auction.bid') &&
    auction.arhtiId !== user.id &&
    auction.status === AuctionStatus.ACTIVE &&
    auction.endTime.getTime() > Date.now();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link
        href={can(user.role, 'vendor.auction.bid') ? '/auctions' : '/auction-house'}
        className="inline-flex min-h-12 items-center gap-1.5 text-[15px] font-bold"
      >
        <Icon name="arrowleft" size={20} /> {t('auctions.back')}
      </Link>

      <AuctionBidPanel auction={auction} currentUser={user} canBid={canBid} commissionRate={commissionRate} />
    </div>
  );
}
