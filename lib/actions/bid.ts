'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { placeBidSchema } from '@/lib/validations/bid';
import { getIO } from '@/lib/socket';
import { AuctionStatus, NotificationType } from '@prisma/client';

/**
 * Bidding in a mandi auction is a vendor-only capability. Farmers produce,
 * arhtis sell, shopkeepers buy wholesale — none of them can bid here, and the
 * check lives in the capability gate rather than in the UI.
 */
export async function placeBid(formData: FormData) {
  const user = await requireCapability('vendor.auction.bid');

  const parsed = placeBidSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }

  const { auctionId, amountPerKg } = parsed.data;

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { inventoryLot: { include: { crop: true } }, arhti: true },
  });

  if (!auction) return { error: 'Auction not found' };
  if (auction.status !== AuctionStatus.ACTIVE) return { error: 'This auction is no longer active' };
  if (auction.endTime.getTime() <= Date.now()) return { error: 'Auction has ended' };
  if (auction.arhtiId === user.id) return { error: 'You cannot bid on your own lot' };

  const minimumBid =
    (auction.currentHighestBid ?? auction.reservePrice) +
    (auction.currentHighestBid ? auction.minimumIncrement : 0);
  if (amountPerKg < minimumBid) {
    return { error: `Bid must be at least Rs ${minimumBid.toLocaleString('en-PK')} / kg` };
  }

  const previousHighestBid = await prisma.bid.findFirst({
    where: { auctionId },
    orderBy: { amountPerKg: 'desc' },
  });

  const result = await prisma.$transaction(async (tx) => {
    const bid = await tx.bid.create({
      data: { auctionId, bidderId: user.id, amountPerKg },
    });

    const updatedAuction = await tx.auction.update({
      where: { id: auctionId },
      data: { currentHighestBid: amountPerKg, bidCount: { increment: 1 } },
    });

    return { bid, auction: updatedAuction };
  });

  const notifications = [];

  if (previousHighestBid && previousHighestBid.bidderId !== user.id) {
    notifications.push(
      prisma.notification.create({
        data: {
          userId: previousHighestBid.bidderId,
          type: NotificationType.OUTBID,
          title: 'You have been outbid',
          message: `A new bid of Rs ${amountPerKg}/kg was placed on ${auction.auctionNumber}.`,
          link: `/auctions/${auctionId}`,
        },
      })
    );
  }

  notifications.push(
    prisma.notification.create({
      data: {
        userId: auction.arhtiId,
        type: NotificationType.NEW_BID,
        title: 'New bid received',
        message: `${user.name} bid Rs ${amountPerKg}/kg on ${auction.inventoryLot.crop.name} (${auction.auctionNumber}).`,
        link: `/auction-house`,
      },
    })
  );

  await Promise.all(notifications);

  getIO()?.to(`auction:${auctionId}`).emit('auction:update', {
    auctionId,
    currentHighestBid: amountPerKg,
    bidCount: result.auction.bidCount,
    latestBidderId: user.id,
    latestBidderName: user.name,
    latestBidAmount: amountPerKg,
    bidId: result.bid.id,
    endsAt: auction.endTime.toISOString(),
  });

  revalidatePath('/auctions');
  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath('/auction-house');

  return {
    success: true,
    currentHighestBid: amountPerKg,
    bidCount: result.auction.bidCount,
    bid: {
      id: result.bid.id,
      auctionId,
      bidderId: user.id,
      amountPerKg,
      timestamp: result.bid.timestamp.toISOString(),
      bidder: { id: user.id, name: user.name },
    },
  };
}
