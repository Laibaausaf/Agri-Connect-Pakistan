'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/authz';
import { markNotificationsReadSchema } from '@/lib/validations/notification';

export async function markNotificationsRead(formData: FormData) {
  const user = await requireAuth();

  const rawIds = formData.getAll('notificationId') as string[];
  const parsed = markNotificationsReadSchema.safeParse({ notificationIds: rawIds });
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(', ') };

  const { notificationIds } = parsed.data;

  await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      userId: user.id,
      isRead: false,
    },
    data: { isRead: true },
  });

  revalidatePath('/');
  revalidatePath('/notifications');

  return { success: true };
}

export async function markAllNotificationsRead() {
  const user = await requireAuth();

  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      isRead: false,
    },
    data: { isRead: true },
  });

  revalidatePath('/');
  revalidatePath('/notifications');

  return { success: true };
}
