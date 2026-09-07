import { ConsumerOrderStatus, DealStatus, OfferDirection, OfferStatus, SaleStatus, StockStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { NavBadges } from '@/lib/navigation';

export type { NavBadges };

const OPEN_DEAL_STATUSES = { notIn: [DealStatus.COMPLETED, DealStatus.CANCELLED] };

/** Counts shown on the sidebar are the ones that drive the role's next decision. */
export async function loadNavBadges(userId: string, role: UserRole): Promise<NavBadges> {
  const unreadMessages = () =>
    prisma.message.count({
      where: {
        isRead: false,
        senderId: { not: userId },
        conversation: { OR: [{ userAId: userId }, { userBId: userId }] },
      },
    });

  switch (role) {
    case UserRole.FARMER: {
      const [pendingOffers, activeDeals, messages] = await Promise.all([
        prisma.farmerArhtiOffer.count({
          where: { farmerId: userId, direction: OfferDirection.ARHTI_TO_FARMER, status: OfferStatus.PENDING },
        }),
        prisma.farmerArhtiDeal.count({ where: { farmerId: userId, status: OPEN_DEAL_STATUSES } }),
        unreadMessages(),
      ]);
      return { pendingOffers, activeDeals, unreadMessages: messages };
    }

    case UserRole.ARHTI: {
      const [activeDeals, awaitingReceipt, liveAuctions, messages] = await Promise.all([
        prisma.farmerArhtiDeal.count({ where: { arhtiId: userId, status: OPEN_DEAL_STATUSES } }),
        prisma.farmerArhtiDeal.count({
          where: {
            arhtiId: userId,
            status: { in: [DealStatus.PICKUP_SCHEDULED, DealStatus.PICKED_UP, DealStatus.IN_TRANSIT] },
          },
        }),
        prisma.auction.count({ where: { arhtiId: userId, status: 'ACTIVE' } }),
        unreadMessages(),
      ]);
      return { activeDeals, awaitingReceipt, liveAuctions, unreadMessages: messages };
    }

    case UserRole.VENDOR: {
      const [liveAuctions, openOrders, messages] = await Promise.all([
        prisma.auction.count({ where: { status: 'ACTIVE' } }),
        prisma.vendorShopkeeperSale.count({
          where: { vendorId: userId, status: { notIn: [SaleStatus.COMPLETED, SaleStatus.CANCELLED] } },
        }),
        unreadMessages(),
      ]);
      return { liveAuctions, openOrders, unreadMessages: messages };
    }

    case UserRole.SHOPKEEPER: {
      const [lowStock, openOrders, messages] = await Promise.all([
        prisma.shopkeeperInventory.count({ where: { shopkeeperId: userId, status: StockStatus.LOW_STOCK } }),
        prisma.consumerOrder.count({
          where: {
            shopkeeperId: userId,
            status: { notIn: [ConsumerOrderStatus.DELIVERED, ConsumerOrderStatus.CANCELLED] },
          },
        }),
        unreadMessages(),
      ]);
      return { lowStock, openOrders, unreadMessages: messages };
    }

    case UserRole.CONSUMER: {
      const openOrders = await prisma.consumerOrder.count({
        where: {
          consumerId: userId,
          status: { notIn: [ConsumerOrderStatus.DELIVERED, ConsumerOrderStatus.CANCELLED] },
        },
      });
      return { openOrders };
    }

    case UserRole.ADMIN: {
      const messages = await unreadMessages();
      return { unreadMessages: messages };
    }

    default:
      return {};
  }
}
