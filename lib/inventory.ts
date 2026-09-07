import {
  CropBatchStatus,
  InventoryLotStatus,
  OfferListingStatus,
  StockStatus,
} from '@prisma/client';
import type { Tx } from '@/lib/supplychain';

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryError';
  }
}

/** Guards against float drift accumulating into phantom or negative kilograms. */
export function kg(value: number) {
  return Math.round(value * 1000) / 1000;
}

function assertPositive(quantityKg: number) {
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
    throw new InventoryError('Quantity must be greater than zero');
  }
}

/**
 * Ownership in AgriConnect only ever moves by drawing down a parent record and
 * creating a child record inside the same transaction. These helpers are the
 * only sanctioned way to decrement stock, so overselling is impossible.
 */

export async function drawFromBatch(tx: Tx, batchId: string, quantityKg: number) {
  assertPositive(quantityKg);
  const batch = await tx.farmerCropBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new InventoryError('Crop batch not found');
  if (kg(quantityKg) > kg(batch.availableKg)) {
    throw new InventoryError(
      `Only ${batch.availableKg} kg is unsold in this batch — cannot commit ${quantityKg} kg`
    );
  }
  const remaining = kg(batch.availableKg - quantityKg);
  return tx.farmerCropBatch.update({
    where: { id: batchId },
    data: {
      availableKg: remaining,
      status: remaining === 0 ? CropBatchStatus.SOLD_OUT : CropBatchStatus.NEGOTIATING,
    },
  });
}

export async function returnToBatch(tx: Tx, batchId: string, quantityKg: number) {
  assertPositive(quantityKg);
  const batch = await tx.farmerCropBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new InventoryError('Crop batch not found');
  const restored = kg(Math.min(batch.quantityKg, batch.availableKg + quantityKg));
  return tx.farmerCropBatch.update({
    where: { id: batchId },
    data: {
      availableKg: restored,
      status: restored > 0 ? CropBatchStatus.READY_FOR_SALE : batch.status,
    },
  });
}

export async function drawFromArhtiLot(tx: Tx, lotId: string, quantityKg: number) {
  assertPositive(quantityKg);
  const lot = await tx.arhtiInventoryLot.findUnique({ where: { id: lotId } });
  if (!lot) throw new InventoryError('Inventory lot not found');
  if (kg(quantityKg) > kg(lot.availableQuantityKg)) {
    throw new InventoryError(
      `You only hold ${lot.availableQuantityKg} kg in lot ${lot.lotNumber} — cannot auction ${quantityKg} kg`
    );
  }
  const remaining = kg(lot.availableQuantityKg - quantityKg);
  return tx.arhtiInventoryLot.update({
    where: { id: lotId },
    data: {
      availableQuantityKg: remaining,
      status: remaining === 0 ? InventoryLotStatus.SOLD_OUT : InventoryLotStatus.PARTIALLY_AUCTIONED,
    },
  });
}

export async function returnToArhtiLot(tx: Tx, lotId: string, quantityKg: number) {
  assertPositive(quantityKg);
  const lot = await tx.arhtiInventoryLot.findUnique({ where: { id: lotId } });
  if (!lot) throw new InventoryError('Inventory lot not found');
  const restored = kg(Math.min(lot.receivedQuantityKg, lot.availableQuantityKg + quantityKg));
  return tx.arhtiInventoryLot.update({
    where: { id: lotId },
    data: {
      availableQuantityKg: restored,
      status:
        restored >= lot.receivedQuantityKg
          ? InventoryLotStatus.IN_STOCK
          : InventoryLotStatus.PARTIALLY_AUCTIONED,
    },
  });
}

export async function drawFromVendorStock(tx: Tx, stockId: string, quantityKg: number) {
  assertPositive(quantityKg);
  const stock = await tx.vendorInventory.findUnique({ where: { id: stockId } });
  if (!stock) throw new InventoryError('Vendor stock not found');
  if (kg(quantityKg) > kg(stock.availableKg)) {
    throw new InventoryError(
      `Only ${stock.availableKg} kg remains uncommitted in stock ${stock.stockNumber}`
    );
  }
  const remaining = kg(stock.availableKg - quantityKg);
  return tx.vendorInventory.update({
    where: { id: stockId },
    data: { availableKg: remaining, status: stockStatusFor(remaining, stock.quantityKg) },
  });
}

export async function drawFromVendorOffer(tx: Tx, offerId: string, quantityKg: number) {
  assertPositive(quantityKg);
  const offer = await tx.vendorOffer.findUnique({ where: { id: offerId } });
  if (!offer) throw new InventoryError('Wholesale offer not found');
  if (offer.status !== OfferListingStatus.ACTIVE) {
    throw new InventoryError('This wholesale offer is not accepting orders');
  }
  if (kg(quantityKg) < kg(offer.minOrderKg)) {
    throw new InventoryError(`Minimum order for this offer is ${offer.minOrderKg} kg`);
  }
  if (kg(quantityKg) > kg(offer.remainingKg)) {
    throw new InventoryError(`Only ${offer.remainingKg} kg is still available in this offer`);
  }
  const remaining = kg(offer.remainingKg - quantityKg);
  return tx.vendorOffer.update({
    where: { id: offerId },
    data: {
      remainingKg: remaining,
      status: remaining === 0 ? OfferListingStatus.SOLD_OUT : OfferListingStatus.ACTIVE,
    },
  });
}

export async function drawFromShopkeeperStock(tx: Tx, stockId: string, quantityKg: number) {
  assertPositive(quantityKg);
  const stock = await tx.shopkeeperInventory.findUnique({ where: { id: stockId } });
  if (!stock) throw new InventoryError('Shop stock not found');
  if (kg(quantityKg) > kg(stock.availableKg)) {
    throw new InventoryError(
      `Only ${stock.availableKg} kg remains unlisted in stock ${stock.stockNumber}`
    );
  }
  const remaining = kg(stock.availableKg - quantityKg);
  return tx.shopkeeperInventory.update({
    where: { id: stockId },
    data: { availableKg: remaining, status: stockStatusFor(remaining, stock.quantityKg) },
  });
}

export async function drawFromRetailListing(tx: Tx, listingId: string, quantityKg: number) {
  assertPositive(quantityKg);
  const listing = await tx.retailListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new InventoryError('Retail listing not found');
  if (listing.status !== OfferListingStatus.ACTIVE) {
    throw new InventoryError('This item is no longer on sale');
  }
  if (kg(quantityKg) > kg(listing.remainingKg)) {
    throw new InventoryError(`Only ${listing.remainingKg} kg left of ${listing.title}`);
  }
  const remaining = kg(listing.remainingKg - quantityKg);
  return tx.retailListing.update({
    where: { id: listingId },
    data: {
      remainingKg: remaining,
      status: remaining === 0 ? OfferListingStatus.SOLD_OUT : OfferListingStatus.ACTIVE,
    },
  });
}

function stockStatusFor(remaining: number, total: number): StockStatus {
  if (remaining === 0) return StockStatus.SOLD_OUT;
  if (total > 0 && remaining / total <= 0.15) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}
