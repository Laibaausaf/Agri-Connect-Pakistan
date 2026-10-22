import Link from 'next/link';
import { CropBatchStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import { Card, CropThumb } from '@/components/ui/kit';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

const farmerSteps = [
  { number: '1', title: 'home.step1.title', detail: 'home.step1.detail', href: '/crops/new', icon: '🌾' },
  { number: '2', title: 'home.step2.title', detail: 'home.step2.detail', href: '/arhti-requests', icon: '🤝' },
  { number: '3', title: 'home.step3.title', detail: 'home.step3.detail', href: '/deals', icon: '📦' },
  { number: '4', title: 'home.step4.title', detail: 'home.step4.detail', href: '/records', icon: '💵' },
] as const;

export default async function FarmerHome({ userId, name }: { userId: string; name: string }) {
  const { t, crop, place, perKg, kg } = await getI18n();

  const communityCrops = await prisma.farmerCropBatch.findMany({
    where: {
      farmerId: { not: userId },
      status: { in: [CropBatchStatus.READY_FOR_SALE, CropBatchStatus.NEGOTIATING] },
      availableKg: { gt: 0 },
    },
    select: {
      id: true,
      batchNumber: true,
      availableKg: true,
      askingPricePerKg: true,
      photos: true,
      originCity: true,
      crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
      farmer: { select: { name: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl bg-agri-900 p-5 text-white sm:p-6">
        <p className="text-sm text-white/80">{t('home.greeting')}</p>
        <h1 className="mt-1 text-2xl font-bold">{t('home.welcome', { name })}</h1>
        <p className="mt-1 text-sm text-white/80">{t('home.question')}</p>
      </div>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-charcoal">{t('home.nextStep')}</h2>
          <p className="mt-0.5 text-sm text-[#636E72]">{t('home.nextStepHint')}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {farmerSteps.map((step) => (
            <Link key={step.href} href={step.href} className="group rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:border-[#B7D4C8] hover:bg-[#F8FBF8] focus:outline-none focus:ring-2 focus:ring-agri-700">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8F3EE] text-2xl">{step.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-agri-900 text-xs font-bold text-white">{step.number}</span>
                    <h3 className="font-bold text-charcoal">{t(step.title)}</h3>
                  </div>
                  <p className="mt-1 text-sm text-[#636E72]">{t(step.detail)}</p>
                </div>
                <span aria-hidden="true" className="text-xl text-agri-900 rtl:-scale-x-100">→</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link href="/crops" className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-sm font-semibold text-charcoal hover:bg-[#F8F9F5]">{t('home.myCrops')}</Link>
          <Link href="/ai-assistant" className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-sm font-semibold text-charcoal hover:bg-[#F8F9F5]">{t('home.aiHelp')}</Link>
          <Link href="/messages" className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-sm font-semibold text-charcoal hover:bg-[#F8F9F5]">{t('home.messages')}</Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-charcoal">{t('home.listings')}</h2>
            <p className="mt-0.5 text-sm text-[#636E72]">{t('home.listingsHint')}</p>
          </div>
        </div>

        {communityCrops.length === 0 ? (
          <Card>
            <p className="text-sm font-semibold text-charcoal">{t('home.noListings')}</p>
            <p className="mt-1 text-sm text-[#636E72]">{t('home.noListingsHint')}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {communityCrops.map((item) => {
              const image = firstPhoto(item.photos) ?? item.crop.imageUrl;
              return (
                <Card key={item.id} className="overflow-hidden" padded={false}>
                  <div className="flex items-center gap-3 p-3">
                    <CropThumb imageUrl={image} name={item.crop.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-charcoal">{crop(item.crop)}</h3>
                      <p className="truncate text-xs text-[#636E72]">{place(item.originCity || item.farmer.location) || t('home.noLocation')}</p>
                    </div>
                  </div>
                  <div className="border-t border-[#E5E7EB] px-3 py-3">
                    <p className="text-lg font-bold text-agri-900">{item.askingPricePerKg ? perKg(item.askingPricePerKg) : t('common.openToOffers')}</p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[#636E72]">
                      <span>{t('home.available')}: <strong className="text-charcoal">{kg(item.availableKg)}</strong></span>
                      <span>{t('home.seller')}: {item.farmer.name}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
