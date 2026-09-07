'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireCapability, ForbiddenError } from '@/lib/authz';
import {
  drawFromVendorStock,
  drawFromVendorOffer,
  InventoryError,
  kg,
} from '@/lib/inventory';
import { businessNumber, recordChainEvent, shortCode } from '@/lib/supplychain';
import { createVendorOfferSchema, purchaseWholesaleSchema } from '@/lib/validations/workflow';
import {
  NotificationType,
  OfferListingStatus,
  PaymentStatus,
  SaleStatus,
  StockStatus,
  SupplyChainStage,
  TransactionType,
  UserRole,
} from '@prisma/client';

/** A vendor puts part of their warehouse stock on their wholesale shop. */
export async function createVendorOffer(formData: FormData) {
  const user = await requireCapability('vendor.offers.manage');

  const parsed = createVendorOfferSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const data = parsed.data;

  const stock = await prisma.vendorInventory.findUnique({
    where: { id: data.stockId },
    include: { crop: true },
  });
  if (!stock) return { error: 'Warehouse stock not found' };
  if (stock.vendorId !== user.id) throw new ForbiddenError('This stock is not yours');
  if (data.pricePerKg <= stock.costPerKg) {
    return { error: `Wholesale price must be above your cost of Rs ${stock.costPerKg}/kg` };
  }

  const cities = (data.deliveryCities ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    await prisma.$transaction(async (tx) => {
      await drawFromVendorStock(tx, stock.id, data.offeredQuantityKg);

      const offer = await tx.vendorOffer.create({
        data: {
          offerNumber: `WO-${shortCode(stock.crop.name)}-${businessNumber('').slice(1)}`,
          vendorId: user.id,
          stockId: stock.id,
          rootBatchId: stock.rootBatchId,
          cropId: stock.cropId,
          offeredQuantityKg: data.offeredQuantityKg,
          remainingKg: data.offeredQuantityKg,
          pricePerKg: data.pricePerKg,
          minOrderKg: data.minOrderKg,
          grade: stock.grade,
          deliveryCities: cities,
          deliveryEtaHours: data.deliveryEtaHours,
          photos: stock.photos ?? [],
          status: OfferListingStatus.ACTIVE,
        },
      });

      await recordChainEvent(tx, {
        batchId: stock.rootBatchId,
        stage: SupplyChainStage.VENDOR_WHOLESALE_OFFER,
        actorId: user.id,
        actorRole: UserRole.VENDOR,
        title: 'Listed on vendor wholesale shop',
        description: `${data.offeredQuantityKg.toLocaleString('en-PK')} kg ${stock.crop.name} offered to shopkeepers at Rs ${data.pricePerKg}/kg`,
        quantityKg: data.offeredQuantityKg,
        pricePerKg: data.pricePerKg,
        refType: 'VendorOffer',
        refId: offer.id,
      });
    });
  } catch (err) {
    if (err instanceof InventoryError) return { error: err.message };
    throw err;
  }

  revalidatePath('/wholesale-shop');
  revalidatePath('/stock');
  revalidatePath('/wholesale');
  redirect('/wholesale-shop');
}

export async function setVendorOfferStatus(formData: FormData) {
  const user = await requireCapability('vendor.offers.manage');
  const offerId = String(formData.get('offerId') ?? '');
  const next = String(formData.get('status') ?? '');
  if (next !== 'ACTIVE' && next !== 'PAUSED') return { error: 'Invalid status' };

  const offer = await prisma.vendorOffer.findUnique({ where: { id: offerId } });
  if (!offer) return { error: 'Offer not found' };
  if (offer.vendorId !== user.id) throw new ForbiddenError('This offer is not yours');
  if (offer.status === OfferListingStatus.SOLD_OUT) return { error: 'This offer is sold out' };

  await prisma.vendorOffer.update({
    where: { id: offerId },
    data: { status: next as OfferListingStatus },
  });
  revalidatePath('/wholesale-shop');
  return { success: true };
}

/**
 * Shopkeeper buys wholesale. The vendor offer is drawn down and shop stock is
 * created in the same transaction, so the kilograms can never be sold twice.
 */
export async function purchaseWholesale(formData: FormData) {
  const user = await requireCapability('shopkeeper.wholesale.purchase');

  const parsed = purchaseWholesaleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const { offerId, quantityKg } = parsed.data;

  const offer = await prisma.vendorOffer.findUnique({
    where: { id: offerId },
    include: { crop: true, vendor: true },
  });
  if (!offer) return { error: 'Wholesale offer not found' };

  const profile = await prisma.shopkeeperProfile.findUnique({ where: { userId: user.id } });

  try {
    const saleId = await prisma.$transaction(async (tx) => {
      await drawFromVendorOffer(tx, offer.id, quantityKg);

      const sale = await tx.vendorShopkeeperSale.create({
        data: {
          saleNumber: `VSS-${businessNumber('').slice(1)}`,
          offerId: offer.id,
          vendorId: offer.vendorId,
          shopkeeperId: user.id,
          rootBatchId: offer.rootBatchId,
          quantityKg,
          ratePerKg: offer.pricePerKg,
          grossAmount: kg(quantityKg * offer.pricePerKg),
          deliveryCity: profile?.city ?? null,
          status: SaleStatus.PAID,
        },
      });

      await tx.shopkeeperInventory.create({
        data: {
          stockNumber: `SS-${shortCode(offer.crop.name)}-${businessNumber('').slice(1)}`,
          shopkeeperId: user.id,
          saleId: sale.id,
          rootBatchId: offer.rootBatchId,
          cropId: offer.cropId,
          quantityKg,
          availableKg: quantityKg,
          grade: offer.grade,
          costPerKg: offer.pricePerKg,
          photos: offer.photos ?? [],
          status: StockStatus.IN_STOCK,
        },
      });

      await tx.paymentRecord.create({
        data: {
          transactionType: TransactionType.VENDOR_SHOPKEEPER,
          transactionId: sale.id,
          amount: sale.grossAmount,
          payerId: user.id,
          recipientId: offer.vendorId,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          reference: `RAAST-${businessNumber('P')}`,
        },
      });

      await recordChainEvent(tx, {
        batchId: offer.rootBatchId,
        stage: SupplyChainStage.VENDOR_SHOPKEEPER_SALE,
        actorId: user.id,
        actorRole: UserRole.SHOPKEEPER,
        title: 'Shopkeeper bought wholesale',
        description: `${profile?.shopName ?? user.name} bought ${quantityKg.toLocaleString('en-PK')} kg ${offer.crop.name} from ${offer.vendor.name} at Rs ${offer.pricePerKg}/kg`,
        quantityKg,
        pricePerKg: offer.pricePerKg,
        refType: 'VendorShopkeeperSale',
        refId: sale.id,
      });

      await tx.notification.create({
        data: {
          userId: offer.vendorId,
          type: NotificationType.WHOLESALE_ORDER,
          title: 'New wholesale order',
          message: `${profile?.shopName ?? user.name} ordered ${quantityKg.toLocaleString('en-PK')} kg ${offer.crop.name} at Rs ${offer.pricePerKg}/kg.`,
          link: '/sales',
        },
      });

      return sale.id;
    });

    revalidatePath('/wholesale');
    revalidatePath('/purchases');
    revalidatePath('/shop-stock');
    revalidatePath('/wholesale-shop');
    return { success: true, saleId };
  } catch (err) {
    if (err instanceof InventoryError) return { error: err.message };
    throw err;
  }
}
