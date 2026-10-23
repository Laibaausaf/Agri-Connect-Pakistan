import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { sendMessage, markConversationRead } from '@/lib/actions/message';
import { getI18n } from '@/lib/i18n/server';
import Icon from '@/components/ui/Icon';
import { initialsOf } from '@/lib/initials';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const { t, role, time } = await getI18n();

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      userA: true,
      userB: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!conversation) notFound();

  const isParticipant = conversation.userAId === userId || conversation.userBId === userId;
  if (!isParticipant) redirect('/messages');

  const other = conversation.userAId === userId ? conversation.userB : conversation.userA;

  await prisma.message.updateMany({
    where: {
      conversationId: id,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return (
    <div className="mx-auto flex h-[calc(100dvh-15rem)] min-h-[480px] max-w-3xl flex-col lg:h-[calc(100vh-10rem)]">
      <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
        <Link href="/messages" className="inline-flex min-h-12 items-center gap-1.5 text-[15px] font-bold">
          <Icon name="arrowleft" size={20} />
          {t('common.back')}
        </Link>
        <span className="h-11 w-11 shrink-0 rounded-full bg-sage text-center text-sm font-extrabold leading-[44px] text-forest" dir="ltr">
          {initialsOf(other.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[17px] font-bold">{other.name}</div>
          <div className="text-[13px] text-muted">{role(other.role)}</div>
        </div>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-paper p-4">
          {conversation.messages.length === 0 && <div className="py-8 text-center text-sm text-muted">{t('conversation.empty')}</div>}
          {conversation.messages.map((m) => {
            const isMe = m.senderId === userId;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[82%]">
                  {/* Message text is typed by people and shown as written. */}
                  <div
                    dir="auto"
                    className={`rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed ${
                      isMe ? 'rounded-ee-md bg-forest text-paper' : 'rounded-es-md border border-line bg-sf text-ink'
                    }`}
                  >
                    {m.text}
                  </div>
                  <div className={`mt-1 text-xs text-muted ${isMe ? 'text-end' : ''}`}>
                    {time(m.createdAt, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <form
          action={sendMessage as unknown as (formData: FormData) => Promise<void>}
          className="flex items-center gap-2 border-t border-line bg-sf p-3"
        >
          <input type="hidden" name="conversationId" value={conversation.id} />
          <input type="text" name="text" placeholder={t('conversation.placeholder')} required autoComplete="off" className="field-input flex-1 bg-paper" />
          <button type="submit" className="btn btn-primary min-h-[52px] shrink-0 px-5" aria-label={t('conversation.send')}>
            <Icon name="send" size={20} />
            <span className="hidden sm:inline">{t('conversation.send')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
