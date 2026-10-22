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
  TransportResponsibility,
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
} from '@/lib/data/amis-tomato-prices';

import {
  askAi as legacyAskAi,
  confirmAgentAction as legacyConfirmAgentAction,
  cancelAgentAction as legacyCancelAgentAction,
} from '@/lib/actions/ai';

/*
 * LLM provider settings. Any OpenAI-compatible /chat/completions endpoint
 * works, configured through AI_API_KEY, AI_BASE_URL and AI_MODEL. The
 * defaults are Alibaba Cloud Model Studio (Singapore).
 */
const DEFAULT_AI_BASE_URL =
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const DEFAULT_AI_MODEL = 'qwen-plus-2025-12-01';

// Covers the whole request, including reading the response body.
const AI_TIMEOUT_MS = 30_000;

// A reply in the wrong language or with an unknown price is retried once,
// but only if the first call was quick.
const RETRY_BUDGET_MS = 15_000;

// Recent turns sent to the model (the session itself keeps 12).
const HISTORY_FOR_MODEL = 6;

// Highest prices sent per source, besides the farmer's own and named cities.
const TOP_PRICES_PER_SOURCE = 6;

/*
 * Settlement rules, the same as receiveProduce in lib/actions/deals.ts:
 * commission = gross x arhti commission rate (default 2%), mandi cess
 * 0.5%, and transport is the farmer's in full (FARMER), half (MUTUAL) or
 * not at all (ARHTI).
 */
const DEFAULT_COMMISSION_RATE = 0.02;
const MANDI_CESS_RATE = 0.005;

const AMIS_REPORT_ISO_DATE = '2026-10-10';

/*
 * Runtime validation for the model output. JSON Object mode guarantees valid
 * JSON but not the keys, so safe defaults are used where a missing field
 * cannot cause a wrong answer or a database write.
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
  language: z
    .enum(['english', 'urdu', 'roman_urdu'])
    .catch('english'),
  reply: z.string().trim().min(1),
  generalGuidance: z
    .string()
    .nullish()
    .catch(null)
    .transform((value) => value?.trim() || null),
  action: z.enum(['NONE', 'CREATE_CROP_BATCH']).catch('NONE'),
  readyToConfirm: z.boolean().catch(false),
  cropDraft: cropDraftSchema.partial().nullish().catch(null),
  suggestedView: z
    .enum(['NONE', 'CROPS', 'OFFERS', 'DEALS', 'RECORDS'])
    .catch('NONE'),
});

type CropDraft = z.infer<typeof cropDraftSchema>;

type NaturalAiResult = Omit<
  z.infer<typeof naturalAiResultSchema>,
  'cropDraft'
> & {
  cropDraft: CropDraft;
};

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

// Fixed label for general-knowledge text, in the farmer's language.
const GUIDANCE_LABEL = {
  english: 'General guidance (not live data):',
  roman_urdu: 'Aam maloomat (live data nahi):',
  urdu: 'عام رہنمائی (لائیو ڈیٹا نہیں):',
} as const;

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

const PLAIN_TRANSPORT: Record<TransportResponsibility, string> = {
  FARMER: 'farmer pays transport',
  ARHTI: 'arhti pays transport',
  MUTUAL: 'transport cost shared half and half',
};

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
  'jee', 'ji', 'ha', 'haa', 'aaj', 'kal', 'parson', 'nikala', 'nikali',
  'tora', 'tori', 'tor', 'liya', 'diya', 'hy',
]);

// Common English words, used to tell a short English message from a
// short Roman Urdu one.
const ENGLISH_WORDS = new Set([
  'the', 'is', 'are', 'my', 'i', 'how', 'what', 'where', 'when', 'which',
  'please', 'yes', 'no', 'ok', 'okay', 'it', 'was', 'will', 'get', 'much',
  'many', 'sell', 'price', 'today', 'yesterday', 'harvested',
]);

// Province of well-known cities and districts, keyed by placeKey().
const CITY_PROVINCE: Record<string, string> = Object.fromEntries(
  Object.entries({
    'Khyber Pakhtunkhwa': [
      'Swabi', 'Peshawar', 'Mardan', 'Charsadda', 'Nowshera', 'Abbottabad',
      'Mansehra', 'Haripur', 'Kohat', 'Bannu', 'Dera Ismail Khan', 'DI Khan',
      'Swat', 'Mingora', 'Malakand', 'Dir', 'Chitral', 'Karak', 'Lakki Marwat',
    ],
    Punjab: [
      'Lahore', 'Multan', 'Rawalpindi', 'Faisalabad', 'Okara', 'Gujranwala',
      'Sialkot', 'Sargodha', 'Sahiwal', 'Bahawalpur', 'Bahawalnagar',
      'Rahim Yar Khan', 'Dera Ghazi Khan', 'DG Khan', 'Jhang', 'Kasur',
      'Sheikhupura', 'Pakpattan', 'Vehari', 'Khanewal', 'Chiniot',
      'Mandi Bahauddin', 'Gujrat', 'Jhelum', 'Attock', 'Chakwal', 'Mianwali',
      'Bhakkar', 'Layyah', 'Muzaffargarh', 'Toba Tek Singh', 'Narowal',
      'Hafizabad', 'Khushab', 'Lodhran', 'Rajanpur', 'Nankana Sahib',
    ],
    Sindh: [
      'Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Mirpur Khas',
      'Nawabshah', 'Shaheed Benazirabad', 'Thatta', 'Badin', 'Sanghar',
      'Khairpur', 'Dadu', 'Jacobabad', 'Shikarpur', 'Ghotki', 'Umerkot',
    ],
    Balochistan: [
      'Quetta', 'Turbat', 'Khuzdar', 'Gwadar', 'Sibi', 'Zhob', 'Loralai',
      'Pishin', 'Mastung', 'Nasirabad', 'Jaffarabad', 'Kalat',
    ],
    'Islamabad Capital Territory': ['Islamabad'],
  }).flatMap(([province, cities]) =>
    cities.map((city) => [
      city.toLowerCase().replace(/[^a-z0-9]/g, ''),
      province,
    ])
  )
);

// Roman Urdu name used in server-written Roman Urdu text.
const ROMAN_CROP_NAME: Record<string, string> = {
  Tomato: 'tamatar',
  Potato: 'aloo',
  Onion: 'pyaz',
  Wheat: 'gandum',
  Maize: 'makai',
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

function romanUrduLikely(text: string) {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hits = words.filter((word) => ROMAN_URDU_WORDS.has(word)).length;

  return words.length <= 3 ? hits >= 1 : hits >= 2;
}

function englishLikely(text: string) {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hits = words.filter((word) => ENGLISH_WORDS.has(word)).length;

  return hits >= 2 || (words.length <= 2 && hits >= 1);
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

function plainStatus(status: string) {
  return PLAIN_STATUS[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

function isoDate(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : null;
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

// Today's date in Pakistan as a UTC-midnight Date, for date arithmetic.
function karachiTodayDate() {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return new Date(`${iso}T00:00:00Z`);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

/**
 * Turns how a farmer says a date ("aaj", "kal", "parson", "3 din pehle",
 * "20 October", "20/10/2026", "2026-10-20") into YYYY-MM-DD. "kal" means
 * yesterday for a harvest date and tomorrow for a ready date. Returns null
 * when the words cannot be read as a date.
 */
function resolveDate(
  value: string | null,
  direction: 'past' | 'future'
): string | null {
  if (!value) {
    return null;
  }

  const text = value.trim().toLowerCase();
  const today = karachiTodayDate();
  const sign = direction === 'past' ? -1 : 1;
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())
      ? null
      : text;
  }

  if (/\b(aaj|aj|today)\b|آج/.test(text)) {
    return iso(today);
  }

  if (/\b(yesterday)\b/.test(text)) {
    return iso(addDays(today, -1));
  }

  if (/\b(tomorrow)\b/.test(text)) {
    return iso(addDays(today, 1));
  }

  if (/\b(parson|parsoon|parso)\b|پرسوں/.test(text)) {
    return iso(addDays(today, 2 * sign));
  }

  if (/\b(kal|kl)\b|کل/.test(text)) {
    return iso(addDays(today, sign));
  }

  const daysAgo = text.match(/(\d+)\s*(din|days?)\s*(pehle|pehlay|ago)/);
  if (daysAgo) {
    return iso(addDays(today, -Number(daysAgo[1])));
  }

  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;

  const numeric = text.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  const named =
    text.match(/(\d{1,2})\s*([a-z]{3,})\.?\s*(\d{4})?/) ??
    text.match(/([a-z]{3,})\.?\s*(\d{1,2})(?:,?\s*(\d{4}))?/);

  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    year = numeric[3] ? Number(numeric[3]) : undefined;
  } else if (named) {
    const dayFirst = /^\d/.test(named[1]);
    const monthName = dayFirst ? named[2] : named[1];
    const index = MONTHS.indexOf(monthName.slice(0, 3));

    if (index >= 0) {
      day = Number(dayFirst ? named[1] : named[2]);
      month = index + 1;
      year = named[3] ? Number(named[3]) : undefined;
    }
  }

  if (!day || !month || month > 12 || day > 31) {
    return null;
  }

  if (year !== undefined && year < 100) {
    year += 2000;
  }

  let date = new Date(
    Date.UTC(year ?? today.getUTCFullYear(), month - 1, day)
  );

  if (date.getUTCDate() !== day) {
    return null;
  }

  // Without a year, a harvest date cannot be in the future (and a ready
  // date cannot be in the past), so use the neighbouring year.
  if (year === undefined) {
    if (direction === 'past' && date > today) {
      date = new Date(Date.UTC(today.getUTCFullYear() - 1, month - 1, day));
    } else if (direction === 'future' && date < today) {
      date = new Date(Date.UTC(today.getUTCFullYear() + 1, month - 1, day));
    }
  }

  return iso(date);
}

// A date for server-written text: "aaj"/"kal" when it is today/yesterday.
function spokenDate(
  isoDate: string,
  language: 'english' | 'roman_urdu' | 'urdu'
) {
  const today = karachiTodayDate().toISOString().slice(0, 10);
  const yesterday = addDays(karachiTodayDate(), -1)
    .toISOString()
    .slice(0, 10);

  const words = {
    english: { today: 'today', yesterday: 'yesterday' },
    roman_urdu: { today: 'aaj', yesterday: 'kal' },
    urdu: { today: 'آج', yesterday: 'کل' },
  }[language];

  if (isoDate === today) {
    return words.today;
  }

  if (isoDate === yesterday) {
    return words.yesterday;
  }

  const date = new Date(`${isoDate}T00:00:00Z`);

  return `${date.getUTCDate()} ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date)} ${date.getUTCFullYear()}`;
}

function money(amount: number) {
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
}

function perKg(amount: number) {
  return `Rs ${amount.toLocaleString('en-PK', {
    maximumFractionDigits: 1,
  })}/kg`;
}

function percent(rate: number) {
  return `${(rate * 100).toLocaleString('en-PK', {
    maximumFractionDigits: 2,
  })}%`;
}

// Lower-case letters and digits only, so "Rahim Yar Khan" matches
// "RahimYarKhan".
function placeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

type RankedPrice = {
  rank: number;
  place: string;
  city: string;
  pricePerKgValue: number;
  date: string;
  daysOld: number;
  trend?: string;
};

/*
 * Sorts prices from highest to lowest in code and keeps the top entries
 * plus every place the farmer cares about (their own cities and any city
 * named in the message). Ranks are positions in the full sorted list.
 */
function rankPrices(
  entries: Omit<RankedPrice, 'rank'>[],
  wantedPlaces: string[]
) {
  const sorted = [...entries]
    .sort((a, b) => b.pricePerKgValue - a.pricePerKgValue)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const kept = sorted.filter(
    (entry) =>
      entry.rank <= TOP_PRICES_PER_SOURCE ||
      wantedPlaces.includes(placeKey(entry.city))
  );

  return {
    total: sorted.length,
    kept,
  };
}

/*
 * True when an offer asks for more than is left in its batch, e.g. after
 * another offer on the same batch was accepted. Accepting it would fail
 * (drawFromBatch in lib/inventory.ts refuses it).
 */
function offerTooLarge(offer: {
  quantityKg: number;
  batch: { availableKg: number };
}) {
  return offer.quantityKg > offer.batch.availableKg;
}

function daysSince(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

type NetEstimate = {
  for: string;
  calculation: string;
  netEstimate: string;
  notIncluded?: string;
};

/*
 * Net amount in code, using the same rules as the real settlement (see
 * DEFAULT_COMMISSION_RATE above), so the model only explains the numbers.
 */
function estimateNet(input: {
  label: string;
  quantityKg: number;
  pricePerKgValue: number;
  commissionRate: number | null;
  transportResponsibility: TransportResponsibility | null;
  transportCost: number | null;
}): NetEstimate {
  const gross = input.quantityKg * input.pricePerKgValue;

  const commissionRate =
    input.commissionRate ?? DEFAULT_COMMISSION_RATE;

  const deductions = [
    {
      name: 'arhti commission',
      value: gross * commissionRate,
      basis:
        input.commissionRate === null
          ? `${percent(commissionRate)} AgriConnect default (arhti not known yet)`
          : `${percent(commissionRate)} arhti's commission rate`,
    },
    {
      name: 'mandi cess',
      value: gross * MANDI_CESS_RATE,
      basis: `${percent(MANDI_CESS_RATE)} of gross`,
    },
  ];

  const notIncluded: string[] = [];

  if (input.transportResponsibility === TransportResponsibility.ARHTI) {
    deductions.push({
      name: 'transport',
      value: 0,
      basis: 'arhti pays transport',
    });
  } else if (
    input.transportResponsibility !== null &&
    input.transportCost !== null
  ) {
    const share =
      input.transportResponsibility === TransportResponsibility.MUTUAL
        ? input.transportCost / 2
        : input.transportCost;

    deductions.push({
      name: 'transport',
      value: share,
      basis:
        input.transportResponsibility === TransportResponsibility.MUTUAL
          ? `half of ${money(input.transportCost)} transport`
          : `full ${money(input.transportCost)} transport`,
    });
  } else {
    notIncluded.push(
      input.transportResponsibility === null
        ? 'transport (depends on the deal)'
        : `transport (${PLAIN_TRANSPORT[input.transportResponsibility]}, cost not known yet)`
    );
  }

  const net =
    gross - deductions.reduce((sum, item) => sum + item.value, 0);

  // One ready-made line, so the model copies it instead of calculating.
  const calculation = [
    `${input.quantityKg.toLocaleString('en-PK')} kg x ${perKg(
      input.pricePerKgValue
    )} = gross ${money(gross)}`,
    ...deductions.map(
      (item) => `minus ${item.name} ${money(item.value)} (${item.basis})`
    ),
  ].join('; ');

  return {
    for: input.label,
    calculation,
    netEstimate: money(net),
    ...(notIncluded.length
      ? { notIncluded: notIncluded.join('; ') }
      : {}),
  };
}

async function getFarmerContext(userId: string, message: string) {
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
      take: 100,
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

  /*
   * Places the farmer cares about: their own location and batch origins,
   * plus any mandi or AMIS city named in the message.
   */
  const messageKey = placeKey(message);
  const knownCities = [
    ...marketPrices.map((price) => price.mandi.city),
    ...AMIS_TOMATO_PRICES.map((row) => row.city),
  ];
  const wantedPlaces = [
    ...new Set(
      [
        farmer?.location ?? '',
        farmer?.farmerProfile?.village ?? '',
        ...batches.map((batch) => batch.originCity),
        ...knownCities.filter((city) => {
          const key = placeKey(city);
          return key.length >= 4 && messageKey.includes(key);
        }),
      ]
        .map(placeKey)
        .filter(Boolean)
    ),
  ];

  /*
   * Price ranking per crop, highest first, kept separate per source because
   * the app records and the AMIS report have different dates.
   */
  const priceRanking = crops
    .map((crop) => {
      const app = rankPrices(
        marketPrices
          .filter((price) => price.cropId === crop.id)
          .map((price) => ({
            place: `${price.mandi.name}, ${price.mandi.city}`,
            city: price.mandi.city,
            pricePerKgValue: price.ratePerKg,
            date: isoDate(price.recordedAt)!,
            daysOld: daysSince(price.recordedAt),
            trend:
              price.trend === 'stable'
                ? 'stable'
                : `${price.trend} ${Math.abs(price.changePercent)}%`,
          })),
        wantedPlaces
      );

      const amis =
        crop.name === 'Tomato'
          ? rankPrices(
              AMIS_TOMATO_PRICES.filter(
                (row) => row.fqp !== null
              ).map((row) => ({
                place: row.city,
                city: row.city,
                pricePerKgValue: row.fqp! / 100,
                date: AMIS_REPORT_ISO_DATE,
                daysOld: daysSince(new Date(AMIS_REPORT_ISO_DATE)),
              })),
              wantedPlaces
            )
          : null;

      return {
        crop,
        app,
        amis,
      };
    })
    .filter((entry) => entry.app.total > 0 || entry.amis);

  const latestSettlementWithTransport = settlements.find((settlement) =>
    settlement.deductions.some((item) => item.type === 'TRANSPORT')
  );

  /*
   * Net amount estimates: every sellable batch with an asking price, every
   * pending offer and every active deal.
   */
  const netEstimates: NetEstimate[] = [
    ...batches
      .filter(
        (batch) =>
          batch.status !== CropBatchStatus.GROWING &&
          batch.availableKg > 0 &&
          batch.askingPricePerKg
      )
      .map((batch) =>
        estimateNet({
          label: `batch ${batch.batchNumber} (${batch.crop.name}) at your asking price`,
          quantityKg: batch.availableKg,
          pricePerKgValue: batch.askingPricePerKg!,
          commissionRate: null,
          transportResponsibility: null,
          transportCost: null,
        })
      ),

    // An offer for more than is left in its batch cannot be accepted as is
    // (the app refuses it), so it gets no net amount.
    ...offers.filter((offer) => !offerTooLarge(offer)).map((offer) =>
      estimateNet({
        label: `offer from ${
          offer.arhti.arhtiProfile?.businessName ?? offer.arhti.name
        } for batch ${offer.batch.batchNumber} (${offer.batch.crop.name})`,
        quantityKg: offer.quantityKg,
        pricePerKgValue: offer.pricePerKg,
        commissionRate:
          offer.arhti.arhtiProfile?.commissionRate ?? null,
        transportResponsibility: offer.transportResponsibility,
        transportCost: null,
      })
    ),

    ...deals.map((deal) =>
      estimateNet({
        label: `deal ${deal.dealNumber} (${deal.crop.name})`,
        quantityKg: deal.agreedQuantityKg,
        pricePerKgValue: deal.agreedPricePerKg,
        commissionRate:
          deal.arhti.arhtiProfile?.commissionRate ?? null,
        transportResponsibility: deal.transportResponsibility,
        transportCost: deal.transportCost,
      })
    ),
  ];

  /*
   * Everything the reply may quote as a per-kg price, and every identifier
   * the reply may use. Checked after the model answers.
   */
  const allowedPerKg = [
    ...priceRanking.flatMap((entry) => [
      ...entry.app.kept.map((item) => item.pricePerKgValue),
      ...(entry.amis?.kept.map((item) => item.pricePerKgValue) ?? []),
    ]),
    ...batches.flatMap((batch) =>
      batch.askingPricePerKg ? [batch.askingPricePerKg] : []
    ),
    ...offers.map((offer) => offer.pricePerKg),
    ...deals.map((deal) => deal.agreedPricePerKg),
    ...demands.flatMap((demand) => [
      demand.targetPriceMin,
      demand.targetPriceMax,
    ]),
  ].filter((value): value is number => typeof value === 'number');

  const knownIds = [
    ...batches.map((batch) => batch.batchNumber),
    ...offers.map((offer) => offer.batch.batchNumber),
    ...deals.map((deal) => deal.dealNumber),
    ...settlements.map((settlement) => settlement.deal.dealNumber),
    ...demands.map((demand) => demand.requestNumber),
  ];

  const forModel = {
    farmer: farmer
      ? {
          name: farmer.name,
          location: farmer.location,
          village: farmer.farmerProfile?.village ?? null,
        }
      : null,

    myCropBatches: batches.map((batch) => ({
      batchNumber: batch.batchNumber,
      crop: batch.crop.name,
      availableKg: batch.availableKg,
      originallyListedKg: batch.quantityKg,
      grade: batch.grade,
      originVillage: batch.originVillage,
      originCity: batch.originCity,
      harvestDate: isoDate(batch.harvestDate),
      askingPrice: batch.askingPricePerKg
        ? perKg(batch.askingPricePerKg)
        : null,
      status: plainStatus(batch.status),
    })),

    directArhtiOffers: offers.map((offer) => ({
      arhti:
        offer.arhti.arhtiProfile?.businessName ??
        offer.arhti.name,
      batchNumber: offer.batch.batchNumber,
      crop: offer.batch.crop.name,
      quantityKg: offer.quantityKg,
      price: perKg(offer.pricePerKg),
      destinationMandi: `${offer.destinationMandi.name}, ${offer.destinationMandi.city}`,
      transport: PLAIN_TRANSPORT[offer.transportResponsibility],
      proposedPickup: isoDate(offer.proposedPickupAt),
      note: offer.note,
      ...(offerTooLarge(offer)
        ? {
            cannotAcceptAsIs: `offer is for ${offer.quantityKg.toLocaleString(
              'en-PK'
            )} kg but only ${offer.batch.availableKg.toLocaleString(
              'en-PK'
            )} kg is left in batch ${offer.batch.batchNumber}`,
          }
        : {}),
    })),

    openArhtiDemand: demands.map((demand) => ({
      requestNumber: demand.requestNumber,
      arhti:
        demand.arhti.arhtiProfile?.businessName ??
        demand.arhti.name,
      crop: demand.crop.name,
      quantityKg: `${demand.minQuantityKg}-${demand.maxQuantityKg}`,
      gradeWanted: demand.gradeWanted,
      targetPrice:
        demand.targetPriceMin && demand.targetPriceMax
          ? `${perKg(demand.targetPriceMin)} to ${perKg(demand.targetPriceMax)}`
          : null,
      neededBy: isoDate(demand.neededBy),
      arhtiSendsTransport: demand.transportOffered,
      mandi: `${demand.mandi.name}, ${demand.mandi.city}`,
    })),

    activeDeals: deals.map((deal) => ({
      dealNumber: deal.dealNumber,
      crop: deal.crop.name,
      arhti: deal.arhti.name,
      quantityKg: deal.agreedQuantityKg,
      price: perKg(deal.agreedPricePerKg),
      gross: money(deal.grossAmount),
      destinationMandi: deal.destinationMandi.name,
      transport: PLAIN_TRANSPORT[deal.transportResponsibility],
      status: plainStatus(deal.status),
      driver: deal.pickup?.driverName ?? null,
      scheduledPickup: isoDate(deal.pickup?.scheduledAt),
    })),

    payments: settlements.map((settlement) => ({
      dealNumber: settlement.deal.dealNumber,
      crop: settlement.deal.crop.name,
      arhti: settlement.deal.arhti.name,
      gross: money(settlement.grossAmount),
      deductions: settlement.deductions.map(
        (item) =>
          `${item.type.replace(/_/g, ' ').toLowerCase()} ${money(item.amount)}`
      ),
      netPaid: money(settlement.netPayable),
      status: settlement.status,
    })),

    lastTransportPaid: latestSettlementWithTransport
      ? `${money(
          latestSettlementWithTransport.deductions.find(
            (item) => item.type === 'TRANSPORT'
          )!.amount
        )} (your share) on deal ${latestSettlementWithTransport.deal.dealNumber}`
      : null,

    netEstimates,

    priceRanking: priceRanking.map((entry) => ({
      crop: entry.crop.name,

      // Ready-made lines in rank order ("1. place: Rs x/kg ...").
      ...(entry.app.total
        ? {
            appMandiRecords: {
              placesWithData: entry.app.total,
              highestFirst: entry.app.kept.map(
                (item) =>
                  `${item.rank}. ${item.place}: ${perKg(
                    item.pricePerKgValue
                  )} (recorded ${item.date}, ${item.daysOld} days old, trend ${item.trend})`
              ),
            },
          }
        : {}),

      ...(entry.amis
        ? {
            amisReport: {
              reportDate: AMIS_TOMATO_REPORT_DATE,
              note: 'wholesale reference prices; AMIS unit assumed Rs per 100 kg, shown here per kg',
              citiesWithData: entry.amis.total,
              highestFirst: entry.amis.kept.map(
                (item) =>
                  `${item.rank}. ${item.place}: ${perKg(
                    item.pricePerKgValue
                  )}`
              ),
            },
          }
        : {}),
    })),

    supportedCrops: crops.map((crop) => crop.name),
  };

  return {
    forModel,
    crops,
    allowedPerKg,
    knownIds: [...new Set(knownIds)],
  };
}

const INSTRUCTIONS = `
You are AgriConnect AI, a post-harvest selling assistant for Pakistani farmers. The user is a FARMER.

SCOPE: crop prices and trends, which cities or mandis pay more, what the farmer will receive after commission, cess and transport, sell now or hold, storage after harvest (how, how long, losses), transport (options, costs, timing), the farmer's own crops, offers, deals and payments, and listing a crop through this chat.
- Growing questions (pests, disease, fertilizer, seed, irrigation, spraying): in 1-2 sentences say you help with selling, storage and transport after harvest and suggest the local agriculture extension office (Mehkama Zaraat / محکمہ زراعت).
- Anything not about farming or this app: decline politely in one sentence.

DATA RULES (strict)
- CONTEXT is the only source of facts. Its numbers are already calculated and sorted. Copy them exactly; never calculate, round, re-sort or convert them yourself.
- Copy batch numbers, deal numbers, request numbers, names and amounts character for character. Never add prefixes or suffixes to them.
- "Where is the price highest": use CONTEXT.priceRanking. Each highestFirst list is already sorted; line "1." is the highest for that source. Name the source (app mandi record with its date and age, or AMIS report with reportDate) and keep the two sources apart. Never call a record "today's" unless it is 0 days old.
- "How much will I get": use CONTEXT.netEstimates. Say what it is for, give its calculation line and netEstimate as written, and mention notIncluded.
- An offer with cannotAcceptAsIs cannot be accepted as it stands: say so and why, in the farmer's language, and give no net amount or total for it.
- Never state a per-kg price that is not in CONTEXT. Do not invent prices, records, offers or payments. If CONTEXT has no data for the question, say so.
- You cannot contact arhtis, accept offers, book transport or move money; the only action is preparing a crop listing. You have no phone numbers.
- Never show internal names (CONTEXT, cropDraft, field names, status codes).

GENERAL KNOWLEDGE
Anything not in CONTEXT (storage life and method, typical losses, which cities usually pay more, transport options and typical costs, seasonal trends) goes ONLY in "generalGuidance", never in "reply". The app shows it under a "general guidance" label. Only add it when it directly helps with THIS question (e.g. which cities usually pay more, for a price question); no unrelated tips. Keep it to 1-2 short sentences, with no per-kg prices. Never put questions, offers of help ("ask me", "bata dein") or remarks about the farmer's own records there. If there is no real general knowledge to add, use null.

LANGUAGE (strict)
Reply in exactly the language and script of the latest message (FARMER_MESSAGE_SCRIPT, ROMAN_URDU_LIKELY):
- Urdu script -> Urdu script, language "urdu".
- Roman Urdu (Urdu in English letters, e.g. "meri payments") -> natural Roman Urdu, never English or Urdu script, language "roman_urdu". If ROMAN_URDU_LIKELY is true, reply in Roman Urdu.
- English -> English, language "english".
generalGuidance uses the same language. Numbers, "Rs" and "kg" may stay as they are.

STYLE
Answer the question first, in 2-4 short sentences or up to 4 lines starting with "- ". When asked to choose (sell or hold, which mandi, which offer), give ONE recommendation and the main reason. If something essential is missing, ask ONE short question. Plain text, no Markdown or emojis. Use recentConversation for follow-ups.

CROP LISTING
"list kar do", "laga do", "daal do", "add", "list my crop" about the farmer's crop = create a NEW listing (not: show a list). Existing batches never block a new listing. Set action "CREATE_CROP_BATCH" while collecting a listing (also when existingCropDraft has values and the farmer is answering); otherwise action "NONE" and cropDraft null.
- cropName: English name from CONTEXT.supportedCrops ("tamatar" -> "Tomato", "pyaz" -> "Onion").
- Required: cropName, quantityKg (kg; 1 maund = 40 kg), originCity, originProvince, harvestDate. Optional, never ask: grade (default "Standard"), variety, packaging, askingPricePerKg, notes. Do not ask for a mandi or arhti.
- harvestDate / readyDate: copy the farmer's own words ("aaj", "kal", "parson", "20 October") or a YYYY-MM-DD date; the app converts them. Ask for dates in plain words (aaj, kal, or a date); never ask the farmer to type a date format. Never guess a date the farmer has not given.
- Province from city: Swabi, Peshawar, Mardan -> Khyber Pakhtunkhwa; Lahore, Multan, Rawalpindi, Faisalabad, Okara -> Punjab; Karachi, Hyderabad -> Sindh; Quetta -> Balochistan; Islamabad -> Islamabad Capital Territory.
- Missing required info: readyToConfirm false, ask one short question. All required info present: readyToConfirm true, summarise in plain words (e.g. "Tamatar 3000 kg, Swabi (Khyber Pakhtunkhwa), aaj ki harvest") and tell them to press Confirm under Pending Actions. If they say "haan"/"yes", keep the same cropDraft with readyToConfirm true.
Example: "mera tamatar list kar do" -> CREATE_CROP_BATCH, cropName "Tomato", readyToConfirm false, reply "Theek hai. Kitne kilo tamatar hain aur kis shehar ya gaon mein hain?"

suggestedView: "NONE" unless the answer is about that page's data: "CROPS" (batches, listing), "OFFERS", "DEALS", "RECORDS" (payments). Price, storage and transport answers: "NONE".

OUTPUT: only one JSON object with exactly these keys:
{"language":"english|urdu|roman_urdu","reply":"string","generalGuidance":"string or null","action":"NONE|CREATE_CROP_BATCH","readyToConfirm":true|false,"cropDraft":null or {"cropName","quantityKg","variety","grade","originVillage","originCity","originProvince","harvestDate","readyDate","packaging","askingPricePerKg","notes"} (unknown values null),"suggestedView":"NONE|CROPS|OFFERS|DEALS|RECORDS"}
`.trim();

function getAiConfig() {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured on the server.');
  }

  const baseUrl = (
    process.env.AI_BASE_URL || DEFAULT_AI_BASE_URL
  ).replace(/\/+$/, '');

  const model = process.env.AI_MODEL || DEFAULT_AI_MODEL;

  return {
    apiKey,
    baseUrl,
    model,
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

async function callModel(messages: ChatMessage[]): Promise<{
  result: NaturalAiResult;
  raw: string;
  usage: unknown;
}> {
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
      },

      body: JSON.stringify({
        model: config.model,

        messages,

        temperature: 0.2,

        // JSON Object mode: valid JSON guaranteed, keys checked with zod.
        // max_tokens is left out on purpose (provider advice for JSON mode).
        response_format: {
          type: 'json_object',
        },
      }),
    });

    const body = await response.text();

    if (!response.ok) {
      if (body.includes('AllocationQuota.FreeTierOnly')) {
        console.error(
          'AI free quota used up (403 AllocationQuota.FreeTierOnly); using the rule-based assistant.'
        );
      } else {
        console.error(
          'AI provider error:',
          response.status,
          body.slice(0, 1000)
        );
      }

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

    return {
      result: {
        ...validated.data,
        cropDraft: {
          ...EMPTY_DRAFT,
          ...(validated.data.cropDraft ?? {}),
        },
      },
      raw: output,
      usage: data.usage,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/*
 * Replaces an identifier the model decorated (e.g. "DEAL-FAD-2025-1001")
 * with the real one it contains. Longest IDs are tried first.
 */
function fixIdentifiers(text: string, knownIds: string[]) {
  const ids = [...knownIds].sort((a, b) => b.length - a.length);

  return text.replace(/[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+/g, (token) => {
    if (ids.includes(token)) {
      return token;
    }

    const contained = ids.find((id) => token.includes(id));

    if (contained) {
      console.warn(`AI changed identifier ${contained} to ${token}; fixed.`);
      return contained;
    }

    return token;
  });
}

// Per-kg prices stated in a reply, in English/Roman Urdu or Urdu wording.
function perKgPricesIn(text: string) {
  const patterns = [
    /Rs\.?\s*([\d,]+(?:\.\d+)?)\s*(?:\/|per\s*)\s*(?:kg|kilo)/gi,
    /([\d,]+(?:\.\d+)?)\s*(?:روپے|روپیہ)\s*(?:\/|فی)\s*(?:کلو|kg)/g,
    /Rs\.?\s*([\d,]+(?:\.\d+)?)\s*(?:\/|فی)\s*(?:کلو)/g,
  ];

  return patterns.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) =>
      Number(match[1].replace(/,/g, ''))
    )
  );
}

function unknownPerKgPrices(text: string, allowed: number[]) {
  return perKgPricesIn(text).filter(
    (value) =>
      !allowed.some((known) => Math.abs(known - value) <= 0.5)
  );
}

const ALL_GUIDANCE_LABELS = Object.values(GUIDANCE_LABEL);

/*
 * Splits text at the first general-guidance label. The model sometimes
 * copies the label from earlier turns into its own reply.
 */
function splitAtGuidanceLabel(text: string) {
  const positions = ALL_GUIDANCE_LABELS.map((label) =>
    text.indexOf(label)
  ).filter((index) => index >= 0);

  if (!positions.length) {
    return { before: text.trim(), after: '' };
  }

  const first = Math.min(...positions);

  return {
    before: text.slice(0, first).trim(),
    after: text.slice(first).trim(),
  };
}

// Earlier turns without their guidance part, for the model's history.
function withoutGuidance(text: string) {
  return splitAtGuidanceLabel(text).before || text;
}

// Offers of help or requests to ask again: filler, not general knowledge.
const FILLER_PATTERN =
  /\b(bata\s*d[ei]i?n|batayen|batayein|bataen|pooch|puchh?|let me know|ask me|tell me|feel free|if you (want|need|would like))\b|بتائیں|بتا دیں|پوچھیں/i;

/*
 * General guidance without labels, duplicates, per-kg prices, the
 * farmer's own records or filler. Prices and records are data and belong
 * in the factual reply; questions and offers of help are not guidance.
 */
function cleanGuidance(parts: (string | null)[], knownIds: string[]) {
  let text = parts.filter(Boolean).join(' ');

  for (const label of ALL_GUIDANCE_LABELS) {
    text = text.split(label).join(' ');
  }

  const sentences = text
    .split(/(?<=[.!?۔؟])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => perKgPricesIn(sentence).length === 0)
    .filter((sentence) => !/[?؟]/.test(sentence))
    .filter((sentence) => !FILLER_PATTERN.test(sentence))
    .filter((sentence) => !knownIds.some((id) => sentence.includes(id)));

  const unique = [...new Set(sentences)];

  return unique.length ? unique.join(' ') : null;
}

function normalizeResult(
  result: NaturalAiResult,
  knownIds: string[]
): NaturalAiResult {
  const { before, after } = splitAtGuidanceLabel(result.reply);

  return {
    ...result,
    reply: before || result.reply,
    generalGuidance: cleanGuidance(
      [after, result.generalGuidance],
      knownIds
    ),
  };
}

function inExpectedLanguage(
  text: string,
  script: MessageScript,
  romanUrdu: boolean
) {
  if (!replyMatchesScript(text, script)) {
    return false;
  }

  return !romanUrdu || romanUrduLikely(text);
}

async function understandFarmer(
  message: string,
  history: StoredHistory[],
  draft: CropDraft,
  context: Awaited<ReturnType<typeof getFarmerContext>>
): Promise<{ result: NaturalAiResult; script: MessageScript }> {
  const script = messageScript(message);

  const romanUrdu = script === 'latin' && romanUrduLikely(message);

  const input = JSON.stringify({
    TODAY: karachiToday(),

    FARMER_MESSAGE_SCRIPT:
      script === 'urdu' ? 'urdu_script' : 'english_letters',

    ROMAN_URDU_LIKELY: romanUrdu,

    latestMessage: message,

    recentConversation: history
      .slice(-HISTORY_FOR_MODEL)
      .map((item) => ({
        role: item.role,
        text: withoutGuidance(item.text),
      })),

    existingCropDraft: Object.values(draft).some((value) => value !== null)
      ? draft
      : null,

    CONTEXT: context.forModel,
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

  let { result, raw, usage } = await callModel(messages);

  console.info('AI usage:', JSON.stringify(usage));

  result = normalizeResult(result, context.knownIds);

  /*
   * One correction round for problems code can detect: wrong language or
   * script (in the reply or the guidance), and per-kg prices that are not
   * in the data.
   */
  const problems: string[] = [];

  if (
    !replyMatchesScript(result.reply, script) ||
    (romanUrdu && result.language === 'english') ||
    (result.generalGuidance !== null &&
      !inExpectedLanguage(result.generalGuidance, script, romanUrdu))
  ) {
    const wanted =
      script === 'urdu'
        ? 'Urdu script'
        : romanUrdu
          ? 'Roman Urdu (Urdu written in English letters)'
          : 'English letters (English or Roman Urdu, matching the farmer)';

    problems.push(
      `The reply used the wrong language or script. Rewrite "reply" and "generalGuidance" entirely in ${wanted}.`
    );
  }

  const badPrices = unknownPerKgPrices(
    `${result.reply}\n${result.generalGuidance ?? ''}`,
    context.allowedPerKg
  );

  if (badPrices.length) {
    console.warn('AI stated per-kg prices not in the data:', badPrices);

    problems.push(
      `These per-kg prices are not in CONTEXT: ${badPrices.join(', ')}. Remove them; quote only prices exactly as given in CONTEXT.`
    );
  }

  if (
    problems.length &&
    Date.now() - startedAt < RETRY_BUDGET_MS
  ) {
    ({ result, raw, usage } = await callModel([
      ...messages,
      {
        role: 'assistant',
        content: raw,
      },
      {
        role: 'user',
        content: `${problems.join(' ')} Keep every other fact the same. Return the same JSON object.`,
      },
    ]));

    console.info('AI usage (retry):', JSON.stringify(usage));

    result = normalizeResult(result, context.knownIds);
  }

  // Better no guidance line than one in the wrong language.
  if (
    result.generalGuidance !== null &&
    !inExpectedLanguage(result.generalGuidance, script, romanUrdu)
  ) {
    console.warn('AI guidance still in the wrong language; dropped.');

    result = { ...result, generalGuidance: null };
  }

  return {
    result: {
      ...result,

      reply: fixIdentifiers(result.reply, context.knownIds),

      generalGuidance: result.generalGuidance
        ? fixIdentifiers(result.generalGuidance, context.knownIds)
        : null,
    },
    script,
  };
}

/*
 * The factual answer, followed by any general knowledge under a fixed
 * label in the farmer's language.
 */
/*
 * Language for server-written text (labels, listing summary, questions).
 * Script alone cannot tell Roman Urdu from English, so a short or unclear
 * message ("jee aaj ki ha") follows the model and the farmer's earlier
 * messages instead of defaulting to English.
 */
function replyLanguage(
  result: NaturalAiResult,
  script: MessageScript,
  message: string,
  history: StoredHistory[]
): keyof typeof GUIDANCE_LABEL {
  if (script === 'urdu') {
    return 'urdu';
  }

  if (romanUrduLikely(message) || result.language !== 'english') {
    return 'roman_urdu';
  }

  if (englishLikely(message)) {
    return 'english';
  }

  const earlierRomanUrdu = history
    .filter((item) => item.role === 'user')
    .slice(-3)
    .some(
      (item) =>
        messageScript(item.text) === 'latin' &&
        romanUrduLikely(item.text)
    );

  return earlierRomanUrdu ? 'roman_urdu' : 'english';
}

function composeReply(
  result: NaturalAiResult,
  language: keyof typeof GUIDANCE_LABEL
) {
  if (!result.generalGuidance) {
    return result.reply;
  }

  return `${result.reply}\n\n${GUIDANCE_LABEL[language]} ${result.generalGuidance}`;
}

/*
 * Written by the server when a listing is ready, so the summary always
 * matches what Confirm will create and never promises anything else.
 */
function listingSummary(
  draft: CropDraft,
  crop: { name: string; nameUrdu: string | null },
  language: keyof typeof GUIDANCE_LABEL
) {
  const quantity = (draft.quantityKg ?? 0).toLocaleString('en-PK');
  const place = `${draft.originCity} (${draft.originProvince})`;
  const harvest = spokenDate(draft.harvestDate!, language);
  const price = draft.askingPricePerKg
    ? perKg(draft.askingPricePerKg)
    : null;

  if (language === 'urdu') {
    return `لسٹنگ تیار ہے: ${crop.nameUrdu ?? crop.name}، ${quantity} کلو، ${place}، کٹائی ${harvest}${
      price ? `، قیمت ${price}` : ''
    }۔ لسٹ کرنے کے لیے اوپر Pending Actions میں Confirm دبائیں۔`;
  }

  if (language === 'roman_urdu') {
    return `Theek hai, listing tayyar hai: ${
      ROMAN_CROP_NAME[crop.name] ?? crop.name
    } ${quantity} kg, ${place}, ${harvest} ki harvest${
      price ? `, qeemat ${price}` : ''
    }. List karne ke liye upar Pending Actions mein Confirm dabayein.`;
  }

  return `Ready to list: ${crop.name}, ${quantity} kg from ${place}, harvested ${harvest}${
    price ? `, asking ${price}` : ''
  }. Press Confirm under Pending Actions at the top to list it.`;
}

/*
 * Written by the server while a listing is being collected, so the farmer
 * is asked in plain words (never for a date format) and in their language.
 */
function missingFieldQuestion(
  missing: string[],
  crop: { name: string; nameUrdu: string | null } | undefined,
  draft: CropDraft,
  language: keyof typeof GUIDANCE_LABEL
) {
  const city = draft.originCity ?? '';

  const name = {
    english: crop ? crop.name.toLowerCase() : 'crop',
    roman_urdu: crop ? (ROMAN_CROP_NAME[crop.name] ?? crop.name) : 'fasal',
    urdu: crop ? (crop.nameUrdu ?? crop.name) : 'فصل',
  }[language];

  const questions = {
    english: {
      crop: 'Which crop would you like to list?',
      quantityAndCity: `How many kg of ${name} do you have, and in which city or village?`,
      quantity: `How many kg of ${name} do you have?`,
      city: `In which city or village is the ${name}?`,
      province: `Which province is ${city} in?`,
      harvest: 'When was it harvested: today, yesterday, or on a date?',
    },
    roman_urdu: {
      crop: 'Kaunsi fasal list karni hai?',
      quantityAndCity: `Kitne kilo ${name} hain aur kis shehar ya gaon mein hain?`,
      quantity: `Kitne kilo ${name} hain?`,
      city: `${name} kis shehar ya gaon mein hai?`,
      province: `${city} kis soobay (province) mein hai?`,
      harvest: 'Fasal kab nikali thi: aaj, kal, ya koi aur din?',
    },
    urdu: {
      crop: 'کون سی فصل لسٹ کرنی ہے؟',
      quantityAndCity: `${name} کتنے کلو ہیں اور کس شہر یا گاؤں میں ہیں؟`,
      quantity: `${name} کتنے کلو ہیں؟`,
      city: `${name} کس شہر یا گاؤں میں ہے؟`,
      province: `${city} کس صوبے میں ہے؟`,
      harvest: 'فصل کب نکالی تھی: آج، کل، یا کسی اور دن؟',
    },
  }[language];

  if (missing.includes('crop')) {
    return questions.crop;
  }

  if (missing.includes('quantity') && missing.includes('city')) {
    return questions.quantityAndCity;
  }

  if (missing.includes('quantity')) {
    return questions.quantity;
  }

  if (missing.includes('city')) {
    return questions.city;
  }

  if (missing.includes('province')) {
    return questions.province;
  }

  return questions.harvest;
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
    const farmerContext = await getFarmerContext(user.id, message);

    const { result: aiResult, script } =
      await understandFarmer(
        message,
        history,
        oldDraft,
        farmerContext
      );

    const language = replyLanguage(aiResult, script, message, history);

    let replyText = composeReply(aiResult, language);

    const collectingListing = aiResult.action === 'CREATE_CROP_BATCH';

    /*
     * The farmer may give dates in words ("aaj", "kal", "20 October"); they
     * are converted here. A date that cannot be read counts as missing.
     */
    const rawDraft = collectingListing
      ? mergeDraft(oldDraft, aiResult.cropDraft)
      : oldDraft;

    const mergedDraft: CropDraft = collectingListing
      ? {
          ...rawDraft,
          // Known cities get their province in code, never from the model.
          originProvince:
            rawDraft.originProvince ??
            (rawDraft.originCity
              ? CITY_PROVINCE[placeKey(rawDraft.originCity)] ?? null
              : null),
          harvestDate: resolveDate(rawDraft.harvestDate, 'past'),
          readyDate: resolveDate(rawDraft.readyDate, 'future'),
        }
      : oldDraft;

    let pendingActionId: string | undefined;
    let pendingActionSummary: string | undefined;
    let supersededActionIds: string[] = [];

    if (collectingListing) {
      const missing = missingCropFields(mergedDraft);

      const crop = findSupportedCrop(
        mergedDraft.cropName,
        farmerContext.crops
      );

      // An unsupported crop keeps the model's explanation.
      const unsupportedCrop = Boolean(mergedDraft.cropName) && !crop;

      if (missing.length && !unsupportedCrop) {
        replyText = missingFieldQuestion(
          missing,
          crop,
          mergedDraft,
          language
        );
      }

      // Ready as soon as every required field is known; the farmer still
      // has to press Confirm.
      if (crop && missing.length === 0) {
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

        replyText = listingSummary(mergedDraft, crop, language);
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
        text: replyText,
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

      reply: replyText,

      replyUrdu: script === 'urdu' ? replyText : undefined,

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
     * The existing rule-based assistant still works if the LLM service, the
     * API key or the free quota fails. It continues the session created
     * above instead of opening a second one.
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
