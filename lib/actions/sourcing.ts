'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireCapability, ForbiddenError } from '@/lib/authz';
import { drawFromBatch, InventoryError, kg } from '@/lib/inventory';
import { businessNumber, recordChainEvent, shortCode } from '@/lib/supplychain';
import {
  createDemandRequestSchema,
  createOfferSchema,
  respondToOfferSchema,
} from '@/lib/validations/workflow';
import {
  DealStatus,
  DemandStatus,
  NotificationType,
  OfferDirection,
  OfferStatus,
  SupplyChainStage,
  UserRole,
} from '@prisma/client';

function csv(input?: string) {
  return (input ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Arhti publishes what they want to buy this week. Farmers see these requests. */
export async function createDemandRequest(formData: FormData) {
  const user = await requireCapability('arhti.demand.manage');

  const parsed = createDemandRequestSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    transportOffered: formData.get('transportOffered') === 'on',
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const data = parsed.data;

  if (data.maxQuantityKg < data.minQuantityKg) {
    return { error: 'Maximum quantity must be at least the minimum quantity' };
  }

  const [crop, mandi] = await Promise.all([
    prisma.crop.findUnique({ where: { id: data.cropId } }),
    prisma.mandi.findUnique({ where: { id: data.mandiId } }),
  ]);
  if (!crop || !mandi) return { error: 'Invalid crop or mandi selection' };

  await prisma.arhtiDemandRequest.create({
    data: {
      requestNumber: `REQ-${shortCode(crop.name)}-${businessNumber('').slice(1)}`,
      arhtiId: user.id,
      cropId: crop.id,
      minQuantityKg: data.minQuantityKg,
      maxQuantityKg: data.maxQuantityKg,
      gradeWanted: data.gradeWanted || null,
      preferredOrigins: csv(data.preferredOrigins),
      targetPriceMin: data.targetPriceMin ?? null,
      targetPriceMax: data.targetPriceMax ?? null,
      neededBy: data.neededBy,
      transportOffered: data.transportOffered,
      mandiId: mandi.id,
      notes: data.notes || null,
      status: DemandStatus.OPEN,
    },
  });

  revalidatePath('/demand');
  revalidatePath('/arhti-requests');
  redirect('/demand');
}

export async function closeDemandRequest(formData: FormData) {
  const user = await requireCapability('arhti.demand.manage');
  const requestId = String(formData.get('requestId') ?? '');
  const request = await prisma.arhtiDemandRequest.findUnique({ where: { id: requestId } });
  if (!request) return { error: 'Request not found' };
  if (request.arhtiId !== user.id) return { error: 'This request is not yours' };

  await prisma.arhtiDemandRequest.update({
    where: { id: requestId },
    data: { status: DemandStatus.CLOSED },
  });
  revalidatePath('/demand');
  return { success: true };
}

/**
 * Price offer on a farmer's batch. Arhtis initiate most offers; a farmer can
 * also propose a price to an arhti, which the arhti then accepts or rejects.
 */
export async function createOffer(formData: FormData) {
  const user = await requireCapability('arhti.offers.create', 'farmer.offers.respond');

  const parsed = createOfferSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const data = parsed.data;

  const batch = await prisma.farmerCropBatch.findUnique({
    where: { id: data.batchId },
    include: { crop: true },
  });
  if (!batch) return { error: 'Crop batch not found' };

  const isArhti = user.role === UserRole.ARHTI;
  let counterpartyId: string;

  if (isArhti) {
    counterpartyId = batch.farmerId;
  } else {
    if (batch.farmerId !== user.id) return { error: 'This batch is not yours' };
    counterpartyId = String(formData.get('arhtiId') ?? '');
    const arhti = await prisma.user.findUnique({ where: { id: counterpartyId } });
    if (!arhti || arhti.role !== UserRole.ARHTI) return { error: 'Select a valid arhti' };
  }

  if (kg(data.quantityKg) > kg(batch.availableKg)) {
    return { error: `Only ${batch.availableKg} kg of this batch is uncommitted` };
  }

  const mandi = await prisma.mandi.findUnique({ where: { id: data.destinationMandiId } });
  if (!mandi) return { error: 'Invalid destination mandi' };

  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.farmerArhtiOffer.create({
      data: {
        batchId: batch.id,
        arhtiId: isArhti ? user.id : counterpartyId,
        farmerId: isArhti ? counterpartyId : user.id,
        direction: isArhti ? OfferDirection.ARHTI_TO_FARMER : OfferDirection.FARMER_TO_ARHTI,
        quantityKg: data.quantityKg,
        pricePerKg: data.pricePerKg,
        destinationMandiId: mandi.id,
        transportResponsibility: data.transportResponsibility,
        proposedPickupAt: data.proposedPickupAt ?? null,
        note: data.note || null,
        status: OfferStatus.PENDING,
      },
    });

    await recordChainEvent(tx, {
      batchId: batch.id,
      stage: SupplyChainStage.FARMER_ARHTI_OFFER,
      actorId: user.id,
      actorRole: user.role,
      title: isArhti ? 'Arhti offered a price' : 'Farmer proposed a price',
      description: `${data.quantityKg.toLocaleString('en-PK')} kg ${batch.crop.name} at Rs ${data.pricePerKg}/kg for ${mandi.city}`,
      quantityKg: data.quantityKg,
      pricePerKg: data.pricePerKg,
      refType: 'FarmerArhtiOffer',
      refId: created.id,
    });

    await tx.notification.create({
      data: {
        userId: counterpartyId,
        type: NotificationType.NEW_OFFER,
        title: isArhti ? 'New offer on your crop' : 'A farmer proposed a price',
        message: `${user.name}: Rs ${data.pricePerKg}/kg for ${data.quantityKg.toLocaleString('en-PK')} kg ${batch.crop.name}.`,
        link: isArhti ? '/arhti-requests' : '/sourcing',
      },
    });

    return created;
  });

  revalidatePath('/arhti-requests');
  revalidatePath('/sourcing');
  return { success: true, offerId: offer.id };
}

/**
 * Accepting an offer is the moment ownership starts moving: the batch is drawn
 * down and a deal is created inside one transaction.
 */
export async function respondToOffer(formData: FormData) {
  const user = await requireCapability('farmer.offers.respond', 'arhti.deals.manage');

  const parsed = respondToOfferSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Invalid response' };
  const { offerId, decision } = parsed.data;

  const offer = await prisma.farmerArhtiOffer.findUnique({
    where: { id: offerId },
    include: { batch: { include: { crop: true } }, destinationMandi: true, arhti: true, farmer: true },
  });
  if (!offer) return { error: 'Offer not found' };
  if (offer.status !== OfferStatus.PENDING) return { error: 'This offer has already been answered' };

  // Only the party who received the offer may answer it.
  const responderShouldBe =
    offer.direction === OfferDirection.ARHTI_TO_FARMER ? offer.farmerId : offer.arhtiId;
  if (user.id !== responderShouldBe) throw new ForbiddenError('This offer is not addressed to you');

  if (decision === 'REJECT') {
    const answered = await prisma.$transaction(async (tx) => {
      const claimed = await tx.farmerArhtiOffer.updateMany({
        where: { id: offer.id, status: OfferStatus.PENDING },
        data: { status: OfferStatus.REJECTED, respondedAt: new Date() },
      });
      if (claimed.count === 0) return false;
      await tx.notification.create({
        data: {
          userId: offer.direction === OfferDirection.ARHTI_TO_FARMER ? offer.arhtiId : offer.farmerId,
          type: NotificationType.OFFER_REJECTED,
          title: 'Offer declined',
          message: `${user.name} declined Rs ${offer.pricePerKg}/kg for ${offer.batch.crop.name}.`,
          link: '/deals',
        },
      });
      return true;
    });
    if (!answered) return { error: 'This offer has already been answered' };
    revalidatePath('/arhti-requests');
    revalidatePath('/sourcing');
    return { success: true };
  }

  try {
    const deal = await prisma.$transaction(async (tx) => {
      const claimed = await tx.farmerArhtiOffer.updateMany({
        where: { id: offer.id, status: OfferStatus.PENDING },
        data: { status: OfferStatus.ACCEPTED, respondedAt: new Date() },
      });
      if (claimed.count === 0) throw new OfferAlreadyAnswered();

      await drawFromBatch(tx, offer.batchId, offer.quantityKg);

      const created = await tx.farmerArhtiDeal.create({
        data: {
          dealNumber: `DEAL-${shortCode(offer.batch.crop.name)}-${businessNumber('').slice(1)}`,
          offerId: offer.id,
          batchId: offer.batchId,
          cropId: offer.batch.cropId,
          farmerId: offer.farmerId,
          arhtiId: offer.arhtiId,
          agreedQuantityKg: offer.quantityKg,
          agreedPricePerKg: offer.pricePerKg,
          grossAmount: kg(offer.quantityKg * offer.pricePerKg),
          sourceCity: offer.batch.originCity,
          sourceProvince: offer.batch.originProvince,
          destinationMandiId: offer.destinationMandiId,
          transportResponsibility: offer.transportResponsibility,
          status: DealStatus.AGREED,
        },
      });

      await recordChainEvent(tx, {
        batchId: offer.batchId,
        stage: SupplyChainStage.FARMER_ARHTI_DEAL,
        actorId: user.id,
        actorRole: user.role,
        title: 'Farmer–Arhti deal agreed',
        description: `${offer.quantityKg.toLocaleString('en-PK')} kg ${offer.batch.crop.name} sold to ${offer.arhti.name} at Rs ${offer.pricePerKg}/kg, destination ${offer.destinationMandi.city}`,
        quantityKg: offer.quantityKg,
        pricePerKg: offer.pricePerKg,
        refType: 'FarmerArhtiDeal',
        refId: created.id,
      });

      await tx.notification.create({
        data: {
          userId: offer.direction === OfferDirection.ARHTI_TO_FARMER ? offer.arhtiId : offer.farmerId,
          type: NotificationType.OFFER_ACCEPTED,
          title: 'Offer accepted',
          message: `${user.name} accepted Rs ${offer.pricePerKg}/kg for ${offer.quantityKg.toLocaleString('en-PK')} kg ${offer.batch.crop.name}. Deal ${created.dealNumber}.`,
          link: `/deals/${created.id}`,
        },
      });

      return created;
    });

    revalidatePath('/arhti-requests');
    revalidatePath('/sourcing');
    revalidatePath('/deals');
    return { success: true, dealId: deal.id };
  } catch (err) {
    if (err instanceof InventoryError) return { error: err.message };
    if (err instanceof OfferAlreadyAnswered) return { error: 'This offer has already been answered' };
    throw err;
  }
}

class OfferAlreadyAnswered extends Error {}
