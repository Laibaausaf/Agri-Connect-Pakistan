'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserRole } from '@prisma/client';
import {
  Sprout,
  MapPin,
  Mic,
  Bell,
  ChevronDown,
  ShieldCheck,
  Radio,
  X,
  LogOut,
} from 'lucide-react';
import { SessionUser } from '@/lib/authz';
import { can, ROLE_HOME } from '@/lib/permissions';
import { markNotificationsRead, markAllNotificationsRead } from '@/lib/actions/notification';
import { logout } from '@/lib/actions/auth';
import { Notification } from '@prisma/client';
import { useI18n } from '@/components/i18n/LanguageProvider';
import LanguageToggle from '@/components/layout/LanguageToggle';

type HeaderProps = {
  user: SessionUser;
  notifications: Notification[];
  unreadNotifications: number;
  /** Where the user's produce actually is: mandi for trade roles, city for admin. */
  contextLabel: string;
  contextDetail?: string;
};

const roleEmoji: Record<UserRole, string> = {
  FARMER: '🌾',
  ARHTI: '🤝',
  VENDOR: '🏢',
  SHOPKEEPER: '🛒',
  CONSUMER: '🧺',
  ADMIN: '⚖️',
};

export default function Header({
  user,
  notifications,
  unreadNotifications,
  contextLabel,
  contextDetail,
}: HeaderProps) {
  const { t, role, dateTime, isUrdu } = useI18n();
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const showAi = can(user.role, 'shared.ai');

  return (
    <header className="sticky top-0 z-30 bg-white text-charcoal border-b border-[#E5E7EB] shadow-sm">
      {/* Micro banner */}
      <div className="bg-[#E8F3EE] text-agri-900 px-4 py-1.5 text-xs font-medium flex items-center justify-between border-b border-[#B7D4C8]">
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
          <span className="inline-flex items-center gap-1.5 bg-agri-900 text-white px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase">
            <Radio className="w-3 h-3 text-emerald-300 animate-pulse" /> {t('header.raast')}
          </span>
          <span className="hidden sm:inline text-charcoal">{t('header.bannerLong')}</span>
          <span className="sm:hidden text-charcoal">{t('header.bannerShort')}</span>
        </div>
      </div>

      {/* App bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href={ROLE_HOME[user.role]} className="flex items-center gap-2.5 text-start group focus:outline-none">
            <div className="w-9 h-9 rounded-lg bg-agri-900 text-white flex items-center justify-center font-bold text-lg shadow-xs group-hover:bg-agri-800 transition-colors">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-agri-900 group-hover:text-agri-800 transition-colors">
                  {t('header.brand')}
                </span>
              </div>
              <p className={`text-[11px] text-[#636E72] tracking-tight hidden sm:block ${isUrdu ? '' : 'font-mono'}`}>
                {t('header.workspace', { role: role(user.role) })}
              </p>
            </div>
          </Link>

          {/* Location / mandi context */}
          <div className="ms-2 hidden lg:flex items-center gap-2 bg-[#F2F4F7] px-3 py-1.5 rounded-lg text-xs text-[#636E72] border border-[#E5E7EB]">
            <MapPin className="w-3.5 h-3.5 text-agri-900 shrink-0" />
            <span className="font-medium text-charcoal truncate max-w-[170px]">{contextLabel}</span>
            {contextDetail && (
              <span className="text-[10px] bg-white text-agri-900 border border-[#E5E7EB] px-1.5 py-0.5 rounded font-medium">
                {contextDetail}
              </span>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle />

          {showAi && (
            <Link
              href="/ai-assistant"
              className="flex items-center gap-1.5 bg-agri-900 hover:bg-agri-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              <Mic className="w-4 h-4 text-emerald-200" />
              <span className="hidden sm:inline">{t('header.voiceAi')}</span>
              <span className="sm:hidden">{t('header.ai')}</span>
            </Link>
          )}

          {/* Account */}
          <div className="relative">
            <button
              onClick={() => setAccountOpen(!accountOpen)}
              className="flex items-center gap-2 bg-[#F8F9F5] hover:bg-[#E8F3EE] text-charcoal px-3 py-1.5 rounded-lg text-xs border border-[#E5E7EB] transition-colors"
              aria-expanded={accountOpen}
            >
              <span className="text-sm">{roleEmoji[user.role]}</span>
              <div className="text-start hidden md:block">
                <div className="font-semibold text-charcoal leading-tight flex items-center gap-1">
                  {user.name}
                  <ShieldCheck className="w-3.5 h-3.5 text-agri-900" />
                </div>
                <div className="text-[10px] text-agri-900 font-bold uppercase tracking-wider leading-tight">
                  {role(user.role)}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#636E72] ms-0.5" />
            </button>

            {accountOpen && (
              <div className="absolute end-0 mt-2 w-64 bg-white border border-[#E5E7EB] rounded-xl shadow-xl p-3 z-50 text-charcoal animate-fade-in">
                <div className="p-2.5 bg-[#F8F9F5] rounded-lg border border-[#E5E7EB] mb-2.5">
                  <div className="font-bold text-sm text-charcoal flex items-center justify-between">
                    <span>{user.name}</span>
                    <span className="text-[10px] bg-[#E8F3EE] text-agri-900 font-semibold px-2 py-0.5 rounded border border-[#B7D4C8]">
                      {role(user.role)}
                    </span>
                  </div>
                  <div className="text-xs text-[#636E72] mt-0.5">{user.email}</div>
                </div>

                <Link
                  href="/profile"
                  className="w-full text-center block py-1.5 text-xs text-charcoal hover:bg-[#F8F9F5] rounded-lg font-medium mb-1"
                >
                  {t('header.myProfile')}
                </Link>

                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full text-center py-1.5 text-xs text-rose-700 hover:bg-rose-50 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {t('header.logout')}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-lg bg-[#F8F9F5] hover:bg-[#E8F3EE] text-charcoal border border-[#E5E7EB] relative transition-colors"
              title={t('header.notifications')}
            >
              <Bell className="w-4 h-4 text-[#636E72]" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 end-1 w-2 h-2 bg-agri-900 rounded-full animate-ping" />
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute end-0 mt-2 w-80 bg-white border border-[#E5E7EB] rounded-xl shadow-xl p-3 z-50 text-charcoal max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#636E72]">
                    {t('header.notificationsCount', { count: unreadNotifications })}
                  </span>
                  <div className="flex items-center gap-2">
                    {unreadNotifications > 0 && (
                      <form
                        action={markAllNotificationsRead as unknown as () => Promise<void>}
                        className="inline"
                      >
                        <button
                          type="submit"
                          className="text-[10px] text-agri-900 hover:underline font-medium"
                        >
                          {t('header.markAllRead')}
                        </button>
                      </form>
                    )}
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-[#636E72] hover:text-charcoal"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 space-y-2">
                  {notifications.length === 0 && (
                    <div className="text-center py-6 text-xs text-[#636E72]">
                      {t('header.noNotifications')}
                    </div>
                  )}
                  {/* Titles and messages arrive already translated by the
                      layout where they match a known template. */}
                  {notifications.map((n) => (
                    <form
                      key={n.id}
                      action={markNotificationsRead as unknown as () => Promise<void>}
                      className="block"
                    >
                      <input type="hidden" name="notificationId" value={n.id} />
                      <button
                        type="submit"
                        className={`w-full text-start p-2.5 rounded-lg transition-colors ${
                          n.isRead ? 'bg-white' : 'bg-[#F8F9F5]'
                        } hover:bg-[#E8F3EE]`}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                              n.isRead ? 'bg-[#E5E7EB]' : 'bg-agri-900'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-charcoal truncate">
                              {n.title}
                            </div>
                            <div className="text-[11px] text-[#636E72] line-clamp-2">{n.message}</div>
                            <div className="text-[9px] text-[#636E72] mt-0.5">
                              {dateTime(n.createdAt)}
                            </div>
                          </div>
                        </div>
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
