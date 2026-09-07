'use server';

import { revalidatePath } from 'next/cache';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/authz';
import { updateProfileSchema } from '@/lib/validations/profile';

/** Empty form fields should clear a value rather than store an empty string. */
function nullable(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getMyProfile() {
  const user = await requireAuth();

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      location: true,
      createdAt: true,
      farmerProfile: true,
      arhtiProfile: { include: { mandi: { select: { name: true, city: true } } } },
      vendorProfile: true,
      shopkeeperProfile: true,
      consumerProfile: true,
    },
  });
}

export async function getMyTrust() {
  const user = await requireAuth();

  const [received, agg] = await Promise.all([
    prisma.rating.findMany({
      where: { targetUserId: user.id },
      select: {
        id: true,
        overallRating: true,
        comment: true,
        createdAt: true,
        transactionType: true,
        rater: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.rating.aggregate({ where: { targetUserId: user.id }, _avg: { overallRating: true }, _count: true }),
  ]);

  return {
    recent: received,
    average: agg._avg.overallRating,
    count: agg._count,
  };
}

/**
 * One profile editor for every role. Only the fields belonging to the caller's
 * own role profile are written, so a shopkeeper cannot set warehouse details.
 */
export async function updateProfile(formData: FormData) {
  const user = await requireAuth();

  const parsed = updateProfileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  const d = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { name: d.name, phone: nullable(d.phone), location: nullable(d.location) },
    });

    switch (user.role) {
      case UserRole.FARMER:
        await tx.farmerProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            businessName: nullable(d.businessName),
            village: nullable(d.village),
            farmAreaAcres: d.farmAreaAcres ?? null,
          },
          update: {
            businessName: nullable(d.businessName),
            village: nullable(d.village),
            farmAreaAcres: d.farmAreaAcres ?? null,
          },
        });
        break;

      case UserRole.ARHTI:
        await tx.arhtiProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            businessName: nullable(d.businessName),
            licenseNumber: nullable(d.licenseNumber),
          },
          update: {
            businessName: nullable(d.businessName),
            licenseNumber: nullable(d.licenseNumber),
          },
        });
        break;

      case UserRole.VENDOR:
        await tx.vendorProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            businessName: nullable(d.businessName),
            warehouseCity: nullable(d.warehouseCity),
            warehouseAddress: nullable(d.warehouseAddress),
            ...(d.minOrderKg ? { minOrderKg: d.minOrderKg } : {}),
          },
          update: {
            businessName: nullable(d.businessName),
            warehouseCity: nullable(d.warehouseCity),
            warehouseAddress: nullable(d.warehouseAddress),
            ...(d.minOrderKg ? { minOrderKg: d.minOrderKg } : {}),
          },
        });
        break;

      case UserRole.SHOPKEEPER: {
        const shopName = nullable(d.shopName);
        if (!shopName) throw new Error('Shop name is required');
        await tx.shopkeeperProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            shopName,
            shopAddress: nullable(d.shopAddress),
            city: nullable(d.city),
            opensAt: nullable(d.opensAt),
            closesAt: nullable(d.closesAt),
            ...(d.deliveryRadiusKm ? { deliveryRadiusKm: d.deliveryRadiusKm } : {}),
          },
          update: {
            shopName,
            shopAddress: nullable(d.shopAddress),
            city: nullable(d.city),
            opensAt: nullable(d.opensAt),
            closesAt: nullable(d.closesAt),
            ...(d.deliveryRadiusKm ? { deliveryRadiusKm: d.deliveryRadiusKm } : {}),
          },
        });
        break;
      }

      case UserRole.CONSUMER:
        await tx.consumerProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            deliveryAddress: nullable(d.deliveryAddress),
            preferredCity: nullable(d.preferredCity),
            ...(d.householdSize ? { householdSize: d.householdSize } : {}),
          },
          update: {
            deliveryAddress: nullable(d.deliveryAddress),
            preferredCity: nullable(d.preferredCity),
            ...(d.householdSize ? { householdSize: d.householdSize } : {}),
          },
        });
        break;

      default:
        break;
    }
  });

  revalidatePath('/profile');
  return { success: true };
}
