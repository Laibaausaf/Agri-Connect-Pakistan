'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/LanguageProvider';
import LanguageToggle from '@/components/layout/LanguageToggle';
import ThemeToggle from '@/components/layout/ThemeToggle';
import BrandGlow from '@/components/ui/BrandGlow';
import Icon, { type IconName } from '@/components/ui/Icon';
import type { UiKey } from '@/lib/i18n/translations';

const DEMO_ACCOUNTS: { label: UiKey; email: string; icon: IconName }[] = [
  { label: 'login.demo.FARMER', email: 'farmer@demo.pk', icon: 'sprout' },
  { label: 'login.demo.ARHTI', email: 'arhti@demo.pk', icon: 'scale' },
  { label: 'login.demo.VENDOR', email: 'vendor@demo.pk', icon: 'gavel' },
  { label: 'login.demo.SHOPKEEPER', email: 'shopkeeper@demo.pk', icon: 'store' },
  { label: 'login.demo.CONSUMER', email: 'consumer@demo.pk', icon: 'cart' },
  { label: 'login.demo.ADMIN', email: 'admin@demo.pk', icon: 'shield' },
];

// Sign-in errors are set in English below and shown in the chosen language.
const ERROR_KEYS: Record<string, UiKey> = {
  'Invalid email or password. Try a demo account.': 'login.invalid',
  'Unable to sign in right now. Please try again.': 'login.unavailable',
};

export default function LoginPage() {
  const [email, setEmail] = useState('farmer@demo.pk');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const requestedPath = new URLSearchParams(window.location.search).get('callbackUrl');
      const redirectTo =
        requestedPath && requestedPath.startsWith('/') && !requestedPath.startsWith('//')
          ? requestedPath
          : '/for-you';

      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        redirectTo,
      });

      if (!result?.ok || result.error) {
        setError('Invalid email or password. Try a demo account.');
        return;
      }

      router.replace(result.url || redirectTo);
      router.refresh();
    } catch {
      setError('Unable to sign in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-2">
      {/* Brand panel: a band on phones, a full side on desktop, over the fields illustration */}
      <aside className="relative overflow-hidden bg-brand px-4 pb-16 pt-3.5 text-white lg:flex lg:flex-col lg:justify-between lg:px-14 lg:pb-12 lg:pt-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illustrations/fields.svg"
          alt=""
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-40 w-full object-cover opacity-[.85] lg:inset-0 lg:h-full lg:opacity-100"
        />
        <div aria-hidden="true" className="absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(10,40,29,.55),rgba(10,40,29,.1)_50%,rgba(10,40,29,.7))] lg:block" />

        <div className="relative flex items-center gap-2 lg:hidden">
          <Link href="/" className="inline-flex h-11 items-center gap-1 px-1.5 text-sm font-bold">
            <Icon name="arrowleft" size={20} />
            {t('login.home')}
          </Link>
          <span className="flex-1" />
          <LanguageToggle compact />
          <ThemeToggle compact />
        </div>

        <Link href="/" className="relative flex flex-col items-center gap-2.5 pt-7 text-center lg:flex-row lg:gap-3 lg:pt-0">
          <span className="inline-flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-gold text-ongold lg:h-12 lg:w-12 lg:rounded-[14px]">
            <Icon name="sprout" size={30} />
          </span>
          <span className="text-xl font-extrabold leading-none lg:text-[22px]">{t('header.brand')}</span>
        </Link>

        <div className="relative hidden max-w-[520px] flex-col gap-4 lg:flex">
          <p className="font-display h-display font-semibold">{t('login.side')}</p>
          <p className="flex items-center gap-2.5 text-[15px] font-bold text-sage">
            <Icon name="shield" size={18} />
            {t('login.sideSub')}
          </p>
        </div>
      </aside>

      <main className="relative flex flex-col px-4 pb-10 lg:px-[72px] lg:py-8">
        <div className="hidden items-center gap-2.5 lg:flex">
          <Link href="/" className="inline-flex min-h-12 items-center gap-1.5 text-[15px] font-bold">
            <Icon name="arrowleft" size={20} />
            {t('login.backHome')}
          </Link>
          <span className="flex-1" />
          <LanguageToggle tone="paper" />
          <ThemeToggle tone="paper" />
        </div>

        <div className="ac-up relative mx-auto -mt-10 flex w-full max-w-md flex-col gap-[18px] rounded-[28px] bg-sf px-5 py-[26px] shadow-[0_20px_40px_-24px_rgba(15,61,46,.5)] lg:my-auto lg:max-w-[460px] lg:gap-5 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="flex flex-col gap-1.5 text-center lg:text-start">
            <h1 className="font-display text-[calc(30px*var(--hs))] font-semibold leading-[var(--hl)] lg:text-[calc(40px*var(--hs))]">{t('login.welcome')}</h1>
            <p className="text-[15.5px] text-muted lg:text-base">{t('login.sub')}</p>
          </div>

          {error && (
            <div role="alert" className="ac-shake flex items-start gap-2.5 rounded-2xl bg-err-bg p-3.5 text-[14.5px] font-bold text-err-fg lg:items-center lg:px-4 lg:text-[15px]">
              <Icon name="alert" size={20} className="mt-0.5 lg:mt-0" />
              {ERROR_KEYS[error] ? t(ERROR_KEYS[error]) : error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px] lg:gap-5">
            <label className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[15px] font-bold">
                <Icon name="mail" size={18} />
                {t('login.email')}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input h-14 rounded-2xl bg-paper lg:bg-sf"
                dir="ltr"
                autoComplete="username"
                required
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[15px] font-bold">
                <Icon name="lock" size={18} />
                {t('login.password')}
              </span>
              <span className="relative block" dir="ltr">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input h-14 rounded-2xl bg-paper pe-28 lg:bg-sf"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={t(showPassword ? 'login.hideAria' : 'login.showAria')}
                  aria-pressed={showPassword}
                  className="absolute end-1.5 top-1/2 inline-flex h-11 -translate-y-1/2 items-center gap-1.5 rounded-xl bg-sage px-2.5 text-[13px] font-bold text-ink lg:px-3"
                >
                  <Icon name="eye" size={16} />
                  {t(showPassword ? 'login.hide' : 'login.show')}
                </button>
              </span>
            </label>
            <button type="submit" disabled={loading} className="btn btn-primary h-[58px] w-full rounded-[18px] text-[17px] font-extrabold">
              <Icon name={loading ? 'refresh' : 'lock'} size={20} className={loading ? 'animate-spin' : ''} />
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          <div className="flex flex-col gap-2.5 border-t border-line pt-4">
            <p className="text-center text-sm text-muted lg:text-start">
              {t('login.demo')} <strong className="font-[family-name:var(--font-jakarta)] text-ink" dir="ltr">demo123</strong>
            </p>
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-6" role="group" aria-label={t('login.demoAria')}>
              {DEMO_ACCOUNTS.map((account) => {
                const selected = email === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => setEmail(account.email)}
                    aria-pressed={selected}
                    className={`ac-press flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[13px] font-extrabold lg:rounded-[14px] lg:text-[12.5px] ${
                      selected ? 'bg-forest text-paper' : 'bg-sage text-ink hover:bg-line'
                    }`}
                  >
                    <Icon name={account.icon} size={20} />
                    {t(account.label)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <Link href="/" className="mx-auto mt-6 flex min-h-12 items-center justify-center gap-1.5 text-[15px] font-bold lg:hidden">
          <Icon name="home" size={18} />
          {t('login.backHome')}
        </Link>
      </main>
    </div>
  );
}
