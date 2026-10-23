/**
 * Seeds the AgriConnect demo: six roles and two complete ownership chains that
 * run FARMER -> ARHTI -> VENDOR -> SHOPKEEPER -> CONSUMER, plus live in-progress
 * work so every role has a real next decision on login.
 *
 * Quantities are drawn down stage by stage exactly as lib/inventory.ts does at
 * runtime, so no lot is ever both fully available and fully sold.
 */
import {
  AccountStatus,
  AuctionStatus,
  ConsumerOrderStatus,
  CropBatchStatus,
  CropCategory,
  DealStatus,
  DeductionType,
  DeliveryStage,
  DemandStatus,
  InventoryLotStatus,
  NotificationType,
  OfferDirection,
  OfferListingStatus,
  OfferStatus,
  PaymentStatus,
  PrismaClient,
  SaleStatus,
  StockStatus,
  SupplyChainStage,
  TransactionType,
  TransportResponsibility,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo123';

const NOW = new Date();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const daysAhead = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

/** Guards against float drift, same rounding the runtime inventory helpers use. */
const kg = (value: number) => Math.round(value * 1000) / 1000;

async function wipe() {
  // Children before parents; SQLite has no deferred constraint checking.
  await prisma.consumerOrderItem.deleteMany();
  await prisma.consumerOrder.deleteMany();
  await prisma.retailListing.deleteMany();
  await prisma.shopkeeperInventory.deleteMany();
  await prisma.vendorShopkeeperSale.deleteMany();
  await prisma.vendorOffer.deleteMany();
  await prisma.vendorInventory.deleteMany();
  await prisma.arhtiVendorSale.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.arhtiInventoryLot.deleteMany();
  await prisma.deliveryTracking.deleteMany();
  await prisma.pickupRecord.deleteMany();
  await prisma.settlementDeduction.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.farmerArhtiDeal.deleteMany();
  await prisma.farmerArhtiOffer.deleteMany();
  await prisma.arhtiDemandRequest.deleteMany();
  await prisma.supplyChainEvent.deleteMany();
  await prisma.farmerCropBatch.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.paymentRecord.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.agentAction.deleteMany();
  await prisma.agentSession.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.marketPrice.deleteMany();
  await prisma.transportOption.deleteMany();
  await prisma.crop.deleteMany();
  await prisma.farmerProfile.deleteMany();
  await prisma.arhtiProfile.deleteMany();
  await prisma.vendorProfile.deleteMany();
  await prisma.shopkeeperProfile.deleteMany();
  await prisma.consumerProfile.deleteMany();
  await prisma.mandi.deleteMany();
  await prisma.user.deleteMany();
}

type EventInput = {
  batchId: string;
  stage: SupplyChainStage;
  actorId?: string;
  actorRole?: UserRole;
  title: string;
  description: string;
  quantityKg?: number;
  pricePerKg?: number;
  refType?: string;
  refId?: string;
  isConfidential?: boolean;
  at: Date;
};

async function chainEvent(input: EventInput) {
  return prisma.supplyChainEvent.create({
    data: {
      batchId: input.batchId,
      stage: input.stage,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      title: input.title,
      description: input.description,
      quantityKg: input.quantityKg ?? null,
      pricePerKg: input.pricePerKg ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      isConfidential: input.isConfidential ?? false,
      createdAt: input.at,
    },
  });
}

async function main() {
  await wipe();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // -------------------------------------------------------------------------
  // Reference data
  // -------------------------------------------------------------------------

  const islamabad = await prisma.mandi.create({
    data: {
      name: 'Islamabad Sabzi Mandi',
      city: 'Islamabad',
      province: 'Islamabad Capital Territory',
      address: 'Sector I-11/4, Islamabad',
      phone: '051-4444100',
      category: 'Fruit & Vegetable Wholesale',
      operatingHours: '04:00 - 12:00',
      latitude: 33.6469,
      longitude: 73.0169,
      todayVolumeTonnes: 412,
    },
  });

  const lahore = await prisma.mandi.create({
    data: {
      name: 'Badami Bagh Fruit & Vegetable Market',
      city: 'Lahore',
      province: 'Punjab',
      address: 'Badami Bagh, Lahore',
      phone: '042-3771200',
      category: 'Fruit & Vegetable Wholesale',
      operatingHours: '03:30 - 11:30',
      latitude: 31.6,
      longitude: 74.3167,
      todayVolumeTonnes: 738,
    },
  });

  const peshawar = await prisma.mandi.create({
    data: {
      name: 'Peshawar Karkhano Sabzi Mandi',
      city: 'Peshawar',
      province: 'Khyber Pakhtunkhwa',
      category: 'Fruit & Vegetable Wholesale',
      operatingHours: '04:00 - 11:00',
      latitude: 34.0151,
      longitude: 71.5249,
      todayVolumeTonnes: 205,
    },
  });

  const karachi = await prisma.mandi.create({
    data: {
      name: 'Karachi Sabzi Mandi (Super Highway)',
      city: 'Karachi',
      province: 'Sindh',
      category: 'Fruit & Vegetable Wholesale',
      operatingHours: '02:00 - 10:00',
      latitude: 25.0,
      longitude: 67.2,
      todayVolumeTonnes: 1120,
    },
  });

  const tomato = await prisma.crop.create({
    data: {
      name: 'Tomato',
      nameUrdu: 'ٹماٹر',
      category: CropCategory.VEGETABLE,
      varieties: ['Roma', 'Desi Round', 'Hybrid 1359'],
      shelfLifeDays: 7,
      imageUrl: '/crops/tomato.png',
    },
  });

  const potato = await prisma.crop.create({
    data: {
      name: 'Potato',
      nameUrdu: 'آلو',
      category: CropCategory.VEGETABLE,
      varieties: ['Sadaf', 'Lady Rosetta', 'Faisalabad White'],
      shelfLifeDays: 45,
      imageUrl: '/crops/potato.png',
    },
  });

  const onion = await prisma.crop.create({
    data: {
      name: 'Onion',
      nameUrdu: 'پیاز',
      category: CropCategory.VEGETABLE,
      varieties: ['Phulkara', 'Desi Red', 'Nasik Red'],
      shelfLifeDays: 60,
      imageUrl: '/crops/onion.png',
    },
  });

  const wheat = await prisma.crop.create({
    data: {
      name: 'Wheat',
      nameUrdu: 'گندم',
      category: CropCategory.GRAIN,
      varieties: ['Galaxy-13', 'Akbar-19'],
      shelfLifeDays: 300,
    },
  });

  const maize = await prisma.crop.create({
    data: {
      name: 'Maize',
      nameUrdu: 'مکئی',
      category: CropCategory.GRAIN,
      varieties: ['Pioneer 30Y87', 'Desi Yellow'],
      shelfLifeDays: 180,
    },
  });

  const marketPrices: Array<[string, string, number, number, string, number, number, number]> = [
    [tomato.id, islamabad.id, 92, 4.1, 'up', 96, 84, 118],
    [tomato.id, lahore.id, 88, 2.3, 'up', 92, 82, 164],
    [tomato.id, peshawar.id, 79, -1.4, 'down', 84, 76, 61],
    [tomato.id, karachi.id, 96, 0.4, 'stable', 99, 92, 240],
    [potato.id, islamabad.id, 58, -0.8, 'down', 61, 55, 96],
    [potato.id, lahore.id, 55, -1.9, 'down', 58, 52, 210],
    [potato.id, peshawar.id, 52, 0.2, 'stable', 54, 50, 44],
    [potato.id, karachi.id, 62, 1.1, 'up', 64, 59, 188],
    [onion.id, islamabad.id, 81, 3.6, 'up', 85, 76, 74],
    [onion.id, lahore.id, 77, 2.8, 'up', 80, 73, 132],
    [onion.id, peshawar.id, 72, 0.6, 'stable', 75, 70, 38],
    [onion.id, karachi.id, 84, 4.4, 'up', 88, 79, 196],
    [wheat.id, lahore.id, 41, 0.3, 'stable', 42, 40, 320],
    [maize.id, lahore.id, 34, -0.5, 'down', 35, 33, 150],
  ];

  for (const [cropId, mandiId, ratePerKg, changePercent, trend, high, low, arrivals] of marketPrices) {
    await prisma.marketPrice.create({
      data: {
        cropId,
        mandiId,
        ratePerKg,
        changePercent,
        trend,
        high24h: high,
        low24h: low,
        dailyArrivalTonnes: arrivals,
        recordedAt: hoursAgo(3),
      },
    });
  }

  const truck = await prisma.transportOption.create({
    data: {
      driverName: 'Ghafoor Khan',
      driverPhone: '0333-4412907',
      vehicleType: 'Mazda Titan 6-Wheeler',
      vehiclePlate: 'KP-4471',
      capacityKg: 6000,
      currentLocation: 'Swabi, Khyber Pakhtunkhwa',
      latitude: 34.1167,
      longitude: 72.4667,
      estimatedCost: 18000,
      baseRatePerKm: 62,
      rating: 4.7,
      tripsCount: 214,
    },
  });

  const trailer = await prisma.transportOption.create({
    data: {
      driverName: 'Muhammad Sajid',
      driverPhone: '0301-8823440',
      vehicleType: 'Hino 10-Wheeler',
      vehiclePlate: 'LEB-7719',
      capacityKg: 12000,
      currentLocation: 'Okara, Punjab',
      latitude: 30.8081,
      longitude: 73.4534,
      estimatedCost: 24000,
      baseRatePerKm: 55,
      rating: 4.5,
      tripsCount: 389,
    },
  });

  await prisma.transportOption.create({
    data: {
      driverName: 'Imran Bacha',
      driverPhone: '0345-2290166',
      vehicleType: 'Suzuki Ravi Pickup',
      vehiclePlate: 'ICT-2288',
      capacityKg: 800,
      currentLocation: 'Islamabad',
      estimatedCost: 4500,
      baseRatePerKm: 48,
      rating: 4.3,
      tripsCount: 91,
    },
  });

  // -------------------------------------------------------------------------
  // Accounts — exactly one role each
  // -------------------------------------------------------------------------

  const farmer = await prisma.user.create({
    data: {
      email: 'farmer@demo.pk',
      phone: '0301-5551234',
      passwordHash,
      name: 'Zubair Khan',
      role: UserRole.FARMER,
      status: AccountStatus.VERIFIED,
      location: 'Kalu Khan, Swabi, Khyber Pakhtunkhwa',
      latitude: 34.1167,
      longitude: 72.4667,
      farmerProfile: {
        create: {
          businessName: 'Khan Brothers Farm',
          primaryCrops: ['Tomato', 'Onion', 'Potato'],
          farmAreaAcres: 14,
          village: 'Kalu Khan',
          averageRate: 71,
        },
      },
    },
  });

  const farmer2 = await prisma.user.create({
    data: {
      email: 'farmer2@demo.pk',
      phone: '0302-7719044',
      passwordHash,
      name: 'Ghulam Rasool',
      role: UserRole.FARMER,
      status: AccountStatus.VERIFIED,
      location: 'Renala Khurd, Okara, Punjab',
      latitude: 30.8081,
      longitude: 73.4534,
      farmerProfile: {
        create: {
          businessName: 'Rasool Potato Farm',
          primaryCrops: ['Potato', 'Onion', 'Wheat'],
          farmAreaAcres: 32,
          village: 'Renala Khurd',
          averageRate: 44,
        },
      },
    },
  });

  const arhti = await prisma.user.create({
    data: {
      email: 'arhti@demo.pk',
      phone: '0300-4448811',
      passwordHash,
      name: 'Haji Aslam',
      role: UserRole.ARHTI,
      status: AccountStatus.VERIFIED,
      location: 'Sector I-11, Islamabad',
      latitude: 33.6469,
      longitude: 73.0169,
      arhtiProfile: {
        create: {
          businessName: 'Haji Aslam & Sons Commission Shop',
          licenseNumber: 'ICT-ARH-2019-0447',
          mandiId: islamabad.id,
          commissionRate: 0.02,
        },
      },
    },
  });

  const arhti2 = await prisma.user.create({
    data: {
      email: 'arhti2@demo.pk',
      phone: '0321-9902117',
      passwordHash,
      name: 'Malik Tanveer',
      role: UserRole.ARHTI,
      status: AccountStatus.VERIFIED,
      location: 'Badami Bagh, Lahore',
      latitude: 31.6,
      longitude: 74.3167,
      arhtiProfile: {
        create: {
          businessName: 'Tanveer Commission Agency',
          licenseNumber: 'PB-ARH-2016-1188',
          mandiId: lahore.id,
          commissionRate: 0.025,
        },
      },
    },
  });

  const vendor = await prisma.user.create({
    data: {
      email: 'vendor@demo.pk',
      phone: '0333-1122334',
      passwordHash,
      name: 'Bilal Ahmed',
      role: UserRole.VENDOR,
      status: AccountStatus.VERIFIED,
      location: 'I-10 Industrial Area, Islamabad',
      latitude: 33.6531,
      longitude: 73.0479,
      vendorProfile: {
        create: {
          businessName: 'Bilal Traders Wholesale',
          warehouseCity: 'Islamabad',
          warehouseAddress: 'Warehouse 14, I-10/3, Islamabad',
          servesCities: ['Islamabad', 'Rawalpindi', 'Wah Cantt', 'Taxila'],
          minOrderKg: 100,
          rating: 4.6,
        },
      },
    },
  });

  const vendor2 = await prisma.user.create({
    data: {
      email: 'vendor2@demo.pk',
      phone: '0345-6677889',
      passwordHash,
      name: 'Kareem Bakhsh',
      role: UserRole.VENDOR,
      status: AccountStatus.VERIFIED,
      location: 'Dhoke Kala Khan, Rawalpindi',
      latitude: 33.5651,
      longitude: 73.0169,
      vendorProfile: {
        create: {
          businessName: 'Kareem Wholesale Supply',
          warehouseCity: 'Rawalpindi',
          warehouseAddress: 'Godown 6, Pirwadhai, Rawalpindi',
          servesCities: ['Rawalpindi', 'Islamabad', 'Murree'],
          minOrderKg: 150,
          rating: 4.4,
        },
      },
    },
  });

  const shopkeeper = await prisma.user.create({
    data: {
      email: 'shopkeeper@demo.pk',
      phone: '0311-2223344',
      passwordHash,
      name: 'Naveed Iqbal',
      role: UserRole.SHOPKEEPER,
      status: AccountStatus.VERIFIED,
      location: 'G-11 Markaz, Islamabad',
      latitude: 33.6844,
      longitude: 73.0179,
      shopkeeperProfile: {
        create: {
          shopName: 'Green Mart',
          shopAddress: 'Shop 27, G-11 Markaz, Islamabad',
          city: 'Islamabad',
          deliveryRadiusKm: 5,
          avgDeliveryMinutes: 30,
          opensAt: '08:00',
          closesAt: '23:00',
          rating: 5,
          ratingCount: 1,
        },
      },
    },
  });

  const shopkeeper2 = await prisma.user.create({
    data: {
      email: 'shopkeeper2@demo.pk',
      phone: '0313-5566778',
      passwordHash,
      name: 'Sana Yousaf',
      role: UserRole.SHOPKEEPER,
      status: AccountStatus.VERIFIED,
      location: 'F-10 Markaz, Islamabad',
      latitude: 33.6971,
      longitude: 73.0119,
      shopkeeperProfile: {
        create: {
          shopName: 'Fresh Corner',
          shopAddress: 'Shop 4, F-10 Markaz, Islamabad',
          city: 'Islamabad',
          deliveryRadiusKm: 4,
          avgDeliveryMinutes: 40,
          opensAt: '09:00',
          closesAt: '22:00',
        },
      },
    },
  });

  const consumer = await prisma.user.create({
    data: {
      email: 'consumer@demo.pk',
      phone: '0335-9081726',
      passwordHash,
      name: 'Ayesha Siddiqui',
      role: UserRole.CONSUMER,
      status: AccountStatus.VERIFIED,
      location: 'G-11/3, Islamabad',
      latitude: 33.6835,
      longitude: 73.0221,
      consumerProfile: {
        create: {
          deliveryAddress: 'House 214, Street 32, G-11/3, Islamabad',
          preferredCity: 'Islamabad',
          householdSize: 5,
        },
      },
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@demo.pk',
      phone: '051-4444100',
      passwordHash,
      name: 'Mandi Administration',
      role: UserRole.ADMIN,
      status: AccountStatus.VERIFIED,
      location: 'Islamabad Sabzi Mandi, I-11',
    },
  });

  // -------------------------------------------------------------------------
  // CHAIN A — Tomato: Swabi Rs 74 -> Islamabad auction Rs 92 -> wholesale
  //           Rs 104 -> Green Mart retail Rs 145 -> consumer
  // -------------------------------------------------------------------------

  const batchA = await prisma.farmerCropBatch.create({
    data: {
      batchNumber: 'FB-2025-1001',
      cropId: tomato.id,
      farmerId: farmer.id,
      variety: 'Roma',
      quantityKg: 5000,
      availableKg: 0, // fully committed to deal A
      grade: 'A',
      originVillage: 'Kalu Khan',
      originCity: 'Swabi',
      originProvince: 'Khyber Pakhtunkhwa',
      harvestDate: daysAgo(12),
      readyDate: daysAgo(11),
      packaging: '25 kg plastic crates',
      askingPricePerKg: 70,
      photos: ['/crops/tomato.png'],
      notes: 'Hand-picked, uniform ripeness, packed the same evening.',
      status: CropBatchStatus.SOLD_OUT,
      createdAt: daysAgo(12),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.FARMER_HARVEST,
    actorId: farmer.id,
    actorRole: UserRole.FARMER,
    title: 'Harvest recorded',
    description: '5,000 kg Grade A Roma tomato harvested at Kalu Khan, Swabi',
    quantityKg: 5000,
    refType: 'FarmerCropBatch',
    refId: batchA.id,
    at: daysAgo(12),
  });

  const offerA = await prisma.farmerArhtiOffer.create({
    data: {
      batchId: batchA.id,
      arhtiId: arhti.id,
      farmerId: farmer.id,
      direction: OfferDirection.ARHTI_TO_FARMER,
      quantityKg: 5000,
      pricePerKg: 74,
      destinationMandiId: islamabad.id,
      transportResponsibility: TransportResponsibility.MUTUAL,
      proposedPickupAt: daysAgo(10),
      note: 'Rs 74/kg for the full lot, transport cost shared 50/50.',
      status: OfferStatus.ACCEPTED,
      createdAt: daysAgo(11),
      respondedAt: daysAgo(11),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.FARMER_ARHTI_OFFER,
    actorId: arhti.id,
    actorRole: UserRole.ARHTI,
    title: 'Arhti offered a rate',
    description: 'Haji Aslam offered Rs 74/kg for 5,000 kg, destination Islamabad Sabzi Mandi',
    quantityKg: 5000,
    pricePerKg: 74,
    refType: 'FarmerArhtiOffer',
    refId: offerA.id,
    at: daysAgo(11),
  });

  const dealA = await prisma.farmerArhtiDeal.create({
    data: {
      dealNumber: 'FAD-2025-1001',
      offerId: offerA.id,
      batchId: batchA.id,
      cropId: tomato.id,
      farmerId: farmer.id,
      arhtiId: arhti.id,
      agreedQuantityKg: 5000,
      agreedPricePerKg: 74,
      grossAmount: 370000,
      sourceCity: 'Swabi',
      sourceProvince: 'Khyber Pakhtunkhwa',
      destinationMandiId: islamabad.id,
      transportResponsibility: TransportResponsibility.MUTUAL,
      transportCost: 18000,
      receivedQuantityKg: 4920,
      weightDifferenceKg: -80,
      weightVerifiedAt: daysAgo(9),
      weightVerifierName: 'Mandi Weighbridge 2 — Faisal Shah',
      receivedAt: daysAgo(9),
      status: DealStatus.COMPLETED,
      notes: 'Shrinkage of 80 kg accepted by both sides after weighbridge check.',
      createdAt: daysAgo(11),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.FARMER_ARHTI_DEAL,
    actorId: farmer.id,
    actorRole: UserRole.FARMER,
    title: 'Deal agreed',
    description: 'Zubair Khan accepted Rs 74/kg for 5,000 kg — deal FAD-2025-1001',
    quantityKg: 5000,
    pricePerKg: 74,
    refType: 'FarmerArhtiDeal',
    refId: dealA.id,
    at: daysAgo(11),
  });

  const pickupA = await prisma.pickupRecord.create({
    data: {
      dealId: dealA.id,
      transportOptionId: truck.id,
      driverName: 'Ghafoor Khan',
      driverPhone: '0333-4412907',
      vehicleType: 'Mazda Titan 6-Wheeler',
      vehiclePlate: 'KP-4471',
      arrangedBy: TransportResponsibility.MUTUAL,
      estimatedCost: 18000,
      scheduledAt: daysAgo(10),
      confirmedAt: daysAgo(10),
      confirmedByUserId: farmer.id,
      expectedArrivalAt: daysAgo(9),
      arrivedAt: daysAgo(9),
      notes: 'Loaded 200 crates at 05:40, left Swabi at 06:15.',
      createdAt: daysAgo(10),
    },
  });

  await prisma.deliveryTracking.create({
    data: {
      pickupId: pickupA.id,
      origin: 'Kalu Khan, Swabi',
      destination: 'Islamabad Sabzi Mandi, I-11',
      stage: DeliveryStage.DELIVERED,
      currentLat: 33.6469,
      currentLng: 73.0169,
      etaMinutes: 0,
      statusNotes: 'Unloaded at Haji Aslam & Sons, gate 4.',
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.PICKUP,
    actorId: farmer.id,
    actorRole: UserRole.FARMER,
    title: 'Produce picked up',
    description: 'Ghafoor Khan (KP-4471) collected 5,000 kg from Kalu Khan for Islamabad',
    quantityKg: 5000,
    refType: 'PickupRecord',
    refId: pickupA.id,
    at: daysAgo(10),
  });

  // Settlement is computed on the verified received weight, not the agreed weight.
  const grossA = kg(4920 * 74); // 364,080
  const commissionA = kg(grossA * 0.02); // 7,281.6
  const farmerTransportShareA = kg(18000 / 2); // MUTUAL split
  const cessA = kg(grossA * 0.005); // 1,820.4
  const deductionsA = kg(commissionA + farmerTransportShareA + cessA);
  const netA = kg(grossA - deductionsA);

  const settlementA = await prisma.settlement.create({
    data: {
      dealId: dealA.id,
      farmerId: farmer.id,
      grossAmount: grossA,
      deductionsTotal: deductionsA,
      netPayable: netA,
      status: 'paid',
      createdAt: daysAgo(9),
      deductions: {
        create: [
          {
            type: DeductionType.ARHTI_COMMISSION,
            amount: commissionA,
            description: 'Arhti commission at 2% of Rs 364,080',
          },
          {
            type: DeductionType.TRANSPORT,
            amount: farmerTransportShareA,
            description: 'Farmer half of Rs 18,000 transport (shared responsibility)',
          },
          {
            type: DeductionType.MANDI_CESS,
            amount: cessA,
            description: 'Mandi cess at 0.5%',
          },
        ],
      },
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.ARHTI_RECEIPT,
    actorId: arhti.id,
    actorRole: UserRole.ARHTI,
    title: 'Received and weighed at mandi',
    description: '4,920 kg verified against 5,000 kg agreed (80 kg shrinkage) at Islamabad Sabzi Mandi',
    quantityKg: 4920,
    pricePerKg: 74,
    refType: 'FarmerArhtiDeal',
    refId: dealA.id,
    at: daysAgo(9),
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.ARHTI_RECEIPT,
    actorId: arhti.id,
    actorRole: UserRole.ARHTI,
    title: 'Farmer settlement calculated',
    description: `Gross Rs ${grossA.toLocaleString('en-PK')}, deductions Rs ${deductionsA.toLocaleString('en-PK')}, net payable Rs ${netA.toLocaleString('en-PK')}`,
    quantityKg: 4920,
    pricePerKg: 74,
    refType: 'Settlement',
    refId: settlementA.id,
    isConfidential: true,
    at: daysAgo(9),
  });

  const paymentA = await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.FARMER_ARHTI,
      transactionId: dealA.id,
      amount: netA,
      payerId: arhti.id,
      recipientId: farmer.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P8K2M4',
      paidAt: daysAgo(9),
      createdAt: daysAgo(9),
    },
  });

  await prisma.receipt.create({
    data: {
      receiptNumber: 'PARCHEE-2025-1001',
      transactionType: TransactionType.FARMER_ARHTI,
      transactionId: dealA.id,
      rootBatchId: batchA.id,
      issuedAt: daysAgo(9),
      data: {
        dealNumber: dealA.dealNumber,
        farmer: farmer.name,
        arhti: arhti.name,
        crop: 'Tomato',
        receivedQuantityKg: 4920,
        ratePerKg: 74,
        grossAmount: grossA,
        deductionsTotal: deductionsA,
        netPayable: netA,
        paymentReference: paymentA.reference,
      },
    },
  });

  const lotA = await prisma.arhtiInventoryLot.create({
    data: {
      lotNumber: 'ISL-TOM-1001',
      arhtiId: arhti.id,
      dealId: dealA.id,
      batchId: batchA.id,
      cropId: tomato.id,
      mandiId: islamabad.id,
      receivedQuantityKg: 4920,
      availableQuantityKg: 0, // whole lot went to auction A
      grade: 'A',
      purchasePricePerKg: 74,
      sourceCity: 'Swabi',
      sourceFarmerName: farmer.name,
      photos: ['/crops/tomato.png'],
      status: InventoryLotStatus.SOLD_OUT,
      createdAt: daysAgo(9),
    },
  });

  const auctionA = await prisma.auction.create({
    data: {
      auctionNumber: 'AUC-2025-1001',
      inventoryLotId: lotA.id,
      arhtiId: arhti.id,
      mandiId: islamabad.id,
      quantityKg: 4920,
      grade: 'A',
      photos: ['/crops/tomato.png'],
      startTime: daysAgo(8),
      endTime: daysAgo(8),
      reservePrice: 85,
      minimumIncrement: 1,
      status: AuctionStatus.SOLD,
      createdAt: daysAgo(8),
    },
  });

  const bidsA = [
    { bidderId: vendor2.id, amountPerKg: 86, at: daysAgo(8) },
    { bidderId: vendor.id, amountPerKg: 88, at: daysAgo(8) },
    { bidderId: vendor2.id, amountPerKg: 90, at: daysAgo(8) },
    { bidderId: vendor.id, amountPerKg: 92, at: daysAgo(8) },
  ];
  let winningBidA = '';
  for (const b of bidsA) {
    const created = await prisma.bid.create({
      data: {
        auctionId: auctionA.id,
        bidderId: b.bidderId,
        amountPerKg: b.amountPerKg,
        timestamp: b.at,
      },
    });
    winningBidA = created.id;
  }

  await prisma.auction.update({
    where: { id: auctionA.id },
    data: {
      bidCount: bidsA.length,
      currentHighestBid: 92,
      winnerId: vendor.id,
      winningBidId: winningBidA,
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.MANDI_AUCTION,
    actorId: arhti.id,
    actorRole: UserRole.ARHTI,
    title: 'Opened for mandi auction',
    description: '4,920 kg Grade A tomato auctioned at Islamabad Sabzi Mandi, reserve Rs 85/kg',
    quantityKg: 4920,
    pricePerKg: 85,
    refType: 'Auction',
    refId: auctionA.id,
    at: daysAgo(8),
  });

  const grossSaleA = kg(4920 * 92); // 452,640
  // The vendor pays the auction value plus Haji Aslam's 2% commission on it.
  const commissionSaleA = kg(grossSaleA * 0.02); // 9,052.8
  const vendorPaysA = kg(grossSaleA + commissionSaleA); // 461,692.8
  const saleA = await prisma.arhtiVendorSale.create({
    data: {
      saleNumber: 'AVS-2025-1001',
      auctionId: auctionA.id,
      arhtiId: arhti.id,
      vendorId: vendor.id,
      rootBatchId: batchA.id,
      quantityKg: 4920,
      ratePerKg: 92,
      grossAmount: grossSaleA,
      commission: commissionSaleA,
      mandiId: islamabad.id,
      status: SaleStatus.COMPLETED,
      createdAt: daysAgo(8),
    },
  });

  await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.ARHTI_VENDOR,
      transactionId: saleA.id,
      amount: vendorPaysA,
      payerId: vendor.id,
      recipientId: arhti.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P9L7Q1',
      paidAt: daysAgo(8),
      createdAt: daysAgo(8),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.ARHTI_VENDOR_SALE,
    actorId: arhti.id,
    actorRole: UserRole.ARHTI,
    title: 'Auction won by vendor',
    description: 'Bilal Traders Wholesale won 4,920 kg tomato at Rs 92/kg in Islamabad',
    quantityKg: 4920,
    pricePerKg: 92,
    refType: 'ArhtiVendorSale',
    refId: saleA.id,
    at: daysAgo(8),
  });

  const vendorStockA = await prisma.vendorInventory.create({
    data: {
      stockNumber: 'VS-TOM-1001',
      vendorId: vendor.id,
      saleId: saleA.id,
      rootBatchId: batchA.id,
      cropId: tomato.id,
      quantityKg: 4920,
      availableKg: 1920, // 3,000 kg listed on the wholesale shop
      grade: 'A',
      costPerKg: kg(vendorPaysA / 4920), // Rs 93.84: Rs 92 + 2% commission
      sourceMandiCity: 'Islamabad',
      sourceFarmCity: 'Swabi',
      photos: ['/crops/tomato.png'],
      status: StockStatus.IN_STOCK,
      createdAt: daysAgo(8),
    },
  });

  const offerWholesaleA = await prisma.vendorOffer.create({
    data: {
      offerNumber: 'WO-TOM-1001',
      vendorId: vendor.id,
      stockId: vendorStockA.id,
      rootBatchId: batchA.id,
      cropId: tomato.id,
      offeredQuantityKg: 3000,
      remainingKg: 2650, // 200 kg to Green Mart, 150 kg to Fresh Corner
      pricePerKg: 104,
      minOrderKg: 100,
      grade: 'A',
      deliveryCities: ['Islamabad', 'Rawalpindi'],
      deliveryEtaHours: 8,
      photos: ['/crops/tomato.png'],
      status: OfferListingStatus.ACTIVE,
      createdAt: daysAgo(7),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.VENDOR_WHOLESALE_OFFER,
    actorId: vendor.id,
    actorRole: UserRole.VENDOR,
    title: 'Listed on vendor wholesale shop',
    description: '3,000 kg tomato offered to shopkeepers at Rs 104/kg',
    quantityKg: 3000,
    pricePerKg: 104,
    refType: 'VendorOffer',
    refId: offerWholesaleA.id,
    at: daysAgo(7),
  });

  const vssA1 = await prisma.vendorShopkeeperSale.create({
    data: {
      saleNumber: 'VSS-2025-1001',
      offerId: offerWholesaleA.id,
      vendorId: vendor.id,
      shopkeeperId: shopkeeper.id,
      rootBatchId: batchA.id,
      quantityKg: 200,
      ratePerKg: 104,
      grossAmount: kg(200 * 104),
      deliveryCity: 'Islamabad',
      status: SaleStatus.COMPLETED,
      createdAt: daysAgo(6),
    },
  });

  await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.VENDOR_SHOPKEEPER,
      transactionId: vssA1.id,
      amount: vssA1.grossAmount,
      payerId: shopkeeper.id,
      recipientId: vendor.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P2T5V9',
      paidAt: daysAgo(6),
      createdAt: daysAgo(6),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.VENDOR_SHOPKEEPER_SALE,
    actorId: shopkeeper.id,
    actorRole: UserRole.SHOPKEEPER,
    title: 'Shopkeeper bought wholesale',
    description: 'Green Mart bought 200 kg tomato from Bilal Ahmed at Rs 104/kg',
    quantityKg: 200,
    pricePerKg: 104,
    refType: 'VendorShopkeeperSale',
    refId: vssA1.id,
    at: daysAgo(6),
  });

  const shopStockA1 = await prisma.shopkeeperInventory.create({
    data: {
      stockNumber: 'SS-TOM-1001',
      shopkeeperId: shopkeeper.id,
      saleId: vssA1.id,
      rootBatchId: batchA.id,
      cropId: tomato.id,
      quantityKg: 200,
      availableKg: 50, // 150 kg listed for retail
      grade: 'A',
      costPerKg: 104,
      photos: ['/crops/tomato.png'],
      status: StockStatus.IN_STOCK,
      createdAt: daysAgo(6),
    },
  });

  const listingA1 = await prisma.retailListing.create({
    data: {
      listingNumber: 'RL-2025-1001',
      shopkeeperId: shopkeeper.id,
      stockId: shopStockA1.id,
      rootBatchId: batchA.id,
      cropId: tomato.id,
      title: 'Fresh Swabi Tomatoes',
      listedQuantityKg: 150,
      remainingKg: 147, // 3 kg sold to the consumer
      pricePerKg: 145,
      packSizeKg: 1,
      imageUrl: '/crops/tomato.png',
      originLabel: 'Swabi, Khyber Pakhtunkhwa',
      status: OfferListingStatus.ACTIVE,
      createdAt: daysAgo(5),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.RETAIL_LISTING,
    actorId: shopkeeper.id,
    actorRole: UserRole.SHOPKEEPER,
    title: 'Listed for retail sale',
    description: '150 kg tomato on sale at Green Mart for Rs 145/kg',
    quantityKg: 150,
    pricePerKg: 145,
    refType: 'RetailListing',
    refId: listingA1.id,
    at: daysAgo(5),
  });

  const order1 = await prisma.consumerOrder.create({
    data: {
      orderNumber: 'CO-2025-1001',
      consumerId: consumer.id,
      shopkeeperId: shopkeeper.id,
      totalAmount: kg(3 * 145 + 60),
      deliveryFee: 60,
      deliveryAddress: 'House 214, Street 32, G-11/3, Islamabad',
      etaMinutes: 30,
      status: ConsumerOrderStatus.DELIVERED,
      placedAt: daysAgo(4),
      deliveredAt: daysAgo(4),
      items: {
        create: [
          {
            listingId: listingA1.id,
            rootBatchId: batchA.id,
            quantityKg: 3,
            pricePerKg: 145,
            lineTotal: kg(3 * 145),
          },
        ],
      },
    },
  });

  await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.SHOPKEEPER_CONSUMER,
      transactionId: order1.id,
      amount: order1.totalAmount,
      payerId: consumer.id,
      recipientId: shopkeeper.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P4W1Z8',
      paidAt: daysAgo(4),
      createdAt: daysAgo(4),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.CONSUMER_ORDER,
    actorId: consumer.id,
    actorRole: UserRole.CONSUMER,
    title: 'Consumer purchase',
    description: '3 kg tomato bought from Green Mart at Rs 145/kg',
    quantityKg: 3,
    pricePerKg: 145,
    refType: 'ConsumerOrder',
    refId: order1.id,
    at: daysAgo(4),
  });

  // Second shopkeeper draws from the same wholesale offer.
  const vssA2 = await prisma.vendorShopkeeperSale.create({
    data: {
      saleNumber: 'VSS-2025-1002',
      offerId: offerWholesaleA.id,
      vendorId: vendor.id,
      shopkeeperId: shopkeeper2.id,
      rootBatchId: batchA.id,
      quantityKg: 150,
      ratePerKg: 104,
      grossAmount: kg(150 * 104),
      deliveryCity: 'Islamabad',
      status: SaleStatus.COMPLETED,
      createdAt: daysAgo(5),
    },
  });

  await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.VENDOR_SHOPKEEPER,
      transactionId: vssA2.id,
      amount: vssA2.grossAmount,
      payerId: shopkeeper2.id,
      recipientId: vendor.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P6R3H2',
      paidAt: daysAgo(5),
      createdAt: daysAgo(5),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.VENDOR_SHOPKEEPER_SALE,
    actorId: shopkeeper2.id,
    actorRole: UserRole.SHOPKEEPER,
    title: 'Shopkeeper bought wholesale',
    description: 'Fresh Corner bought 150 kg tomato from Bilal Ahmed at Rs 104/kg',
    quantityKg: 150,
    pricePerKg: 104,
    refType: 'VendorShopkeeperSale',
    refId: vssA2.id,
    at: daysAgo(5),
  });

  const shopStockA2 = await prisma.shopkeeperInventory.create({
    data: {
      stockNumber: 'SS-TOM-1002',
      shopkeeperId: shopkeeper2.id,
      saleId: vssA2.id,
      rootBatchId: batchA.id,
      cropId: tomato.id,
      quantityKg: 150,
      availableKg: 50, // 100 kg listed
      grade: 'A',
      costPerKg: 104,
      photos: ['/crops/tomato.png'],
      status: StockStatus.IN_STOCK,
      createdAt: daysAgo(5),
    },
  });

  const listingA2 = await prisma.retailListing.create({
    data: {
      listingNumber: 'RL-2025-1002',
      shopkeeperId: shopkeeper2.id,
      stockId: shopStockA2.id,
      rootBatchId: batchA.id,
      cropId: tomato.id,
      title: 'Swabi Tomatoes (Grade A)',
      listedQuantityKg: 100,
      remainingKg: 96,
      pricePerKg: 150,
      packSizeKg: 1,
      imageUrl: '/crops/tomato.png',
      originLabel: 'Swabi, Khyber Pakhtunkhwa',
      status: OfferListingStatus.ACTIVE,
      createdAt: daysAgo(4),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.RETAIL_LISTING,
    actorId: shopkeeper2.id,
    actorRole: UserRole.SHOPKEEPER,
    title: 'Listed for retail sale',
    description: '100 kg tomato on sale at Fresh Corner for Rs 150/kg',
    quantityKg: 100,
    pricePerKg: 150,
    refType: 'RetailListing',
    refId: listingA2.id,
    at: daysAgo(4),
  });

  const order3 = await prisma.consumerOrder.create({
    data: {
      orderNumber: 'CO-2025-1003',
      consumerId: consumer.id,
      shopkeeperId: shopkeeper2.id,
      totalAmount: kg(4 * 150 + 60),
      deliveryFee: 60,
      deliveryAddress: 'House 214, Street 32, G-11/3, Islamabad',
      etaMinutes: 40,
      status: ConsumerOrderStatus.DELIVERED,
      placedAt: daysAgo(2),
      deliveredAt: daysAgo(2),
      items: {
        create: [
          {
            listingId: listingA2.id,
            rootBatchId: batchA.id,
            quantityKg: 4,
            pricePerKg: 150,
            lineTotal: kg(4 * 150),
          },
        ],
      },
    },
  });

  await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.SHOPKEEPER_CONSUMER,
      transactionId: order3.id,
      amount: order3.totalAmount,
      payerId: consumer.id,
      recipientId: shopkeeper2.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P7N2C5',
      paidAt: daysAgo(2),
      createdAt: daysAgo(2),
    },
  });

  await chainEvent({
    batchId: batchA.id,
    stage: SupplyChainStage.CONSUMER_ORDER,
    actorId: consumer.id,
    actorRole: UserRole.CONSUMER,
    title: 'Consumer purchase',
    description: '4 kg tomato bought from Fresh Corner at Rs 150/kg',
    quantityKg: 4,
    pricePerKg: 150,
    refType: 'ConsumerOrder',
    refId: order3.id,
    at: daysAgo(2),
  });

  // -------------------------------------------------------------------------
  // CHAIN B — Potato: Okara Rs 42 -> Lahore auction Rs 55 -> wholesale Rs 66
  //           -> Green Mart retail Rs 88 -> consumer order awaiting fulfilment
  // -------------------------------------------------------------------------

  const batchB = await prisma.farmerCropBatch.create({
    data: {
      batchNumber: 'FB-2025-1002',
      cropId: potato.id,
      farmerId: farmer2.id,
      variety: 'Sadaf',
      quantityKg: 8000,
      availableKg: 0,
      grade: 'B',
      originVillage: 'Renala Khurd',
      originCity: 'Okara',
      originProvince: 'Punjab',
      harvestDate: daysAgo(20),
      readyDate: daysAgo(19),
      packaging: '50 kg jute bags',
      askingPricePerKg: 40,
      photos: ['/crops/potato.png'],
      status: CropBatchStatus.SOLD_OUT,
      createdAt: daysAgo(20),
    },
  });

  await chainEvent({
    batchId: batchB.id,
    stage: SupplyChainStage.FARMER_HARVEST,
    actorId: farmer2.id,
    actorRole: UserRole.FARMER,
    title: 'Harvest recorded',
    description: '8,000 kg Grade B Sadaf potato harvested at Renala Khurd, Okara',
    quantityKg: 8000,
    refType: 'FarmerCropBatch',
    refId: batchB.id,
    at: daysAgo(20),
  });

  const offerB = await prisma.farmerArhtiOffer.create({
    data: {
      batchId: batchB.id,
      arhtiId: arhti2.id,
      farmerId: farmer2.id,
      direction: OfferDirection.ARHTI_TO_FARMER,
      quantityKg: 8000,
      pricePerKg: 42,
      destinationMandiId: lahore.id,
      transportResponsibility: TransportResponsibility.ARHTI,
      proposedPickupAt: daysAgo(18),
      note: 'Rs 42/kg, I will arrange and pay for the truck.',
      status: OfferStatus.ACCEPTED,
      createdAt: daysAgo(19),
      respondedAt: daysAgo(19),
    },
  });

  const dealB = await prisma.farmerArhtiDeal.create({
    data: {
      dealNumber: 'FAD-2025-1002',
      offerId: offerB.id,
      batchId: batchB.id,
      cropId: potato.id,
      farmerId: farmer2.id,
      arhtiId: arhti2.id,
      agreedQuantityKg: 8000,
      agreedPricePerKg: 42,
      grossAmount: 336000,
      sourceCity: 'Okara',
      sourceProvince: 'Punjab',
      destinationMandiId: lahore.id,
      transportResponsibility: TransportResponsibility.ARHTI,
      transportCost: 24000,
      receivedQuantityKg: 7950,
      weightDifferenceKg: -50,
      weightVerifiedAt: daysAgo(17),
      weightVerifierName: 'Badami Bagh Weighbridge 1',
      receivedAt: daysAgo(17),
      status: DealStatus.COMPLETED,
      createdAt: daysAgo(19),
    },
  });

  const pickupB = await prisma.pickupRecord.create({
    data: {
      dealId: dealB.id,
      transportOptionId: trailer.id,
      driverName: 'Muhammad Sajid',
      driverPhone: '0301-8823440',
      vehicleType: 'Hino 10-Wheeler',
      vehiclePlate: 'LEB-7719',
      arrangedBy: TransportResponsibility.ARHTI,
      estimatedCost: 24000,
      scheduledAt: daysAgo(18),
      confirmedAt: daysAgo(18),
      confirmedByUserId: arhti2.id,
      expectedArrivalAt: daysAgo(17),
      arrivedAt: daysAgo(17),
      createdAt: daysAgo(18),
    },
  });

  await prisma.deliveryTracking.create({
    data: {
      pickupId: pickupB.id,
      origin: 'Renala Khurd, Okara',
      destination: 'Badami Bagh, Lahore',
      stage: DeliveryStage.DELIVERED,
      currentLat: 31.6,
      currentLng: 74.3167,
      etaMinutes: 0,
    },
  });

  const grossB = kg(7950 * 42); // 333,900
  const commissionB = kg(grossB * 0.025);
  const cessB = kg(grossB * 0.005);
  const deductionsB = kg(commissionB + cessB); // arhti carried the transport
  const netB = kg(grossB - deductionsB);

  await prisma.settlement.create({
    data: {
      dealId: dealB.id,
      farmerId: farmer2.id,
      grossAmount: grossB,
      deductionsTotal: deductionsB,
      netPayable: netB,
      status: 'paid',
      createdAt: daysAgo(17),
      deductions: {
        create: [
          {
            type: DeductionType.ARHTI_COMMISSION,
            amount: commissionB,
            description: 'Arhti commission at 2.5%',
          },
          { type: DeductionType.MANDI_CESS, amount: cessB, description: 'Mandi cess at 0.5%' },
        ],
      },
    },
  });

  await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.FARMER_ARHTI,
      transactionId: dealB.id,
      amount: netB,
      payerId: arhti2.id,
      recipientId: farmer2.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P1D9F3',
      paidAt: daysAgo(17),
      createdAt: daysAgo(17),
    },
  });

  await chainEvent({
    batchId: batchB.id,
    stage: SupplyChainStage.ARHTI_RECEIPT,
    actorId: arhti2.id,
    actorRole: UserRole.ARHTI,
    title: 'Received and weighed at mandi',
    description: '7,950 kg verified at Badami Bagh against 8,000 kg agreed',
    quantityKg: 7950,
    pricePerKg: 42,
    refType: 'FarmerArhtiDeal',
    refId: dealB.id,
    at: daysAgo(17),
  });

  const lotB = await prisma.arhtiInventoryLot.create({
    data: {
      lotNumber: 'LHR-POT-1002',
      arhtiId: arhti2.id,
      dealId: dealB.id,
      batchId: batchB.id,
      cropId: potato.id,
      mandiId: lahore.id,
      receivedQuantityKg: 7950,
      availableQuantityKg: 0,
      grade: 'B',
      purchasePricePerKg: 42,
      sourceCity: 'Okara',
      sourceFarmerName: farmer2.name,
      photos: ['/crops/potato.png'],
      status: InventoryLotStatus.SOLD_OUT,
      createdAt: daysAgo(17),
    },
  });

  const auctionB = await prisma.auction.create({
    data: {
      auctionNumber: 'AUC-2025-1002',
      inventoryLotId: lotB.id,
      arhtiId: arhti2.id,
      mandiId: lahore.id,
      quantityKg: 7950,
      grade: 'B',
      photos: ['/crops/potato.png'],
      startTime: daysAgo(16),
      endTime: daysAgo(16),
      reservePrice: 50,
      minimumIncrement: 1,
      status: AuctionStatus.SOLD,
      createdAt: daysAgo(16),
    },
  });

  const bidB1 = await prisma.bid.create({
    data: { auctionId: auctionB.id, bidderId: vendor.id, amountPerKg: 52, timestamp: daysAgo(16) },
  });
  const bidB2 = await prisma.bid.create({
    data: { auctionId: auctionB.id, bidderId: vendor2.id, amountPerKg: 55, timestamp: daysAgo(16) },
  });

  await prisma.auction.update({
    where: { id: auctionB.id },
    data: {
      bidCount: 2,
      currentHighestBid: 55,
      winnerId: vendor2.id,
      winningBidId: bidB2.id,
    },
  });

  await chainEvent({
    batchId: batchB.id,
    stage: SupplyChainStage.MANDI_AUCTION,
    actorId: arhti2.id,
    actorRole: UserRole.ARHTI,
    title: 'Opened for mandi auction',
    description: `7,950 kg Grade B potato auctioned at Badami Bagh, reserve Rs 50/kg (opening bid Rs ${bidB1.amountPerKg}/kg)`,
    quantityKg: 7950,
    pricePerKg: 50,
    refType: 'Auction',
    refId: auctionB.id,
    at: daysAgo(16),
  });

  const grossSaleB = kg(7950 * 55); // 437,250
  // The vendor pays the auction value plus Malik Tanveer's 2.5% commission on it.
  const commissionSaleB = kg(grossSaleB * 0.025); // 10,931.25
  const vendorPaysB = kg(grossSaleB + commissionSaleB); // 448,181.25
  const saleB = await prisma.arhtiVendorSale.create({
    data: {
      saleNumber: 'AVS-2025-1002',
      auctionId: auctionB.id,
      arhtiId: arhti2.id,
      vendorId: vendor2.id,
      rootBatchId: batchB.id,
      quantityKg: 7950,
      ratePerKg: 55,
      grossAmount: grossSaleB,
      commission: commissionSaleB,
      mandiId: lahore.id,
      status: SaleStatus.COMPLETED,
      createdAt: daysAgo(16),
    },
  });

  await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.ARHTI_VENDOR,
      transactionId: saleB.id,
      amount: vendorPaysB,
      payerId: vendor2.id,
      recipientId: arhti2.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P3G8B7',
      paidAt: daysAgo(16),
      createdAt: daysAgo(16),
    },
  });

  await chainEvent({
    batchId: batchB.id,
    stage: SupplyChainStage.ARHTI_VENDOR_SALE,
    actorId: arhti2.id,
    actorRole: UserRole.ARHTI,
    title: 'Auction won by vendor',
    description: 'Kareem Wholesale Supply won 7,950 kg potato at Rs 55/kg in Lahore',
    quantityKg: 7950,
    pricePerKg: 55,
    refType: 'ArhtiVendorSale',
    refId: saleB.id,
    at: daysAgo(16),
  });

  const vendorStockB = await prisma.vendorInventory.create({
    data: {
      stockNumber: 'VS-POT-1002',
      vendorId: vendor2.id,
      saleId: saleB.id,
      rootBatchId: batchB.id,
      cropId: potato.id,
      quantityKg: 7950,
      availableKg: 3950, // 4,000 kg on the wholesale shop
      grade: 'B',
      costPerKg: kg(vendorPaysB / 7950), // Rs 56.375: Rs 55 + 2.5% commission
      sourceMandiCity: 'Lahore',
      sourceFarmCity: 'Okara',
      photos: ['/crops/potato.png'],
      status: StockStatus.IN_STOCK,
      createdAt: daysAgo(16),
    },
  });

  const offerWholesaleB = await prisma.vendorOffer.create({
    data: {
      offerNumber: 'WO-POT-1002',
      vendorId: vendor2.id,
      stockId: vendorStockB.id,
      rootBatchId: batchB.id,
      cropId: potato.id,
      offeredQuantityKg: 4000,
      remainingKg: 3700, // 300 kg to Green Mart
      pricePerKg: 66,
      minOrderKg: 150,
      grade: 'B',
      deliveryCities: ['Rawalpindi', 'Islamabad', 'Murree'],
      deliveryEtaHours: 12,
      photos: ['/crops/potato.png'],
      status: OfferListingStatus.ACTIVE,
      createdAt: daysAgo(14),
    },
  });

  await chainEvent({
    batchId: batchB.id,
    stage: SupplyChainStage.VENDOR_WHOLESALE_OFFER,
    actorId: vendor2.id,
    actorRole: UserRole.VENDOR,
    title: 'Listed on vendor wholesale shop',
    description: '4,000 kg potato offered to shopkeepers at Rs 66/kg',
    quantityKg: 4000,
    pricePerKg: 66,
    refType: 'VendorOffer',
    refId: offerWholesaleB.id,
    at: daysAgo(14),
  });

  const vssB1 = await prisma.vendorShopkeeperSale.create({
    data: {
      saleNumber: 'VSS-2025-1003',
      offerId: offerWholesaleB.id,
      vendorId: vendor2.id,
      shopkeeperId: shopkeeper.id,
      rootBatchId: batchB.id,
      quantityKg: 300,
      ratePerKg: 66,
      grossAmount: kg(300 * 66),
      deliveryCity: 'Islamabad',
      status: SaleStatus.COMPLETED,
      createdAt: daysAgo(12),
    },
  });

  await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.VENDOR_SHOPKEEPER,
      transactionId: vssB1.id,
      amount: vssB1.grossAmount,
      payerId: shopkeeper.id,
      recipientId: vendor2.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P5J4K6',
      paidAt: daysAgo(12),
      createdAt: daysAgo(12),
    },
  });

  await chainEvent({
    batchId: batchB.id,
    stage: SupplyChainStage.VENDOR_SHOPKEEPER_SALE,
    actorId: shopkeeper.id,
    actorRole: UserRole.SHOPKEEPER,
    title: 'Shopkeeper bought wholesale',
    description: 'Green Mart bought 300 kg potato from Kareem Bakhsh at Rs 66/kg',
    quantityKg: 300,
    pricePerKg: 66,
    refType: 'VendorShopkeeperSale',
    refId: vssB1.id,
    at: daysAgo(12),
  });

  const shopStockB1 = await prisma.shopkeeperInventory.create({
    data: {
      stockNumber: 'SS-POT-1003',
      shopkeeperId: shopkeeper.id,
      saleId: vssB1.id,
      rootBatchId: batchB.id,
      cropId: potato.id,
      quantityKg: 300,
      availableKg: 100, // 200 kg listed
      grade: 'B',
      costPerKg: 66,
      photos: ['/crops/potato.png'],
      status: StockStatus.IN_STOCK,
      createdAt: daysAgo(12),
    },
  });

  const listingB1 = await prisma.retailListing.create({
    data: {
      listingNumber: 'RL-2025-1003',
      shopkeeperId: shopkeeper.id,
      stockId: shopStockB1.id,
      rootBatchId: batchB.id,
      cropId: potato.id,
      title: 'Okara Potatoes',
      listedQuantityKg: 200,
      remainingKg: 195,
      pricePerKg: 88,
      packSizeKg: 1,
      imageUrl: '/crops/potato.png',
      originLabel: 'Okara, Punjab',
      status: OfferListingStatus.ACTIVE,
      createdAt: daysAgo(11),
    },
  });

  await chainEvent({
    batchId: batchB.id,
    stage: SupplyChainStage.RETAIL_LISTING,
    actorId: shopkeeper.id,
    actorRole: UserRole.SHOPKEEPER,
    title: 'Listed for retail sale',
    description: '200 kg potato on sale at Green Mart for Rs 88/kg',
    quantityKg: 200,
    pricePerKg: 88,
    refType: 'RetailListing',
    refId: listingB1.id,
    at: daysAgo(11),
  });

  // Open order — the shopkeeper's live work item.
  const order2 = await prisma.consumerOrder.create({
    data: {
      orderNumber: 'CO-2025-1002',
      consumerId: consumer.id,
      shopkeeperId: shopkeeper.id,
      totalAmount: kg(5 * 88 + 60),
      deliveryFee: 60,
      deliveryAddress: 'House 214, Street 32, G-11/3, Islamabad',
      etaMinutes: 30,
      status: ConsumerOrderStatus.PLACED,
      placedAt: hoursAgo(1),
      items: {
        create: [
          {
            listingId: listingB1.id,
            rootBatchId: batchB.id,
            quantityKg: 5,
            pricePerKg: 88,
            lineTotal: kg(5 * 88),
          },
        ],
      },
    },
  });

  await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.SHOPKEEPER_CONSUMER,
      transactionId: order2.id,
      amount: order2.totalAmount,
      payerId: consumer.id,
      recipientId: shopkeeper.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P8Y7X2',
      paidAt: hoursAgo(1),
      createdAt: hoursAgo(1),
    },
  });

  await chainEvent({
    batchId: batchB.id,
    stage: SupplyChainStage.CONSUMER_ORDER,
    actorId: consumer.id,
    actorRole: UserRole.CONSUMER,
    title: 'Consumer purchase',
    description: '5 kg potato bought from Green Mart at Rs 88/kg',
    quantityKg: 5,
    pricePerKg: 88,
    refType: 'ConsumerOrder',
    refId: order2.id,
    at: hoursAgo(1),
  });

  // -------------------------------------------------------------------------
  // CHAIN C — Onion, still moving: one lot part-auctioned with a LIVE auction,
  //           one consignment in transit for the arhti to receive and weigh
  // -------------------------------------------------------------------------

  const batchC1 = await prisma.farmerCropBatch.create({
    data: {
      batchNumber: 'FB-2025-1003',
      cropId: onion.id,
      farmerId: farmer2.id,
      variety: 'Phulkara',
      quantityKg: 4000,
      availableKg: 1500, // 2,500 kg committed to deal C1
      grade: 'A',
      originVillage: 'Renala Khurd',
      originCity: 'Okara',
      originProvince: 'Punjab',
      harvestDate: daysAgo(9),
      readyDate: daysAgo(8),
      packaging: '40 kg mesh bags',
      askingPricePerKg: 64,
      photos: ['/crops/onion.png'],
      status: CropBatchStatus.NEGOTIATING,
      createdAt: daysAgo(9),
    },
  });

  await chainEvent({
    batchId: batchC1.id,
    stage: SupplyChainStage.FARMER_HARVEST,
    actorId: farmer2.id,
    actorRole: UserRole.FARMER,
    title: 'Harvest recorded',
    description: '4,000 kg Grade A Phulkara onion harvested at Renala Khurd, Okara',
    quantityKg: 4000,
    refType: 'FarmerCropBatch',
    refId: batchC1.id,
    at: daysAgo(9),
  });

  const offerC1 = await prisma.farmerArhtiOffer.create({
    data: {
      batchId: batchC1.id,
      arhtiId: arhti.id,
      farmerId: farmer2.id,
      direction: OfferDirection.ARHTI_TO_FARMER,
      quantityKg: 2500,
      pricePerKg: 68,
      destinationMandiId: islamabad.id,
      transportResponsibility: TransportResponsibility.ARHTI,
      proposedPickupAt: daysAgo(7),
      status: OfferStatus.ACCEPTED,
      createdAt: daysAgo(8),
      respondedAt: daysAgo(8),
    },
  });

  const dealC1 = await prisma.farmerArhtiDeal.create({
    data: {
      dealNumber: 'FAD-2025-1003',
      offerId: offerC1.id,
      batchId: batchC1.id,
      cropId: onion.id,
      farmerId: farmer2.id,
      arhtiId: arhti.id,
      agreedQuantityKg: 2500,
      agreedPricePerKg: 68,
      grossAmount: 170000,
      sourceCity: 'Okara',
      sourceProvince: 'Punjab',
      destinationMandiId: islamabad.id,
      transportResponsibility: TransportResponsibility.ARHTI,
      transportCost: 21000,
      receivedQuantityKg: 2450,
      weightDifferenceKg: -50,
      weightVerifiedAt: daysAgo(6),
      weightVerifierName: 'Mandi Weighbridge 2 — Faisal Shah',
      receivedAt: daysAgo(6),
      status: DealStatus.PAID,
      createdAt: daysAgo(8),
    },
  });

  const pickupC1 = await prisma.pickupRecord.create({
    data: {
      dealId: dealC1.id,
      transportOptionId: trailer.id,
      driverName: 'Muhammad Sajid',
      driverPhone: '0301-8823440',
      vehicleType: 'Hino 10-Wheeler',
      vehiclePlate: 'LEB-7719',
      arrangedBy: TransportResponsibility.ARHTI,
      estimatedCost: 21000,
      scheduledAt: daysAgo(7),
      confirmedAt: daysAgo(7),
      confirmedByUserId: arhti.id,
      expectedArrivalAt: daysAgo(6),
      arrivedAt: daysAgo(6),
      createdAt: daysAgo(7),
    },
  });

  await prisma.deliveryTracking.create({
    data: {
      pickupId: pickupC1.id,
      origin: 'Renala Khurd, Okara',
      destination: 'Islamabad Sabzi Mandi, I-11',
      stage: DeliveryStage.DELIVERED,
      currentLat: 33.6469,
      currentLng: 73.0169,
      etaMinutes: 0,
    },
  });

  const grossC1 = kg(2450 * 68); // 166,600
  const commissionC1 = kg(grossC1 * 0.02);
  const cessC1 = kg(grossC1 * 0.005);
  const deductionsC1 = kg(commissionC1 + cessC1);
  const netC1 = kg(grossC1 - deductionsC1);

  await prisma.settlement.create({
    data: {
      dealId: dealC1.id,
      farmerId: farmer2.id,
      grossAmount: grossC1,
      deductionsTotal: deductionsC1,
      netPayable: netC1,
      status: 'paid',
      createdAt: daysAgo(6),
      deductions: {
        create: [
          {
            type: DeductionType.ARHTI_COMMISSION,
            amount: commissionC1,
            description: 'Arhti commission at 2%',
          },
          { type: DeductionType.MANDI_CESS, amount: cessC1, description: 'Mandi cess at 0.5%' },
        ],
      },
    },
  });

  await prisma.paymentRecord.create({
    data: {
      transactionType: TransactionType.FARMER_ARHTI,
      transactionId: dealC1.id,
      amount: netC1,
      payerId: arhti.id,
      recipientId: farmer2.id,
      status: PaymentStatus.PAID,
      reference: 'RAAST-P2Q6L4',
      paidAt: daysAgo(6),
      createdAt: daysAgo(6),
    },
  });

  await chainEvent({
    batchId: batchC1.id,
    stage: SupplyChainStage.ARHTI_RECEIPT,
    actorId: arhti.id,
    actorRole: UserRole.ARHTI,
    title: 'Received and weighed at mandi',
    description: '2,450 kg onion verified at Islamabad against 2,500 kg agreed',
    quantityKg: 2450,
    pricePerKg: 68,
    refType: 'FarmerArhtiDeal',
    refId: dealC1.id,
    at: daysAgo(6),
  });

  const lotC1 = await prisma.arhtiInventoryLot.create({
    data: {
      lotNumber: 'ISL-ONI-1003',
      arhtiId: arhti.id,
      dealId: dealC1.id,
      batchId: batchC1.id,
      cropId: onion.id,
      mandiId: islamabad.id,
      receivedQuantityKg: 2450,
      availableQuantityKg: 950, // 1,500 kg is in the live auction
      grade: 'A',
      purchasePricePerKg: 68,
      sourceCity: 'Okara',
      sourceFarmerName: farmer2.name,
      photos: ['/crops/onion.png'],
      status: InventoryLotStatus.PARTIALLY_AUCTIONED,
      createdAt: daysAgo(6),
    },
  });

  const auctionLive = await prisma.auction.create({
    data: {
      auctionNumber: 'AUC-2025-1003',
      inventoryLotId: lotC1.id,
      arhtiId: arhti.id,
      mandiId: islamabad.id,
      quantityKg: 1500,
      grade: 'A',
      photos: ['/crops/onion.png'],
      startTime: hoursAgo(2),
      endTime: hoursAhead(6),
      reservePrice: 78,
      minimumIncrement: 1,
      currentHighestBid: 81,
      bidCount: 2,
      status: AuctionStatus.ACTIVE,
      createdAt: hoursAgo(2),
    },
  });

  await prisma.bid.create({
    data: {
      auctionId: auctionLive.id,
      bidderId: vendor2.id,
      amountPerKg: 79,
      timestamp: hoursAgo(1.5),
    },
  });
  await prisma.bid.create({
    data: {
      auctionId: auctionLive.id,
      bidderId: vendor.id,
      amountPerKg: 81,
      timestamp: hoursAgo(1),
    },
  });

  await chainEvent({
    batchId: batchC1.id,
    stage: SupplyChainStage.MANDI_AUCTION,
    actorId: arhti.id,
    actorRole: UserRole.ARHTI,
    title: 'Opened for mandi auction',
    description: '1,500 kg Grade A onion live at Islamabad Sabzi Mandi, reserve Rs 78/kg',
    quantityKg: 1500,
    pricePerKg: 78,
    refType: 'Auction',
    refId: auctionLive.id,
    at: hoursAgo(2),
  });

  // Consignment in transit — the arhti's receive-and-weigh work item.
  const batchC2 = await prisma.farmerCropBatch.create({
    data: {
      batchNumber: 'FB-2025-1004',
      cropId: onion.id,
      farmerId: farmer.id,
      variety: 'Desi Red',
      quantityKg: 3000,
      availableKg: 0,
      grade: 'B',
      originVillage: 'Kalu Khan',
      originCity: 'Swabi',
      originProvince: 'Khyber Pakhtunkhwa',
      harvestDate: daysAgo(4),
      readyDate: daysAgo(3),
      packaging: '40 kg mesh bags',
      askingPricePerKg: 62,
      photos: ['/crops/onion.png'],
      status: CropBatchStatus.SOLD_OUT,
      createdAt: daysAgo(4),
    },
  });

  await chainEvent({
    batchId: batchC2.id,
    stage: SupplyChainStage.FARMER_HARVEST,
    actorId: farmer.id,
    actorRole: UserRole.FARMER,
    title: 'Harvest recorded',
    description: '3,000 kg Grade B Desi Red onion harvested at Kalu Khan, Swabi',
    quantityKg: 3000,
    refType: 'FarmerCropBatch',
    refId: batchC2.id,
    at: daysAgo(4),
  });

  const offerC2 = await prisma.farmerArhtiOffer.create({
    data: {
      batchId: batchC2.id,
      arhtiId: arhti.id,
      farmerId: farmer.id,
      direction: OfferDirection.ARHTI_TO_FARMER,
      quantityKg: 3000,
      pricePerKg: 66,
      destinationMandiId: islamabad.id,
      transportResponsibility: TransportResponsibility.MUTUAL,
      proposedPickupAt: hoursAgo(9),
      status: OfferStatus.ACCEPTED,
      createdAt: daysAgo(3),
      respondedAt: daysAgo(3),
    },
  });

  const dealC2 = await prisma.farmerArhtiDeal.create({
    data: {
      dealNumber: 'FAD-2025-1004',
      offerId: offerC2.id,
      batchId: batchC2.id,
      cropId: onion.id,
      farmerId: farmer.id,
      arhtiId: arhti.id,
      agreedQuantityKg: 3000,
      agreedPricePerKg: 66,
      grossAmount: 198000,
      sourceCity: 'Swabi',
      sourceProvince: 'Khyber Pakhtunkhwa',
      destinationMandiId: islamabad.id,
      transportResponsibility: TransportResponsibility.MUTUAL,
      transportCost: 14000,
      status: DealStatus.IN_TRANSIT,
      notes: 'Truck left Swabi this morning, arhti to weigh on arrival.',
      createdAt: daysAgo(3),
    },
  });

  await chainEvent({
    batchId: batchC2.id,
    stage: SupplyChainStage.FARMER_ARHTI_DEAL,
    actorId: farmer.id,
    actorRole: UserRole.FARMER,
    title: 'Deal agreed',
    description: 'Zubair Khan accepted Rs 66/kg for 3,000 kg onion — deal FAD-2025-1004',
    quantityKg: 3000,
    pricePerKg: 66,
    refType: 'FarmerArhtiDeal',
    refId: dealC2.id,
    at: daysAgo(3),
  });

  const pickupC2 = await prisma.pickupRecord.create({
    data: {
      dealId: dealC2.id,
      transportOptionId: truck.id,
      driverName: 'Ghafoor Khan',
      driverPhone: '0333-4412907',
      vehicleType: 'Mazda Titan 6-Wheeler',
      vehiclePlate: 'KP-4471',
      arrangedBy: TransportResponsibility.MUTUAL,
      estimatedCost: 14000,
      scheduledAt: hoursAgo(9),
      confirmedAt: hoursAgo(9),
      confirmedByUserId: farmer.id,
      expectedArrivalAt: hoursAhead(3),
      createdAt: daysAgo(1),
    },
  });

  await prisma.deliveryTracking.create({
    data: {
      pickupId: pickupC2.id,
      origin: 'Kalu Khan, Swabi',
      destination: 'Islamabad Sabzi Mandi, I-11',
      stage: DeliveryStage.IN_TRANSIT,
      currentLat: 33.9,
      currentLng: 72.72,
      etaMinutes: 180,
      statusNotes: 'Passing Attock on the M-1, driver reports no delays.',
    },
  });

  await chainEvent({
    batchId: batchC2.id,
    stage: SupplyChainStage.PICKUP,
    actorId: farmer.id,
    actorRole: UserRole.FARMER,
    title: 'Produce picked up',
    description: 'Ghafoor Khan (KP-4471) collected 3,000 kg onion, ETA Islamabad in 3 hours',
    quantityKg: 3000,
    refType: 'PickupRecord',
    refId: pickupC2.id,
    at: hoursAgo(9),
  });

  // -------------------------------------------------------------------------
  // Farmer's open decisions — batches on the market with live offers
  // -------------------------------------------------------------------------

  const batchD = await prisma.farmerCropBatch.create({
    data: {
      batchNumber: 'FB-2025-1005',
      cropId: potato.id,
      farmerId: farmer.id,
      variety: 'Faisalabad White',
      quantityKg: 2000,
      availableKg: 2000,
      grade: 'B',
      originVillage: 'Kalu Khan',
      originCity: 'Swabi',
      originProvince: 'Khyber Pakhtunkhwa',
      harvestDate: daysAgo(2),
      readyDate: daysAgo(1),
      packaging: '50 kg jute bags',
      askingPricePerKg: 48,
      photos: ['/crops/potato.png'],
      notes: 'Graded and bagged, ready for pickup any morning.',
      status: CropBatchStatus.READY_FOR_SALE,
      createdAt: daysAgo(2),
    },
  });

  await chainEvent({
    batchId: batchD.id,
    stage: SupplyChainStage.FARMER_HARVEST,
    actorId: farmer.id,
    actorRole: UserRole.FARMER,
    title: 'Harvest recorded',
    description: '2,000 kg Grade B potato harvested at Kalu Khan, Swabi',
    quantityKg: 2000,
    refType: 'FarmerCropBatch',
    refId: batchD.id,
    at: daysAgo(2),
  });

  const pendingOffer1 = await prisma.farmerArhtiOffer.create({
    data: {
      batchId: batchD.id,
      arhtiId: arhti.id,
      farmerId: farmer.id,
      direction: OfferDirection.ARHTI_TO_FARMER,
      quantityKg: 1800,
      pricePerKg: 45,
      destinationMandiId: islamabad.id,
      transportResponsibility: TransportResponsibility.MUTUAL,
      proposedPickupAt: daysAhead(1),
      note: 'Rs 45/kg for 1,800 kg, transport shared. Islamabad rate is firm this week.',
      status: OfferStatus.PENDING,
      createdAt: hoursAgo(5),
    },
  });

  await chainEvent({
    batchId: batchD.id,
    stage: SupplyChainStage.FARMER_ARHTI_OFFER,
    actorId: arhti.id,
    actorRole: UserRole.ARHTI,
    title: 'Arhti offered a rate',
    description: 'Haji Aslam offered Rs 45/kg for 1,800 kg, destination Islamabad Sabzi Mandi',
    quantityKg: 1800,
    pricePerKg: 45,
    refType: 'FarmerArhtiOffer',
    refId: pendingOffer1.id,
    at: hoursAgo(5),
  });

  const pendingOffer2 = await prisma.farmerArhtiOffer.create({
    data: {
      batchId: batchD.id,
      arhtiId: arhti2.id,
      farmerId: farmer.id,
      direction: OfferDirection.ARHTI_TO_FARMER,
      quantityKg: 2000,
      pricePerKg: 44,
      destinationMandiId: lahore.id,
      transportResponsibility: TransportResponsibility.ARHTI,
      proposedPickupAt: daysAhead(2),
      note: 'Rs 44/kg for the whole lot and I cover the truck to Lahore.',
      status: OfferStatus.PENDING,
      createdAt: hoursAgo(3),
    },
  });

  await chainEvent({
    batchId: batchD.id,
    stage: SupplyChainStage.FARMER_ARHTI_OFFER,
    actorId: arhti2.id,
    actorRole: UserRole.ARHTI,
    title: 'Arhti offered a rate',
    description: 'Malik Tanveer offered Rs 44/kg for 2,000 kg with transport included, destination Lahore',
    quantityKg: 2000,
    pricePerKg: 44,
    refType: 'FarmerArhtiOffer',
    refId: pendingOffer2.id,
    at: hoursAgo(3),
  });

  const batchE = await prisma.farmerCropBatch.create({
    data: {
      batchNumber: 'FB-2025-1006',
      cropId: tomato.id,
      farmerId: farmer.id,
      variety: 'Hybrid 1359',
      quantityKg: 1200,
      availableKg: 1200,
      grade: 'A',
      originVillage: 'Kalu Khan',
      originCity: 'Swabi',
      originProvince: 'Khyber Pakhtunkhwa',
      harvestDate: daysAhead(9),
      packaging: '25 kg plastic crates',
      photos: ['/crops/tomato.png'],
      notes: 'Still on the vine — flowering finished last week.',
      status: CropBatchStatus.GROWING,
      createdAt: daysAgo(1),
    },
  });

  const batchF = await prisma.farmerCropBatch.create({
    data: {
      batchNumber: 'FB-2025-1007',
      cropId: onion.id,
      farmerId: farmer2.id,
      variety: 'Nasik Red',
      quantityKg: 6000,
      availableKg: 6000,
      grade: 'A',
      originVillage: 'Renala Khurd',
      originCity: 'Okara',
      originProvince: 'Punjab',
      harvestDate: daysAgo(1),
      readyDate: NOW,
      packaging: '40 kg mesh bags',
      askingPricePerKg: 70,
      photos: ['/crops/onion.png'],
      status: CropBatchStatus.READY_FOR_SALE,
      createdAt: daysAgo(1),
    },
  });

  await chainEvent({
    batchId: batchF.id,
    stage: SupplyChainStage.FARMER_HARVEST,
    actorId: farmer2.id,
    actorRole: UserRole.FARMER,
    title: 'Harvest recorded',
    description: '6,000 kg Grade A Nasik Red onion harvested at Renala Khurd, Okara',
    quantityKg: 6000,
    refType: 'FarmerCropBatch',
    refId: batchF.id,
    at: daysAgo(1),
  });

  // -------------------------------------------------------------------------
  // Arhti buy requests — what the arhtis are actively looking to source
  // -------------------------------------------------------------------------

  await prisma.arhtiDemandRequest.create({
    data: {
      requestNumber: 'DR-2025-1001',
      arhtiId: arhti.id,
      cropId: tomato.id,
      minQuantityKg: 2000,
      maxQuantityKg: 6000,
      gradeWanted: 'A',
      preferredOrigins: ['Swabi', 'Mardan', 'Charsadda'],
      targetPriceMin: 70,
      targetPriceMax: 80,
      neededBy: daysAhead(5),
      transportOffered: true,
      mandiId: islamabad.id,
      notes: 'Grade A only, crates preferred. I can send a truck within 24 hours.',
      status: DemandStatus.OPEN,
      createdAt: daysAgo(2),
    },
  });

  await prisma.arhtiDemandRequest.create({
    data: {
      requestNumber: 'DR-2025-1002',
      arhtiId: arhti.id,
      cropId: onion.id,
      minQuantityKg: 1000,
      maxQuantityKg: 3000,
      gradeWanted: 'A',
      preferredOrigins: ['Okara', 'Swabi'],
      targetPriceMin: 60,
      targetPriceMax: 70,
      neededBy: daysAhead(3),
      transportOffered: true,
      mandiId: islamabad.id,
      status: DemandStatus.OPEN,
      createdAt: daysAgo(1),
    },
  });

  await prisma.arhtiDemandRequest.create({
    data: {
      requestNumber: 'DR-2025-1003',
      arhtiId: arhti2.id,
      cropId: potato.id,
      minQuantityKg: 5000,
      maxQuantityKg: 10000,
      gradeWanted: 'B',
      preferredOrigins: ['Okara', 'Sahiwal', 'Pakpattan'],
      targetPriceMin: 40,
      targetPriceMax: 48,
      neededBy: daysAhead(7),
      transportOffered: true,
      mandiId: lahore.id,
      status: DemandStatus.OPEN,
      createdAt: daysAgo(3),
    },
  });

  // -------------------------------------------------------------------------
  // Trust — ratings only exist against completed transactions
  // -------------------------------------------------------------------------

  await prisma.rating.create({
    data: {
      transactionType: TransactionType.FARMER_ARHTI,
      transactionId: dealA.id,
      raterId: farmer.id,
      targetUserId: arhti.id,
      overallRating: 5,
      paymentTimeliness: 5,
      communication: 5,
      transparency: 4,
      comment: 'Weighbridge slip shared without asking and payment came the same day.',
      createdAt: daysAgo(8),
    },
  });

  await prisma.rating.create({
    data: {
      transactionType: TransactionType.FARMER_ARHTI,
      transactionId: dealA.id,
      raterId: arhti.id,
      targetUserId: farmer.id,
      overallRating: 5,
      produceQuality: 5,
      descriptionAccuracy: 5,
      quantityAccuracy: 4,
      comment: 'Grading was honest, only 80 kg shrinkage over that distance.',
      createdAt: daysAgo(8),
    },
  });

  await prisma.rating.create({
    data: {
      transactionType: TransactionType.ARHTI_VENDOR,
      transactionId: saleA.id,
      raterId: vendor.id,
      targetUserId: arhti.id,
      overallRating: 4,
      produceQuality: 4,
      timeliness: 5,
      comment: 'Lot matched the auction photos. Loading took a while.',
      createdAt: daysAgo(7),
    },
  });

  await prisma.rating.create({
    data: {
      transactionType: TransactionType.VENDOR_SHOPKEEPER,
      transactionId: vssA1.id,
      raterId: shopkeeper.id,
      targetUserId: vendor.id,
      overallRating: 5,
      timeliness: 5,
      produceQuality: 5,
      comment: 'Delivered to G-11 before opening time.',
      createdAt: daysAgo(5),
    },
  });

  // Order 1 is rated; order 3 is delivered but unrated so the flow stays demoable.
  await prisma.rating.create({
    data: {
      transactionType: TransactionType.SHOPKEEPER_CONSUMER,
      transactionId: order1.id,
      raterId: consumer.id,
      targetUserId: shopkeeper.id,
      overallRating: 5,
      timeliness: 5,
      produceQuality: 5,
      comment: 'Tomatoes were firm and it arrived in 25 minutes.',
      createdAt: daysAgo(4),
    },
  });

  // -------------------------------------------------------------------------
  // Messaging — only between parties that actually trade with each other
  // -------------------------------------------------------------------------

  const convFarmerArhti = await prisma.conversation.create({
    data: {
      userAId: farmer.id,
      userBId: arhti.id,
      relatedRefType: 'FarmerArhtiDeal',
      relatedRefId: dealC2.id,
      lastMessageAt: hoursAgo(2),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convFarmerArhti.id,
        senderId: arhti.id,
        text: 'Onion truck left on time? I have a buyer waiting at the mandi.',
        createdAt: hoursAgo(8),
        isRead: true,
      },
      {
        conversationId: convFarmerArhti.id,
        senderId: farmer.id,
        text: 'Yes, Ghafoor left at 6:15. 75 bags loaded.',
        createdAt: hoursAgo(7),
        isRead: true,
      },
      {
        conversationId: convFarmerArhti.id,
        senderId: arhti.id,
        text: 'Good. I will send the weighbridge slip as soon as it is unloaded.',
        createdAt: hoursAgo(2),
        isRead: false,
      },
    ],
  });

  const convArhtiVendor = await prisma.conversation.create({
    data: {
      userAId: arhti.id,
      userBId: vendor.id,
      relatedRefType: 'Auction',
      relatedRefId: auctionLive.id,
      lastMessageAt: hoursAgo(1),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convArhtiVendor.id,
        senderId: vendor.id,
        text: 'Is the onion lot the same Okara consignment as last week?',
        createdAt: hoursAgo(2),
        isRead: true,
      },
      {
        conversationId: convArhtiVendor.id,
        senderId: arhti.id,
        text: 'Same farmer, Grade A. 950 kg still uncommitted if you want it outside the auction.',
        createdAt: hoursAgo(1),
        isRead: false,
      },
    ],
  });

  const convVendorShop = await prisma.conversation.create({
    data: {
      userAId: vendor.id,
      userBId: shopkeeper.id,
      relatedRefType: 'VendorOffer',
      relatedRefId: offerWholesaleA.id,
      lastMessageAt: hoursAgo(4),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convVendorShop.id,
        senderId: shopkeeper.id,
        text: 'Can you hold 200 kg tomato for tomorrow morning at the same rate?',
        createdAt: hoursAgo(5),
        isRead: true,
      },
      {
        conversationId: convVendorShop.id,
        senderId: vendor.id,
        text: 'Rs 104/kg holds until Thursday. 2,650 kg still open on the offer.',
        createdAt: hoursAgo(4),
        isRead: false,
      },
    ],
  });

  // -------------------------------------------------------------------------
  // Notifications — each role's live work item
  // -------------------------------------------------------------------------

  await prisma.notification.createMany({
    data: [
      {
        userId: farmer.id,
        type: NotificationType.NEW_OFFER,
        title: 'Two arhtis want your potato',
        message: 'Haji Aslam offered Rs 45/kg for 1,800 kg and Malik Tanveer Rs 44/kg for 2,000 kg.',
        link: '/arhti-requests',
        createdAt: hoursAgo(3),
      },
      {
        userId: farmer.id,
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Payment received',
        message: `Rs ${netA.toLocaleString('en-PK')} credited for deal FAD-2025-1001.`,
        link: '/records',
        isRead: true,
        createdAt: daysAgo(9),
      },
      {
        userId: farmer2.id,
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Payment received',
        message: `Rs ${netC1.toLocaleString('en-PK')} credited for deal FAD-2025-1003.`,
        link: '/records',
        createdAt: daysAgo(6),
      },
      {
        userId: arhti.id,
        type: NotificationType.PICKUP_CONFIRMED,
        title: 'Onion consignment in transit',
        message: '3,000 kg from Zubair Khan is on the M-1, ETA about 3 hours. Weigh it on arrival.',
        link: '/receiving',
        createdAt: hoursAgo(9),
      },
      {
        userId: arhti.id,
        type: NotificationType.NEW_BID,
        title: 'New bid on your onion auction',
        message: 'Bilal Ahmed bid Rs 81/kg on 1,500 kg Grade A onion.',
        link: '/auction-house',
        createdAt: hoursAgo(1),
      },
      {
        userId: arhti2.id,
        type: NotificationType.INFO,
        title: 'Potato buy request still open',
        message: 'DR-2025-1003 has no matching batches yet in Okara.',
        link: '/demand',
        createdAt: daysAgo(1),
      },
      {
        userId: vendor.id,
        type: NotificationType.AUCTION_ENDING,
        title: 'Onion auction closes in 6 hours',
        message: 'You lead at Rs 81/kg on 1,500 kg Grade A onion in Islamabad.',
        link: '/auctions',
        createdAt: hoursAgo(1),
      },
      {
        userId: vendor.id,
        type: NotificationType.WHOLESALE_ORDER,
        title: 'Wholesale order fulfilled',
        message: 'Fresh Corner bought 150 kg tomato at Rs 104/kg.',
        link: '/sales',
        isRead: true,
        createdAt: daysAgo(5),
      },
      {
        userId: vendor2.id,
        type: NotificationType.OUTBID,
        title: 'You were outbid',
        message: 'Bilal Ahmed is now leading the onion auction at Rs 81/kg.',
        link: '/auctions',
        createdAt: hoursAgo(1),
      },
      {
        userId: shopkeeper.id,
        type: NotificationType.RETAIL_ORDER,
        title: 'New customer order',
        message: '5 kg potato — Rs 500. Ayesha Siddiqui, G-11/3.',
        link: '/retail-orders',
        createdAt: hoursAgo(1),
      },
      {
        userId: shopkeeper.id,
        type: NotificationType.INFO,
        title: '100 kg potato still unlisted',
        message: 'Stock SS-POT-1003 has 100 kg that is not on your storefront yet.',
        link: '/shop-stock',
        createdAt: hoursAgo(6),
      },
      {
        userId: shopkeeper2.id,
        type: NotificationType.INFO,
        title: '50 kg tomato still unlisted',
        message: 'Stock SS-TOM-1002 has 50 kg that is not on your storefront yet.',
        link: '/shop-stock',
        createdAt: hoursAgo(6),
      },
      {
        userId: consumer.id,
        type: NotificationType.ORDER_DELIVERED,
        title: 'Order delivered',
        message: 'Your order CO-2025-1003 from Fresh Corner has been delivered. Rate your shop.',
        link: '/orders',
        createdAt: daysAgo(2),
      },
      {
        userId: admin.id,
        type: NotificationType.INFO,
        title: 'Chain traced end to end',
        message: 'Batch FB-2025-1001 now has 11 recorded stages from Swabi to G-11.',
        link: '/admin/trace',
        createdAt: daysAgo(4),
      },
    ],
  });

  await prisma.mandi.update({
    where: { id: islamabad.id },
    data: { activeAuctionsCount: 1 },
  });

  const counts = {
    users: await prisma.user.count(),
    batches: await prisma.farmerCropBatch.count(),
    deals: await prisma.farmerArhtiDeal.count(),
    lots: await prisma.arhtiInventoryLot.count(),
    auctions: await prisma.auction.count(),
    vendorStock: await prisma.vendorInventory.count(),
    wholesaleOffers: await prisma.vendorOffer.count(),
    shopStock: await prisma.shopkeeperInventory.count(),
    retailListings: await prisma.retailListing.count(),
    consumerOrders: await prisma.consumerOrder.count(),
    chainEvents: await prisma.supplyChainEvent.count(),
  };

  console.log('AgriConnect demo seeded');
  console.table(counts);
  console.log(`\nAll demo accounts use the password: ${DEMO_PASSWORD}`);
  console.log('  farmer@demo.pk       Zubair Khan (Swabi)');
  console.log('  farmer2@demo.pk      Ghulam Rasool (Okara)');
  console.log('  arhti@demo.pk        Haji Aslam (Islamabad Sabzi Mandi)');
  console.log('  arhti2@demo.pk       Malik Tanveer (Badami Bagh, Lahore)');
  console.log('  vendor@demo.pk       Bilal Traders Wholesale (Islamabad)');
  console.log('  vendor2@demo.pk      Kareem Wholesale Supply (Rawalpindi)');
  console.log('  shopkeeper@demo.pk   Green Mart (G-11, Islamabad)');
  console.log('  shopkeeper2@demo.pk  Fresh Corner (F-10, Islamabad)');
  console.log('  consumer@demo.pk     Ayesha Siddiqui (G-11/3)');
  console.log('  admin@demo.pk        Mandi Administration');
  console.log('\nFlagship chain FB-2025-1001: Rs 74 -> Rs 92 -> Rs 104 -> Rs 145 per kg');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
