import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Header from '@/components/layout/Header';
import ConsumerHeader from '@/components/layout/ConsumerHeader';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import { loadNavBadges } from '@/lib/navBadges';

const AI_HINTS: Partial<Record<UserRole, string>> = {
  FARMER: 'Ask “Aaj tamatar ka bhao kya hai?” before you accept an arhti offer.',
  ARHTI: 'Ask which lots are worth auctioning today and at what reserve.',
  VENDOR: 'Ask for the wholesale margin on your current warehouse stock.',
  SHOPKEEPER: 'Ask which crop is selling fastest in your locality this week.',
};

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

  if (role === UserRole.CONSUMER) {
    const address = user.consumerProfile?.deliveryAddress;
    const city = user.consumerProfile?.preferredCity ?? user.location ?? 'Islamabad';
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <ConsumerHeader name={user.name} location={address ? `${address}` : city} />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 pb-24">{children}</main>
        <MobileNav role={role} badges={badges} />
      </div>
    );
  }

  const [unreadNotifications, notifications] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const mandi = user.arhtiProfile?.mandi;
  const contextLabel = mandi ? mandi.name.split('(')[0].trim() : user.location ?? 'Pakistan Pilot Network';
  const contextDetail = mandi?.city ?? undefined;

  return (
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
          userCity={user.location}
          aiHint={AI_HINTS[role]}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">{children}</main>
      </div>
      <MobileNav role={role} badges={badges} />
    </div>
  );
}
