import { z } from 'zod';

const optionalText = (max = 120) => z.string().trim().max(max).optional();

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  phone: z.string().trim().max(20).optional(),
  location: optionalText(),

  // Farmer
  businessName: optionalText(),
  village: optionalText(),
  farmAreaAcres: z.coerce.number().nonnegative().optional(),

  // Arhti
  licenseNumber: optionalText(60),

  // Vendor
  warehouseCity: optionalText(60),
  warehouseAddress: optionalText(200),
  minOrderKg: z.coerce.number().positive().optional(),

  // Shopkeeper
  shopName: optionalText(80),
  shopAddress: optionalText(200),
  city: optionalText(60),
  opensAt: optionalText(10),
  closesAt: optionalText(10),
  deliveryRadiusKm: z.coerce.number().positive().max(50).optional(),

  // Consumer
  deliveryAddress: optionalText(300),
  preferredCity: optionalText(60),
  householdSize: z.coerce.number().int().min(1).max(30).optional(),
});
