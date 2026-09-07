import { z } from 'zod';

export const resetDemoSchema = z.object({
  confirm: z.literal('RESET'),
});
