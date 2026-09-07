'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/authz';
import { sendMessageSchema } from '@/lib/validations/message';

export async function sendMessage(formData: FormData) {
  const user = await requireAuth();

  const raw = Object.fromEntries(formData.entries());
  const parsed = sendMessageSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(', ') };

  const { conversationId, recipientId, text, relatedRefType, relatedRefId } = parsed.data;

  let conversation = conversationId
    ? await prisma.conversation.findUnique({ where: { id: conversationId } })
    : null;

  if (!conversation && recipientId) {
    const existing = await prisma.conversation.findFirst({
      where: {
        OR: [
          { userAId: user.id, userBId: recipientId },
          { userAId: recipientId, userBId: user.id },
        ],
      },
    });

    if (existing) {
      conversation = existing;
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userAId: user.id,
          userBId: recipientId,
          relatedRefType: relatedRefType || null,
          relatedRefId: relatedRefId || null,
        },
      });
    }
  }

  if (!conversation) return { error: 'Conversation not found' };

  const isParticipant = conversation.userAId === user.id || conversation.userBId === user.id;
  if (!isParticipant) return { error: 'You are not a participant in this conversation' };

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: user.id,
      text,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  const recipientIdToNotify =
    conversation.userAId === user.id ? conversation.userBId : conversation.userAId;

  await prisma.notification.create({
    data: {
      userId: recipientIdToNotify,
      type: 'INFO',
      title: 'New message',
      message: `${user.name}: ${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`,
      link: `/messages/${conversation.id}`,
    },
  });

  revalidatePath('/messages');
  revalidatePath(`/messages/${conversation.id}`);

  return { success: true, messageId: message.id, conversationId: conversation.id };
}

export async function markConversationRead(formData: FormData) {
  const user = await requireAuth();

  const conversationId = formData.get('conversationId') as string;
  if (!conversationId) return { error: 'Conversation is required' };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) return { error: 'Conversation not found' };

  const isParticipant = conversation.userAId === user.id || conversation.userBId === user.id;
  if (!isParticipant) return { error: 'Forbidden' };

  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: user.id },
      isRead: false,
    },
    data: { isRead: true },
  });

  revalidatePath('/messages');
  revalidatePath(`/messages/${conversationId}`);

  return { success: true };
}
