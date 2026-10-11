import Link from 'next/link';
import { CropBatchStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Card, CropThumb, money, qty } from '@/components/ui/kit';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

const farmerSteps = [
  { number: '1', title: 'Add a crop', urdu: 'فصل درج کریں', detail: 'List your harvest', href: '/crops/new', icon: '🌾' },
  { number: '2', title: 'Check offers', urdu: 'پیشکشیں دیکھیں', detail: 'Review arhti offers', href: '/arhti-requests', icon: '🤝' },
  { number: '3', title: 'Track a deal', urdu: 'سودا دیکھیں', detail: 'Follow deal progress', href: '/deals', icon: '📦' },
  { number: '4', title: 'Payments', urdu: 'حساب کتاب', detail: 'See paid and pending money', href: '/records', icon: '💵' },
];

export default async function FarmerHome({ userId, name }: { userId: string; name: string }) {
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
      crop: { select: { name: true, imageUrl: true } },
      farmer: { select: { name: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl bg-agri-900 p-5 text-white sm:p-6">
        <p className="text-sm text-white/80">Assalam-o-Alaikum · السلام علیکم</p>
        <h1 className="mt-1 text-2xl font-bold">Welcome, {name}</h1>
        <p className="mt-1 text-sm text-white/80">What would you like to do today? · آج کیا کرنا ہے؟</p>
      </div>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-charcoal">Your next step <span className="text-sm font-normal text-[#636E72]">· اگلا قدم</span></h2>
          <p className="mt-0.5 text-sm text-[#636E72]">Choose one option. You can come back here anytime.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {farmerSteps.map((step) => (
            <Link key={step.href} href={step.href} className="group rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:border-[#B7D4C8] hover:bg-[#F8FBF8] focus:outline-none focus:ring-2 focus:ring-agri-700">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8F3EE] text-2xl">{step.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-agri-900 text-xs font-bold text-white">{step.number}</span>
                    <h3 className="font-bold text-charcoal">{step.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-[#636E72]">{step.urdu} · {step.detail}</p>
                </div>
                <span aria-hidden="true" className="text-xl text-agri-900">→</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link href="/crops" className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-sm font-semibold text-charcoal hover:bg-[#F8F9F5]">My crops <span className="block text-xs font-normal text-[#636E72]">میری فصلیں</span></Link>
          <Link href="/ai-assistant" className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-sm font-semibold text-charcoal hover:bg-[#F8F9F5]">AI help <span className="block text-xs font-normal text-[#636E72]">اے آئی مدد</span></Link>
          <Link href="/messages" className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-sm font-semibold text-charcoal hover:bg-[#F8F9F5]">Messages <span className="block text-xs font-normal text-[#636E72]">پیغامات</span></Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-charcoal">Farmers’ listings <span className="text-sm font-normal text-[#636E72]">· کسانوں کی فصلیں</span></h2>
            <p className="mt-0.5 text-sm text-[#636E72]">Browse what others have listed. This page is for viewing, not buying.</p>
          </div>
        </div>

        {communityCrops.length === 0 ? (
          <Card>
            <p className="text-sm font-semibold text-charcoal">No other listings yet · ابھی کوئی فصل درج نہیں</p>
            <p className="mt-1 text-sm text-[#636E72]">New listings from other farmers will appear here.</p>
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
                      <h3 className="truncate text-base font-bold text-charcoal">{item.crop.name}</h3>
                      <p className="truncate text-xs text-[#636E72]">{item.originCity || item.farmer.location || 'Location not added'}</p>
                    </div>
                  </div>
                  <div className="border-t border-[#E5E7EB] px-3 py-3">
                    <p className="text-lg font-bold text-agri-900">{item.askingPricePerKg ? `${money(item.askingPricePerKg)} / kg` : 'Open to offers · قیمت کی بات ہو سکتی ہے'}</p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[#636E72]">
                      <span>Available · دستیاب: <strong className="text-charcoal">{qty(item.availableKg)}</strong></span>
                      <span>Seller · کسان: {item.farmer.name}</span>
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
