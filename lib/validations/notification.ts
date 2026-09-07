import { z } from 'zod';

export const markNotificationsReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1, 'At least one notification is required'),
});
