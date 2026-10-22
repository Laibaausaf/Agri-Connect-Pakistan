import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AuctionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { can } from '@/lib/permissions';
import AuctionBidPanel from '@/components/auctions/AuctionBidPanel';
import { getI18n } from '@/lib/i18n/server';

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

  const canBid =
    can(user.role, 'vendor.auction.bid') &&
    auction.arhtiId !== user.id &&
    auction.status === AuctionStatus.ACTIVE &&
    auction.endTime.getTime() > Date.now();

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-6 space-y-4">
      <Link
        href={can(user.role, 'vendor.auction.bid') ? '/auctions' : '/auction-house'}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#636E72] hover:text-agri-900"
      >
        <ArrowLeft className="w-3.5 h-3.5 rtl:-scale-x-100" /> {t('auctions.back')}
      </Link>

      <AuctionBidPanel auction={auction} currentUser={user} canBid={canBid} />
    </div>
  );
}
