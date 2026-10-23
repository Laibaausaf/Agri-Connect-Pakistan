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
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[1fr_1.05fr]">
      {/* Brand panel: a band on phones, a full side on desktop */}
      <aside className="relative bg-brand text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <BrandGlow />
        <div className="relative flex items-center justify-between gap-2 px-4 pt-3 lg:hidden">
          <Link href="/" className="inline-flex h-12 items-center gap-1.5 rounded-xl px-2 text-[15px] font-bold hover:bg-white/10">
            <Icon name="arrowleft" size={20} />
            {t('login.backHome')}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle compact />
            <ThemeToggle compact />
          </div>
        </div>
        <Link href="/" className="relative flex flex-col items-center gap-2 pb-12 pt-5 lg:flex-row lg:gap-3 lg:p-0">
          <span className="inline-flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-gold text-ongold lg:h-12 lg:w-12 lg:rounded-[14px]">
            <Icon name="sprout" size={30} />
          </span>
          <span className="text-[22px] font-extrabold">{t('header.brand')}</span>
        </Link>
        <div className="relative hidden lg:block">
          <p className="font-display h-page max-w-md font-semibold">{t('login.side')}</p>
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-[#D6E6D9]">
            <Icon name="shield" size={16} />
            {t('login.sideSub')}
          </p>
        </div>
      </aside>

      <main className="relative -mt-8 px-4 pb-10 lg:mt-0 lg:flex lg:flex-col lg:px-12 lg:py-8">
        <div className="hidden items-center justify-between lg:flex">
          <Link href="/" className="inline-flex h-12 items-center gap-1.5 rounded-xl px-2 text-[15px] font-bold hover:bg-sage">
            <Icon name="arrowleft" size={20} />
            {t('login.backHome')}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle compact tone="paper" />
            <ThemeToggle compact tone="paper" />
          </div>
        </div>

        <div className="card ac-up mx-auto w-full max-w-md p-5 sm:p-7 lg:my-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <h1 className="font-display h-page text-center font-semibold lg:text-start">{t('login.welcome')}</h1>
          <p className="mt-1.5 text-center text-muted lg:text-start">{t('login.sub')}</p>

          {error && (
            <div role="alert" className="ac-shake mt-5 flex items-start gap-2.5 rounded-2xl bg-err-bg p-3.5 text-sm font-bold text-err-fg">
              <Icon name="alert" size={18} className="mt-0.5" />
              {ERROR_KEYS[error] ? t(ERROR_KEYS[error]) : error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
                <Icon name="mail" size={16} />
                {t('login.email')}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input bg-paper"
                dir="ltr"
                autoComplete="username"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
                <Icon name="lock" size={16} />
                {t('login.password')}
              </span>
              <span className="relative block" dir="ltr">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input bg-paper pe-28"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={t(showPassword ? 'login.hideAria' : 'login.showAria')}
                  aria-pressed={showPassword}
                  className="absolute end-1.5 top-1/2 inline-flex h-10 -translate-y-1/2 items-center gap-1.5 rounded-[10px] bg-sage px-3 text-[13px] font-bold"
                >
                  <Icon name="eye" size={16} />
                  {t(showPassword ? 'login.hide' : 'login.show')}
                </button>
              </span>
            </label>
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              <Icon name={loading ? 'refresh' : 'lock'} size={20} className={loading ? 'animate-spin' : ''} />
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          <div className="mt-6 border-t border-line pt-5">
            <p className="text-center text-sm text-muted">
              {t('login.demo')} <span className="font-bold text-ink" dir="ltr">demo123</span>
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={t('login.demoAria')}>
              {DEMO_ACCOUNTS.map((account) => {
                const selected = email === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => setEmail(account.email)}
                    aria-pressed={selected}
                    className={`ac-press flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[13px] font-bold ${
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
