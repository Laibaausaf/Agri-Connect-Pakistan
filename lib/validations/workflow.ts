import { z } from 'zod';

const kg = z.coerce.number().positive('Quantity must be greater than zero');
const rate = z.coerce.number().positive('Rate must be greater than zero');

export const createCropBatchSchema = z.object({
  cropId: z.string().min(1, 'Select a crop'),
  variety: z.string().optional(),
  quantityKg: kg.max(500000, 'Quantity looks too large'),
  grade: z.string().min(1, 'Select a grade'),
  originVillage: z.string().optional(),
  originCity: z.string().min(2, 'Enter your city or tehsil'),
  originProvince: z.string().min(2, 'Select your province'),
  harvestDate: z.coerce.date(),
  readyDate: z.preprocess((value) => value === '' || value == null ? undefined : value, z.coerce.date().optional()),
  packaging: z.string().optional(),
  askingPricePerKg: z.preprocess((value) => value === '' || value == null ? undefined : value, z.coerce.number().positive().optional()),
  photos: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const archiveBatchSchema = z.object({
  batchId: z.string().min(1),
});

export const createDemandRequestSchema = z.object({
  cropId: z.string().min(1, 'Select a crop'),
  minQuantityKg: kg,
  maxQuantityKg: kg,
  gradeWanted: z.string().optional(),
  preferredOrigins: z.string().optional(),
  targetPriceMin: z.coerce.number().positive().optional(),
  targetPriceMax: z.coerce.number().positive().optional(),
  neededBy: z.coerce.date(),
  transportOffered: z.coerce.boolean().default(true),
  mandiId: z.string().min(1, 'Select the destination mandi'),
  notes: z.string().max(500).optional(),
});

export const createOfferSchema = z.object({
  batchId: z.string().min(1),
  quantityKg: kg,
  pricePerKg: rate,
  destinationMandiId: z.string().min(1, 'Select the destination mandi'),
  transportResponsibility: z.enum(['FARMER', 'ARHTI', 'MUTUAL']),
  proposedPickupAt: z.coerce.date().optional(),
  note: z.string().max(400).optional(),
});

export const respondToOfferSchema = z.object({
  offerId: z.string().min(1),
  decision: z.enum(['ACCEPT', 'REJECT']),
});

export const schedulePickupSchema = z.object({
  dealId: z.string().min(1),
  driverName: z.string().min(2, 'Driver name is required'),
  driverPhone: z.string().min(7, 'Driver phone is required'),
  vehicleType: z.string().optional(),
  vehiclePlate: z.string().optional(),
  scheduledAt: z.coerce.date(),
  estimatedCost: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(300).optional(),
});

export const dealIdSchema = z.object({
  dealId: z.string().min(1),
});

export const receiveProduceSchema = z.object({
  dealId: z.string().min(1),
  receivedQuantityKg: kg,
  verifierName: z.string().min(2, 'Kanta operator name is required'),
});

export const createAuctionSchema = z.object({
  inventoryLotId: z.string().min(1),
  quantityKg: kg,
  reservePrice: rate,
  minimumIncrement: z.coerce.number().positive().default(1),
  durationMinutes: z.coerce.number().int().min(5).max(1440).default(30),
});

export const auctionIdSchema = z.object({
  auctionId: z.string().min(1),
});

export const createVendorOfferSchema = z.object({
  stockId: z.string().min(1),
  offeredQuantityKg: kg,
  pricePerKg: rate,
  minOrderKg: z.coerce.number().positive().default(50),
  deliveryCities: z.string().optional(),
  deliveryEtaHours: z.coerce.number().int().min(1).max(168).default(12),
});

export const purchaseWholesaleSchema = z.object({
  offerId: z.string().min(1),
  quantityKg: kg,
});

export const createRetailListingSchema = z.object({
  stockId: z.string().min(1),
  title: z.string().min(2, 'Give the listing a name'),
  listedQuantityKg: kg,
  pricePerKg: rate,
  packSizeKg: z.coerce.number().positive().default(1),
});

export const placeConsumerOrderSchema = z.object({
  listingId: z.string().min(1),
  quantityKg: kg,
  deliveryAddress: z.string().max(300).optional(),
});

export const updateConsumerOrderSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
});

export const rateShopSchema = z.object({
  orderId: z.string().min(1),
  overallRating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(400).optional(),
});
