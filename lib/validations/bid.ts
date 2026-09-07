import { z } from 'zod';

export const placeBidSchema = z.object({
  auctionId: z.string().min(1, 'Auction is required'),
  amountPerKg: z.coerce.number().positive('Bid amount must be greater than 0'),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
