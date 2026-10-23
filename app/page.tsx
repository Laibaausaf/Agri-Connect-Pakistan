import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getI18n } from '@/lib/i18n/server';
import type { UiKey } from '@/lib/i18n/translations';
import Icon, { type IconName } from '@/components/ui/Icon';
import { CropThumb } from '@/components/ui/kit';
import LanguageToggle from '@/components/layout/LanguageToggle';
import ThemeToggle from '@/components/layout/ThemeToggle';
import BrandGlow from '@/components/ui/BrandGlow';

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

export default async function LandingPage() {
  const { mandi, prices } = await getMarketSnapshot();
  const { t, crop, place, rate } = await getI18n();
  const mandiName = place(mandi?.name ?? 'Islamabad Sabzi Mandi');

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Hero, with the header on the gradient */}
      <section className="relative bg-brand text-white">
        <BrandGlow />
        <header className="relative mx-auto flex h-[72px] max-w-6xl items-center gap-2.5 px-4 sm:h-20 sm:px-8">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-ongold">
              <Icon name="sprout" size={24} />
            </span>
            <span className="truncate text-[17px] font-extrabold sm:text-[19px]">{t('header.brand')}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#how" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10">
              {t('landing.navHow')}
            </a>
            <a href="#market" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10">
              {t('landing.navPrices')}
            </a>
          </nav>
          <LanguageToggle compact />
          <ThemeToggle compact />
          <Link
            href="/login"
            className="ac-press hidden h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-white/40 px-3.5 text-sm font-bold hover:bg-white/10 sm:inline-flex"
          >
            <Icon name="user" size={18} />
            {t('landing.signIn')}
          </Link>
        </header>

        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-12 pt-6 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pb-20 lg:pt-12">
          <div className="ac-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/[.12] px-3 py-1.5 text-[12.5px] font-bold">
              <span className="h-2 w-2 rounded-full bg-gold" />
              {t('landing.tag')}
            </span>
            <h1 className="font-display h-display mt-5 max-w-xl font-semibold text-balance">{t('landing.h1')}</h1>
            <p className="mt-4 max-w-lg text-base text-[#D6E6D9] sm:text-[17px]">{t('landing.sub')}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/login" className="btn btn-primary w-full px-6 sm:w-auto">
                {t('landing.cta')}
                <Icon name="arrowright" size={20} />
              </Link>
              <a href="#market" className="btn hidden px-3 text-white hover:bg-white/10 sm:inline-flex">
                {t('landing.seePrices')}
                <Icon name="chevronright" size={18} />
              </a>
              <Link href="/login" className="btn text-white hover:bg-white/10 sm:hidden">
                <Icon name="user" size={18} />
                {t('landing.haveAccount')}
              </Link>
            </div>
          </div>
          {/* Illustration only: no figures in the hero. */}
          <div className="ac-up ac-d2 overflow-hidden rounded-hero border border-white/10 shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/illustrations/fields.svg"
              alt={t('landing.heroArtAlt')}
              width={1440}
              height={620}
              className="block aspect-[16/10] h-auto w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-14 sm:px-8 sm:py-20">
        <h2 className="font-display h-page font-semibold">{t('landing.howTitle')}</h2>
        <p className="mt-2 text-muted">{t('landing.howSub')}</p>
        <ol className="relative mt-10 grid gap-6 lg:grid-cols-5 lg:gap-4">
          {HOW.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 lg:flex-col lg:gap-3">
              {i < HOW.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute start-6 top-12 h-[calc(100%-24px)] w-0.5 lg:start-12 lg:top-6 lg:h-0.5 lg:w-[calc(100%-32px)]"
                  style={{ backgroundColor: 'rgba(232,163,61,.55)' }}
                />
              )}
              <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-sf text-forest shadow-card">
                <Icon name={step.icon} size={22} />
              </span>
              <span>
                <span className="block text-[13px] font-extrabold text-goldtext tabular">{String(i + 1).padStart(2, '0')}</span>
                <span className="mt-0.5 block text-base font-bold">{t(step.title)}</span>
                <span className="mt-1 block text-sm text-muted">{t(step.text)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Live mandi snapshot: public prices only */}
      <section id="market" className="mx-auto grid max-w-6xl scroll-mt-6 gap-8 px-4 pb-14 sm:px-8 sm:pb-20 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-gold px-3 py-1 text-xs font-extrabold text-ongold">
            <span className="h-2 w-2 rounded-full bg-ongold" />
            {t('landing.live')}
          </span>
          <h2 className="font-display h-page mt-4 font-semibold">{t('landing.mandiToday', { mandi: mandiName })}</h2>
          <p className="mt-2 text-muted">{t('landing.mandiSub')}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-sage p-4">
              <div className="text-[12.5px] font-bold text-muted">{t('landing.volume')}</div>
              <div className="mt-1 text-xl font-extrabold tabular">{t('landing.tonnes', { count: mandi?.todayVolumeTonnes ?? 0 })}</div>
            </div>
            <div className="rounded-2xl bg-sage p-4">
              <div className="text-[12.5px] font-bold text-muted">{t('landing.auctions')}</div>
              <div className="mt-1 text-xl font-extrabold tabular">{t('landing.live.count', { count: mandi?.activeAuctionsCount ?? 0 })}</div>
            </div>
          </div>
          <p className="mt-5 flex items-start gap-2 text-sm text-muted">
            <Icon name="eye" size={18} className="mt-0.5" />
            {t('landing.privacy')}
          </p>
          <a href="#market" className="mt-4 inline-flex min-h-12 items-center gap-1.5 text-sm font-extrabold text-forest hover:underline">
            {t('landing.allMandis')}
            <Icon name="arrowright" size={18} />
          </a>
        </div>
        <div className="grid content-start items-start gap-3 sm:grid-cols-3">
          {prices.length === 0 && <p className="text-sm text-muted sm:col-span-3">{t('landing.noPrices')}</p>}
          {prices.map((item) => {
            const up = item.trend === 'up';
            const down = item.trend === 'down';
            return (
              <div key={item.id} className="card flex items-center gap-4 p-4 sm:flex-col sm:items-start">
                <CropThumb imageUrl={item.crop.imageUrl} name={item.crop.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">{crop(item.crop)}</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[26px] font-extrabold leading-none tabular">{rate(item.ratePerKg)}</span>
                    <span className="text-[13px] text-muted">{t('landing.perKg')}</span>
                  </div>
                  <div className={`mt-2 inline-flex items-center gap-1 text-[13px] font-bold ${up ? 'text-ok-fg' : down ? 'text-err-fg' : 'text-muted'}`}>
                    {up && <Icon name="trendup" size={16} />}
                    {down && <Icon name="trenddown" size={16} />}
                    <span dir="ltr" className="tabular">
                      {item.changePercent > 0 ? `+${item.changePercent}%` : `${item.changePercent}%`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why AgriConnect */}
      <section className="bg-sage">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-8 lg:grid-cols-[1fr_3fr]">
          <div>
            <h2 className="font-display h-page font-semibold">{t('landing.whyTitle')}</h2>
            <p className="mt-2 text-muted">{t('landing.whySub')}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {WHY.map((item) => (
              <div key={item.title} className="flex gap-4 sm:flex-col sm:gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest text-paper">
                  <Icon name={item.icon} size={22} />
                </span>
                <span>
                  <span className="block text-base font-bold">{t(item.title)}</span>
                  <span className="mt-1 block text-sm text-muted">{t(item.text)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Made for everyone in the chain */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-8 sm:py-20">
        <h2 className="font-display h-page font-semibold">{t('landing.whoTitle')}</h2>
        <p className="mt-2 text-muted">{t('landing.whoSub')}</p>
        <div className="mt-8 grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {WHO.map((item) => (
            <div key={item.title} className="flex gap-4 border-b border-line py-5 sm:flex-col sm:gap-3 sm:px-4 sm:first:ps-0 lg:border-b-0 lg:border-e lg:last:border-e-0">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage text-forest">
                <Icon name={item.icon} size={20} />
              </span>
              <span>
                <span className="block text-[15px] font-bold">{t(item.title)}</span>
                <span className="mt-1 block text-sm text-muted">{t(item.text)}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="relative mt-14 overflow-hidden rounded-hero bg-brand px-6 py-8 text-white sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-10">
          <BrandGlow />
          <div className="relative">
            <h2 className="font-display h-section font-semibold">{t('landing.endTitle')}</h2>
            <p className="mt-1.5 text-sm text-[#D6E6D9]">{t('landing.free')}</p>
          </div>
          <Link href="/login" className="btn btn-primary relative mt-5 w-full shrink-0 px-6 sm:mt-0 sm:w-auto">
            {t('landing.cta2')}
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-[13px] text-muted sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="inline-flex items-center gap-1.5 font-bold text-ink">
              <Icon name="shield" size={16} />
              {t('landing.raast')}
            </span>
            <span>{t('landing.pilot')}</span>
          </div>
          <div className="flex gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="scale" size={16} />
              {t('landing.scale')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="tag" size={16} />
              {t('landing.pricing')}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
