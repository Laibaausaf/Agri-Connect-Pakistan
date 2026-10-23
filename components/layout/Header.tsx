'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NotificationType } from '@prisma/client';
import type { Notification } from '@prisma/client';
import { SessionUser } from '@/lib/authz';
import { can, ROLE_HOME } from '@/lib/permissions';
import { markNotificationsRead, markAllNotificationsRead } from '@/lib/actions/notification';
import { logout } from '@/lib/actions/auth';
import { useI18n } from '@/components/i18n/LanguageProvider';
import LanguageToggle from '@/components/layout/LanguageToggle';
import ThemeToggle from '@/components/layout/ThemeToggle';
import Icon, { type IconName } from '@/components/ui/Icon';
import type { UiKey } from '@/lib/i18n/translations';

type HeaderProps = {
  user: SessionUser;
  notifications: Notification[];
  unreadNotifications: number;
  /** Where the user's produce actually is: mandi for trade roles, city for admin. */
  contextLabel: string;
  contextDetail?: string;
};

/** Icon and word for each kind of stored notification. */
const NOTIFICATION_KIND: Record<NotificationType, { icon: IconName; label: UiKey; tone: string }> = {
  NEW_OFFER: { icon: 'tag', label: 'notifKind.offer', tone: 'bg-info-bg text-info-fg' },
  OFFER_ACCEPTED: { icon: 'tag', label: 'notifKind.offer', tone: 'bg-info-bg text-info-fg' },
  OFFER_REJECTED: { icon: 'tag', label: 'notifKind.offer', tone: 'bg-info-bg text-info-fg' },
  PICKUP_SCHEDULED: { icon: 'truck', label: 'notifKind.pickup', tone: 'bg-warn-bg text-warn-fg' },
  PICKUP_CONFIRMED: { icon: 'truck', label: 'notifKind.pickup', tone: 'bg-warn-bg text-warn-fg' },
  PRODUCE_RECEIVED: { icon: 'scale', label: 'notifKind.weighing', tone: 'bg-info-bg text-info-fg' },
  WEIGHT_VERIFICATION: { icon: 'scale', label: 'notifKind.weighing', tone: 'bg-info-bg text-info-fg' },
  NEW_BID: { icon: 'gavel', label: 'notifKind.auction', tone: 'bg-warn-bg text-warn-fg' },
  OUTBID: { icon: 'gavel', label: 'notifKind.auction', tone: 'bg-warn-bg text-warn-fg' },
  AUCTION_ENDING: { icon: 'gavel', label: 'notifKind.auction', tone: 'bg-warn-bg text-warn-fg' },
  AUCTION_WON: { icon: 'gavel', label: 'notifKind.auction', tone: 'bg-warn-bg text-warn-fg' },
  AUCTION_CLOSED: { icon: 'gavel', label: 'notifKind.auction', tone: 'bg-warn-bg text-warn-fg' },
  WHOLESALE_ORDER: { icon: 'cart', label: 'notifKind.order', tone: 'bg-info-bg text-info-fg' },
  RETAIL_ORDER: { icon: 'cart', label: 'notifKind.order', tone: 'bg-info-bg text-info-fg' },
  ORDER_DELIVERED: { icon: 'cart', label: 'notifKind.order', tone: 'bg-ok-bg text-ok-fg' },
  PAYMENT_RECEIVED: { icon: 'banknote', label: 'notifKind.payment', tone: 'bg-ok-bg text-ok-fg' },
  RECEIPT: { icon: 'receipt', label: 'notifKind.payment', tone: 'bg-ok-bg text-ok-fg' },
  RATING_REQUEST: { icon: 'star', label: 'notifKind.rating', tone: 'bg-sage text-forest' },
  INFO: { icon: 'info', label: 'notifKind.info', tone: 'bg-sage text-forest' },
};

export function initialsOf(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

export default function Header({
  user,
  notifications,
  unreadNotifications,
  contextLabel,
  contextDetail,
}: HeaderProps) {
  const { t, nav, role, dateTime } = useI18n();
  const [open, setOpen] = useState<'account' | 'alerts' | null>(null);
  const showAi = can(user.role, 'shared.ai');
  const showMessages = can(user.role, 'shared.messages');
  const initials = initialsOf(user.name);
  const toggle = (panel: 'account' | 'alerts') => setOpen((current) => (current === panel ? null : panel));

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const brand = (size: 'sm' | 'lg') => (
    <Link href={ROLE_HOME[user.role]} aria-label={t('header.homeAria')} className={`flex items-center gap-2.5 ${size === 'sm' ? 'min-w-0' : 'shrink-0'}`}>
      <span
        className={`inline-flex shrink-0 items-center justify-center bg-gold text-ongold ${
          size === 'sm' ? 'h-10 w-10 rounded-xl' : 'h-11 w-11 rounded-[13px]'
        }`}
      >
        <Icon name="sprout" size={size === 'sm' ? 24 : 26} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`whitespace-nowrap font-extrabold leading-tight tracking-tight ${size === 'sm' ? 'text-[17px]' : 'text-[19px]'}`}>
          {t('header.brand')}
        </span>
        <span className="truncate text-xs font-semibold leading-snug text-[#D6E6D9]">
          {size === 'sm' ? role(user.role) : t('header.workspace', { role: role(user.role) })}
        </span>
      </span>
    </Link>
  );

  const alertsButton = (withLabel: boolean) => (
    <button
      type="button"
      onClick={() => toggle('alerts')}
      aria-expanded={open === 'alerts'}
      aria-label={t('header.alertsAria', { count: unreadNotifications })}
      title={t('header.notifications')}
      className="ac-press inline-flex h-12 shrink-0 items-center gap-1.5 rounded-[14px] bg-white/[.12] px-3 text-sm font-bold text-white hover:bg-white/20"
    >
      <Icon name="bell" size={20} />
      {withLabel && <span>{t('header.alerts')}</span>}
      {unreadNotifications > 0 && (
        <span className="tabular min-w-5 rounded-[10px] bg-gold px-1.5 text-center text-xs font-extrabold leading-5 text-ongold">
          {unreadNotifications}
        </span>
      )}
    </button>
  );

  const accountButton = (withName: boolean) => (
    <button
      type="button"
      onClick={() => toggle('account')}
      aria-expanded={open === 'account'}
      aria-label={t('header.accountAria')}
      className={`ac-press inline-flex shrink-0 items-center gap-2 rounded-[14px] bg-white/[.12] text-start text-white hover:bg-white/20 ${
        withName ? 'h-[52px] pe-2.5 ps-1.5' : 'h-12 pe-1.5 ps-1'
      }`}
    >
      <span className="h-10 w-10 rounded-[11px] bg-sage text-center text-sm font-extrabold leading-10 text-forest font-[family-name:var(--font-jakarta)]" dir="ltr">
        {initials}
      </span>
      {withName && (
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1 text-sm font-bold leading-tight">
            {user.name}
            <Icon name="shield" size={14} />
          </span>
          <span className="text-xs font-semibold leading-tight text-[#D6E6D9]">{role(user.role)}</span>
        </span>
      )}
      <Icon name="chevrondown" size={18} />
    </button>
  );

  const location = (compact: boolean) => (
    <span
      className={`flex min-w-0 items-center gap-1.5 rounded-xl border border-white/[.22] text-white ${
        compact ? 'h-11 flex-1 px-2.5 text-[13.5px]' : 'h-11 max-w-[300px] px-3.5 text-sm'
      } font-semibold`}
    >
      <Icon name="pin" size={18} />
      <span className="truncate">{contextLabel}</span>
      {contextDetail && (
        <span className="hidden shrink-0 rounded-md bg-white/[.14] px-1.5 py-0.5 text-[11px] font-bold sm:inline">{contextDetail}</span>
      )}
    </span>
  );

  return (
    <header className="sticky top-0 z-50 bg-brand text-white">
      <BrandGlow />
      {/* Phone: two rows that fit 390px */}
      <div className="relative flex flex-col gap-1.5 px-4 pb-3 pt-2.5 lg:hidden">
        <div className="flex min-h-[52px] items-center gap-2.5">
          <div className="min-w-0 flex-1">{brand('sm')}</div>
          {alertsButton(false)}
          {accountButton(false)}
        </div>
        <div className="flex items-center gap-2">
          {location(true)}
          <LanguageToggle compact />
          <ThemeToggle compact />
        </div>
      </div>

      {/* Desktop: one row */}
      <div className="relative hidden h-[76px] items-center gap-3.5 px-7 lg:flex">
        {brand('lg')}
        <span className="ms-3 min-w-0">{location(false)}</span>
        <span className="hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white/[.12] px-3 py-1.5 text-[12.5px] font-bold 2xl:inline-flex">
          <Icon name="shield" size={16} />
          {t('header.raast')}
        </span>
        <span className="flex-1" />
        <LanguageToggle />
        <ThemeToggle />
        {showAi && (
          <Link
            href="/ai-assistant"
            className="ac-press inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-[13px] border-[1.5px] border-gold px-4 text-sm font-bold text-white hover:bg-white/10"
          >
            <Icon name="mic" size={19} />
            <span>{t('header.voiceAi')}</span>
          </Link>
        )}
        {alertsButton(true)}
        {accountButton(true)}
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label={t('header.close')}
            onClick={() => setOpen(null)}
            className="ac-fade fixed inset-0 top-0 z-40 cursor-default bg-[#0B1A14]/40 lg:bg-transparent"
          />
          <div className="absolute inset-x-2 top-full z-50 mt-2 lg:inset-x-auto lg:end-7 lg:w-[400px]">
            {open === 'alerts' ? (
              <div className="ac-sheet overflow-hidden rounded-[22px] border border-line bg-sf text-ink shadow-card">
                <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <span className="text-[17px] font-extrabold">{t('header.notificationsCount', { count: unreadNotifications })}</span>
                  <div className="flex items-center gap-1">
                    {unreadNotifications > 0 && (
                      <form action={markAllNotificationsRead as unknown as () => Promise<void>}>
                        <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-bold text-forest hover:bg-sage">
                          <Icon name="check" size={16} />
                          {t('header.markAllRead')}
                        </button>
                      </form>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpen(null)}
                      aria-label={t('header.close')}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-sage"
                    >
                      <Icon name="x" size={18} />
                    </button>
                  </div>
                </div>
                <div className="max-h-[65vh] overflow-y-auto">
                  {notifications.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted">{t('header.noNotifications')}</div>
                  )}
                  {/* Titles and messages arrive already translated by the
                      layout where they match a known template. */}
                  {notifications.map((n) => {
                    const kind = NOTIFICATION_KIND[n.type] ?? NOTIFICATION_KIND.INFO;
                    return (
                      <form key={n.id} action={markNotificationsRead as unknown as () => Promise<void>} className="block">
                        <input type="hidden" name="notificationId" value={n.id} />
                        <button
                          type="submit"
                          className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-start transition-colors hover:bg-sage ${
                            n.isRead ? 'bg-sf' : 'bg-paper'
                          }`}
                        >
                          <span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kind.tone}`}>
                            <Icon name={kind.icon} size={20} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-bold leading-snug">{n.title}</span>
                            <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{n.message}</span>
                            <span className="mt-1 block text-[13px] text-muted">
                              <span className="font-bold text-info-fg">{t(kind.label)}</span> · {dateTime(n.createdAt)}
                            </span>
                          </span>
                          {!n.isRead && (
                            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-gold" title={t('header.unread')} />
                          )}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="ac-sheet ms-auto overflow-hidden rounded-[22px] border border-line bg-sf text-ink shadow-card sm:w-[320px]">
                <div className="flex items-center gap-3 border-b border-line p-4">
                  <span className="h-12 w-12 shrink-0 rounded-full bg-gold text-center text-lg font-extrabold leading-[48px] text-ongold font-[family-name:var(--font-jakarta)]" dir="ltr">
                    {initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] font-extrabold">{user.name}</span>
                    <span className="block truncate text-sm text-muted">{role(user.role)}</span>
                    <span className="block truncate text-[13px] text-muted" dir="ltr">
                      {user.email}
                    </span>
                  </span>
                </div>
                <Link href="/profile" onClick={() => setOpen(null)} className="flex h-14 items-center gap-3 border-b border-line px-4 text-base font-semibold hover:bg-sage">
                  <Icon name="user" size={20} />
                  {t('header.myProfile')}
                </Link>
                {showMessages && (
                  <Link href="/messages" onClick={() => setOpen(null)} className="flex h-14 items-center gap-3 border-b border-line px-4 text-base font-semibold hover:bg-sage">
                    <Icon name="message" size={20} />
                    {nav('Messages')}
                  </Link>
                )}
                <form action={logout}>
                  <button type="submit" className="flex h-14 w-full items-center gap-3 px-4 text-base font-bold text-err-fg hover:bg-err-bg">
                    <Icon name="logout" size={20} />
                    {t('header.logout')}
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}

/** The leaf-green glow in the far corner of the gradient (header, heroes). */
export function BrandGlow() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -top-[90px] -end-[70px] h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(46,158,91,.55),rgba(46,158,91,0)_66%)]" />
    </span>
  );
}
