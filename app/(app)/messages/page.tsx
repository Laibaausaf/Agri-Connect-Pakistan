import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { MessageSquare, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

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
    <div className="max-w-3xl mx-auto">
      <Link
        href="/for-you"
        className="inline-flex items-center gap-1 text-xs font-medium text-[#636E72] hover:text-agri-900 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
      </Link>

      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h1 className="text-lg font-bold text-charcoal flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-agri-900" /> Messages
          </h1>
          <span className="text-[11px] text-[#636E72]">{conversations.length} conversations</span>
        </div>

        {enriched.length === 0 && (
          <div className="p-8 text-center text-sm text-[#636E72]">
            No messages yet. Start a conversation from an order or lot page.
          </div>
        )}

        <div className="divide-y divide-[#E5E7EB]">
          {enriched.map((c) => (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className="flex items-center gap-3 p-4 hover:bg-[#F8F9F5] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-agri-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {c.other.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-charcoal text-sm truncate">{c.other.name}</span>
                  {c.lastMessage && (
                    <span className="text-[10px] text-[#636E72]">
                      {new Date(c.lastMessage.createdAt).toLocaleDateString('en-PK')}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-[#636E72] truncate">
                    {c.lastMessage ? c.lastMessage.text : 'No messages yet'}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="ml-2 bg-agri-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
