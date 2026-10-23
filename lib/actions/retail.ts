'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireCapability, ForbiddenError } from '@/lib/authz';
import {
  drawFromShopkeeperStock,
  drawFromRetailListing,
  returnToRetailListing,
  InventoryError,
  kg,
} from '@/lib/inventory';
import { businessNumber, recordChainEvent } from '@/lib/supplychain';
import {
  createRetailListingSchema,
  placeConsumerOrderSchema,
  rateShopSchema,
  updateConsumerOrderSchema,
} from '@/lib/validations/workflow';
import {
  ConsumerOrderStatus,
  NotificationType,
  OfferListingStatus,
  PaymentStatus,
  SupplyChainStage,
  TransactionType,
  UserRole,
} from '@prisma/client';

/** Shopkeeper puts shop stock on the consumer-facing storefront. */
export async function createRetailListing(formData: FormData) {
  const user = await requireCapability('shopkeeper.retail.manage');

  const parsed = createRetailListingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const data = parsed.data;

  const stock = await prisma.shopkeeperInventory.findUnique({
    where: { id: data.stockId },
    include: { crop: true, sale: true },
  });
  if (!stock) return { error: 'Shop stock not found' };
  if (stock.shopkeeperId !== user.id) throw new ForbiddenError('This stock is not yours');
  if (data.pricePerKg <= stock.costPerKg) {
    return { error: `Retail price must be above your cost of Rs ${stock.costPerKg}/kg` };
  }

  const photos = Array.isArray(stock.photos) ? (stock.photos as string[]) : [];

  try {
    await prisma.$transaction(async (tx) => {
      await drawFromShopkeeperStock(tx, stock.id, data.listedQuantityKg);

      const listing = await tx.retailListing.create({
        data: {
          listingNumber: `RL-${businessNumber('').slice(1)}`,
          shopkeeperId: user.id,
          stockId: stock.id,
          rootBatchId: stock.rootBatchId,
          cropId: stock.cropId,
          title: data.title,
          listedQuantityKg: data.listedQuantityKg,
          remainingKg: data.listedQuantityKg,
          pricePerKg: data.pricePerKg,
          packSizeKg: data.packSizeKg,
          imageUrl: photos[0] ?? stock.crop.imageUrl,
          originLabel: null,
          status: OfferListingStatus.ACTIVE,
        },
      });

      await recordChainEvent(tx, {
        batchId: stock.rootBatchId,
        stage: SupplyChainStage.RETAIL_LISTING,
        actorId: user.id,
        actorRole: UserRole.SHOPKEEPER,
        title: 'Listed for retail sale',
        description: `${data.listedQuantityKg.toLocaleString('en-PK')} kg ${stock.crop.name} on sale at Rs ${data.pricePerKg}/kg`,
        quantityKg: data.listedQuantityKg,
        pricePerKg: data.pricePerKg,
        refType: 'RetailListing',
        refId: listing.id,
      });
    });
  } catch (err) {
    if (err instanceof InventoryError) return { error: err.message };
    throw err;
  }

  revalidatePath('/storefront');
  revalidatePath('/shop-stock');
  revalidatePath('/shop');
  redirect('/storefront');
}

/** Consumer places a demo order against a single shop's retail listing. */
export async function placeConsumerOrder(formData: FormData) {
  const user = await requireCapability('consumer.retail.order');

  const parsed = placeConsumerOrderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const { listingId, quantityKg, deliveryAddress } = parsed.data;

  const listing = await prisma.retailListing.findUnique({
    where: { id: listingId },
    include: { crop: true, shopkeeper: { include: { shopkeeperProfile: true } } },
  });
  if (!listing) return { error: 'This item is not available' };

  const profile = await prisma.consumerProfile.findUnique({ where: { userId: user.id } });
  const lineTotal = kg(quantityKg * listing.pricePerKg);
  const deliveryFee = lineTotal >= 1000 ? 0 : 60;

  try {
    const orderId = await prisma.$transaction(async (tx) => {
      await drawFromRetailListing(tx, listing.id, quantityKg);

      const order = await tx.consumerOrder.create({
        data: {
          orderNumber: `CO-${businessNumber('').slice(1)}`,
          consumerId: user.id,
          shopkeeperId: listing.shopkeeperId,
          totalAmount: kg(lineTotal + deliveryFee),
          deliveryFee,
          deliveryAddress: deliveryAddress || profile?.deliveryAddress || null,
          etaMinutes: listing.shopkeeper.shopkeeperProfile?.avgDeliveryMinutes ?? 35,
          status: ConsumerOrderStatus.PLACED,
          items: {
            create: [
              {
                listingId: listing.id,
                rootBatchId: listing.rootBatchId,
                quantityKg,
                pricePerKg: listing.pricePerKg,
                lineTotal,
              },
            ],
          },
        },
      });

      await tx.paymentRecord.create({
        data: {
          transactionType: TransactionType.SHOPKEEPER_CONSUMER,
          transactionId: order.id,
          amount: order.totalAmount,
          payerId: user.id,
          recipientId: listing.shopkeeperId,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          reference: `RAAST-${businessNumber('P')}`,
        },
      });

      await recordChainEvent(tx, {
        batchId: listing.rootBatchId,
        stage: SupplyChainStage.CONSUMER_ORDER,
        actorId: user.id,
        actorRole: UserRole.CONSUMER,
        title: 'Consumer purchase',
        description: `${quantityKg} kg ${listing.crop.name} bought from ${listing.shopkeeper.shopkeeperProfile?.shopName ?? listing.shopkeeper.name} at Rs ${listing.pricePerKg}/kg`,
        quantityKg,
        pricePerKg: listing.pricePerKg,
        refType: 'ConsumerOrder',
        refId: order.id,
      });

      await tx.notification.create({
        data: {
          userId: listing.shopkeeperId,
          type: NotificationType.RETAIL_ORDER,
          title: 'New customer order',
          message: `${quantityKg} kg ${listing.crop.name} — Rs ${order.totalAmount.toLocaleString('en-PK')}.`,
          link: '/retail-orders',
        },
      });

      return order.id;
    });

    revalidatePath('/shop');
    revalidatePath('/orders');
    revalidatePath('/retail-orders');
    return { success: true, orderId };
  } catch (err) {
    if (err instanceof InventoryError) return { error: err.message };
    throw err;
  }
}

/** The only status each open order may move to (same steps as /retail-orders). */
const NEXT_STATUS: Partial<Record<ConsumerOrderStatus, ConsumerOrderStatus[]>> = {
  PLACED: [ConsumerOrderStatus.CONFIRMED, ConsumerOrderStatus.CANCELLED],
  CONFIRMED: [ConsumerOrderStatus.PREPARING],
  PREPARING: [ConsumerOrderStatus.OUT_FOR_DELIVERY],
  OUT_FOR_DELIVERY: [ConsumerOrderStatus.DELIVERED],
};

export async function updateConsumerOrderStatus(formData: FormData) {
  const user = await requireCapability('shopkeeper.orders.fulfill');

  const parsed = updateConsumerOrderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Invalid order update' };
  const { orderId, status } = parsed.data;

  const order = await prisma.consumerOrder.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { error: 'Order not found' };
  if (order.shopkeeperId !== user.id) throw new ForbiddenError('This order is not for your shop');
  const next = status as ConsumerOrderStatus;
  if (!NEXT_STATUS[order.status]?.includes(next)) return { error: 'Invalid order update' };

  const updated = await prisma.$transaction(async (tx) => {
    // Move the order only from the status we checked, so two clicks (or two
    // tabs) cannot apply the same step twice.
    const claimed = await tx.consumerOrder.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        status: next,
        deliveredAt: next === ConsumerOrderStatus.DELIVERED ? new Date() : null,
      },
    });
    if (claimed.count === 0) return false;

    if (next === ConsumerOrderStatus.CANCELLED) {
      // The kilograms go back on the shelf. The payment record is left as it is.
      for (const item of order.items) {
        await returnToRetailListing(tx, item.listingId, item.quantityKg);
      }
      await tx.notification.create({
        data: {
          userId: order.consumerId,
          type: NotificationType.INFO,
          title: 'Order cancelled',
          message: `Your order ${order.orderNumber} was cancelled by the shop.`,
          link: '/orders',
        },
      });
    }

    if (next === ConsumerOrderStatus.DELIVERED) {
      await tx.notification.create({
        data: {
          userId: order.consumerId,
          type: NotificationType.ORDER_DELIVERED,
          title: 'Order delivered',
          message: `Your order ${order.orderNumber} has been delivered. Rate your shop.`,
          link: '/orders',
        },
      });
    }
    return true;
  });
  if (!updated) return { error: 'Invalid order update' };

  revalidatePath('/retail-orders');
  revalidatePath('/orders');
  revalidatePath('/shop');
  revalidatePath('/storefront');
  return { success: true };
}

/** A consumer may only rate a shop for an order that was actually delivered. */
export async function rateShop(formData: FormData) {
  const user = await requireCapability('consumer.orders.view');

  const parsed = rateShopSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Invalid rating' };
  const { orderId, overallRating, comment } = parsed.data;

  const order = await prisma.consumerOrder.findUnique({ where: { id: orderId } });
  if (!order) return { error: 'Order not found' };
  if (order.consumerId !== user.id) throw new ForbiddenError('This order is not yours');
  if (order.status !== ConsumerOrderStatus.DELIVERED) {
    return { error: 'You can rate a shop only after the order is delivered' };
  }

  const existing = await prisma.rating.findFirst({
    where: {
      transactionType: TransactionType.SHOPKEEPER_CONSUMER,
      transactionId: orderId,
      raterId: user.id,
    },
  });
  if (existing) return { error: 'You have already rated this order' };

  await prisma.$transaction(async (tx) => {
    await tx.rating.create({
      data: {
        transactionType: TransactionType.SHOPKEEPER_CONSUMER,
        transactionId: orderId,
        raterId: user.id,
        targetUserId: order.shopkeeperId,
        overallRating,
        comment: comment || null,
      },
    });

    const profile = await tx.shopkeeperProfile.findUnique({ where: { userId: order.shopkeeperId } });
    if (profile) {
      const count = profile.ratingCount + 1;
      const rating = (profile.rating * profile.ratingCount + overallRating) / count;
      await tx.shopkeeperProfile.update({
        where: { userId: order.shopkeeperId },
        data: { rating: Math.round(rating * 100) / 100, ratingCount: count },
      });
    }
  });

  revalidatePath('/orders');
  revalidatePath('/nearby');
  return { success: true };
}
