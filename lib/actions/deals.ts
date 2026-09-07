'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability, ForbiddenError } from '@/lib/authz';
import { kg } from '@/lib/inventory';
import { businessNumber, recordChainEvent, shortCode } from '@/lib/supplychain';
import {
  dealIdSchema,
  receiveProduceSchema,
  schedulePickupSchema,
} from '@/lib/validations/workflow';
import {
  DealStatus,
  DeductionType,
  DeliveryStage,
  InventoryLotStatus,
  NotificationType,
  PaymentStatus,
  SupplyChainStage,
  TransactionType,
  TransportResponsibility,
  UserRole,
} from '@prisma/client';

async function loadDealForParty(dealId: string, userId: string) {
  const deal = await prisma.farmerArhtiDeal.findUnique({
    where: { id: dealId },
    include: {
      batch: { include: { crop: true } },
      crop: true,
      farmer: true,
      arhti: { include: { arhtiProfile: true } },
      destinationMandi: true,
      pickup: true,
    },
  });
  if (!deal) return null;
  if (deal.farmerId !== userId && deal.arhtiId !== userId) {
    throw new ForbiddenError('This deal does not involve your account');
  }
  return deal;
}

export async function schedulePickup(formData: FormData) {
  const user = await requireCapability('arhti.pickup.manage', 'farmer.deals.view');

  const parsed = schedulePickupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const data = parsed.data;

  const deal = await loadDealForParty(data.dealId, user.id);
  if (!deal) return { error: 'Deal not found' };
  if (deal.status !== DealStatus.AGREED) {
    return { error: 'Transport can only be arranged on a newly agreed deal' };
  }

  // The party that agreed to arrange transport is the one allowed to book it.
  const responsible = deal.transportResponsibility;
  const isFarmer = user.id === deal.farmerId;
  if (responsible === TransportResponsibility.FARMER && !isFarmer) {
    return { error: 'The farmer agreed to arrange transport for this deal' };
  }
  if (responsible === TransportResponsibility.ARHTI && isFarmer) {
    return { error: 'The arhti agreed to arrange transport for this deal' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.pickupRecord.create({
      data: {
        dealId: deal.id,
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        vehicleType: data.vehicleType || null,
        vehiclePlate: data.vehiclePlate || null,
        arrangedBy: isFarmer ? TransportResponsibility.FARMER : TransportResponsibility.ARHTI,
        estimatedCost: data.estimatedCost ?? null,
        scheduledAt: data.scheduledAt,
        expectedArrivalAt: new Date(data.scheduledAt.getTime() + 5 * 60 * 60 * 1000),
        notes: data.notes || null,
      },
    });

    await tx.farmerArhtiDeal.update({
      where: { id: deal.id },
      data: {
        status: DealStatus.PICKUP_SCHEDULED,
        transportCost: data.estimatedCost ?? deal.transportCost,
      },
    });

    await recordChainEvent(tx, {
      batchId: deal.batchId,
      stage: SupplyChainStage.PICKUP,
      actorId: user.id,
      actorRole: user.role,
      title: 'Pickup scheduled',
      description: `${data.driverName} (${data.vehiclePlate ?? data.vehicleType ?? 'vehicle'}) collecting from ${deal.sourceCity} for ${deal.destinationMandi.city}`,
      quantityKg: deal.agreedQuantityKg,
      refType: 'PickupRecord',
      refId: deal.id,
    });

    await tx.notification.create({
      data: {
        userId: isFarmer ? deal.arhtiId : deal.farmerId,
        type: NotificationType.PICKUP_SCHEDULED,
        title: 'Pickup scheduled',
        message: `${data.driverName} will collect ${deal.agreedQuantityKg.toLocaleString('en-PK')} kg ${deal.crop.name} from ${deal.sourceCity}.`,
        link: `/deals/${deal.id}`,
      },
    });
  });

  revalidatePath(`/deals/${deal.id}`);
  revalidatePath('/deals');
  return { success: true };
}

/** Either party can confirm the truck actually left with the produce. */
export async function confirmPickup(formData: FormData) {
  const user = await requireCapability('arhti.pickup.manage', 'farmer.deals.view');

  const parsed = dealIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Invalid deal' };

  const deal = await loadDealForParty(parsed.data.dealId, user.id);
  if (!deal) return { error: 'Deal not found' };
  if (!deal.pickup) return { error: 'Schedule transport before confirming pickup' };
  if (deal.status !== DealStatus.PICKUP_SCHEDULED) {
    return { error: 'This deal is not awaiting pickup confirmation' };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.pickupRecord.update({
      where: { id: deal.pickup!.id },
      data: { confirmedAt: now, confirmedByUserId: user.id },
    });

    await tx.deliveryTracking.create({
      data: {
        pickupId: deal.pickup!.id,
        origin: `${deal.sourceCity}, ${deal.sourceProvince}`,
        destination: deal.destinationMandi.name,
        stage: DeliveryStage.IN_TRANSIT,
        currentLat: deal.destinationMandi.latitude ?? 33.6844,
        currentLng: deal.destinationMandi.longitude ?? 73.0479,
        etaMinutes: 240,
        statusNotes: 'Loaded at farm gate, moving towards mandi',
      },
    });

    await tx.farmerArhtiDeal.update({
      where: { id: deal.id },
      data: { status: DealStatus.IN_TRANSIT },
    });

    await recordChainEvent(tx, {
      batchId: deal.batchId,
      stage: SupplyChainStage.PICKUP,
      actorId: user.id,
      actorRole: user.role,
      title: 'Produce picked up',
      description: `${deal.agreedQuantityKg.toLocaleString('en-PK')} kg loaded and in transit to ${deal.destinationMandi.city}`,
      quantityKg: deal.agreedQuantityKg,
      refType: 'PickupRecord',
      refId: deal.pickup!.id,
    });

    await tx.notification.create({
      data: {
        userId: user.id === deal.farmerId ? deal.arhtiId : deal.farmerId,
        type: NotificationType.PICKUP_CONFIRMED,
        title: 'Produce in transit',
        message: `${deal.crop.name} for deal ${deal.dealNumber} is on the way to ${deal.destinationMandi.city}.`,
        link: `/deals/${deal.id}`,
      },
    });
  });

  revalidatePath(`/deals/${deal.id}`);
  revalidatePath('/deals');
  revalidatePath('/receiving');
  return { success: true };
}

/**
 * The arhti weighs the produce on arrival. This is where ownership transfers:
 * a mandi inventory lot is created and the farmer's settlement is generated.
 */
export async function receiveProduce(formData: FormData) {
  const user = await requireCapability('arhti.receive.produce');

  const parsed = receiveProduceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const data = parsed.data;

  const deal = await loadDealForParty(data.dealId, user.id);
  if (!deal) return { error: 'Deal not found' };
  if (deal.arhtiId !== user.id) throw new ForbiddenError('Only the buying arhti can receive this deal');
  if (deal.status !== DealStatus.IN_TRANSIT && deal.status !== DealStatus.PICKED_UP) {
    return { error: 'This deal is not in transit' };
  }
  if (kg(data.receivedQuantityKg) > kg(deal.agreedQuantityKg * 1.05)) {
    return { error: 'Received weight cannot exceed the agreed quantity by more than 5%' };
  }

  const received = kg(data.receivedQuantityKg);
  const difference = kg(received - deal.agreedQuantityKg);
  const gross = kg(received * deal.agreedPricePerKg);
  const commissionRate = deal.arhti.arhtiProfile?.commissionRate ?? 0.02;
  const commission = kg(gross * commissionRate);
  const farmerTransportShare =
    deal.transportResponsibility === TransportResponsibility.FARMER
      ? (deal.transportCost ?? 0)
      : deal.transportResponsibility === TransportResponsibility.MUTUAL
        ? kg((deal.transportCost ?? 0) / 2)
        : 0;
  const mandiCess = kg(gross * 0.005);
  const deductionsTotal = kg(commission + farmerTransportShare + mandiCess);
  const netPayable = kg(gross - deductionsTotal);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.farmerArhtiDeal.update({
      where: { id: deal.id },
      data: {
        receivedQuantityKg: received,
        weightDifferenceKg: difference,
        weightVerifiedAt: now,
        weightVerifierName: data.verifierName,
        receivedAt: now,
        status: DealStatus.PAYMENT_PENDING,
      },
    });

    if (deal.pickup) {
      await tx.pickupRecord.update({
        where: { id: deal.pickup.id },
        data: { arrivedAt: now },
      });
      await tx.deliveryTracking.updateMany({
        where: { pickupId: deal.pickup.id },
        data: { stage: DeliveryStage.DELIVERED, etaMinutes: 0, statusNotes: 'Unloaded at mandi' },
      });
    }

    const lot = await tx.arhtiInventoryLot.create({
      data: {
        lotNumber: `${shortCode(deal.destinationMandi.city)}-${shortCode(deal.crop.name)}-${businessNumber('').slice(1)}`,
        arhtiId: deal.arhtiId,
        dealId: deal.id,
        batchId: deal.batchId,
        cropId: deal.cropId,
        mandiId: deal.destinationMandiId,
        receivedQuantityKg: received,
        availableQuantityKg: received,
        grade: deal.batch.grade,
        purchasePricePerKg: deal.agreedPricePerKg,
        sourceCity: deal.sourceCity,
        sourceFarmerName: deal.farmer.name,
        photos: deal.batch.photos ?? [],
        status: InventoryLotStatus.IN_STOCK,
      },
    });

    const settlement = await tx.settlement.create({
      data: {
        dealId: deal.id,
        farmerId: deal.farmerId,
        grossAmount: gross,
        deductionsTotal,
        netPayable,
        status: 'pending',
        deductions: {
          create: [
            {
              type: DeductionType.ARHTI_COMMISSION,
              amount: commission,
              description: `Arhti commission at ${(commissionRate * 100).toFixed(1)}%`,
            },
            ...(farmerTransportShare > 0
              ? [
                  {
                    type: DeductionType.TRANSPORT,
                    amount: farmerTransportShare,
                    description: `Transport share (${deal.transportResponsibility.toLowerCase()})`,
                  },
                ]
              : []),
            {
              type: DeductionType.MANDI_CESS,
              amount: mandiCess,
              description: 'Mandi cess at 0.5%',
            },
          ],
        },
      },
    });

    await tx.paymentRecord.create({
      data: {
        transactionType: TransactionType.FARMER_ARHTI,
        transactionId: deal.id,
        amount: netPayable,
        payerId: deal.arhtiId,
        recipientId: deal.farmerId,
        status: PaymentStatus.PENDING,
        reference: settlement.id,
      },
    });

    await recordChainEvent(tx, {
      batchId: deal.batchId,
      stage: SupplyChainStage.ARHTI_RECEIPT,
      actorId: user.id,
      actorRole: UserRole.ARHTI,
      title: 'Received and weighed at mandi',
      description: `${received.toLocaleString('en-PK')} kg accepted at ${deal.destinationMandi.name} (${difference >= 0 ? '+' : ''}${difference} kg vs agreed), verified by ${data.verifierName}`,
      quantityKg: received,
      pricePerKg: deal.agreedPricePerKg,
      refType: 'ArhtiInventoryLot',
      refId: lot.id,
    });

    await tx.notification.create({
      data: {
        userId: deal.farmerId,
        type: NotificationType.WEIGHT_VERIFICATION,
        title: 'Produce weighed at mandi',
        message: `${received.toLocaleString('en-PK')} kg accepted. Net payable Rs ${netPayable.toLocaleString('en-PK')} after deductions.`,
        link: `/deals/${deal.id}`,
      },
    });
  });

  revalidatePath(`/deals/${deal.id}`);
  revalidatePath('/receiving');
  revalidatePath('/inventory');
  revalidatePath('/records');
  return { success: true };
}

/** Arhti releases the farmer's payment over RAAST and the deal completes. */
export async function payFarmer(formData: FormData) {
  const user = await requireCapability('arhti.deals.manage');

  const parsed = dealIdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Invalid deal' };

  const deal = await loadDealForParty(parsed.data.dealId, user.id);
  if (!deal) return { error: 'Deal not found' };
  if (deal.arhtiId !== user.id) throw new ForbiddenError('Only the buying arhti can release payment');
  if (deal.status !== DealStatus.PAYMENT_PENDING) {
    return { error: 'This deal is not awaiting payment' };
  }

  const settlement = await prisma.settlement.findUnique({ where: { dealId: deal.id } });
  if (!settlement) return { error: 'Settlement has not been generated yet' };

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.paymentRecord.update({
      where: {
        transactionType_transactionId: {
          transactionType: TransactionType.FARMER_ARHTI,
          transactionId: deal.id,
        },
      },
      data: { status: PaymentStatus.PAID, paidAt: now, reference: `RAAST-${businessNumber('P')}` },
    });

    await tx.settlement.update({ where: { id: settlement.id }, data: { status: 'paid' } });

    await tx.farmerArhtiDeal.update({
      where: { id: deal.id },
      data: { status: DealStatus.COMPLETED },
    });

    await tx.receipt.create({
      data: {
        receiptNumber: `PARCHEE-${businessNumber('').slice(1)}`,
        transactionType: TransactionType.FARMER_ARHTI,
        transactionId: deal.id,
        rootBatchId: deal.batchId,
        data: {
          dealNumber: deal.dealNumber,
          crop: deal.crop.name,
          farmer: deal.farmer.name,
          arhti: deal.arhti.name,
          mandi: deal.destinationMandi.name,
          quantityKg: deal.receivedQuantityKg ?? deal.agreedQuantityKg,
          ratePerKg: deal.agreedPricePerKg,
          grossAmount: settlement.grossAmount,
          deductions: settlement.deductionsTotal,
          netPayable: settlement.netPayable,
          issuedAt: now.toISOString(),
        },
      },
    });

    await tx.notification.create({
      data: {
        userId: deal.farmerId,
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Payment received',
        message: `Rs ${settlement.netPayable.toLocaleString('en-PK')} credited via RAAST for deal ${deal.dealNumber}.`,
        link: '/records',
      },
    });
  });

  revalidatePath(`/deals/${deal.id}`);
  revalidatePath('/deals');
  revalidatePath('/records');
  return { success: true };
}
