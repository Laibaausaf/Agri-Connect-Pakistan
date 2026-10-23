import Link from 'next/link';
import { CropBatchStatus, OfferDirection, OfferStatus, PaymentStatus, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import { Badge, CropThumb, statusTone } from '@/components/ui/kit';
import Icon, { type IconName } from '@/components/ui/Icon';
import BrandGlow from '@/components/ui/BrandGlow';
import { DEAL_STAGES, dealStageIndex } from '@/components/deals/stages';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

const farmerSteps: { title: 'home.step1.title' | 'home.step2.title' | 'home.step3.title' | 'home.step4.title'; detail: 'home.step1.detail' | 'home.step2.detail' | 'home.step3.detail' | 'home.step4.detail'; href: string; icon: IconName }[] = [
  { title: 'home.step1.title', detail: 'home.step1.detail', href: '/crops/new', icon: 'pluscircle' },
  { title: 'home.step2.title', detail: 'home.step2.detail', href: '/arhti-requests', icon: 'handshake' },
  { title: 'home.step3.title', detail: 'home.step3.detail', href: '/deals', icon: 'truck' },
  { title: 'home.step4.title', detail: 'home.step4.detail', href: '/records', icon: 'wallet' },
];

export default async function FarmerHome({ userId, name }: { userId: string; name: string }) {
  const { t, plural, crop, place, perKg, kg, money, status, date } = await getI18n();

  // Read-only. Each query is the one the farmer's own page already runs:
  // offers waiting (/arhti-requests), crops (/crops), open deals (/deals) and
  // settlements with payments (/records).
  const [communityCrops, pendingOffers, batches, deals, settlements, payments] = await Promise.all([
    prisma.farmerCropBatch.findMany({
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
    }),
    prisma.farmerArhtiOffer.findMany({
      where: { farmerId: userId, direction: OfferDirection.ARHTI_TO_FARMER, status: OfferStatus.PENDING },
      include: {
        arhti: { select: { id: true, name: true, location: true } },
        batch: { include: { crop: true } },
        destinationMandi: true,
      },
      orderBy: { pricePerKg: 'desc' },
    }),
    prisma.farmerCropBatch.findMany({
      where: { farmerId: userId, status: { not: CropBatchStatus.ARCHIVED } },
      include: {
        crop: true,
        offers: { where: { status: 'PENDING' }, select: { id: true } },
        deals: { select: { id: true, dealNumber: true, status: true, agreedPricePerKg: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.farmerArhtiDeal.findMany({
      where: { farmerId: userId },
      include: { crop: true, arhti: { select: { name: true } }, destinationMandi: { select: { name: true, city: true } }, settlement: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.settlement.findMany({ where: { farmerId: userId }, select: { dealId: true, netPayable: true } }),
    prisma.paymentRecord.findMany({
      where: { recipientId: userId, transactionType: TransactionType.FARMER_ARHTI },
      select: { transactionId: true, status: true },
    }),
  ]);

  // Same totals as /records: paid settlements, and the ones still awaited.
  const paymentByDeal = new Map(payments.map((p) => [p.transactionId, p]));
  const earned = settlements.filter((s) => paymentByDeal.get(s.dealId)?.status === PaymentStatus.PAID).reduce((sum, s) => sum + s.netPayable, 0);
  const awaited = settlements.filter((s) => paymentByDeal.get(s.dealId)?.status !== PaymentStatus.PAID).reduce((sum, s) => sum + s.netPayable, 0);

  const openDeal = deals.find((d) => d.status !== 'COMPLETED' && d.status !== 'CANCELLED');
  const best = pendingOffers[0]?.pricePerKg;
  const today = date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="ac-up flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[15px] text-muted">{t('home.greeting')}</p>
          <h1 className="font-display h-page font-semibold">{t('home.welcome', { name })}</h1>
          <p className="mt-1 text-muted">{t('home.question')}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
          <Icon name="calendar" size={16} />
          {today}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* The one thing that needs an answer: offers waiting, else the deal on its way, else a crop to add. */}
        {pendingOffers.length > 0 ? (
          <section className="ac-up ac-d1 rounded-hero bg-sage p-5 sm:p-6">
            <Badge tone="amber" icon="bell">{plural('home.newOffers', pendingOffers.length)}</Badge>
            <h2 className="font-display h-section mt-3 font-semibold">{t('offers.waiting')}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {pendingOffers.slice(0, 2).map((offer) => {
                const isBest = offer.pricePerKg === best;
                return (
                  <div key={offer.id} className={`rounded-2xl bg-sf p-4 ${isBest ? 'ring-2 ring-gold' : ''}`}>
                    {isBest && (
                      <span className="mb-1.5 inline-flex items-center gap-1 text-[12.5px] font-extrabold text-goldtext">
                        <Icon name="star" size={14} />
                        {t('offers.bestRate')}
                      </span>
                    )}
                    <div className="text-[15px] font-bold">{offer.arhti.name}</div>
                    <div className="text-sm text-muted">{crop(offer.batch.crop)} · {offer.batch.batchNumber}</div>
                    <div className="tabular mt-2 text-[26px] font-extrabold leading-none">{perKg(offer.pricePerKg)}</div>
                    <div className="mt-2 text-[13px] text-muted">
                      {kg(offer.quantityKg)} · {t('offers.youReceive')} <span className="font-bold text-ink">{money(offer.quantityKg * offer.pricePerKg)}</span>
                    </div>
                    <div className="text-[13px] text-muted">
                      {t('offers.transport')}:{' '}
                      {offer.transportResponsibility === 'ARHTI'
                        ? t('offers.transportArhti')
                        : offer.transportResponsibility === 'FARMER'
                          ? t('offers.transportFarmer')
                          : t('offers.transportShared')}
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/arhti-requests" className="btn btn-primary mt-5 w-full sm:w-auto sm:px-7">
              {t('home.step2.title')}
              <Icon name="arrowright" size={20} />
            </Link>
          </section>
        ) : openDeal ? (
          <section className="ac-up ac-d1 rounded-hero bg-sage p-5 sm:p-6">
            <Badge tone={statusTone(openDeal.status)}>{status(openDeal.status)}</Badge>
            <h2 className="font-display h-section mt-3 font-semibold">
              {crop(openDeal.crop)} · {kg(openDeal.agreedQuantityKg)}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {openDeal.arhti.name} · {perKg(openDeal.agreedPricePerKg)} · {place(openDeal.destinationMandi.city)}
            </p>
            <Link href={`/deals/${openDeal.id}`} className="btn btn-primary mt-5 w-full sm:w-auto sm:px-7">
              {t('home.step3.title')}
              <Icon name="arrowright" size={20} />
            </Link>
          </section>
        ) : (
          <section className="ac-up ac-d1 rounded-hero bg-sage p-5 sm:p-6">
            <h2 className="font-display h-section font-semibold">{t('home.step1.title')}</h2>
            <p className="mt-1 text-muted">{t('home.step1.detail')}</p>
            <Link href="/crops/new" className="btn btn-primary mt-5 w-full sm:w-auto sm:px-7">
              <Icon name="pluscircle" size={20} />
              {t('home.step1.title')}
            </Link>
          </section>
        )}

        {/* Your money: the dashboard's one gradient block */}
        <section className="ac-up ac-d2 relative overflow-hidden rounded-hero bg-brand p-5 text-white sm:p-6">
          <BrandGlow />
          <div className="relative">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[.14]">
                <Icon name="wallet" size={20} />
              </span>
              <h2 className="font-display h-card font-semibold">{t('home.money')}</h2>
            </div>
            <div className="mt-4 text-sm font-semibold text-[#D6E6D9]">{t('records.received')}</div>
            <div className="tabular text-[38px] font-extrabold leading-tight text-[#F6C871]">{money(earned)}</div>
            <div className="text-sm text-[#D6E6D9]">
              {t('records.awaiting')}: <span className="font-bold text-white">{money(awaited)}</span>
            </div>
            {openDeal && (
              <div className="mt-5 border-t border-white/15 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold">
                    {crop(openDeal.crop)} · {kg(openDeal.agreedQuantityKg)}
                  </span>
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[.14] px-2.5 text-[12.5px] font-bold">
                    <Icon name="truck" size={15} />
                    {status(openDeal.status)}
                  </span>
                </div>
                <div className="mt-3 flex gap-1.5" aria-hidden="true">
                  {DEAL_STAGES.map((stage, i) => (
                    <span key={stage.status} className={`h-1.5 flex-1 rounded-full ${i <= dealStageIndex(openDeal.status) ? 'bg-gold' : 'bg-white/20'}`} />
                  ))}
                </div>
                <Link href={`/deals/${openDeal.id}`} className="btn mt-4 w-full border-[1.5px] border-white/30 text-white hover:bg-white/10">
                  <Icon name="route" size={18} />
                  {t('home.trackDeal')}
                </Link>
              </div>
            )}
            <Link href="/records" className="mt-3 inline-flex min-h-12 items-center gap-1.5 text-sm font-bold text-white hover:underline">
              {t('home.step4.detail')}
              <Icon name="arrowright" size={16} />
            </Link>
          </div>
        </section>
      </div>

      {/* My crops */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-display h-section font-semibold">{t('home.myCrops')}</h2>
          {batches.length > 0 && (
            <Link href="/crops" className="inline-flex min-h-12 items-center gap-1 text-sm font-bold text-forest">
              {t('home.seeAll', { count: batches.length })}
              <Icon name="chevronright" size={16} />
            </Link>
          )}
        </div>
        {batches.length === 0 ? (
          <Link href="/crops/new" className="card flex items-center gap-3 p-4 font-bold">
            <Icon name="pluscircle" size={22} className="text-forest" />
            {t('home.step1.detail')}
          </Link>
        ) : (
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {batches.slice(0, 3).map((batch) => {
              const photo = firstPhoto(batch.photos) ?? batch.crop.imageUrl;
              return (
                <Link key={batch.id} href="/crops" className="card w-[220px] shrink-0 snap-start overflow-hidden sm:w-auto">
                  <div className="h-28 bg-sage">
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={crop(batch.crop)} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="p-4">
                    <Badge tone={statusTone(batch.status)}>{status(batch.status)}</Badge>
                    <div className="mt-2 text-[15px] font-bold">
                      {crop(batch.crop)}
                      {batch.variety ? ` · ${batch.variety}` : ''}
                    </div>
                    <div className="tabular text-xl font-extrabold">{kg(batch.quantityKg)}</div>
                    <div className="mt-1 text-[13px] text-muted">
                      {batch.askingPricePerKg ? perKg(batch.askingPricePerKg) : t('common.openToOffers')}
                      {batch.offers.length > 0 && ` · ${plural('crops.pendingOffers', batch.offers.length)}`}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Your next step */}
      <section>
        <h2 className="font-display h-section font-semibold">{t('home.nextStep')}</h2>
        <p className="mt-1 text-sm text-muted">{t('home.nextStepHint')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {farmerSteps.map((step) => (
            <Link key={step.href} href={step.href} className="card ac-press flex min-h-[76px] items-center gap-3 p-4 hover:border-forest">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage text-forest">
                <Icon name={step.icon} size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{t(step.title)}</span>
                <span className="block text-[13px] text-muted">{t(step.detail)}</span>
              </span>
              <Icon name="chevronright" size={18} className="text-muted" />
            </Link>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { href: '/crops', label: t('home.myCrops'), icon: 'sprout' as const },
            { href: '/ai-assistant', label: t('home.aiHelp'), icon: 'sparkles' as const },
            { href: '/messages', label: t('home.messages'), icon: 'message' as const },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="btn btn-secondary px-2 text-sm">
              <Icon name={item.icon} size={18} />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Other farmers' listings: for comparing prices only */}
      <section>
        <h2 className="font-display h-section font-semibold">{t('home.listings')}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <Icon name="eye" size={16} />
          {t('home.listingsHint')}
        </p>
        {communityCrops.length === 0 ? (
          <div className="card mt-3 p-4">
            <p className="font-semibold">{t('home.noListings')}</p>
            <p className="mt-1 text-sm text-muted">{t('home.noListingsHint')}</p>
          </div>
        ) : (
          <div className="card mt-3 divide-y divide-line overflow-hidden">
            {communityCrops.map((item) => {
              const image = firstPhoto(item.photos) ?? item.crop.imageUrl;
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 sm:p-4">
                  <CropThumb imageUrl={image} name={item.crop.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{crop(item.crop)}</div>
                    <div className="truncate text-[13px] text-muted">
                      {place(item.originCity || item.farmer.location) || t('home.noLocation')} · {t('home.seller')}: {item.farmer.name}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="tabular text-base font-extrabold">
                      {item.askingPricePerKg ? perKg(item.askingPricePerKg) : t('common.openToOffers')}
                    </div>
                    <div className="text-[13px] text-muted">
                      {t('home.available')}: {kg(item.availableKg)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
