'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createCropBatchSchema, archiveBatchSchema } from '@/lib/validations/workflow';
import { businessNumber, recordChainEvent, shortCode } from '@/lib/supplychain';
import { CropBatchStatus, SupplyChainStage, UserRole } from '@prisma/client';

function parsePhotos(input: string | undefined, fallback: string | null) {
  const list = (input ?? '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length) return list;
  return fallback ? [fallback] : [];
}

/**
 * A farmer records what they grew. No mandi, no reserve price, no auction —
 * where the produce goes is decided later through an arhti deal.
 */
export async function createCropBatch(formData: FormData) {
  const user = await requireCapability('farmer.batch.manage');

  const raw = Object.fromEntries(formData.entries());
  const parsed = createCropBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(', ') };
  }
  const data = parsed.data;

  const crop = await prisma.crop.findUnique({ where: { id: data.cropId } });
  if (!crop) return { error: 'Invalid crop selection' };

  const batchNumber = `${shortCode(data.originCity)}-${shortCode(crop.name)}-${businessNumber('B').slice(2)}`;

  await prisma.$transaction(async (tx) => {
    const batch = await tx.farmerCropBatch.create({
      data: {
        batchNumber,
        cropId: crop.id,
        farmerId: user.id,
        variety: data.variety || null,
        quantityKg: data.quantityKg,
        availableKg: data.quantityKg,
        grade: data.grade,
        originVillage: data.originVillage || null,
        originCity: data.originCity,
        originProvince: data.originProvince,
        harvestDate: data.harvestDate,
        readyDate: data.readyDate ?? null,
        packaging: data.packaging || null,
        askingPricePerKg: data.askingPricePerKg ?? null,
        photos: parsePhotos(data.photos, crop.imageUrl),
        notes: data.notes || null,
        status: CropBatchStatus.READY_FOR_SALE,
      },
    });

    await recordChainEvent(tx, {
      batchId: batch.id,
      stage: SupplyChainStage.FARMER_HARVEST,
      actorId: user.id,
      actorRole: UserRole.FARMER,
      title: 'Crop batch registered by farmer',
      description: `${data.quantityKg.toLocaleString('en-PK')} kg ${crop.name} (${data.grade}) harvested in ${data.originCity}`,
      quantityKg: data.quantityKg,
      pricePerKg: data.askingPricePerKg ?? null,
      refType: 'FarmerCropBatch',
      refId: batch.id,
    });
  });

  revalidatePath('/crops');
  revalidatePath('/sourcing');
  redirect('/crops');
}

export async function archiveCropBatch(formData: FormData) {
  const user = await requireCapability('farmer.batch.manage');

  const parsed = archiveBatchSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Invalid batch' };

  const batch = await prisma.farmerCropBatch.findUnique({ where: { id: parsed.data.batchId } });
  if (!batch) return { error: 'Batch not found' };
  if (batch.farmerId !== user.id) return { error: 'This batch is not yours' };
  if (batch.availableKg < batch.quantityKg) {
    return { error: 'Part of this batch is already committed to a deal and cannot be archived' };
  }

  await prisma.farmerCropBatch.update({
    where: { id: batch.id },
    data: { status: CropBatchStatus.ARCHIVED },
  });

  revalidatePath('/crops');
  return { success: true };
}
