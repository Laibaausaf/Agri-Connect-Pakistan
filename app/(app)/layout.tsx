import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Noto_Nastaliq_Urdu } from 'next/font/google';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Header from '@/components/layout/Header';
import ConsumerHeader from '@/components/layout/ConsumerHeader';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import { LanguageProvider } from '@/components/i18n/LanguageProvider';
import { loadNavBadges } from '@/lib/navBadges';
import { getI18n } from '@/lib/i18n/server';

// Urdu font for Urdu mode, downloaded at build time and served by the app.
const urduFont = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-urdu',
  display: 'swap',
});

// Browser tab title in the chosen language (English keeps the root title).
export async function generateMetadata(): Promise<Metadata> {
  const { isUrdu, t } = await getI18n();
  return isUrdu ? { title: t('meta.title'), description: t('meta.description') } : {};
}

const AI_HINT_ROLES: UserRole[] = [UserRole.FARMER, UserRole.ARHTI, UserRole.VENDOR, UserRole.SHOPKEEPER];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      location: true,
      avatarUrl: true,
      arhtiProfile: { select: { mandi: { select: { name: true, city: true } } } },
      consumerProfile: { select: { deliveryAddress: true, preferredCity: true } },
    },
  });

  if (!user) {
    redirect('/login');
  }

  const role = user.role;
  const badges = await loadNavBadges(user.id, role);
  const i18n = await getI18n();

  // Urdu mode: right-to-left layout and the Urdu font for everything inside.
  const wrap = (content: React.ReactNode) => (
    <LanguageProvider lang={i18n.lang}>
      <div
        lang={i18n.lang}
        dir={i18n.dir}
        className={i18n.isUrdu ? `${urduFont.variable} urdu-mode` : undefined}
      >
        {content}
      </div>
    </LanguageProvider>
  );

  if (role === UserRole.CONSUMER) {
    const address = user.consumerProfile?.deliveryAddress;
    const city = user.consumerProfile?.preferredCity ?? user.location ?? 'Islamabad';
    return wrap(
      <div className="min-h-screen bg-surface flex flex-col">
        <ConsumerHeader name={user.name} location={address ? `${address}` : i18n.place(city)} />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 pb-24">{children}</main>
        <MobileNav role={role} badges={badges} />
      </div>
    );
  }

  const [unreadNotifications, storedNotifications, crops] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    i18n.isUrdu ? prisma.crop.findMany({ select: { name: true, nameUrdu: true } }) : Promise.resolve([]),
  ]);

  // Notifications are stored in English; in Urdu mode the known templates are
  // translated for display only (see STORED_TEXT_TEMPLATES).
  const cropNames = Object.fromEntries(
    crops.filter((c) => c.nameUrdu).map((c) => [c.name, c.nameUrdu as string])
  );
  const notifications = storedNotifications.map((n) => ({
    ...n,
    title: i18n.storedText(n.title, cropNames),
    message: i18n.storedText(n.message, cropNames),
  }));

  const mandi = user.arhtiProfile?.mandi;
  const contextLabel = mandi
    ? i18n.place(mandi.name.split('(')[0].trim())
    : user.location
      ? i18n.place(user.location)
      : i18n.t('header.pilotNetwork');
  const contextDetail = mandi?.city ? i18n.place(mandi.city) : undefined;

  return wrap(
    <div className="min-h-screen bg-surface flex flex-col">
      <Header
        user={{
          id: user.id,
          email: user.email,
          name: user.name,
          role,
          image: user.avatarUrl,
        }}
        notifications={notifications}
        unreadNotifications={unreadNotifications}
        contextLabel={contextLabel}
        contextDetail={contextDetail}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          role={role}
          badges={badges}
          userName={user.name}
          userCity={user.location ? i18n.place(user.location) : null}
          aiHint={AI_HINT_ROLES.includes(role) ? i18n.t(`aiHint.${role}` as 'aiHint.FARMER') : undefined}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">{children}</main>
      </div>
      <MobileNav role={role} badges={badges} />
    </div>
  );
}
