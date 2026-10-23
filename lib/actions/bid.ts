'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { placeBidSchema } from '@/lib/validations/bid';
import { getIO } from '@/lib/socket';
import { AuctionStatus, NotificationType } from '@prisma/client';

type AuctionForBid = {
  status: AuctionStatus;
  endTime: Date;
  currentHighestBid: number | null;
  reservePrice: number;
  minimumIncrement: number;
};

function minimumBidFor(auction: AuctionForBid) {
  return auction.currentHighestBid == null
    ? auction.reservePrice
    : auction.currentHighestBid + auction.minimumIncrement;
}

/** The reason a bid cannot be placed right now, or null if it can. */
function bidRejection(auction: AuctionForBid, amountPerKg: number) {
  if (auction.status !== AuctionStatus.ACTIVE) return 'This auction is no longer active';
  if (auction.endTime.getTime() <= Date.now()) return 'Auction has ended';
  const minimumBid = minimumBidFor(auction);
  if (amountPerKg < minimumBid) {
    return `Bid must be at least Rs ${minimumBid.toLocaleString('en-PK')} / kg`;
  }
  return null;
}

class BidRejected extends Error {}

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
  if (auction.arhtiId === user.id) return { error: 'You cannot bid on your own lot' };
  const early = bidRejection(auction, amountPerKg);
  if (early) return { error: early };

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      // The check and the write are one statement: the auction only takes this
      // bid if, at the moment of writing, it is still open and the bid still
      // beats the current top bid. A concurrent higher bid or a close that got
      // there first makes this match nothing, so a lower bid can never become
      // the top bid and no bid lands on a sold auction.
      const claimed = await tx.auction.updateMany({
        where: {
          id: auctionId,
          status: AuctionStatus.ACTIVE,
          endTime: { gt: new Date() },
          OR: [
            { currentHighestBid: null, reservePrice: { lte: amountPerKg } },
            { currentHighestBid: { lte: amountPerKg - auction.minimumIncrement } },
          ],
        },
        data: { currentHighestBid: amountPerKg, bidCount: { increment: 1 } },
      });
      if (claimed.count === 0) throw new BidRejected();

      const previousHighestBid = await tx.bid.findFirst({
        where: { auctionId },
        orderBy: { amountPerKg: 'desc' },
      });

      const bid = await tx.bid.create({
        data: { auctionId, bidderId: user.id, amountPerKg },
      });

      const updatedAuction = await tx.auction.findUniqueOrThrow({ where: { id: auctionId } });

      return { bid, auction: updatedAuction, previousHighestBid };
    });
  } catch (err) {
    if (!(err instanceof BidRejected)) throw err;
    // Someone else's bid or the close got there first: explain with fresh numbers.
    const fresh = await prisma.auction.findUnique({ where: { id: auctionId } });
    return {
      error: (fresh && bidRejection(fresh, amountPerKg)) ?? 'This auction is no longer active',
      currentHighestBid: fresh?.currentHighestBid ?? undefined,
      bidCount: fresh?.bidCount,
    };
  }

  const { previousHighestBid } = result;

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
    currentHighestBid: result.auction.currentHighestBid ?? amountPerKg,
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
    currentHighestBid: result.auction.currentHighestBid ?? amountPerKg,
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

/**
 * Current state of an auction for the bid page. The page uses it only while
 * its live connection is down, so bids and the close still show up without a
 * reload.
 */
export async function getAuctionLiveState(auctionId: string) {
  await requireCapability('vendor.auction.browse', 'arhti.auction.manage');
  if (typeof auctionId !== 'string' || !auctionId) return null;

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: {
      status: true,
      endTime: true,
      currentHighestBid: true,
      bidCount: true,
      bids: {
        orderBy: { amountPerKg: 'desc' },
        take: 50,
        select: {
          id: true,
          auctionId: true,
          bidderId: true,
          amountPerKg: true,
          timestamp: true,
          bidder: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!auction) return null;

  return {
    status: auction.status,
    endsAt: auction.endTime.toISOString(),
    currentHighestBid: auction.currentHighestBid,
    bidCount: auction.bidCount,
    bids: auction.bids.map((b) => ({ ...b, timestamp: b.timestamp.toISOString() })),
  };
}
