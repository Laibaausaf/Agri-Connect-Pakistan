import { z } from 'zod';

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'Conversation is required').optional(),
  recipientId: z.string().min(1, 'Recipient is required').optional(),
  text: z.string().min(1, 'Message cannot be empty').max(2000, 'Message is too long'),
  relatedRefType: z.string().optional(),
  relatedRefId: z.string().optional(),
});
