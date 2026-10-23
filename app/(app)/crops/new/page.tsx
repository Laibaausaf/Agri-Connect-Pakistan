import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createCropBatch } from '@/lib/actions/crops';
import { PageHeader } from '@/components/ui/kit';
import FarmerCropWizard from '@/components/crops/FarmerCropWizard';
import { getI18n } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function NewCropBatchPage() {
  const user = await requireCapability('farmer.batch.manage');
  const { t } = await getI18n();
  const [crops, profile, account, prices] = await Promise.all([
    prisma.crop.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, nameUrdu: true, imageUrl: true } }),
    prisma.farmerProfile.findUnique({ where: { userId: user.id } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { location: true } }),
    prisma.marketPrice.findMany({ select: { cropId: true, ratePerKg: true, recordedAt: true }, orderBy: { recordedAt: 'desc' } }),
  ]);
  const priceByCrop: Record<string, number> = {};
  for (const price of prices) if (priceByCrop[price.cropId] === undefined) priceByCrop[price.cropId] = price.ratePerKg;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('cropNew.title')} subtitle={t('cropNew.subtitle')} />
      <FarmerCropWizard
          action={createCropBatch}
          crops={crops}
          priceByCrop={priceByCrop}
          defaults={{ village: profile?.village ?? '', city: account?.location ?? 'Swabi', province: 'Khyber Pakhtunkhwa', today: new Date().toISOString().slice(0, 10) }}
        />
    </div>
  );
}
