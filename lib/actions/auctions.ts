'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability, ForbiddenError } from '@/lib/authz';
import { drawFromArhtiLot, returnToArhtiLot, InventoryError, kg } from '@/lib/inventory';
import { businessNumber, recordChainEvent, shortCode } from '@/lib/supplychain';
import { getIO } from '@/lib/socket';
import { auctionIdSchema, createAuctionSchema } from '@/lib/validations/workflow';
import {
  AuctionStatus,
  NotificationType,
  PaymentStatus,
  SaleStatus,
  StockStatus,
  SupplyChainStage,
  TransactionType,
  UserRole,
} from '@prisma/client';

/** Only an arhti may open a mandi auction, and only against stock they hold. */
export async function createAuction(formData: FormData) {
  const user = await requireCapability('arhti.auction.manage');

  const parsed = createAuctionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const data = parsed.data;

  const lot = await prisma.arhtiInventoryLot.findUnique({
    where: { id: data.inventoryLotId },
    include: { crop: true, mandi: true },
  });
  if (!lot) return { error: 'Inventory lot not found' };
  if (lot.arhtiId !== user.id) throw new ForbiddenError('This inventory lot is not yours');

  if (data.reservePrice < lot.purchasePricePerKg) {
    return {
      error: `Reserve price is below your purchase cost of Rs ${lot.purchasePricePerKg}/kg`,
    };
  }

  try {
    const auction = await prisma.$transaction(async (tx) => {
      await drawFromArhtiLot(tx, lot.id, data.quantityKg);

      const created = await tx.auction.create({
        data: {
          auctionNumber: `AUC-${shortCode(lot.crop.name)}-${businessNumber('').slice(1)}`,
          inventoryLotId: lot.id,
          arhtiId: user.id,
          mandiId: lot.mandiId,
          quantityKg: data.quantityKg,
          grade: lot.grade,
          photos: lot.photos ?? [],
          startTime: new Date(),
          endTime: new Date(Date.now() + data.durationMinutes * 60 * 1000),
          reservePrice: data.reservePrice,
          currentHighestBid: null,
          minimumIncrement: data.minimumIncrement,
          status: AuctionStatus.ACTIVE,
        },
      });

      await recordChainEvent(tx, {
        batchId: lot.batchId,
        stage: SupplyChainStage.MANDI_AUCTION,
        actorId: user.id,
        actorRole: UserRole.ARHTI,
        title: 'Listed for mandi auction',
        description: `${data.quantityKg.toLocaleString('en-PK')} kg ${lot.crop.name} opened at ${lot.mandi.name} with reserve Rs ${data.reservePrice}/kg`,
        quantityKg: data.quantityKg,
        pricePerKg: data.reservePrice,
        refType: 'Auction',
        refId: created.id,
      });

      return created;
    });

    revalidatePath('/auction-house');
    revalidatePath('/inventory');
    revalidatePath('/auctions');
    return { success: true, auctionId: auction.id };
  } catch (err) {
    if (err instanceof InventoryError) return { error: err.message };
    throw err;
  }
}

class AuctionAlreadyClosed extends Error {}

/**
 * Closing an auction hands the produce to the winning vendor: an ArhtiVendorSale
 * records the transaction and VendorInventory records the new ownership.
 */
export async function closeAuction(formData: FormData) {
  const user = await requireCapability('arhti.auction.manage');

  const parsed = auctionIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Invalid auction' };

  const auction = await prisma.auction.findUnique({
    where: { id: parsed.data.auctionId },
    include: {
      inventoryLot: { include: { crop: true } },
      mandi: true,
      arhti: { include: { arhtiProfile: true } },
    },
  });
  if (!auction) return { error: 'Auction not found' };
  if (auction.arhtiId !== user.id) throw new ForbiddenError('This auction is not yours');
  if (auction.status !== AuctionStatus.ACTIVE) return { error: 'This auction is already closed' };

  const commissionRate = auction.arhti.arhtiProfile?.commissionRate ?? 0.02;

  let outcome: { sold: false } | { sold: true; amountPerKg: number; winnerName: string };
  try {
    outcome = await prisma.$transaction(async (tx) => {
      // Claim the auction first. From here on no bid can be accepted (bids only
      // land on an ACTIVE auction), and a second close finds nothing to claim.
      const claimed = await tx.auction.updateMany({
        where: { id: auction.id, status: AuctionStatus.ACTIVE },
        data: { status: AuctionStatus.EXPIRED },
      });
      if (claimed.count === 0) throw new AuctionAlreadyClosed();

      // Read the top bid only after the claim, so a bid that got in just before
      // the close is the one that wins.
      const topBid = await tx.bid.findFirst({
        where: { auctionId: auction.id },
        orderBy: { amountPerKg: 'desc' },
        include: { bidder: true },
      });

      if (!topBid) {
        await returnToArhtiLot(tx, auction.inventoryLotId, auction.quantityKg);
        return { sold: false as const };
      }

      const gross = kg(auction.quantityKg * topBid.amountPerKg);
      const commission = kg(gross * commissionRate);

      const sale = await tx.arhtiVendorSale.create({
        data: {
          saleNumber: `AVS-${businessNumber('').slice(1)}`,
          auctionId: auction.id,
          arhtiId: auction.arhtiId,
          vendorId: topBid.bidderId,
          rootBatchId: auction.inventoryLot.batchId,
          quantityKg: auction.quantityKg,
          ratePerKg: topBid.amountPerKg,
          grossAmount: gross,
          commission,
          mandiId: auction.mandiId,
          // Payment is recorded as paid below, so the sale is complete.
          status: SaleStatus.COMPLETED,
        },
      });

      await tx.vendorInventory.create({
        data: {
          stockNumber: `VS-${shortCode(auction.inventoryLot.crop.name)}-${businessNumber('').slice(1)}`,
          vendorId: topBid.bidderId,
          saleId: sale.id,
          rootBatchId: auction.inventoryLot.batchId,
          cropId: auction.inventoryLot.cropId,
          quantityKg: auction.quantityKg,
          availableKg: auction.quantityKg,
          grade: auction.grade,
          costPerKg: topBid.amountPerKg,
          sourceMandiCity: auction.mandi.city,
          sourceFarmCity: auction.inventoryLot.sourceCity,
          photos: auction.photos ?? [],
          status: StockStatus.IN_STOCK,
        },
      });

      await tx.paymentRecord.create({
        data: {
          transactionType: TransactionType.ARHTI_VENDOR,
          transactionId: sale.id,
          amount: gross,
          payerId: topBid.bidderId,
          recipientId: auction.arhtiId,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          reference: `RAAST-${businessNumber('P')}`,
        },
      });

      await tx.auction.update({
        where: { id: auction.id },
        data: {
          status: AuctionStatus.SOLD,
          winnerId: topBid.bidderId,
          winningBidId: topBid.id,
          currentHighestBid: topBid.amountPerKg,
        },
      });

      await recordChainEvent(tx, {
        batchId: auction.inventoryLot.batchId,
        stage: SupplyChainStage.ARHTI_VENDOR_SALE,
        actorId: auction.arhtiId,
        actorRole: UserRole.ARHTI,
        title: 'Auction won by vendor',
        description: `${topBid.bidder.name} won ${auction.quantityKg.toLocaleString('en-PK')} kg ${auction.inventoryLot.crop.name} at Rs ${topBid.amountPerKg}/kg in ${auction.mandi.city}`,
        quantityKg: auction.quantityKg,
        pricePerKg: topBid.amountPerKg,
        refType: 'ArhtiVendorSale',
        refId: sale.id,
      });

      await tx.notification.createMany({
        data: [
          {
            userId: topBid.bidderId,
            type: NotificationType.AUCTION_WON,
            title: 'You won the auction',
            message: `${auction.quantityKg.toLocaleString('en-PK')} kg ${auction.inventoryLot.crop.name} at Rs ${topBid.amountPerKg}/kg is now in your warehouse.`,
            link: '/stock',
          },
          {
            userId: auction.arhtiId,
            type: NotificationType.AUCTION_CLOSED,
            title: 'Auction closed',
            message: `Sold ${auction.quantityKg.toLocaleString('en-PK')} kg at Rs ${topBid.amountPerKg}/kg to ${topBid.bidder.name}.`,
            link: '/sales',
          },
        ],
      });

      return { sold: true as const, amountPerKg: topBid.amountPerKg, winnerName: topBid.bidder.name };
    });
  } catch (err) {
    if (err instanceof AuctionAlreadyClosed) return { error: 'This auction is already closed' };
    throw err;
  }

  if (!outcome.sold) {
    getIO()?.to(`auction:${auction.id}`).emit('auction:closed', { auctionId: auction.id, sold: false });
    revalidatePath('/auction-house');
    revalidatePath('/inventory');
    return { success: true, sold: false };
  }

  getIO()?.to(`auction:${auction.id}`).emit('auction:closed', {
    auctionId: auction.id,
    sold: true,
    winningBid: outcome.amountPerKg,
    winnerName: outcome.winnerName,
  });

  revalidatePath('/auction-house');
  revalidatePath('/auctions');
  revalidatePath('/stock');
  revalidatePath('/sales');
  return { success: true, sold: true };
}

export async function cancelAuction(formData: FormData) {
  const user = await requireCapability('arhti.auction.manage');
  const parsed = auctionIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Invalid auction' };

  const auction = await prisma.auction.findUnique({ where: { id: parsed.data.auctionId } });
  if (!auction) return { error: 'Auction not found' };
  if (auction.arhtiId !== user.id) throw new ForbiddenError('This auction is not yours');
  if (auction.status !== AuctionStatus.ACTIVE) return { error: 'This auction is already closed' };
  if (auction.bidCount > 0) return { error: 'An auction with live bids cannot be cancelled' };

  // Cancel only if it is still open with no bids at the moment of writing.
  const cancelled = await prisma.$transaction(async (tx) => {
    const claimed = await tx.auction.updateMany({
      where: { id: auction.id, status: AuctionStatus.ACTIVE, bidCount: 0 },
      data: { status: AuctionStatus.CANCELLED },
    });
    if (claimed.count === 0) return false;
    await returnToArhtiLot(tx, auction.inventoryLotId, auction.quantityKg);
    return true;
  });
  if (!cancelled) {
    const fresh = await prisma.auction.findUnique({ where: { id: auction.id } });
    return {
      error:
        fresh?.status === AuctionStatus.ACTIVE
          ? 'An auction with live bids cannot be cancelled'
          : 'This auction is already closed',
    };
  }
  getIO()?.to(`auction:${auction.id}`).emit('auction:closed', { auctionId: auction.id, sold: false });

  revalidatePath('/auction-house');
  revalidatePath('/inventory');
  return { success: true };
}
