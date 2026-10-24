import Link from 'next/link';
import { SupplyChainStage } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import type { UiKey } from '@/lib/i18n/translations';
import Icon, { type IconName } from '@/components/ui/Icon';
import LanguageToggle from '@/components/layout/LanguageToggle';
import ThemeToggle from '@/components/layout/ThemeToggle';

export const dynamic = 'force-dynamic';

async function getMarketSnapshot() {
  const mandi = await prisma.mandi.findFirst({ where: { city: 'Islamabad' } });
  if (!mandi) return { mandi: null, prices: [] };
  const prices = await prisma.marketPrice.findMany({
    where: { mandiId: mandi.id },
    include: { crop: true },
    orderBy: { crop: { name: 'asc' } },
    take: 3,
  });
  return { mandi, prices };
}

/**
 * Read-only price journey of one real batch: the most recent one that reached
 * a shop shelf. Each price is read off the recorded step, the same way the
 * admin trace page does; confidential steps are never used.
 */
async function getPriceJourney() {
  const shelf = await prisma.supplyChainEvent.findFirst({
    where: { stage: SupplyChainStage.RETAIL_LISTING, pricePerKg: { not: null }, isConfidential: false },
    orderBy: { createdAt: 'desc' },
    select: { batchId: true },
  });
  if (!shelf) return null;
  const [batch, events] = await Promise.all([
    prisma.farmerCropBatch.findUnique({
      where: { id: shelf.batchId },
      select: { originCity: true, crop: { select: { name: true, nameUrdu: true } } },
    }),
    prisma.supplyChainEvent.findMany({
      where: { batchId: shelf.batchId, isConfidential: false, pricePerKg: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { stage: true, pricePerKg: true },
    }),
  ]);
  const priceAt = (stage: SupplyChainStage) => events.find((e) => e.stage === stage)?.pricePerKg ?? null;
  return {
    batch,
    farm: priceAt(SupplyChainStage.FARMER_ARHTI_DEAL) ?? priceAt(SupplyChainStage.ARHTI_RECEIPT),
    auction: priceAt(SupplyChainStage.ARHTI_VENDOR_SALE),
    wholesale: priceAt(SupplyChainStage.VENDOR_SHOPKEEPER_SALE),
    shop: priceAt(SupplyChainStage.RETAIL_LISTING),
  };
}

const HOW: { icon: IconName; title: UiKey; text: UiKey }[] = [
  { icon: 'sprout', title: 'landing.how1.title', text: 'landing.how1.text' },
  { icon: 'gavel', title: 'landing.how2.title', text: 'landing.how2.text' },
  { icon: 'handshake', title: 'landing.how3.title', text: 'landing.how3.text' },
  { icon: 'truck', title: 'landing.how4.title', text: 'landing.how4.text' },
  { icon: 'banknote', title: 'landing.how5.title', text: 'landing.how5.text' },
];

const WHY: { icon: IconName; title: UiKey; text: UiKey }[] = [
  { icon: 'scale', title: 'landing.why1.title', text: 'landing.why1.text' },
  { icon: 'shield', title: 'landing.why2.title', text: 'landing.why2.text' },
  { icon: 'mic', title: 'landing.why3.title', text: 'landing.why3.text' },
];

const WHO: { icon: IconName; title: UiKey; text: UiKey }[] = [
  { icon: 'sprout', title: 'landing.who1.title', text: 'landing.who1.text' },
  { icon: 'scale', title: 'landing.who2.title', text: 'landing.who2.text' },
  { icon: 'gavel', title: 'landing.who3.title', text: 'landing.who3.text' },
  { icon: 'store', title: 'landing.who4.title', text: 'landing.who4.text' },
];

const WRAP = 'mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-[72px]';

export default async function LandingPage() {
  const [{ mandi, prices }, journey] = await Promise.all([getMarketSnapshot(), getPriceJourney()]);
  const { t, crop, place, rate, money, isUrdu } = await getI18n();
  const mandiName = place(mandi?.name ?? 'Islamabad Sabzi Mandi');

  // Only the steps that have a recorded price; the card is left out if none do.
  const steps: { key: UiKey; price: number | null; gold: boolean }[] = journey
    ? [
        { key: 'landing.stage.farmer', price: journey.farm, gold: true },
        { key: 'landing.stage.auction', price: journey.auction, gold: false },
        { key: 'landing.stage.wholesale', price: journey.wholesale, gold: false },
        { key: 'landing.stage.shop', price: journey.shop, gold: false },
      ]
    : [];
  const ladder = steps.filter((step): step is { key: UiKey; price: number; gold: boolean } => step.price !== null);
  const top = Math.max(...ladder.map((step) => step.price), 1);
  const journeyCrop = journey?.batch ? (isUrdu ? crop(journey.batch.crop) : journey.batch.crop.name.toLowerCase()) : '';
  const journeyPlace = journey?.batch?.originCity ? place(journey.batch.originCity) : '';
  const trustText =
    journey?.batch && ladder.length === 4
      ? t('landing.trustFull', {
          crop: journeyCrop,
          place: journeyPlace,
          farm: money(ladder[0].price),
          auction: money(ladder[1].price),
          wholesale: money(ladder[2].price),
          shop: money(ladder[3].price),
        })
      : journey?.batch
        ? t('landing.trustShort', { crop: journeyCrop, place: journeyPlace })
        : null;

  const priceCard =
    ladder.length > 0 ? (
      <div className="flex flex-col gap-3 rounded-[24px] bg-sf p-[18px] text-ink shadow-[0_30px_50px_-24px_rgba(0,0,0,.55)]">
        <span className="flex items-center gap-2 text-sm font-extrabold text-goldtext">
          <Icon name="route" size={18} />
          {t('landing.trust')}
        </span>
        <div className="grid h-[110px] items-end gap-2" style={{ gridTemplateColumns: `repeat(${ladder.length}, minmax(0, 1fr))` }}>
          {ladder.map((step) => (
            <div key={step.key} className="flex h-full flex-col justify-end gap-1.5">
              <span className="tabular text-center font-[family-name:var(--font-jakarta)] text-[13px] font-extrabold leading-none">{money(step.price)}</span>
              <div
                className={`rounded-[9px_9px_3px_3px] ${step.gold ? 'bg-gold' : 'bg-forest'}`}
                style={{ height: `${Math.max(12, Math.round((step.price / top) * 92))}%` }}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${ladder.length}, minmax(0, 1fr))` }}>
          {ladder.map((step) => (
            <span key={step.key} className="text-center text-[11.5px] font-bold leading-tight text-muted">
              {t(step.key)}
            </span>
          ))}
        </div>
      </div>
    ) : null;

  // The phone shows the app with public mandi figures only: no farmer's offers or payments.
  const [first, second, third] = prices;
  const phone = (size: 'sm' | 'lg') => {
    const lg = size === 'lg';
    return (
      <div
        aria-hidden="true"
        className={`bg-[#0B1A14] shadow-[0_40px_70px_-30px_rgba(0,0,0,.7)] ${lg ? 'h-[540px] w-[270px] rounded-[40px] p-2.5' : 'h-[330px] w-[200px] rounded-[30px] p-2'}`}
      >
        <div className={`flex h-full w-full flex-col overflow-hidden bg-[#F7F5EE] text-[#16251D] ${lg ? 'rounded-[31px]' : 'rounded-[23px]'}`}>
          <div className={`flex shrink-0 items-center gap-2 bg-[linear-gradient(135deg,#0F3D2E,#23804A)] ${lg ? 'h-[58px] px-3.5' : 'h-11 px-2.5'}`}>
            <span className={`inline-flex items-center justify-center bg-gold text-ongold ${lg ? 'h-7 w-7 rounded-[9px]' : 'h-[22px] w-[22px] rounded-[7px]'}`}>
              <Icon name="sprout" size={lg ? 16 : 13} />
            </span>
            <span className={`font-extrabold text-white ${lg ? 'text-[13px]' : 'text-[11px]'}`}>{t('header.brand')}</span>
          </div>
          <div className={`flex flex-col ${lg ? 'gap-2.5 p-3.5' : 'gap-2 p-2.5'}`}>
            {lg && <span className="font-display text-[calc(15px*var(--hs))] font-semibold">{t('landing.live')}</span>}
            {first && (
              <div className={`flex flex-col bg-[#E6EFE3] ${lg ? 'gap-2 rounded-2xl p-3' : 'gap-1.5 rounded-xl p-2'}`}>
                <div className="flex items-center gap-2.5">
                  {first.crop.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={first.crop.imageUrl} alt="" className={`shrink-0 object-cover ${lg ? 'h-11 w-11 rounded-xl' : 'h-[34px] w-[34px] rounded-[9px]'}`} />
                  )}
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={`truncate font-extrabold ${lg ? 'text-[11.5px]' : 'text-[10px]'}`}>{crop(first.crop)}</span>
                    <span className={`tabular font-extrabold leading-none ${lg ? 'text-xl' : 'text-[15px]'}`}>
                      {rate(first.ratePerKg)}
                      <span className={`font-bold text-[#4C5C53] ${lg ? 'text-[11px]' : 'text-[9px]'}`}> {t('landing.perKg')}</span>
                    </span>
                  </span>
                </div>
                <div className={`flex items-center justify-center bg-gold text-center font-extrabold text-ongold ${lg ? 'h-[38px] rounded-[11px] text-[12.5px]' : 'h-[30px] rounded-[9px] text-[10.5px]'}`}>
                  {t('landing.auctions')}: {t('landing.live.count', { count: mandi?.activeAuctionsCount ?? 0 })}
                </div>
              </div>
            )}
            <div className={`flex flex-col bg-[linear-gradient(135deg,#0F3D2E,#23804A)] text-white ${lg ? 'gap-1 rounded-2xl p-3' : 'gap-0.5 rounded-xl p-2'}`}>
              <span className={`text-[#D6E6D9] ${lg ? 'text-[11px]' : 'text-[9px]'}`}>{t('landing.volume')}</span>
              <span className={`tabular font-extrabold leading-none text-[#F6C871] ${lg ? 'text-2xl' : 'text-base'}`}>
                {t('landing.tonnes', { count: mandi?.todayVolumeTonnes ?? 0 })}
              </span>
            </div>
            {lg && (
              <div className="flex gap-2">
                {[second, third].map((item) =>
                  item?.crop.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={item.id} src={item.crop.imageUrl} alt="" className="h-16 min-w-0 flex-1 rounded-xl object-cover" />
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Hero over the fields illustration, with the header on it */}
      <section className="relative overflow-hidden bg-brand text-white lg:min-h-[760px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illustrations/fields.svg"
          alt=""
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[340px] w-full object-cover opacity-90 lg:inset-0 lg:h-full lg:opacity-100"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,40,29,0)_40%,rgba(10,40,29,.55)_100%)] lg:bg-[linear-gradient(90deg,rgba(10,40,29,.72)_0%,rgba(10,40,29,.25)_60%,rgba(10,40,29,0)_100%)] lg:rtl:bg-[linear-gradient(270deg,rgba(10,40,29,.72)_0%,rgba(10,40,29,.25)_60%,rgba(10,40,29,0)_100%)]"
        />

        <header className={`${WRAP} relative flex h-[72px] items-center gap-2 lg:h-[84px] lg:gap-3.5`}>
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-ongold lg:h-11 lg:w-11 lg:rounded-[13px]">
              <Icon name="sprout" size={24} />
            </span>
            <span className="truncate text-[17px] font-extrabold lg:text-xl">{t('header.brand')}</span>
          </Link>
          <a href="#how" className="hidden min-h-12 items-center px-3 text-[15px] font-bold lg:inline-flex">
            {t('landing.navHow')}
          </a>
          <a href="#market" className="hidden min-h-12 items-center px-3 text-[15px] font-bold lg:inline-flex">
            {t('landing.navPrices')}
          </a>
          <span className="lg:hidden">
            <LanguageToggle compact />
          </span>
          <span className="hidden lg:inline-flex">
            <LanguageToggle />
          </span>
          <span className="lg:hidden">
            <ThemeToggle compact />
          </span>
          <span className="hidden lg:inline-flex">
            <ThemeToggle />
          </span>
          <Link
            href="/login"
            className="ac-press hidden h-12 items-center gap-2 rounded-[13px] border-[1.5px] border-white/50 px-[18px] text-[15px] font-extrabold hover:bg-white/10 lg:inline-flex"
          >
            <Icon name="user" size={19} />
            {t('landing.signIn')}
          </Link>
        </header>

        <div className={`${WRAP} relative grid items-center gap-2.5 pt-[22px] lg:grid-cols-[1.1fr_.9fr] lg:gap-12 lg:pb-24 lg:pt-14`}>
          <div className="flex max-w-[640px] flex-col gap-[18px] lg:gap-6">
            <span className="ac-up inline-flex h-8 items-center gap-2 self-start rounded-full bg-white/[.14] px-3 text-[12.5px] font-bold lg:h-9 lg:px-3.5 lg:text-sm">
              <span className="ac-pulse h-2 w-2 rounded-full bg-gold" />
              {t('landing.tag')}
            </span>
            <h1 className="ac-up ac-d1 font-display text-[calc(42px*var(--hs))] font-semibold tracking-[-.01em] lg:text-[calc(72px*var(--hs))] lg:tracking-[-.02em]">
              {t('landing.h1')}
            </h1>
            <p className="ac-up ac-d2 max-w-[560px] text-[17px] text-[#E6EFE3] lg:text-xl">{t('landing.sub')}</p>
            <div className="ac-up ac-d3 flex flex-col gap-1 lg:flex-row lg:flex-wrap lg:items-center lg:gap-5">
              <Link
                href="/login"
                className="ac-press inline-flex h-[60px] items-center justify-center gap-2.5 rounded-[18px] bg-gold px-8 text-[17px] font-extrabold text-ongold shadow-[0_16px_30px_-12px_rgba(0,0,0,.45)] lg:h-16 lg:text-lg"
              >
                {t('landing.cta')}
                <Icon name="arrowright" size={20} />
              </Link>
              <a href="#market" className="hidden min-h-12 items-center gap-1.5 text-base font-bold underline underline-offset-4 lg:inline-flex">
                {t('landing.seePrices')}
                <Icon name="chevronright" size={18} />
              </a>
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center gap-1.5 self-center text-[15px] font-bold lg:hidden">
                <Icon name="user" size={18} />
                {t('landing.haveAccount')}
              </Link>
            </div>
          </div>

          {/* Desktop: the phone with the price journey card beside it */}
          <div className="relative hidden h-[560px] lg:block">
            <div className="absolute start-[60px] top-2.5">{phone('lg')}</div>
            {priceCard && <div className="ac-up ac-d4 absolute bottom-5 end-0 w-[320px]">{priceCard}</div>}
          </div>
          <div className="relative flex h-[300px] justify-center overflow-hidden pt-2.5 lg:hidden">{phone('sm')}</div>
        </div>
      </section>

      {/* Phones: the price journey card overlaps the bottom of the hero */}
      {priceCard && (
        <div className="relative -mt-7 px-4 lg:hidden">
          {priceCard}
          {trustText && <p className="mt-2 px-1 text-[13px] text-muted">{trustText}</p>}
        </div>
      )}

      {/* How it works */}
      <section id="how" className={`${WRAP} scroll-mt-6 pt-11 lg:pt-24`}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div>
            <h2 className="font-display text-[calc(28px*var(--hs))] font-semibold lg:text-[calc(48px*var(--hs))]">{t('landing.howTitle')}</h2>
            <p className="mt-1.5 text-[15.5px] text-muted lg:mt-2 lg:text-lg">{t('landing.howSub')}</p>
          </div>
          {trustText && <p className="hidden max-w-[360px] text-[15px] text-muted lg:block">{trustText}</p>}
        </div>
        <ol className="relative mt-5 flex flex-col lg:mt-10 lg:grid lg:grid-cols-5 lg:gap-6">
          <span aria-hidden="true" className="absolute bottom-6 start-[23px] top-6 w-[3px] rounded-sm bg-[linear-gradient(#E8A33D,var(--fo))] lg:hidden" />
          <span aria-hidden="true" className="absolute inset-x-8 top-[31px] hidden h-[3px] rounded-sm bg-[linear-gradient(90deg,#E8A33D,var(--fo))] lg:block lg:rtl:bg-[linear-gradient(270deg,#E8A33D,var(--fo))]" />
          {HOW.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 pb-[22px] lg:flex-col lg:gap-3.5 lg:pb-0">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sf text-forest shadow-[0_0_0_2px_var(--ln)] lg:h-16 lg:w-16 lg:rounded-[20px] lg:shadow-[0_0_0_2px_var(--ln),var(--sh)]">
                <Icon name={step.icon} size={24} />
              </span>
              <span className="flex flex-col gap-1 pt-1 lg:gap-3.5 lg:pt-0">
                <span className="text-[17px] font-extrabold lg:flex lg:flex-col lg:gap-3.5 lg:text-[19px]">
                  <span className="tabular text-goldtext lg:text-sm">{String(i + 1).padStart(2, '0')}</span>
                  <span className="lg:hidden"> · </span>
                  {t(step.title)}
                </span>
                <span className="text-[14.5px] text-muted lg:text-[15px]">{t(step.text)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Live mandi snapshot: public prices only */}
      <section id="market" className={`${WRAP} scroll-mt-6 pt-12 lg:grid lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:gap-14 lg:pt-24`}>
        <div className="flex flex-col gap-4 lg:gap-[18px]">
          <span className="inline-flex h-[30px] items-center gap-2 self-start rounded-full bg-gold px-3 text-[12.5px] font-extrabold text-ongold lg:h-8 lg:text-[13px]">
            <span className="ac-pulse h-2 w-2 rounded-full bg-ongold" />
            {t('landing.live')}
          </span>
          <h2 className="font-display text-[calc(28px*var(--hs))] font-semibold lg:text-[calc(44px*var(--hs))]">{t('landing.mandiToday', { mandi: mandiName })}</h2>
          <p className="text-[15px] text-muted lg:text-[17px]">{t('landing.mandiSub')}</p>
          <div className="flex gap-2.5 lg:gap-3">
            <span className="flex flex-1 flex-col gap-1 rounded-[18px] bg-sage p-3.5 lg:gap-1.5 lg:rounded-[20px] lg:p-[18px]">
              <span className="text-[12.5px] font-bold text-muted lg:text-[13px]">{t('landing.volume')}</span>
              <span className="tabular text-[22px] font-extrabold leading-none lg:text-[28px]">{t('landing.tonnes', { count: mandi?.todayVolumeTonnes ?? 0 })}</span>
            </span>
            <span className="flex flex-1 flex-col gap-1 rounded-[18px] bg-sage p-3.5 lg:gap-1.5 lg:rounded-[20px] lg:p-[18px]">
              <span className="text-[12.5px] font-bold text-muted lg:text-[13px]">{t('landing.auctions')}</span>
              <span className="tabular text-[22px] font-extrabold leading-none lg:text-[28px]">{t('landing.live.count', { count: mandi?.activeAuctionsCount ?? 0 })}</span>
            </span>
          </div>
          <p className="hidden items-start gap-2.5 text-sm text-muted lg:flex">
            <Icon name="eye" size={18} className="mt-0.5 text-forest" />
            {t('landing.privacy')}
          </p>
          <a href="#market" className="hidden min-h-12 items-center gap-1.5 text-base font-extrabold lg:inline-flex">
            {t('landing.allMandis')}
            <Icon name="arrowright" size={18} />
          </a>
        </div>

        <div className="mt-2 flex flex-col lg:mt-0 lg:grid lg:grid-cols-3 lg:gap-5">
          {prices.length === 0 && <p className="text-sm text-muted lg:col-span-3">{t('landing.noPrices')}</p>}
          {prices.map((item) => {
            const up = item.trend === 'up';
            const down = item.trend === 'down';
            return (
              <div
                key={item.id}
                className="flex items-center gap-3.5 border-b border-line py-3.5 lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-hidden lg:rounded-hero lg:border-0 lg:bg-sf lg:py-0 lg:shadow-card"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-sage lg:h-[170px] lg:w-full lg:rounded-none">
                  {item.crop.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.crop.imageUrl} alt={crop(item.crop)} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px] lg:gap-2 lg:px-5 lg:pb-[22px] lg:pt-[18px]">
                  <span className="text-[17px] font-extrabold lg:text-[19px]">{crop(item.crop)}</span>
                  <span className="hidden items-baseline gap-1.5 lg:flex">
                    <span className="tabular text-[38px] font-extrabold leading-none">{rate(item.ratePerKg)}</span>
                    <span className="text-[15px] font-bold text-muted">{t('landing.perKg')}</span>
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[13px] font-extrabold lg:text-sm ${up ? 'text-ok-fg' : down ? 'text-err-fg' : 'text-muted'}`}>
                    {up && <Icon name="trendup" size={16} />}
                    {down && <Icon name="trenddown" size={16} />}
                    <span dir="ltr" className="tabular">
                      {item.changePercent > 0 ? `+${item.changePercent}%` : `${item.changePercent}%`}
                    </span>
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5 lg:hidden">
                  <span className="tabular text-2xl font-extrabold leading-none">{rate(item.ratePerKg)}</span>
                  <span className="text-[12.5px] text-muted">{t('landing.perKg')}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-sf p-3.5 text-[13.5px] shadow-card lg:hidden">
          <Icon name="eye" size={18} className="mt-0.5 text-forest" />
          <span className="flex-1">{t('landing.privacy')}</span>
        </div>
        <a href="#market" className="mt-2 inline-flex min-h-12 items-center gap-1.5 text-[15px] font-extrabold lg:hidden">
          {t('landing.allMandis')}
          <Icon name="arrowright" size={18} />
        </a>
      </section>

      {/* Why AgriConnect */}
      <section className="mt-12 bg-sage lg:mt-24">
        <div className={`${WRAP} flex flex-col gap-[22px] py-9 lg:grid lg:grid-cols-[.8fr_repeat(3,minmax(0,1fr))] lg:gap-10 lg:py-20`}>
          <div className="flex flex-col gap-1.5 lg:gap-2.5">
            <h2 className="font-display text-[calc(28px*var(--hs))] font-semibold lg:text-[calc(40px*var(--hs))]">{t('landing.whyTitle')}</h2>
            <p className="text-[15px] text-muted lg:text-base">{t('landing.whySub')}</p>
          </div>
          {WHY.map((item) => (
            <div key={item.title} className="flex gap-3.5 lg:flex-col">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest text-[#F6C871] lg:h-14 lg:w-14 lg:rounded-[18px]">
                <Icon name={item.icon} size={24} />
              </span>
              <span className="flex flex-col gap-1 lg:gap-3.5">
                <span className="text-[17px] font-extrabold lg:text-[19px]">{t(item.title)}</span>
                <span className="text-[14.5px] text-muted lg:text-[15.5px]">{t(item.text)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Made for everyone in the chain */}
      <section className={`${WRAP} pt-12 lg:pt-24`}>
        <h2 className="font-display text-[calc(28px*var(--hs))] font-semibold lg:text-[calc(44px*var(--hs))]">{t('landing.whoTitle')}</h2>
        <p className="mt-1.5 text-[15px] text-muted lg:mt-2 lg:text-[17px]">{t('landing.whoSub')}</p>
        <div className="mt-4 lg:mt-8 lg:grid lg:grid-cols-4 lg:border-t lg:border-line">
          {WHO.map((item) => (
            <div key={item.title} className="flex items-center gap-3.5 border-b border-line px-1 py-3.5 lg:flex-col lg:items-start lg:gap-3 lg:border-b-0 lg:border-e lg:px-6 lg:py-7">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-sage text-forest lg:h-12 lg:w-12 lg:rounded-2xl">
                <Icon name={item.icon} size={22} />
              </span>
              <span className="flex flex-1 flex-col gap-0.5 lg:gap-3">
                <span className="text-base font-extrabold lg:text-lg">{t(item.title)}</span>
                <span className="text-[13.5px] text-muted lg:text-[15px]">{t(item.text)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={`${WRAP} pt-12 lg:pt-24`}>
        <div className="flex flex-col gap-3.5 rounded-[28px] bg-brand px-[22px] py-[26px] text-white lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:rounded-[32px] lg:px-14 lg:py-12">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-[calc(26px*var(--hs))] font-semibold lg:text-[calc(40px*var(--hs))]">{t('landing.endTitle')}</h2>
            <span className="hidden text-[15px] text-[#D6E6D9] lg:block">{t('landing.free')}</span>
          </div>
          <Link
            href="/login"
            className="ac-press inline-flex h-[58px] shrink-0 items-center justify-center gap-2.5 rounded-[18px] bg-gold px-8 text-[17px] font-extrabold text-ongold lg:h-16 lg:text-lg"
          >
            {t('landing.cta2')}
          </Link>
          <span className="text-center text-[13px] text-[#D6E6D9] lg:hidden">{t('landing.free')}</span>
        </div>
      </section>

      <footer className="mt-10 border-t border-line lg:mt-16">
        <div className={`${WRAP} flex flex-col gap-2 py-6 text-[13px] text-muted lg:flex-row lg:items-center lg:gap-7 lg:pb-9 lg:pt-7 lg:text-sm`}>
          <span className="inline-flex items-center gap-2 font-extrabold text-ink">
            <Icon name="shield" size={16} />
            {t('landing.raast')}
          </span>
          <span className="lg:flex-1">{t('landing.pilot')}</span>
          <span className="flex gap-5">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="scale" size={16} />
              {t('landing.scale')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="tag" size={16} />
              {t('landing.pricing')}
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}
