import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { sendMessage, markConversationRead } from '@/lib/actions/message';
import { ArrowLeft, Send } from 'lucide-react';
import { getI18n } from '@/lib/i18n/server';

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
    <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/messages"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#636E72] hover:text-agri-900"
        >
          <ArrowLeft className="w-3.5 h-3.5 rtl:-scale-x-100" /> {t('common.back')}
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-agri-900 text-white flex items-center justify-center text-[10px] font-bold">
            {other.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-charcoal">{other.name}</div>
            <div className="text-[10px] text-[#636E72]">{role(other.role)}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {conversation.messages.length === 0 && (
            <div className="text-center text-xs text-[#636E72] py-8">
              {t('conversation.empty')}
            </div>
          )}
          {conversation.messages.map((m) => {
            const isMe = m.senderId === userId;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                    isMe
                      ? 'bg-agri-900 text-white rounded-ee-none'
                      : 'bg-[#F2F4F7] text-charcoal rounded-es-none'
                  }`}
                >
                  {m.text}
                  <div
                    className={`text-[9px] mt-1 ${isMe ? 'text-emerald-200' : 'text-[#636E72]'}`}
                  >
                    {time(m.createdAt, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <form
          action={sendMessage as unknown as (formData: FormData) => Promise<void>}
          className="p-3 border-t border-[#E5E7EB] bg-[#F8F9F5] flex items-center gap-2"
        >
          <input type="hidden" name="conversationId" value={conversation.id} />
          <input
            type="text"
            name="text"
            placeholder={t('conversation.placeholder')}
            required
            autoComplete="off"
            className="flex-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-agri-500 bg-white"
          />
          <button
            type="submit"
            className="bg-agri-900 hover:bg-agri-800 text-white p-2 rounded-lg transition-colors"
            aria-label={t('conversation.send')}
          >
            <Send className="w-4 h-4 rtl:-scale-x-100" />
          </button>
        </form>
      </div>
    </div>
  );
}
