import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getI18n } from '@/lib/i18n/server';
import Icon from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/kit';
import { initialsOf } from '@/lib/initials';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const { t, date, role } = await getI18n();

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: {
      userA: true,
      userB: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: 'desc' },
  });

  const enriched = conversations.map((c) => {
    const other = c.userAId === userId ? c.userB : c.userA;
    const lastMessage = c.messages[0];
    const unreadCount = 0; // computed below
    return { ...c, other, lastMessage, unreadCount };
  });

  const unreadCounts = await Promise.all(
    conversations.map((c) =>
      prisma.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: userId },
          isRead: false,
        },
      })
    )
  );

  enriched.forEach((c, i) => {
    c.unreadCount = unreadCounts[i];
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/for-you" className="mb-2 inline-flex min-h-12 items-center gap-1.5 text-[15px] font-bold">
        <Icon name="arrowleft" size={20} />
        {t('messages.back')}
      </Link>
      <PageHeader title={t('messages.title')} subtitle={t('messages.count', { count: conversations.length })} />

      {enriched.length === 0 ? (
        <div className="rounded-card border-[1.5px] border-dashed border-line bg-sf px-6 py-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage text-forest">
            <Icon name="message" size={28} />
          </span>
          <p className="mt-4 text-[15px] text-muted">{t('messages.empty')}</p>
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {enriched.map((c) => (
            <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-sage">
              <span className="h-12 w-12 shrink-0 rounded-full bg-sage text-center text-base font-extrabold leading-[48px] text-forest" dir="ltr">
                {initialsOf(c.other.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-bold">{c.other.name}</span>
                  {c.lastMessage && <span className="shrink-0 text-[13px] text-muted">{date(c.lastMessage.createdAt)}</span>}
                </div>
                <div className="text-[13px] font-semibold text-muted">{role(c.other.role)}</div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  {/* Message text is typed by people and shown as written. */}
                  <span className={`truncate text-sm ${c.unreadCount > 0 ? 'font-bold text-ink' : 'text-muted'}`}>
                    {c.lastMessage ? c.lastMessage.text : t('messages.noMessages')}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="tabular h-6 min-w-6 shrink-0 rounded-full bg-gold px-1.5 text-center text-xs font-extrabold leading-6 text-ongold">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
