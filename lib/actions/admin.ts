'use server';

import { revalidatePath } from 'next/cache';
import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { AccountStatus, AuctionStatus, UserRole } from '@prisma/client';
import { resetDemoSchema } from '@/lib/validations/admin';

const execAsync = promisify(exec);

/**
 * Network-wide counters. Admin is the only role allowed to see aggregate value
 * across every stage of the chain, so all of this lives behind admin.console.
 */
export async function getAdminStats() {
  await requireCapability('admin.console');

  const [
    totalUsers,
    usersByRole,
    totalMandis,
    totalBatches,
    liveAuctions,
    openDeals,
    farmerPayout,
    mandiTrade,
    wholesaleTrade,
    retailTrade,
    harvestVolume,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
    prisma.mandi.count(),
    prisma.farmerCropBatch.count(),
    prisma.auction.count({ where: { status: AuctionStatus.ACTIVE } }),
    prisma.farmerArhtiDeal.count({
      where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    }),
    prisma.settlement.aggregate({ _sum: { netPayable: true } }),
    prisma.arhtiVendorSale.aggregate({ _sum: { grossAmount: true, commission: true, quantityKg: true } }),
    prisma.vendorShopkeeperSale.aggregate({ _sum: { grossAmount: true, quantityKg: true } }),
    prisma.consumerOrder.aggregate({ _sum: { totalAmount: true } }),
    prisma.farmerCropBatch.aggregate({ _sum: { quantityKg: true } }),
  ]);

  const roleCounts = usersByRole.reduce<Record<string, number>>((acc, item) => {
    acc[item.role] = item._count.role;
    return acc;
  }, {});

  return {
    totalUsers,
    roleCounts,
    totalMandis,
    totalBatches,
    liveAuctions,
    openDeals,
    farmerPayout: farmerPayout._sum.netPayable ?? 0,
    // What vendors paid at the mandi: the auction price plus the arhti's commission.
    mandiTradeValue: (mandiTrade._sum.grossAmount ?? 0) + (mandiTrade._sum.commission ?? 0),
    mandiCommission: mandiTrade._sum.commission ?? 0,
    mandiVolumeKg: mandiTrade._sum.quantityKg ?? 0,
    wholesaleTradeValue: wholesaleTrade._sum.grossAmount ?? 0,
    wholesaleVolumeKg: wholesaleTrade._sum.quantityKg ?? 0,
    retailTradeValue: retailTrade._sum.totalAmount ?? 0,
    harvestVolumeKg: harvestVolume._sum.quantityKg ?? 0,
  };
}

export async function getAdminUsers(query?: string) {
  await requireCapability('admin.console');

  const q = query?.trim();

  return prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { location: { contains: q } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      location: true,
      createdAt: true,
      farmerProfile: { select: { businessName: true, village: true } },
      arhtiProfile: { select: { businessName: true, mandi: { select: { name: true } } } },
      vendorProfile: { select: { businessName: true, warehouseCity: true } },
      shopkeeperProfile: { select: { shopName: true, city: true } },
      consumerProfile: { select: { preferredCity: true } },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });
}

export async function getAdminMandis() {
  await requireCapability('admin.console');

  return prisma.mandi.findMany({
    include: {
      _count: {
        select: { auctions: true, inventoryLots: true, deals: true, arhtiProfiles: true },
      },
    },
    orderBy: { city: 'asc' },
  });
}

/**
 * Batch picker for the traceability portal. A batch is the root of every
 * lineage, so every trace starts by choosing one.
 */
export async function getTraceBatches(query?: string) {
  await requireCapability('admin.trace');

  const q = query?.trim();

  return prisma.farmerCropBatch.findMany({
    where: q
      ? {
          OR: [
            { batchNumber: { contains: q } },
            { originCity: { contains: q } },
            { crop: { name: { contains: q } } },
            { farmer: { name: { contains: q } } },
          ],
        }
      : undefined,
    select: {
      id: true,
      batchNumber: true,
      quantityKg: true,
      availableKg: true,
      grade: true,
      originCity: true,
      originProvince: true,
      harvestDate: true,
      status: true,
      crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
      farmer: { select: { name: true } },
      _count: { select: { chainEvents: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
}

/**
 * The full ownership history of one batch, from harvest to consumer order.
 * Confidential events (purchase costs, margins) are included because admin is
 * the only role permitted to see the whole chain's pricing.
 */
export async function getBatchTrace(batchId: string) {
  await requireCapability('admin.trace');

  return prisma.farmerCropBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      batchNumber: true,
      variety: true,
      quantityKg: true,
      availableKg: true,
      grade: true,
      originVillage: true,
      originCity: true,
      originProvince: true,
      harvestDate: true,
      askingPricePerKg: true,
      status: true,
      crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
      farmer: {
        select: {
          name: true,
          phone: true,
          farmerProfile: { select: { businessName: true, village: true } },
        },
      },
      chainEvents: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          stage: true,
          actorRole: true,
          title: true,
          description: true,
          quantityKg: true,
          pricePerKg: true,
          refType: true,
          refId: true,
          isConfidential: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      },
    },
  });
}

export async function toggleUserStatus(formData: FormData) {
  await requireCapability('admin.console');

  const userId = String(formData.get('userId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!userId || (status !== AccountStatus.VERIFIED && status !== AccountStatus.SUSPENDED)) {
    return { error: 'Invalid input' };
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { error: 'User not found' };
  if (target.role === UserRole.ADMIN) return { error: 'Admin accounts cannot be suspended' };

  await prisma.user.update({ where: { id: userId }, data: { status } });

  revalidatePath('/admin');
  return { success: true };
}

export async function resetDemoData(formData: FormData) {
  await requireCapability('admin.console');

  const parsed = resetDemoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Type RESET to confirm' };

  try {
    await execAsync('npm run db:reset', { cwd: process.cwd(), timeout: 180000 });
    revalidatePath('/admin');
    revalidatePath('/admin/trace');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Demo reset failed' };
  }
}
