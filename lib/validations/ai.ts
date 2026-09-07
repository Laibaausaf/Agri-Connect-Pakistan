import { z } from 'zod';

export const askAiSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(2000),
});

export const confirmAgentActionSchema = z.object({
  actionId: z.string().min(1),
});
