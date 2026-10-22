'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  AgentActionStatus,
  CropBatchStatus,
  DemandStatus,
  DealStatus,
  OfferStatus,
  Prisma,
  SupplyChainStage,
  UserRole,
} from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { askAiSchema, confirmAgentActionSchema } from '@/lib/validations/ai';
import { createCropBatchSchema } from '@/lib/validations/workflow';
import {
  businessNumber,
  recordChainEvent,
  shortCode,
} from '@/lib/supplychain';
import {
  AMIS_TOMATO_PRICES,
  AMIS_TOMATO_REPORT_DATE,
  AMIS_TOMATO_REPORTED_UNIT,
  AMIS_TOMATO_SOURCE,
} from '@/lib/data/amis-tomato-prices';

import {
  askAi as legacyAskAi,
  confirmAgentAction as legacyConfirmAgentAction,
  cancelAgentAction as legacyCancelAgentAction,
} from '@/lib/actions/ai';

/*
 * LLM provider settings. Any OpenAI-compatible /chat/completions endpoint
 * works (OpenRouter by default, or e.g. Qwen on Alibaba Cloud), configured
 * through OPENROUTER_API_KEY, OPENROUTER_BASE_URL and OPENROUTER_MODEL.
 */
const DEFAULT_AI_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_AI_MODEL = 'qwen/qwen-plus';

// Covers the whole request, including reading the response body.
const AI_TIMEOUT_MS = 30_000;

// A wrong-script reply is retried once, but only if the first call was quick.
const SCRIPT_RETRY_BUDGET_MS = 15_000;

/*
 * Runtime validation for the model output. Numbers sometimes arrive as
 * numeric strings, so those are accepted and converted.
 */
const nullableNumber = z.preprocess(
  (value) =>
    typeof value === 'string' &&
    value.trim() !== '' &&
    !Number.isNaN(Number(value))
      ? Number(value)
      : value,
  z.number().nullable()
);

const cropDraftSchema = z.object({
  cropName: z.string().nullable(),
  quantityKg: nullableNumber,
  variety: z.string().nullable(),
  grade: z.string().nullable(),
  originVillage: z.string().nullable(),
  originCity: z.string().nullable(),
  originProvince: z.string().nullable(),
  harvestDate: z.string().nullable(),
  readyDate: z.string().nullable(),
  packaging: z.string().nullable(),
  askingPricePerKg: nullableNumber,
  notes: z.string().nullable(),
});

const naturalAiResultSchema = z.object({
  language: z.enum(['english', 'urdu', 'roman_urdu']),
  reply: z.string().trim().min(1),
  action: z.enum(['NONE', 'CREATE_CROP_BATCH']),
  readyToConfirm: z.boolean(),
  cropDraft: cropDraftSchema,
  suggestedView: z.enum(['NONE', 'CROPS', 'OFFERS', 'DEALS', 'RECORDS']),
});

type CropDraft = z.infer<typeof cropDraftSchema>;

type NaturalAiResult = z.infer<typeof naturalAiResultSchema>;

type MessageScript = 'urdu' | 'latin';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type StoredHistory = {
  role: 'user' | 'ai';
  text: string;
};

const EMPTY_DRAFT: CropDraft = {
  cropName: null,
  quantityKg: null,
  variety: null,
  grade: null,
  originVillage: null,
  originCity: null,
  originProvince: null,
  harvestDate: null,
  readyDate: null,
  packaging: null,
  askingPricePerKg: null,
  notes: null,
};

const VIEW_LINKS: Record<
  NaturalAiResult['suggestedView'],
  { label: string; href: string } | null
> = {
  NONE: null,
  CROPS: {
    label: 'My Crops',
    href: '/crops',
  },
  OFFERS: {
    label: 'Arhti Requests',
    href: '/arhti-requests',
  },
  DEALS: {
    label: 'My Deals',
    href: '/deals',
  },
  RECORDS: {
    label: 'Payments & Records',
    href: '/records',
  },
};

/*
 * Common spellings farmers use for the seeded crops, keyed by the
 * lower-case English crop name. The Urdu name from the database is always
 * accepted as well.
 */
const CROP_ALIASES: Record<string, string[]> = {
  tomato: ['tomatoes', 'tamatar', 'tamater', 'timatar', 'tamatur', 'ٹماٹر'],
  potato: ['potatoes', 'aloo', 'alu', 'aaloo', 'آلو'],
  onion: ['onions', 'piyaz', 'pyaz', 'piaz', 'pyaaz', 'پیاز'],
  wheat: ['gandum', 'gandam', 'گندم'],
  maize: ['corn', 'makai', 'makki', 'makkai', 'مکئی', 'مکی'],
};

function asRecord(value: unknown): Record<string, unknown> {
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getHistory(context: Record<string, unknown>): StoredHistory[] {
  if (!Array.isArray(context.history)) {
    return [];
  }

  return context.history
    .filter(
      (item): item is StoredHistory =>
        typeof item === 'object' &&
        item !== null &&
        'role' in item &&
        'text' in item &&
        ((item as StoredHistory).role === 'user' ||
          (item as StoredHistory).role === 'ai') &&
        typeof (item as StoredHistory).text === 'string'
    )
    .map((item) => ({ role: item.role, text: item.text }))
    .slice(-12);
}

function getDraft(context: Record<string, unknown>): CropDraft {
  const raw = asRecord(context.cropDraft);

  return {
    cropName:
      typeof raw.cropName === 'string' ? raw.cropName : null,

    quantityKg:
      typeof raw.quantityKg === 'number' ? raw.quantityKg : null,

    variety:
      typeof raw.variety === 'string' ? raw.variety : null,

    grade:
      typeof raw.grade === 'string' ? raw.grade : null,

    originVillage:
      typeof raw.originVillage === 'string'
        ? raw.originVillage
        : null,

    originCity:
      typeof raw.originCity === 'string' ? raw.originCity : null,

    originProvince:
      typeof raw.originProvince === 'string'
        ? raw.originProvince
        : null,

    harvestDate:
      typeof raw.harvestDate === 'string'
        ? raw.harvestDate
        : null,

    readyDate:
      typeof raw.readyDate === 'string' ? raw.readyDate : null,

    packaging:
      typeof raw.packaging === 'string'
        ? raw.packaging
        : null,

    askingPricePerKg:
      typeof raw.askingPricePerKg === 'number'
        ? raw.askingPricePerKg
        : null,

    notes:
      typeof raw.notes === 'string' ? raw.notes : null,
  };
}

function mergeDraft(
  oldDraft: CropDraft,
  newDraft: CropDraft
): CropDraft {
  return {
    cropName: newDraft.cropName ?? oldDraft.cropName,
    quantityKg: newDraft.quantityKg ?? oldDraft.quantityKg,
    variety: newDraft.variety ?? oldDraft.variety,
    grade: newDraft.grade ?? oldDraft.grade,
    originVillage:
      newDraft.originVillage ?? oldDraft.originVillage,
    originCity: newDraft.originCity ?? oldDraft.originCity,
    originProvince:
      newDraft.originProvince ?? oldDraft.originProvince,
    harvestDate:
      newDraft.harvestDate ?? oldDraft.harvestDate,
    readyDate: newDraft.readyDate ?? oldDraft.readyDate,
    packaging: newDraft.packaging ?? oldDraft.packaging,
    askingPricePerKg:
      newDraft.askingPricePerKg ??
      oldDraft.askingPricePerKg,
    notes: newDraft.notes ?? oldDraft.notes,
  };
}

function normalizeCropName(value: string) {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Matches what the farmer (or the model) called the crop against the
 * supported crops: English name, plural, Urdu name or a common Roman Urdu
 * spelling such as "tamatar".
 */
function findSupportedCrop<
  T extends { name: string; nameUrdu: string | null }
>(cropName: string | null, crops: T[]): T | undefined {
  if (!cropName) {
    return undefined;
  }

  const wanted = normalizeCropName(cropName);
  const singular = wanted.replace(/(es|s)$/, '');

  return crops.find((crop) => {
    const names = [
      crop.name,
      crop.nameUrdu ?? '',
      ...(CROP_ALIASES[crop.name.toLowerCase()] ?? []),
    ]
      .map(normalizeCropName)
      .filter(Boolean);

    return names.includes(wanted) || names.includes(singular);
  });
}

function countScripts(text: string) {
  return {
    urdu: (text.match(/[؀-ۿ]/g) ?? []).length,
    latin: (text.match(/[A-Za-z]/g) ?? []).length,
  };
}

function messageScript(text: string): MessageScript {
  const { urdu, latin } = countScripts(text);

  return urdu > latin ? 'urdu' : 'latin';
}

// Common Urdu words written in English letters. Words that are also
// ordinary English (do, me, to) are left out on purpose.
const ROMAN_URDU_WORDS = new Set([
  'mera', 'meri', 'mere', 'mujhe', 'muje', 'mjhe', 'hum', 'humara', 'aap',
  'kya', 'kia', 'hai', 'hain', 'tha', 'thi', 'kahan', 'kab', 'kaise',
  'kaisay', 'kitna', 'kitne', 'kitni', 'kyun', 'kaunsi', 'konsi', 'kaun',
  'karun', 'karoon', 'karo', 'kar', 'ko', 'ka', 'ki', 'ke', 'aur', 'nahi',
  'nahin', 'haan', 'han', 'bhi', 'se', 'mein', 'abhi', 'rakhun', 'rakhoon',
  'bechun', 'bechoon', 'bechna', 'batao', 'bataen', 'chahiye', 'chahye',
  'theek', 'thik', 'wala', 'wali', 'raha', 'rahi', 'gaya', 'gayi', 'liye',
  'paisa', 'pese', 'paise', 'fasal', 'bhao', 'qeemat', 'tamatar', 'aloo',
  'pyaz', 'piyaz', 'mandi', 'arhti', 'kilo', 'zyada', 'kam', 'acha',
]);

function romanUrduLikely(text: string) {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hits = words.filter((word) => ROMAN_URDU_WORDS.has(word)).length;

  return words.length <= 3 ? hits >= 1 : hits >= 2;
}

/*
 * Crop names, "Rs" and "kg" may appear in Latin letters inside an Urdu
 * reply (and an Urdu crop name inside a Latin reply), so this only checks
 * which script dominates.
 */
function replyMatchesScript(reply: string, script: MessageScript) {
  const { urdu, latin } = countScripts(reply);

  if (script === 'urdu') {
    return urdu >= latin;
  }

  return urdu * 4 <= latin;
}

// Plain words for batch and deal statuses, so internal enum names never
// reach the farmer through the model.
const PLAIN_STATUS: Record<string, string> = {
  GROWING: 'still growing, not harvested yet',
  READY_FOR_SALE: 'ready for sale',
  NEGOTIATING: 'in talks with an arhti',
  RESERVED: 'reserved for a deal',
  AGREED: 'agreed, waiting for pickup to be arranged',
  PICKUP_SCHEDULED: 'pickup scheduled',
  PICKED_UP: 'picked up from the farm',
  IN_TRANSIT: 'on the way to the mandi',
  RECEIVED_BY_ARHTI: 'received at the mandi, waiting for weighing',
  WEIGHT_VERIFIED: 'weighed, payment being prepared',
  PAYMENT_PENDING: 'payment on its way',
  PAID: 'paid',
  DISPUTED: 'disputed',
};

function plainStatus(status: string) {
  return PLAIN_STATUS[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

function karachiToday() {
  const now = new Date();

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    weekday: 'long',
  }).format(now);

  return `${date} (${weekday})`;
}

async function getFarmerContext(userId: string) {
  const batches = await prisma.farmerCropBatch.findMany({
    where: {
      farmerId: userId,
      status: {
        notIn: [
          CropBatchStatus.ARCHIVED,
          CropBatchStatus.SOLD_OUT,
        ],
      },
    },
    include: {
      crop: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 8,
  });

  const cropIds = [...new Set(batches.map((b) => b.cropId))];

  const [
    farmer,
    offers,
    demands,
    deals,
    settlements,
    marketPrices,
    crops,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        farmerProfile: true,
      },
    }),

    prisma.farmerArhtiOffer.findMany({
      where: {
        farmerId: userId,
        status: OfferStatus.PENDING,
      },
      include: {
        arhti: {
          select: {
            id: true,
            name: true,
            arhtiProfile: {
              select: {
                businessName: true,
                commissionRate: true,
              },
            },
          },
        },
        batch: {
          include: {
            crop: true,
          },
        },
        destinationMandi: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    }),

    prisma.arhtiDemandRequest.findMany({
      where: {
        status: DemandStatus.OPEN,

        ...(cropIds.length
          ? {
              cropId: {
                in: cropIds,
              },
            }
          : {}),
      },
      include: {
        crop: true,
        mandi: true,
        arhti: {
          select: {
            id: true,
            name: true,
            arhtiProfile: {
              select: {
                businessName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    }),

    prisma.farmerArhtiDeal.findMany({
      where: {
        farmerId: userId,
        status: {
          notIn: [
            DealStatus.COMPLETED,
            DealStatus.CANCELLED,
          ],
        },
      },
      include: {
        crop: true,
        arhti: {
          select: {
            name: true,
            arhtiProfile: {
              select: {
                commissionRate: true,
              },
            },
          },
        },
        destinationMandi: true,
        pickup: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 8,
    }),

    prisma.settlement.findMany({
      where: {
        farmerId: userId,
      },
      include: {
        deal: {
          include: {
            crop: true,
            arhti: {
              select: {
                name: true,
              },
            },
          },
        },
        deductions: {
          select: {
            type: true,
            amount: true,
            description: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 8,
    }),

    prisma.marketPrice.findMany({
      include: {
        crop: true,
        mandi: true,
      },
      orderBy: {
        recordedAt: 'desc',
      },
      take: 50,
    }),

    prisma.crop.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
  ]);

  return {
    farmer: farmer
      ? {
          name: farmer.name,
          location: farmer.location,
          village: farmer.farmerProfile?.village ?? null,
          primaryCrops:
            farmer.farmerProfile?.primaryCrops ?? [],
        }
      : null,

    myCropBatches: batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      crop: batch.crop.name,
      cropUrdu: batch.crop.nameUrdu,
      availableKg: batch.availableKg,
      originallyListedKg: batch.quantityKg,
      grade: batch.grade,
      originVillage: batch.originVillage,
      originCity: batch.originCity,
      originProvince: batch.originProvince,
      harvestDate: batch.harvestDate,
      readyDate: batch.readyDate,
      askingPricePerKg: batch.askingPricePerKg,
      status: plainStatus(batch.status),
    })),

    directArhtiOffers: offers.map((offer) => ({
      id: offer.id,
      arhti:
        offer.arhti.arhtiProfile?.businessName ??
        offer.arhti.name,

      arhtiCommissionRate:
        offer.arhti.arhtiProfile?.commissionRate ?? null,

      crop: offer.batch.crop.name,

      quantityKg: offer.quantityKg,

      pricePerKg: offer.pricePerKg,

      destinationMandi: offer.destinationMandi.name,

      destinationCity: offer.destinationMandi.city,

      transportResponsibility:
        offer.transportResponsibility,

      proposedPickupAt: offer.proposedPickupAt,

      note: offer.note,
    })),

    openArhtiDemandMatchingMyCrops: demands.map((demand) => ({
      id: demand.id,

      requestNumber: demand.requestNumber,

      arhti:
        demand.arhti.arhtiProfile?.businessName ??
        demand.arhti.name,

      crop: demand.crop.name,

      cropUrdu: demand.crop.nameUrdu,

      minQuantityKg: demand.minQuantityKg,

      maxQuantityKg: demand.maxQuantityKg,

      gradeWanted: demand.gradeWanted,

      preferredOrigins: demand.preferredOrigins,

      targetPriceMin: demand.targetPriceMin,

      targetPriceMax: demand.targetPriceMax,

      neededBy: demand.neededBy,

      transportOffered: demand.transportOffered,

      mandi: demand.mandi.name,

      mandiCity: demand.mandi.city,

      notes: demand.notes,
    })),

    activeDeals: deals.map((deal) => ({
      id: deal.id,

      dealNumber: deal.dealNumber,

      crop: deal.crop.name,

      arhti: deal.arhti.name,

      arhtiCommissionRate:
        deal.arhti.arhtiProfile?.commissionRate ?? null,

      quantityKg: deal.agreedQuantityKg,

      pricePerKg: deal.agreedPricePerKg,

      grossAmount: deal.grossAmount,

      transportResponsibility: deal.transportResponsibility,

      transportCost: deal.transportCost,

      destinationMandi: deal.destinationMandi.name,

      status: plainStatus(deal.status),

      driver: deal.pickup?.driverName ?? null,

      scheduledPickup: deal.pickup?.scheduledAt ?? null,
    })),

    payments: settlements.map((settlement) => ({
      dealNumber: settlement.deal.dealNumber,

      crop: settlement.deal.crop.name,

      arhti: settlement.deal.arhti.name,

      grossAmount: settlement.grossAmount,

      deductions: settlement.deductionsTotal,

      deductionBreakdown: settlement.deductions,

      netPayable: settlement.netPayable,

      status: settlement.status,
    })),

    publicMandiPrices: marketPrices.map((price) => ({
      crop: price.crop.name,
      cropUrdu: price.crop.nameUrdu,

      mandi: price.mandi.name,

      city: price.mandi.city,

      ratePerKg: price.ratePerKg,

      high24hPerKg: price.high24h,

      low24hPerKg: price.low24h,

      trend: price.trend,

      changePercent: price.changePercent,

      dailyArrivalTonnes: price.dailyArrivalTonnes,

      recordedAt: price.recordedAt,

      recordedDaysAgo: Math.floor(
        (Date.now() - price.recordedAt.getTime()) / 86_400_000
      ),
    })),

    amisTomatoReport: {
      source: AMIS_TOMATO_SOURCE,
      reportDate: AMIS_TOMATO_REPORT_DATE,
      unit: AMIS_TOMATO_REPORTED_UNIT,
      note:
        'Mandi/wholesale reference prices, not farm-gate offers. approxFqpPerKg = fqp / 100 and is only valid if the unit is Rs per 100 kg.',
      cities: AMIS_TOMATO_PRICES.filter(
        (row) => row.fqp !== null
      ).map((row) => ({
        city: row.city,
        min: row.min,
        max: row.max,
        fqp: row.fqp,
        approxFqpPerKg:
          row.fqp === null ? null : row.fqp / 100,
      })),
      citiesWithNoPriceReported: AMIS_TOMATO_PRICES.filter(
        (row) => row.fqp === null
      ).map((row) => row.city),
    },

    supportedCrops: crops.map((crop) => ({
      id: crop.id,
      name: crop.name,
      nameUrdu: crop.nameUrdu,
      category: crop.category,
    })),
  };
}

const RESPONSE_SCHEMA = {
  type: 'object',

  additionalProperties: false,

  properties: {
    language: {
      type: 'string',
      enum: ['english', 'urdu', 'roman_urdu'],
    },

    reply: {
      type: 'string',
    },

    action: {
      type: 'string',
      enum: ['NONE', 'CREATE_CROP_BATCH'],
    },

    readyToConfirm: {
      type: 'boolean',
    },

    cropDraft: {
      type: 'object',

      additionalProperties: false,

      properties: {
        cropName: {
          type: ['string', 'null'],
        },

        quantityKg: {
          type: ['number', 'null'],
        },

        variety: {
          type: ['string', 'null'],
        },

        grade: {
          type: ['string', 'null'],
        },

        originVillage: {
          type: ['string', 'null'],
        },

        originCity: {
          type: ['string', 'null'],
        },

        originProvince: {
          type: ['string', 'null'],
        },

        harvestDate: {
          type: ['string', 'null'],
        },

        readyDate: {
          type: ['string', 'null'],
        },

        packaging: {
          type: ['string', 'null'],
        },

        askingPricePerKg: {
          type: ['number', 'null'],
        },

        notes: {
          type: ['string', 'null'],
        },
      },

      required: [
        'cropName',
        'quantityKg',
        'variety',
        'grade',
        'originVillage',
        'originCity',
        'originProvince',
        'harvestDate',
        'readyDate',
        'packaging',
        'askingPricePerKg',
        'notes',
      ],
    },

    suggestedView: {
      type: 'string',

      enum: [
        'NONE',
        'CROPS',
        'OFFERS',
        'DEALS',
        'RECORDS',
      ],
    },
  },

  required: [
    'language',
    'reply',
    'action',
    'readyToConfirm',
    'cropDraft',
    'suggestedView',
  ],
} as const;

const INSTRUCTIONS = `
You are AgriConnect AI, a post-harvest selling assistant for Pakistani farmers. The current user is a FARMER.

WHAT YOU HELP WITH (after harvest: selling and money)
- crop prices and price trends
- which cities or mandis in Pakistan usually pay more
- what the farmer will actually receive after arhti commission, mandi cess / market fee, unloading and transport
- whether to sell now or hold
- storage after harvest: how to store, how long the crop lasts, typical losses
- transport: options, cost considerations, timing
- the farmer's own crops, offers, deals, pickups and payments in AgriConnect
- listing a crop on AgriConnect through this chat

TWO KINDS OF INFORMATION - keep them clearly separate
1. FARMER_CONTEXT (from the app): the farmer's own crops, offers, deals, payments, the app's mandi price records (publicMandiPrices) and the AMIS tomato report (amisTomatoReport). This is the ONLY source for the farmer's records and for exact prices.
2. Your general knowledge of Pakistani agricultural markets: seasonal price patterns, which markets are bigger or usually pay more, typical commission and cess ranges, storage life and losses, transport options and typical costs. Use it for guidance, but every fact or number that is NOT in FARMER_CONTEXT must be introduced as general guidance in the reply's language (for example "Aam tor par...", "Generally...", "عام طور پر..."), never as live data or as the farmer's own figures.

HARD RULES
- Never invent the farmer's crops, offers, deals, pickups, payments, arhti names or any exact current price. If FARMER_CONTEXT has no data for what was asked, say so plainly, then give general guidance if it helps.
- Copy batch numbers, deal numbers, names, quantities and amounts exactly as they appear in FARMER_CONTEXT, and only from the matching record (check the crop name of the record before using its batch number). For "how much do I have" use availableKg, not originallyListedKg. originVillage and originCity are places, not people. Batches in myCropBatches all belong to this farmer.
- When you quote a price from FARMER_CONTEXT, say where it is from and how old it is: "app mandi record" (recordedDaysAgo) or "AMIS report" (reportDate). Never call a record "today's" or "current" unless recordedDaysAgo is 0. Never present general knowledge as a current rate.
- AMIS tomato report: min, max and fqp are per 100 kg (assumed; the source does not print the unit), so per kg = value / 100. For tomato prices use this report, mention its date, and add a short unit caution once. The report covers ONLY the cities in amisTomatoReport.cities. Karachi, Islamabad and Peshawar are not in it. Never attribute an AMIS price to a city that is not listed there; for those cities only the app mandi records exist.
- Every price, cost or amount you state must either be copied from one specific record in FARMER_CONTEXT (with that record's own city, mandi and date) or be clearly labelled general guidance. When you mention a deal or offer, use its own crop, quantity and destinationMandi exactly.
- Net amount: net = availableKg x price - arhti commission - mandi cess / market fee - unloading - transport (if the farmer pays it). Use arhtiCommissionRate (a fraction: 0.02 = 2%) and the farmer's own past deductions (payments[].deductionBreakdown, as a percentage of that payment's grossAmount) when available, and say these come from their records. If you use typical rates instead, say they are typical, not their actual charges. Show the short calculation with every deduction you used. Never call gross sale value "profit".
- You do not have phone numbers or vehicle numbers. If asked, tell the farmer to open the deal in My Deals.
- The farmer cannot bid in mandi auctions. The farmer does not choose the mandi when listing a crop.
- The only thing you can do in the app is prepare a crop listing. Do not offer to contact arhtis, send requests, accept offers, book transport or move money. Never claim something happened unless FARMER_CONTEXT shows it.
- Never show internal names to the farmer (FARMER_CONTEXT, cropDraft, RECORDS, READY_FOR_SALE, NEGOTIATING and similar). Use page names (My Crops, Arhti Requests, My Deals, Payments & Records) and plain words for statuses.

OUT OF SCOPE
- Growing the crop (pests, diseases, fertilizer, seed, sowing, irrigation, spraying): in 1-2 sentences say you focus on selling, storage and transport after harvest, and suggest the local agriculture extension office (Mehkama Zaraat / محکمہ زراعت). Do not give growing advice.
- Anything not about farming or this app: politely decline in one sentence and say what you can help with.
- For both: action = NONE, suggestedView = NONE, and still reply in the farmer's language.
Example (Roman Urdu): "mere aloo ko keera lag gaya" -> "Main fasal bechne, storage aur transport mein madad karta hoon. Keeray aur spray ke liye apne qareebi Mehkama Zaraat (agriculture extension office) se rabta karein."

LANGUAGE (strict)
FARMER_MESSAGE_SCRIPT tells you which script the latest message used. ROMAN_URDU_LIKELY is true when the latest message contains common Urdu words written in English letters. Reply in exactly the farmer's language and script:
- Urdu script -> reply entirely in Urdu script. language = "urdu".
- Roman Urdu (Urdu written in English letters, e.g. "meri payments", "tamatar kahan bikte hain") -> reply in natural, conversational Roman Urdu, not English and never Urdu script. language = "roman_urdu". If ROMAN_URDU_LIKELY is true, the reply must be Roman Urdu even if the message also has English words.
- English -> reply in English. language = "english".
Follow the latest message, not earlier turns. Numbers, "Rs" and "kg" may stay as they are.
Understand spelling variants: mujhe/mjhe/muje, chahiye/chahye, arhti/aarti/arhati, tamatar/tamater/tomato, aloo/alu, piyaz/pyaz, paisa/pese/payment, fasal/crop, bhao/rate/qeemat, mandi/mundi.

ANSWER STYLE
- Answer the exact question first. No introductions, no capability lists.
- Keep it short: 2-4 short sentences, or up to 4 short lines starting with "- " when comparing places or showing a calculation.
- When the farmer asks you to choose (sell now or hold, which mandi, which crop, which offer), give ONE clear recommendation, the main reason, and one uncertainty if it matters. Do not hand the choice back.
- If something essential is missing, ask ONE short question.
- Plain text only: no Markdown, no asterisks, no headings, no emojis.
- Use recentConversation to resolve follow-ups ("aur doosri wali?", "us ka rate?"). If the farmer asks several things, answer all of them briefly.

CROP LISTING
When the farmer asks to add / list / register / sell a NEW crop on AgriConnect, set action = CREATE_CROP_BATCH and fill cropDraft from the conversation. In Roman Urdu "list kar do", "laga do", "daal do", "bechne ke liye daal do" about their crop mean: create a new listing (not: show my list). While a listing is being collected (existingCropDraft has values and the farmer is answering your question), keep action = CREATE_CROP_BATCH. Existing batches never block a new listing: the farmer may list the same crop again, so do not ask whether they mean an existing batch. Never ask for grade, variety, packaging, price or notes; they are optional. For every other message set action = NONE and every cropDraft field to null.
Example:
Farmer: "mera tamatar list kar do" -> action = CREATE_CROP_BATCH, cropName = "Tomato", readyToConfirm = false, reply: "Theek hai. Kitne kilo tamatar hain aur kis shehar ya gaon mein hain?"
Farmer: "3000 kilo hain, Swabi mein, aaj tor liye" -> quantityKg = 3000, originCity = "Swabi", originProvince = "Khyber Pakhtunkhwa", harvestDate = today, readyToConfirm = true, reply summarises the listing and asks them to press Confirm.
- cropName must be the English name of a crop in FARMER_CONTEXT.supportedCrops (for example "tamatar" -> "Tomato"). If the crop is not supported, say so and set readyToConfirm = false.
- Required: cropName, quantityKg (number, in kg; if the farmer says maund / mann, use 40 kg per maund and say so), originCity, originProvince, harvestDate (YYYY-MM-DD).
- grade defaults to "Standard" if the farmer does not know it. askingPricePerKg is optional. Do not ask for a mandi, auction price or arhti.
- "ready today": harvestDate = today, readyDate = today. "ready tomorrow": harvestDate = today, readyDate = tomorrow, unless they say otherwise. Dates are YYYY-MM-DD.
- You may infer the province from a well-known city or district: Swabi, Peshawar, Mardan -> Khyber Pakhtunkhwa; Lahore, Multan, Rawalpindi, Faisalabad, Okara -> Punjab; Karachi, Hyderabad -> Sindh; Quetta -> Balochistan; Islamabad -> Islamabad Capital Territory.
- If required information is missing: readyToConfirm = false and ask one simple question for what is missing.
- If everything required is present: readyToConfirm = true, briefly summarise what will be listed in plain words (for example "Tamatar 3000 kg, Swabi (Khyber Pakhtunkhwa), aaj ki harvest") and tell the farmer to press Confirm under Pending Actions. Do not ask them to confirm in chat. If they reply "yes" / "haan" in chat, keep the same cropDraft with readyToConfirm = true and remind them to press Confirm.
- Never tell the farmer to fill the form when you already have enough information.

suggestedView: default NONE. Set it only when the answer is about that page's own data: CROPS (My Crops) for the farmer's batches or a crop listing, OFFERS (Arhti Requests) for offers, DEALS (My Deals) for deals and pickups, RECORDS (Payments & Records) for payments. Price, storage and transport answers use NONE.

OUTPUT
Return only one JSON object that matches the response schema. No text outside the JSON.
`;

function getAiConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured on the server.'
    );
  }

  const baseUrl = (
    process.env.OPENROUTER_BASE_URL || DEFAULT_AI_BASE_URL
  ).replace(/\/+$/, '');

  const model = process.env.OPENROUTER_MODEL || DEFAULT_AI_MODEL;

  return {
    apiKey,
    baseUrl,
    model,
    isOpenRouter: /openrouter\.ai/i.test(baseUrl),
  };
}

function contentToText(content: unknown): string | null {
  if (typeof content === 'string') {
    return content;
  }

  // Some OpenAI-compatible providers return content as an array of parts.
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        const record = asRecord(part);
        return typeof record.text === 'string' ? record.text : '';
      })
      .join('');

    return text || null;
  }

  return null;
}

function parseJsonContent(content: string): unknown {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start === -1 || end <= start) {
      throw new Error('AI response is not JSON.');
    }

    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

async function callModel(
  messages: ChatMessage[]
): Promise<{ result: NaturalAiResult; raw: string }> {
  const config = getAiConfig();

  // Hard stop so a slow or hung provider can never freeze the chat. The
  // signal also aborts reading the body. On abort the askAi catch block
  // falls back to the rule-based assistant.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,

      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.isOpenRouter
          ? {
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'AgriConnect Pakistan',
            }
          : {}),
      },

      body: JSON.stringify({
        model: config.model,

        messages,

        temperature: 0.2,

        max_tokens: 1200,

        response_format: {
          type: 'json_schema',

          json_schema: {
            name: 'agriconnect_farmer_assistant',
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },

        // Only route to OpenRouter providers that honour json_schema.
        ...(config.isOpenRouter
          ? { provider: { require_parameters: true } }
          : {}),
      }),
    });

    const body = await response.text();

    if (!response.ok) {
      console.error(
        'AI provider error:',
        response.status,
        body.slice(0, 1000)
      );

      throw new Error(`AI service returned ${response.status}`);
    }

    const data = asRecord(JSON.parse(body));
    const choice = asRecord(
      Array.isArray(data.choices) ? data.choices[0] : undefined
    );
    const output = contentToText(asRecord(choice.message).content);

    if (!output) {
      console.error(
        'Unexpected AI response:',
        body.slice(0, 1000)
      );

      throw new Error('AI returned no usable response.');
    }

    const validated = naturalAiResultSchema.safeParse(
      parseJsonContent(output)
    );

    if (!validated.success) {
      console.error(
        'AI response failed validation:',
        validated.error.issues,
        output.slice(0, 1000)
      );

      throw new Error('AI response did not match the expected format.');
    }

    return { result: validated.data, raw: output };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function understandFarmer(
  message: string,
  history: StoredHistory[],
  draft: CropDraft,
  farmerContext: Awaited<
    ReturnType<typeof getFarmerContext>
  >
): Promise<NaturalAiResult> {
  const script = messageScript(message);

  const romanUrdu = script === 'latin' && romanUrduLikely(message);

  const input = JSON.stringify({
    TODAY: karachiToday(),

    FARMER_MESSAGE_SCRIPT:
      script === 'urdu' ? 'urdu_script' : 'english_letters',

    ROMAN_URDU_LIKELY: romanUrdu,

    latestMessage: message,

    recentConversation: history,

    existingCropDraft: draft,

    FARMER_CONTEXT: farmerContext,
  });

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: INSTRUCTIONS,
    },
    {
      role: 'user',
      content: input,
    },
  ];

  const startedAt = Date.now();

  let { result, raw } = await callModel(messages);

  const wrongLanguage =
    !replyMatchesScript(result.reply, script) ||
    (romanUrdu && result.language === 'english');

  if (
    wrongLanguage &&
    Date.now() - startedAt < SCRIPT_RETRY_BUDGET_MS
  ) {
    const wanted =
      script === 'urdu'
        ? 'Urdu script'
        : romanUrdu
          ? 'Roman Urdu (Urdu written in English letters)'
          : 'English letters (English or Roman Urdu, matching the farmer)';

    ({ result, raw } = await callModel([
      ...messages,
      {
        role: 'assistant',
        content: raw,
      },
      {
        role: 'user',
        content: `Your reply used the wrong script. The farmer wrote in ${wanted}. Return the same JSON with "reply" rewritten entirely in ${wanted}. Keep every fact and number the same.`,
      },
    ]));
  }

  return {
    ...result,

    language:
      script === 'urdu'
        ? 'urdu'
        : result.language === 'urdu'
          ? 'roman_urdu'
          : result.language,

    cropDraft: {
      ...EMPTY_DRAFT,
      ...result.cropDraft,
    },
  };
}

async function createOrResumeSession(
  requestedSessionId: string | undefined,
  userId: string,
  role: UserRole
) {
  let session = requestedSessionId
    ? await prisma.agentSession.findUnique({
        where: {
          id: requestedSessionId,
        },
      })
    : null;

  if (session && session.userId !== userId) {
    session = null;
  }

  if (!session) {
    session = await prisma.agentSession.create({
      data: {
        userId,
        context: {
          role,
          history: [],
          cropDraft: EMPTY_DRAFT,
        },
      },
    });
  }

  return session;
}

function missingCropFields(draft: CropDraft): string[] {
  const missing: string[] = [];

  if (!draft.cropName) {
    missing.push('crop');
  }

  if (!draft.quantityKg) {
    missing.push('quantity');
  }

  if (!draft.originCity) {
    missing.push('city');
  }

  if (!draft.originProvince) {
    missing.push('province');
  }

  if (!draft.harvestDate) {
    missing.push('harvest date');
  }

  return missing;
}

const CROP_PAYLOAD_KEYS = [
  'cropId',
  'cropName',
  'quantityKg',
  'variety',
  'grade',
  'originVillage',
  'originCity',
  'originProvince',
  'harvestDate',
  'readyDate',
  'packaging',
  'askingPricePerKg',
  'notes',
] as const;

function samePayload(a: unknown, b: Record<string, unknown>) {
  const record = asRecord(a);

  return CROP_PAYLOAD_KEYS.every(
    (key) => (record[key] ?? null) === (b[key] ?? null)
  );
}

/**
 * Natural-language entry point.
 *
 * Farmer gets full conversational interpretation.
 *
 * Other roles currently fall back to the existing safe tool router so this
 * upgrade does not destabilize their working workflows.
 */
export async function askAi(formData: FormData) {
  const user = await requireCapability('shared.ai');

  if (user.role !== UserRole.FARMER) {
    return legacyAskAi(formData);
  }

  const parsed = askAiSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!parsed.success) {
    return {
      error: parsed.error.errors
        .map((error) => error.message)
        .join(', '),
    };
  }

  const { sessionId, message } = parsed.data;

  const session = await createOrResumeSession(
    sessionId,
    user.id,
    user.role
  );

  const oldContext = asRecord(session.context);

  const history = getHistory(oldContext);

  const oldDraft = getDraft(oldContext);

  try {
    const farmerContext = await getFarmerContext(user.id);

    const aiResult = await understandFarmer(
      message,
      history,
      oldDraft,
      farmerContext
    );

    const mergedDraft =
      aiResult.action === 'CREATE_CROP_BATCH'
        ? mergeDraft(oldDraft, aiResult.cropDraft)
        : oldDraft;

    let pendingActionId: string | undefined;
    let pendingActionSummary: string | undefined;
    let supersededActionIds: string[] = [];

    if (
      aiResult.action === 'CREATE_CROP_BATCH' &&
      aiResult.readyToConfirm
    ) {
      const missing = missingCropFields(mergedDraft);

      const crop =
        missing.length === 0
          ? findSupportedCrop(
              mergedDraft.cropName,
              farmerContext.supportedCrops
            )
          : undefined;

      if (crop) {
        const payload = {
          cropId: crop.id,

          cropName: crop.name,

          quantityKg: mergedDraft.quantityKg!,

          variety: mergedDraft.variety,

          grade: mergedDraft.grade ?? 'Standard',

          originVillage:
            mergedDraft.originVillage,

          originCity: mergedDraft.originCity!,

          originProvince:
            mergedDraft.originProvince!,

          harvestDate:
            mergedDraft.harvestDate!,

          readyDate: mergedDraft.readyDate,

          packaging: mergedDraft.packaging,

          askingPricePerKg:
            mergedDraft.askingPricePerKg,

          notes: mergedDraft.notes,
        };

        /*
         * One pending crop listing per session: an identical one is reused,
         * a changed one replaces the old one.
         */
        const existing = await prisma.agentAction.findMany({
          where: {
            sessionId: session.id,
            actionType: 'CREATE_CROP_BATCH',
            status: AgentActionStatus.PENDING,
          },
        });

        const same = existing.find((action) =>
          samePayload(action.payload, payload)
        );

        if (same) {
          pendingActionId = same.id;
          pendingActionSummary = same.humanSummary;
        }

        supersededActionIds = existing
          .filter((action) => action.id !== same?.id)
          .map((action) => action.id);

        if (supersededActionIds.length) {
          await prisma.agentAction.updateMany({
            where: {
              id: {
                in: supersededActionIds,
              },
              status: AgentActionStatus.PENDING,
            },
            data: {
              status: AgentActionStatus.CANCELLED,
            },
          });
        }

        if (!same) {
          pendingActionSummary = `List ${
            mergedDraft.quantityKg
          } kg ${crop.name} from ${
            mergedDraft.originCity
          }`;

          const action = await prisma.agentAction.create({
            data: {
              sessionId: session.id,

              actionType: 'CREATE_CROP_BATCH',

              humanSummary: pendingActionSummary,

              payload: payload as Prisma.InputJsonValue,
            },
          });

          pendingActionId = action.id;
        }
      }
    }

    const nextHistory: StoredHistory[] = [
      ...history,
      {
        role: 'user' as const,
        text: message,
      },
      {
        role: 'ai' as const,
        text: aiResult.reply,
      },
    ].slice(-12);

    await prisma.agentSession.update({
      where: {
        id: session.id,
      },

      data: {
        context: {
          ...oldContext,

          role: user.role,

          history: nextHistory,

          cropDraft:
            aiResult.action === 'CREATE_CROP_BATCH'
              ? mergedDraft
              : oldContext.cropDraft ?? EMPTY_DRAFT,
        } as Prisma.InputJsonValue,

        updatedAt: new Date(),
      },
    });

    const view = VIEW_LINKS[aiResult.suggestedView];

    revalidatePath('/ai-assistant');

    return {
      success: true as const,

      sessionId: session.id,

      tool:
        aiResult.action === 'CREATE_CROP_BATCH'
          ? 'myCrops'
          : 'help',

      reply: aiResult.reply,

      replyUrdu:
        aiResult.language === 'urdu'
          ? aiResult.reply
          : undefined,

      suggestedActions: view ? [view] : undefined,

      pendingActionId,

      pendingActionType: pendingActionId
        ? 'CREATE_CROP_BATCH'
        : undefined,

      pendingActionSummary,

      supersededActionIds,
    };
  } catch (error) {
    console.error('Natural AgriConnect AI failed:', error);

    /*
     * Important hackathon fallback:
     *
     * The existing rule-based assistant still works if the LLM service or
     * API key fails. It continues the session created above instead of
     * opening a second one.
     */
    const fallbackFormData = new FormData();
    fallbackFormData.set('sessionId', session.id);
    fallbackFormData.set('message', message);

    return legacyAskAi(fallbackFormData);
  }
}

class ActionAlreadyProcessedError extends Error {}

/**
 * Confirmation wrapper.
 *
 * Existing AI actions continue through the old implementation.
 * CREATE_CROP_BATCH is executed here because it is a genuine AI-assisted
 * database action rather than simply opening a form.
 */
export async function confirmAgentAction(
  formData: FormData
) {
  const user = await requireCapability('shared.ai');

  const parsed = confirmAgentActionSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!parsed.success) {
    return {
      error: parsed.error.errors
        .map((error) => error.message)
        .join(', '),
    };
  }

  const action = await prisma.agentAction.findUnique({
    where: {
      id: parsed.data.actionId,
    },

    include: {
      session: true,
    },
  });

  if (!action) {
    return {
      error: 'Action not found',
    };
  }

  if (action.session.userId !== user.id) {
    return {
      error: 'Forbidden',
    };
  }

  /*
   * Anything that isn't our new crop action continues to use the
   * existing implementation.
   */
  if (action.actionType !== 'CREATE_CROP_BATCH') {
    return legacyConfirmAgentAction(formData);
  }

  if (user.role !== UserRole.FARMER) {
    return {
      error: 'Only a farmer can create a crop batch.',
    };
  }

  if (action.status !== AgentActionStatus.PENDING) {
    return {
      error: 'Action already processed',
    };
  }

  const payload = asRecord(action.payload);

  const validation = createCropBatchSchema.safeParse({
    cropId: payload.cropId,

    quantityKg: payload.quantityKg,

    variety: payload.variety ?? undefined,

    grade: payload.grade ?? 'Standard',

    originVillage:
      payload.originVillage ?? undefined,

    originCity: payload.originCity,

    originProvince: payload.originProvince,

    harvestDate: payload.harvestDate,

    readyDate: payload.readyDate ?? undefined,

    packaging: payload.packaging ?? undefined,

    askingPricePerKg:
      payload.askingPricePerKg ?? undefined,

    notes: payload.notes ?? undefined,

    photos: undefined,
  });

  if (!validation.success) {
    return {
      error: validation.error.errors
        .map((error) => error.message)
        .join(', '),
    };
  }

  const data = validation.data;

  const crop = await prisma.crop.findUnique({
    where: {
      id: data.cropId,
    },
  });

  if (!crop) {
    return {
      error: 'Crop no longer exists.',
    };
  }

  let createdBatchId: string | undefined;

  try {
    await prisma.$transaction(async (tx) => {
      /*
       * Claim the action first. Only one confirm can move it out of
       * PENDING, so a double click or a second tab cannot create a
       * second batch.
       */
      const claimed = await tx.agentAction.updateMany({
        where: {
          id: action.id,

          status: AgentActionStatus.PENDING,
        },

        data: {
          status: AgentActionStatus.CONFIRMED,

          confirmedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        throw new ActionAlreadyProcessedError();
      }

      const batchNumber = `${shortCode(
        data.originCity
      )}-${shortCode(crop.name)}-${businessNumber('B').slice(
        2
      )}`;

      const photos = crop.imageUrl
        ? [crop.imageUrl]
        : [];

      const batch = await tx.farmerCropBatch.create({
        data: {
          batchNumber,

          cropId: crop.id,

          farmerId: user.id,

          variety: data.variety || null,

          quantityKg: data.quantityKg,

          availableKg: data.quantityKg,

          grade: data.grade,

          originVillage:
            data.originVillage || null,

          originCity: data.originCity,

          originProvince:
            data.originProvince,

          harvestDate: data.harvestDate,

          readyDate: data.readyDate ?? null,

          packaging:
            data.packaging || null,

          askingPricePerKg:
            data.askingPricePerKg ?? null,

          photos,

          notes: data.notes || null,

          status: CropBatchStatus.READY_FOR_SALE,
        },
      });

      createdBatchId = batch.id;

      await recordChainEvent(tx, {
        batchId: batch.id,

        stage: SupplyChainStage.FARMER_HARVEST,

        actorId: user.id,

        actorRole: UserRole.FARMER,

        title: 'Crop batch registered with AgriConnect AI',

        description: `${data.quantityKg.toLocaleString(
          'en-PK'
        )} kg ${crop.name} (${data.grade}) from ${
          data.originCity
        }`,

        quantityKg: data.quantityKg,

        pricePerKg:
          data.askingPricePerKg ?? null,

        refType: 'FarmerCropBatch',

        refId: batch.id,
      });

      /*
       * Clear the crop draft after successful creation.
       */
      const context = asRecord(action.session.context);

      await tx.agentSession.update({
        where: {
          id: action.session.id,
        },

        data: {
          context: {
            ...context,

            cropDraft: EMPTY_DRAFT,
          } as Prisma.InputJsonValue,
        },
      });
    });
  } catch (error) {
    if (error instanceof ActionAlreadyProcessedError) {
      return {
        error: 'Action already processed',
      };
    }

    throw error;
  }

  revalidatePath('/crops');
  revalidatePath('/sourcing');
  revalidatePath('/ai-assistant');

  return {
    success: true as const,

    actionType: 'CREATE_CROP_BATCH',

    href: createdBatchId
      ? '/crops'
      : undefined,
  };
}

/**
 * Cancel wrapper.
 *
 * The status change itself stays in the existing implementation. For a
 * farmer's crop listing the half-finished crop draft is also cleared, so
 * old details do not leak into the next listing.
 */
export async function cancelAgentAction(
  formData: FormData
) {
  const user = await requireCapability('shared.ai');

  const result = await legacyCancelAgentAction(formData);

  if ('error' in result || user.role !== UserRole.FARMER) {
    return result;
  }

  const actionId = formData.get('actionId');

  const action =
    typeof actionId === 'string'
      ? await prisma.agentAction.findUnique({
          where: {
            id: actionId,
          },

          include: {
            session: true,
          },
        })
      : null;

  if (
    action &&
    action.actionType === 'CREATE_CROP_BATCH' &&
    action.session.userId === user.id
  ) {
    await prisma.agentSession.update({
      where: {
        id: action.session.id,
      },

      data: {
        context: {
          ...asRecord(action.session.context),

          cropDraft: EMPTY_DRAFT,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return result;
}
