'use server';

/*
 * AgriConnect AI for traders: arhti, vendor and shopkeeper. Same approach as
 * the farmer chat in lib/actions/natural-ai.ts: the server collects the
 * user's own data and calculates every amount, the model (OpenAI-compatible,
 * JSON mode) only explains it, the reply is checked in code, and any failure
 * falls back to the rule-based assistant in lib/actions/ai.ts. These
 * assistants answer questions only; they never prepare or perform an action.
 *
 * The small helpers below are copied from natural-ai.ts on purpose, so the
 * farmer chat stays exactly as it is.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  AuctionStatus,
  ConsumerOrderStatus,
  CropBatchStatus,
  DealStatus,
  DeductionType,
  OfferListingStatus,
  OfferStatus,
  Prisma,
  StockStatus,
  TransportResponsibility,
  UserRole,
} from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { askAiSchema } from '@/lib/validations/ai';
import { getArhtiEarnings } from '@/lib/earnings';
import { DEFAULT_COMMISSION_RATE, vendorCommission, vendorPaysPerKg } from '@/lib/commission';
import {
  AMIS_TOMATO_PRICES,
  AMIS_TOMATO_REPORT_DATE,
} from '@/lib/data/amis-tomato-prices';
import { askAi as legacyAskAi } from '@/lib/actions/ai';

/*
 * Provider settings: the same endpoint and key as the farmer chat. The
 * traders use AI_MODEL_TRADER when it is set (its own free quota), else
 * AI_MODEL.
 */
const DEFAULT_AI_BASE_URL =
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const DEFAULT_AI_MODEL = 'qwen-plus-2025-12-01';

// Covers the whole request, including reading the response body.
const AI_TIMEOUT_MS = 30_000;

// A reply in the wrong language, voice or with an unknown amount is retried
// once, but only if the first call was quick.
const RETRY_BUDGET_MS = 15_000;

// Recent turns sent to the model (the session itself keeps 12).
const HISTORY_FOR_MODEL = 6;

// Highest prices sent per source, besides the user's own city and named cities.
const TOP_PRICES_PER_SOURCE = 6;

// Newest open farmer batches from the Farmer Market sent to the model (arhti).
const OPEN_FARMER_BATCHES = 15;

// Recent records per list sent to the model.
const RECENT_RECORDS = 10;

// Open auctions / wholesale offers on the market sent to the model.
const MARKET_RECORDS = 15;

const AMIS_REPORT_ISO_DATE = '2026-10-10';

// Same rate as receiveProduce in lib/actions/deals.ts.
const MANDI_CESS_RATE = 0.005;

type TraderRole = 'ARHTI' | 'VENDOR' | 'SHOPKEEPER';

/*
 * Runtime validation for the model output. JSON Object mode guarantees valid
 * JSON but not the keys. There is no action field: these assistants only
 * answer. suggestedView is checked against the user's own pages below.
 */
const traderAiResultSchema = z.object({
  language: z.enum(['english', 'urdu', 'roman_urdu']).catch('english'),
  reply: z.string().trim().min(1),
  generalGuidance: z
    .string()
    .nullish()
    .catch(null)
    .transform((value) => value?.trim() || null),
  suggestedView: z.string().catch('NONE'),
});

type TraderAiResult = z.infer<typeof traderAiResultSchema>;

type MessageScript = 'urdu' | 'latin';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type StoredHistory = {
  role: 'user' | 'ai';
  text: string;
};

type ViewLink = { label: string; href: string };

// Labels are the app's navigation labels, so the chat translates them.
const VIEW_LINKS: Record<TraderRole, Record<string, ViewLink>> = {
  ARHTI: {
    FARMER_MARKET: { label: 'Farmer Market', href: '/sourcing' },
    BUY_REQUESTS: { label: 'My Buy Requests', href: '/demand' },
    DEALS: { label: 'Farmer Deals', href: '/deals' },
    RECEIVING: { label: 'Receive & Verify', href: '/receiving' },
    INVENTORY: { label: 'Mandi Inventory', href: '/inventory' },
    AUCTIONS: { label: 'Auction House', href: '/auction-house' },
    SALES: { label: 'Sales & Commission', href: '/sales' },
    INSIGHTS: { label: 'Trade Insights', href: '/insights' },
  },
  VENDOR: {
    AUCTIONS: { label: 'Mandi Auctions', href: '/auctions' },
    STOCK: { label: 'My Warehouse', href: '/stock' },
    WHOLESALE_SHOP: { label: 'My Wholesale Shop', href: '/wholesale-shop' },
    SALES: { label: 'Shopkeeper Orders', href: '/sales' },
    INSIGHTS: { label: 'Trade Insights', href: '/insights' },
  },
  SHOPKEEPER: {
    WHOLESALE_MARKET: { label: 'Wholesale Market', href: '/wholesale' },
    PURCHASES: { label: 'My Purchases', href: '/purchases' },
    SHOP_STOCK: { label: 'Shop Stock', href: '/shop-stock' },
    STOREFRONT: { label: 'My Storefront', href: '/storefront' },
    ORDERS: { label: 'Customer Orders', href: '/retail-orders' },
    INSIGHTS: { label: 'Shop Insights', href: '/insights' },
  },
};

// Fixed label for general-knowledge text, in the user's language (same as the farmer chat).
const GUIDANCE_LABEL = {
  english: 'General guidance (not live data):',
  roman_urdu: 'Aam maloomat (live data nahi):',
  urdu: 'عام رہنمائی (لائیو ڈیٹا نہیں):',
} as const;

// Plain words for statuses, so internal enum names never reach the user.
const PLAIN_STATUS: Record<string, string> = {
  READY_FOR_SALE: 'ready for sale',
  NEGOTIATING: 'in talks with an arhti',
  PENDING: 'waiting for an answer',
  ACCEPTED: 'accepted',
  REJECTED: 'declined',
  EXPIRED: 'closed without a sale',
  WITHDRAWN: 'withdrawn',
  AGREED: 'agreed, pickup not arranged yet',
  PICKUP_SCHEDULED: 'pickup scheduled',
  PICKED_UP: 'picked up from the farm',
  IN_TRANSIT: 'on the way to the mandi, to be weighed on arrival',
  PAYMENT_PENDING: 'weighed, farmer not paid yet',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  OPEN: 'open',
  PARTIALLY_FULFILLED: 'partly filled',
  FULFILLED: 'filled',
  CLOSED: 'closed',
  IN_STOCK: 'in stock',
  LOW_STOCK: 'running low',
  PARTIALLY_AUCTIONED: 'partly sent to auction',
  SOLD_OUT: 'sold out',
  ACTIVE: 'live',
  PAUSED: 'paused',
  SOLD: 'sold',
  PAID: 'paid',
  PLACED: 'new, waiting for the shop to accept',
  CONFIRMED: 'accepted by the shop',
  PREPARING: 'being packed',
  OUT_FOR_DELIVERY: 'out for delivery',
  DELIVERED: 'delivered',
};

const PLAIN_TRANSPORT: Record<TransportResponsibility, string> = {
  FARMER: 'farmer pays transport',
  ARHTI: 'you (the arhti) pay transport',
  MUTUAL: 'transport cost shared half and half',
};

// Common Urdu words written in English letters (the farmer chat's list plus
// trading words). Words that are also ordinary English are left out.
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
  'jee', 'ji', 'ha', 'haa', 'aaj', 'kal', 'parson', 'liya', 'diya', 'hy',
  'boli', 'bolian', 'neelami', 'nilami', 'munafa', 'kamai', 'kamaya',
  'kamayi', 'maal', 'kitnay', 'mila', 'mili', 'baqi', 'tolna', 'kanta',
  'dukaan', 'dukan', 'gahak', 'grahak', 'khareeda', 'khareedi', 'becha',
  'bechi', 'godam', 'thok', 'lagao', 'laga', 'lagi', 'pada', 'padi',
]);

// Common English words, used to tell a short English message from a short Roman Urdu one.
const ENGLISH_WORDS = new Set([
  'the', 'is', 'are', 'my', 'i', 'how', 'what', 'where', 'when', 'which',
  'please', 'yes', 'no', 'ok', 'okay', 'it', 'was', 'will', 'get', 'much',
  'many', 'sell', 'price', 'today', 'yesterday', 'did', 'earn', 'auction',
  'stock', 'orders', 'shop', 'margin', 'paid',
]);

/* ------------------------------------------------------------------ *
 * Instructions: shared rules plus one section per role
 * ------------------------------------------------------------------ */

const ROLE_INSTRUCTIONS: Record<TraderRole, { intro: string; privacy: string; views: string }> = {
  ARHTI: {
    intro: `You are AgriConnect AI for an ARHTI (commission agent) at a Pakistani sabzi mandi. The user is this arhti.

SCOPE: the arhti's own work in this app: farmer batches on the Farmer Market, their offers, buy requests and deals with farmers, trucks to receive and weigh on the kanta, farmer settlements, mandi inventory lots, their auctions and bids from vendors, their sales, commission and earnings, and mandi prices.
- Earnings: use CONTEXT.earnings. It has three figures that add up to the total: commission from farmers (from PAID farmer settlements only), commission from vendors (paid on top of the auction price, on lots sold at auction) and trading margin ((auction price - price paid to the farmer) x kg sold at auction). Pending commission on unpaid settlements is separate and not in the total. Always say what each figure covers; they are not matched kg by kg.
- "What do I earn if this auction sells now": use yourAuctions[].ifSoldAtTopBid exactly as given.
YOU CANNOT send offers, accept or close anything, weigh, start or close auctions, pay farmers or contact anyone.`,
    privacy: `Never reveal or estimate: another arhti's deals, commission, earnings or settlements; a vendor's warehouse costs, resale prices, margins or profits; a shopkeeper's costs or margins; settlements of farmers who did not deal with this arhti.`,
    views: '"FARMER_MARKET" (open farmer batches), "BUY_REQUESTS", "DEALS" (farmer deals, settlements), "RECEIVING" (trucks to weigh), "INVENTORY" (lots), "AUCTIONS", "SALES" (sales, commission, earnings), "INSIGHTS"',
  },
  VENDOR: {
    intro: `You are AgriConnect AI for a VENDOR (wholesale trader) in Pakistan. The user is this vendor: they buy at mandi auctions, keep stock in their warehouse and sell wholesale to shopkeepers.

SCOPE: the vendor's own work in this app: live mandi auctions and their bids, the arhti's commission they pay on top of the winning price, lots they won and what they paid, warehouse stock and its cost, their wholesale offers, orders from shopkeepers, their margins, and mandi prices.
- Commission: the winning vendor pays the arhti's commission on top of the auction price. For live auctions use liveAuctions[].youPayAtNextMinimumBid and .ifYouWinAtTopBid exactly as given.
- Warehouse cost per kg already includes the commission paid.
- Margins and totals: use CONTEXT.summary and the per-record figures exactly as given.
YOU CANNOT place bids, list or pause offers, accept orders or contact anyone.`,
    privacy: `Never reveal or estimate: what the arhti paid the farmer, the arhti's purchase cost, margin, commission income or earnings; any farmer's price or settlement; other vendors' bids except the amounts shown on the auction, their stock, costs, prices paid or margins; a shopkeeper's retail prices, costs or margins.`,
    views: '"AUCTIONS" (live auctions, bids), "STOCK" (warehouse, lots won, what was paid), "WHOLESALE_SHOP" (wholesale offers), "SALES" (orders from shopkeepers, revenue, margin), "INSIGHTS"',
  },
  SHOPKEEPER: {
    intro: `You are AgriConnect AI for a SHOPKEEPER (retail shop) in Pakistan. The user is this shopkeeper: they buy wholesale from vendors and sell to customers through their storefront.

SCOPE: the shopkeeper's own work in this app: wholesale offers on the market, their wholesale purchases, shop stock and its cost, their retail listings, customer orders, their margins and takings, and mandi prices.
- Shop stock cost per kg is the wholesale price they paid.
- Margins and totals: use CONTEXT.summary and the per-record figures exactly as given.
YOU CANNOT buy, list, price or change orders, or contact anyone.`,
    privacy: `Never reveal or estimate: a vendor's purchase cost, the auction price, the arhti's commission, or any vendor's or arhti's margin or profit; any farmer's price or settlement; other shopkeepers' purchases, prices, sales or margins; customers' phone numbers or addresses.`,
    views: '"WHOLESALE_MARKET" (offers to buy), "PURCHASES" (wholesale orders placed), "SHOP_STOCK", "STOREFRONT" (retail listings), "ORDERS" (customer orders), "INSIGHTS"',
  },
};

function instructionsFor(role: TraderRole) {
  const r = ROLE_INSTRUCTIONS[role];
  const views = Object.keys(VIEW_LINKS[role]);
  return `
${r.intro}
- Anything not about this trading or this app: decline politely in one sentence.

YOU ONLY ANSWER QUESTIONS. If asked to do something, say which page to use (suggestedView) and that they do it there. You have no phone numbers.

VOICE (strict)
You are the assistant talking TO the user. Always address the user as "you" (Roman Urdu "aap", Urdu "آپ"): "you earned", "aap ko mila", "آپ کو ملے". Never speak as the user: never "I/my/we" (mujhe, maine, mera; مجھے، میں نے، میرا) about the user's trading, money or records. You may say "I" only about yourself as the assistant ("I can only see...").

PRIVACY (strict)
CONTEXT holds only THIS user's own records and what the app already shows them. ${r.privacy} If asked, say in one sentence that you can only see the user's own trading, and give nothing more. Never guess such numbers from other data, and never use a public offer price or the user's own prices as someone else's purchase or sale price. CONTEXT may list competitors ("...NotVisibleToYou"): never state what they bought, paid, charge or sold. Never say something did not happen because it is not in CONTEXT: say it is not visible to the user.

DATA RULES (strict)
- CONTEXT is the only source of facts. Its numbers are already calculated. Copy amounts, kg, rates and percentages exactly; never calculate, add up, round, re-sort or convert them yourself. If a figure you need is not in CONTEXT, say it is not available instead of working it out.
- Copy order, sale, stock, lot, auction, deal and request numbers and names character for character.
- "Where is the price highest": use CONTEXT.priceRanking. Each highestFirst list is already sorted; line "1." is the highest. Name the source (app mandi record with its date and age, or AMIS report with reportDate) and keep the two sources apart. Never call a record "today's" unless it is 0 days old.
- Never state a per-kg price or a rupee amount that is not in CONTEXT. Do not invent records. If CONTEXT has no data for the question, say so.
- Never show internal names (CONTEXT, field names, status codes).

GENERAL KNOWLEDGE
Anything not in CONTEXT (usual seasonal trends, how buying and selling usually goes, storage and handling) goes ONLY in "generalGuidance", never in "reply". The app shows it under a "general guidance" label. Only add it when it directly helps with THIS question and you are sure it is correct, natural and in the user's language; otherwise null. 1-2 short sentences, no prices or amounts, no questions or offers of help.

LANGUAGE (strict)
Reply in exactly the language and script of the latest message (USER_MESSAGE_SCRIPT, ROMAN_URDU_LIKELY):
- Urdu script -> Urdu script, language "urdu".
- Roman Urdu (Urdu in English letters, e.g. "meri kamai kitni hai") -> natural Roman Urdu, never English or Urdu script, language "roman_urdu". If ROMAN_URDU_LIKELY is true, reply in Roman Urdu.
- English -> English, language "english".
generalGuidance uses the same language. Numbers, "Rs" and "kg" may stay as they are.

STYLE
Answer the question first, in 2-4 short sentences or up to 5 lines starting with "- ". When asked to choose, give ONE recommendation and the main reason. If something essential is missing, ask ONE short question. Plain text, no Markdown or emojis. Use recentConversation for follow-ups.

suggestedView: the page for the data you answered about: ${r.views}; price questions and declines: "NONE".

OUTPUT: only one JSON object with exactly these keys:
{"language":"english|urdu|roman_urdu","reply":"string","generalGuidance":"string or null","suggestedView":"NONE|${views.join('|')}"}
`.trim();
}

/* ------------------------------------------------------------------ *
 * Helpers (copied from natural-ai.ts)
 * ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getHistory(context: Record<string, unknown>): StoredHistory[] {
  if (!Array.isArray(context.history)) return [];
  return context.history
    .filter(
      (item): item is StoredHistory =>
        typeof item === 'object' &&
        item !== null &&
        'role' in item &&
        'text' in item &&
        ((item as StoredHistory).role === 'user' || (item as StoredHistory).role === 'ai') &&
        typeof (item as StoredHistory).text === 'string'
    )
    .map((item) => ({ role: item.role, text: item.text }))
    .slice(-12);
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
 * Crop names, "Rs" and "kg" may appear in Latin letters inside an Urdu reply,
 * so this only checks which script dominates.
 */
function replyMatchesScript(reply: string, script: MessageScript) {
  const { urdu, latin } = countScripts(reply);
  if (script === 'urdu') return urdu >= latin;
  return urdu * 4 <= latin;
}

function inExpectedLanguage(text: string, script: MessageScript, romanUrdu: boolean) {
  if (!replyMatchesScript(text, script)) return false;
  return !romanUrdu || romanUrduLikely(text);
}

/*
 * Sentences where the assistant speaks AS the user about the user's own
 * trading ("I got Rs 9,053 commission", "maine becha", "میں نے خریدے").
 * The assistant talking about itself ("I can only see...") is fine.
 */
const SPEAKING_AS_USER = [
  /\b(?:I|we)\s+(?:have\s+|had\s+)?(?:got|earned|made|bought|sold|paid|received|won|own|hold|spent)\b/i,
  /\b(?:my|our)\s+(?:commission|earnings?|income|margin|profit|lots?|deals?|auctions?|sales?|stock|warehouse|shop|offers?|orders?|purchases?|customers?|bids?|money|takings)\b/i,
  /\b(?:mujhe|mujhay|muje|maine|mainay|mein\s+ne|hamein|humein|hum\s+ne)\b[^.!?\n]{0,40}?\b(?:mila|mili|mile|kamaya|kamaye|kamayi|khareed\w*|khareed|becha|bechi|bechay|beche|diya|diye|di|jeeta|jeeti)\b/i,
  /\b(?:mera|meri|mere|hamara|hamari|hamare)\s+(?:commission|kamai|munafa|lot|deal|neelami|maal|stock|dukaan|dukan|order|orders|offer|boli|paisa|paise|godam)\b/i,
  /(?:مجھے|میں نے|ہمیں|ہم نے)[^۔.!؟\n]{0,40}?(?:ملا|ملی|ملے|کمایا|کمائے|خرید|بیچ|دیا|دیے|جیت)/,
  /(?:میرا|میری|میرے|ہمارا|ہماری|ہمارے)\s*(?:کمیشن|کمائی|منافع|لاٹ|سودا|سودے|نیلامی|مال|اسٹاک|دکان|آرڈر|آفر|بولی|گودام)/,
];

function speaksAsUser(text: string) {
  return SPEAKING_AS_USER.some((pattern) => pattern.test(text));
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
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(now);
  return `${date} (${weekday})`;
}

function daysSince(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function money(amount: number) {
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
}

function perKg(amount: number) {
  return `Rs ${amount.toLocaleString('en-PK', { maximumFractionDigits: 2 })}/kg`;
}

function percent(rate: number) {
  return `${(rate * 100).toLocaleString('en-PK', { maximumFractionDigits: 2 })}%`;
}

// Lower-case letters and digits only, so "Rahim Yar Khan" matches "RahimYarKhan".
function placeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cityList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((c): c is string => typeof c === 'string') : [];
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
 * Sorts prices from highest to lowest in code and keeps the top entries plus
 * every place the user cares about. Ranks are positions in the full list.
 */
function rankPrices(entries: Omit<RankedPrice, 'rank'>[], wantedPlaces: string[]) {
  const sorted = [...entries]
    .sort((a, b) => b.pricePerKgValue - a.pricePerKgValue)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const kept = sorted.filter(
    (entry) => entry.rank <= TOP_PRICES_PER_SOURCE || wantedPlaces.includes(placeKey(entry.city))
  );
  return { total: sorted.length, kept };
}

function getAiConfig() {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error('AI_API_KEY is not configured on the server.');
  const baseUrl = (process.env.AI_BASE_URL || DEFAULT_AI_BASE_URL).replace(/\/+$/, '');
  const model = process.env.AI_MODEL_TRADER || process.env.AI_MODEL || DEFAULT_AI_MODEL;
  return { apiKey, baseUrl, model };
}

function contentToText(content: unknown): string | null {
  if (typeof content === 'string') return content;
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
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('AI response is not JSON.');
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

async function callModel(messages: ChatMessage[]): Promise<{ result: TraderAiResult; raw: string; usage: unknown }> {
  const config = getAiConfig();

  // Hard stop so a slow or hung provider can never freeze the chat. On abort
  // the caller falls back to the rule-based assistant.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
        // JSON Object mode: valid JSON guaranteed, keys checked with zod.
        response_format: { type: 'json_object' },
      }),
    });

    const body = await response.text();

    if (!response.ok) {
      if (body.includes('AllocationQuota.FreeTierOnly')) {
        console.error('Trader AI free quota used up (403 AllocationQuota.FreeTierOnly); using the rule-based assistant.');
      } else {
        console.error('Trader AI provider error:', response.status, body.slice(0, 1000));
      }
      throw new Error(`AI service returned ${response.status}`);
    }

    const data = asRecord(JSON.parse(body));
    const choice = asRecord(Array.isArray(data.choices) ? data.choices[0] : undefined);
    const output = contentToText(asRecord(choice.message).content);
    if (!output) {
      console.error('Unexpected trader AI response:', body.slice(0, 1000));
      throw new Error('AI returned no usable response.');
    }

    const validated = traderAiResultSchema.safeParse(parseJsonContent(output));
    if (!validated.success) {
      console.error('Trader AI response failed validation:', validated.error.issues, output.slice(0, 1000));
      throw new Error('AI response did not match the expected format.');
    }

    return { result: validated.data, raw: output, usage: data.usage };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Replaces an identifier the model decorated with the real one it contains.
function fixIdentifiers(text: string, knownIds: string[]) {
  const ids = [...knownIds].sort((a, b) => b.length - a.length);
  return text.replace(/[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+/g, (token) => {
    if (ids.includes(token)) return token;
    const contained = ids.find((id) => token.includes(id));
    if (contained) {
      console.warn(`Trader AI changed identifier ${contained} to ${token}; fixed.`);
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
    [...text.matchAll(pattern)].map((match) => Number(match[1].replace(/,/g, '')))
  );
}

function unknownPerKgPrices(text: string, allowed: number[]) {
  return perKgPricesIn(text).filter((value) => !allowed.some((known) => Math.abs(known - value) <= 0.5));
}

/*
 * Rupee amounts that are not per kg ("Rs 12,150", "12,150 روپے"). New for
 * the traders, whose answers are mostly totals: every amount must be one the
 * server calculated.
 */
function rupeeTotalsIn(text: string) {
  const patterns = [
    /Rs\.?\s*(\d[\d,]*(?:\.\d+)?)(?![\d,.])(?!\s*(?:\/|per\s*)\s*(?:kg|kilo|کلو))/gi,
    /(\d[\d,]*(?:\.\d+)?)(?![\d,.])\s*(?:روپے|روپیہ)(?!\s*(?:\/|فی)\s*(?:کلو|kg))/g,
  ];
  return patterns.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => Number(match[1].replace(/,/g, '')))
  );
}

function unknownRupeeTotals(text: string, allowed: number[]) {
  return rupeeTotalsIn(text).filter((value) => !allowed.some((known) => Math.abs(known - value) <= 1));
}

const ALL_GUIDANCE_LABELS = Object.values(GUIDANCE_LABEL);

// Splits text at the first general-guidance label.
function splitAtGuidanceLabel(text: string) {
  const positions = ALL_GUIDANCE_LABELS.map((label) => text.indexOf(label)).filter((index) => index >= 0);
  if (!positions.length) return { before: text.trim(), after: '' };
  const first = Math.min(...positions);
  return { before: text.slice(0, first).trim(), after: text.slice(first).trim() };
}

// Earlier turns without their guidance part, for the model's history.
function withoutGuidance(text: string) {
  return splitAtGuidanceLabel(text).before || text;
}

// Offers of help or requests to ask again: filler, not general knowledge.
const FILLER_PATTERN =
  /\b(bata\s*d[ei]i?n|batayen|batayein|bataen|pooch|puchh?|let me know|ask me|tell me|feel free|if you (want|need|would like))\b|بتائیں|بتا دیں|پوچھیں/i;

// General guidance without labels, duplicates, prices, amounts, records or filler.
function cleanGuidance(parts: (string | null)[], knownIds: string[]) {
  let text = parts.filter(Boolean).join(' ');
  for (const label of ALL_GUIDANCE_LABELS) text = text.split(label).join(' ');
  const sentences = text
    .split(/(?<=[.!?۔؟])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => perKgPricesIn(sentence).length === 0 && rupeeTotalsIn(sentence).length === 0)
    .filter((sentence) => !/[?؟]/.test(sentence))
    .filter((sentence) => !FILLER_PATTERN.test(sentence))
    .filter((sentence) => !knownIds.some((id) => sentence.includes(id)));
  const unique = [...new Set(sentences)];
  return unique.length ? unique.join(' ') : null;
}

function normalizeResult(result: TraderAiResult, knownIds: string[]): TraderAiResult {
  const { before, after } = splitAtGuidanceLabel(result.reply);
  return {
    ...result,
    reply: before || result.reply,
    generalGuidance: cleanGuidance([after, result.generalGuidance], knownIds),
  };
}

/*
 * Language for the server-written label. Script alone cannot tell Roman Urdu
 * from English, so an unclear message follows the model and earlier messages.
 */
function replyLanguage(
  result: TraderAiResult,
  script: MessageScript,
  message: string,
  history: StoredHistory[]
): keyof typeof GUIDANCE_LABEL {
  if (script === 'urdu') return 'urdu';
  if (romanUrduLikely(message) || result.language !== 'english') return 'roman_urdu';
  if (englishLikely(message)) return 'english';
  const earlierRomanUrdu = history
    .filter((item) => item.role === 'user')
    .slice(-3)
    .some((item) => messageScript(item.text) === 'latin' && romanUrduLikely(item.text));
  return earlierRomanUrdu ? 'roman_urdu' : 'english';
}

function composeReply(result: TraderAiResult, language: keyof typeof GUIDANCE_LABEL) {
  if (!result.generalGuidance) return result.reply;
  return `${result.reply}\n\n${GUIDANCE_LABEL[language]} ${result.generalGuidance}`;
}

async function createOrResumeSession(requestedSessionId: string | undefined, userId: string, role: UserRole) {
  let session = requestedSessionId
    ? await prisma.agentSession.findUnique({ where: { id: requestedSessionId } })
    : null;
  // A session id from another account must never be resumed.
  if (session && session.userId !== userId) session = null;
  if (!session) {
    session = await prisma.agentSession.create({ data: { userId, context: { role, history: [] } } });
  }
  return session;
}

/* ------------------------------------------------------------------ *
 * Shared context pieces
 * ------------------------------------------------------------------ */

/*
 * Every amount and per-kg price written into a context goes through these,
 * so the reply can be checked against what the server calculated.
 */
function amountRecorder() {
  const totals = new Set<number>();
  const rates = new Set<number>();
  return {
    rs: (amount: number) => {
      totals.add(Math.round(amount));
      return money(amount);
    },
    pk: (amount: number) => {
      rates.add(amount);
      return perKg(amount);
    },
    addRates: (values: number[]) => values.forEach((value) => rates.add(value)),
    allowed: () => ({ allowedTotals: [...totals], allowedPerKg: [...rates] }),
  };
}

// Price ranking: same sources and rules as the farmer chat.
async function getPriceRanking(homeCity: string | null, message: string) {
  const [marketPrices, crops, mandis] = await Promise.all([
    prisma.marketPrice.findMany({ include: { crop: true, mandi: true }, orderBy: { recordedAt: 'desc' }, take: 100 }),
    prisma.crop.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.mandi.findMany({ select: { city: true } }),
  ]);

  // Always kept: the user's own city and any city named in the message.
  const messageKey = placeKey(message);
  const wantedPlaces = [
    ...new Set(
      [
        homeCity ?? '',
        ...[...mandis.map((m) => m.city), ...AMIS_TOMATO_PRICES.map((row) => row.city)].filter((city) => {
          const key = placeKey(city);
          return key.length >= 4 && messageKey.includes(key);
        }),
      ]
        .map(placeKey)
        .filter(Boolean)
    ),
  ];

  const ranking = crops
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
            trend: price.trend === 'stable' ? 'stable' : `${price.trend} ${Math.abs(price.changePercent)}%`,
          })),
        wantedPlaces
      );
      const amis =
        crop.name === 'Tomato'
          ? rankPrices(
              AMIS_TOMATO_PRICES.filter((row) => row.fqp !== null).map((row) => ({
                place: row.city,
                city: row.city,
                pricePerKgValue: row.fqp! / 100,
                date: AMIS_REPORT_ISO_DATE,
                daysOld: daysSince(new Date(AMIS_REPORT_ISO_DATE)),
              })),
              wantedPlaces
            )
          : null;
      return { crop, app, amis };
    })
    .filter((entry) => entry.app.total > 0 || entry.amis);

  const allowedPerKg = ranking.flatMap((entry) => [
    ...entry.app.kept.map((item) => item.pricePerKgValue),
    ...(entry.amis?.kept.map((item) => item.pricePerKgValue) ?? []),
  ]);

  const forModel = ranking.map((entry) => ({
    crop: entry.crop.name,
    ...(entry.app.total
      ? {
          appMandiRecords: {
            placesWithData: entry.app.total,
            highestFirst: entry.app.kept.map(
              (item) =>
                `${item.rank}. ${item.place}: ${perKg(item.pricePerKgValue)} (recorded ${item.date}, ${item.daysOld} days old, trend ${item.trend})`
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
            highestFirst: entry.amis.kept.map((item) => `${item.rank}. ${item.place}: ${perKg(item.pricePerKgValue)}`),
          },
        }
      : {}),
  }));

  return { forModel, allowedPerKg, crops: crops.map((crop) => crop.name) };
}

type TraderContext = {
  forModel: Record<string, unknown>;
  allowedPerKg: number[];
  allowedTotals: number[];
  knownIds: string[];
  /** Competitors whose purchases, prices and sales the user must never see. */
  competitors: string[];
};

/** Other arhtis or other shops, by business and personal name. */
async function competitorsOf(userId: string, role: 'ARHTI' | 'SHOPKEEPER') {
  if (role === 'ARHTI') {
    const others = await prisma.user.findMany({
      where: { role: UserRole.ARHTI, id: { not: userId } },
      select: { name: true, arhtiProfile: { select: { businessName: true } } },
    });
    return others.flatMap((u) => [u.name, u.arhtiProfile?.businessName ?? '']).filter(Boolean);
  }
  const others = await prisma.user.findMany({
    where: { role: UserRole.SHOPKEEPER, id: { not: userId } },
    select: { name: true, shopkeeperProfile: { select: { shopName: true } } },
  });
  return others.flatMap((u) => [u.name, u.shopkeeperProfile?.shopName ?? '']).filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Arhti context: only this arhti's own records and what their pages show
 * ------------------------------------------------------------------ */

async function getArhtiContext(userId: string, message: string): Promise<TraderContext> {
  const { rs, pk, addRates, allowed } = amountRecorder();

  const [arhti, openBatches, offers, demands, deals, lots, auctions, sales, earnings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { arhtiProfile: { include: { mandi: true } } },
    }),
    // The Farmer Market (what /sourcing shows): open batches from any farmer.
    prisma.farmerCropBatch.findMany({
      where: { status: { in: [CropBatchStatus.READY_FOR_SALE, CropBatchStatus.NEGOTIATING] }, availableKg: { gt: 0 } },
      include: {
        crop: true,
        farmer: { select: { name: true } },
        offers: { where: { arhtiId: userId, status: OfferStatus.PENDING }, select: { pricePerKg: true, quantityKg: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: OPEN_FARMER_BATCHES,
    }),
    prisma.farmerArhtiOffer.findMany({
      where: { arhtiId: userId },
      include: { batch: { include: { crop: true } }, farmer: { select: { name: true } }, destinationMandi: true },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.arhtiDemandRequest.findMany({
      where: { arhtiId: userId },
      include: { crop: true, mandi: true },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.farmerArhtiDeal.findMany({
      where: { arhtiId: userId, status: { not: DealStatus.CANCELLED } },
      include: {
        crop: true,
        farmer: { select: { name: true } },
        destinationMandi: true,
        pickup: true,
        settlement: { include: { deductions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.arhtiInventoryLot.findMany({
      where: { arhtiId: userId },
      include: { crop: true },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.auction.findMany({
      where: { arhtiId: userId },
      include: {
        inventoryLot: { include: { crop: true } },
        bids: { orderBy: { amountPerKg: 'desc' }, take: 1, include: { bidder: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.arhtiVendorSale.findMany({
      where: { arhtiId: userId },
      include: {
        vendor: { select: { name: true, vendorProfile: { select: { businessName: true } } } },
        auction: {
          include: {
            inventoryLot: {
              include: {
                crop: true,
                deal: {
                  select: {
                    dealNumber: true,
                    settlement: {
                      select: {
                        status: true,
                        deductions: { where: { type: DeductionType.ARHTI_COMMISSION }, select: { amount: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    getArhtiEarnings(userId),
  ]);

  const commissionRate = arhti?.arhtiProfile?.commissionRate ?? DEFAULT_COMMISSION_RATE;
  const mandi = arhti?.arhtiProfile?.mandi ?? null;
  const competitors = await competitorsOf(userId, 'ARHTI');

  const ranking = await getPriceRanking(mandi?.city ?? null, message);
  addRates(ranking.allowedPerKg);

  const vendorName = (v: { name: string; vendorProfile: { businessName: string | null } | null }) =>
    v.vendorProfile?.businessName ?? v.name;

  const forModel = {
    today: karachiToday(),

    arhti: {
      name: arhti?.name ?? null,
      business: arhti?.arhtiProfile?.businessName ?? null,
      mandi: mandi ? `${mandi.name}, ${mandi.city}` : null,
      commissionRate: percent(commissionRate),
      commissionNote: 'deducted from the farmer at settlement, and paid by the winning vendor on top of the auction price',
    },

    earnings: {
      commissionFromFarmers: `${rs(earnings.farmerCommission)} (from ${earnings.paidSettlements} paid farmer settlements)`,
      commissionFromVendors: `${rs(earnings.vendorCommission)} (on ${earnings.salesCount} lots sold at auction)`,
      tradingMargin: `${rs(earnings.tradingMargin)} (auction price minus price paid to the farmer, on ${earnings.soldKg.toLocaleString('en-PK')} kg sold at auction)`,
      total: rs(
        Math.round(earnings.farmerCommission) + Math.round(earnings.vendorCommission) + Math.round(earnings.tradingMargin)
      ),
      pendingNotInTotal:
        earnings.pendingSettlements > 0
          ? `${rs(earnings.farmerCommissionPending)} commission on ${earnings.pendingSettlements} farmer settlement(s) not yet paid`
          : null,
      salesAtAuctionValue: rs(earnings.auctionValue),
    },

    farmerMarket: openBatches.map((batch) => ({
      crop: batch.crop.name,
      farmer: batch.farmer.name,
      from: `${batch.originCity}, ${batch.originProvince}`,
      availableKg: batch.availableKg,
      grade: batch.grade,
      askingPrice: batch.askingPricePerKg ? pk(batch.askingPricePerKg) : 'open to offers',
      harvested: isoDate(batch.harvestDate),
      status: plainStatus(batch.status),
      yourPendingOffer: batch.offers[0] ? `${pk(batch.offers[0].pricePerKg)} for ${batch.offers[0].quantityKg.toLocaleString('en-PK')} kg` : null,
    })),

    yourOffersToFarmers: offers.map((offer) => ({
      farmer: offer.farmer.name,
      crop: offer.batch.crop.name,
      quantityKg: offer.quantityKg,
      price: pk(offer.pricePerKg),
      destination: `${offer.destinationMandi.name}, ${offer.destinationMandi.city}`,
      transport: PLAIN_TRANSPORT[offer.transportResponsibility],
      status: plainStatus(offer.status),
      sent: isoDate(offer.createdAt),
    })),

    yourBuyRequests: demands.map((demand) => ({
      requestNumber: demand.requestNumber,
      crop: demand.crop.name,
      quantityKg: `${demand.minQuantityKg.toLocaleString('en-PK')}-${demand.maxQuantityKg.toLocaleString('en-PK')}`,
      targetPrice:
        demand.targetPriceMin && demand.targetPriceMax
          ? `${pk(demand.targetPriceMin)} to ${pk(demand.targetPriceMax)}`
          : null,
      neededBy: isoDate(demand.neededBy),
      mandi: demand.mandi.name,
      status: plainStatus(demand.status),
    })),

    yourFarmerDeals: deals.map((deal) => {
      const s = deal.settlement;
      const deduction = (type: DeductionType) => s?.deductions.find((d) => d.type === type)?.amount ?? 0;
      const receivedKg = deal.receivedQuantityKg;
      return {
        dealNumber: deal.dealNumber,
        farmer: deal.farmer.name,
        crop: deal.crop.name,
        agreed: `${deal.agreedQuantityKg.toLocaleString('en-PK')} kg at ${pk(deal.agreedPricePerKg)}, ${rs(deal.grossAmount)}`,
        destination: deal.destinationMandi.name,
        transport: PLAIN_TRANSPORT[deal.transportResponsibility],
        status: plainStatus(deal.status),
        needsWeighing: deal.status === DealStatus.IN_TRANSIT || deal.status === DealStatus.PICKED_UP,
        driver: deal.pickup?.driverName ?? null,
        weighed: receivedKg !== null ? `${receivedKg.toLocaleString('en-PK')} kg on the kanta (${(deal.weightDifferenceKg ?? 0).toLocaleString('en-PK')} kg vs agreed)` : null,
        settlement: s
          ? {
              gross: rs(s.grossAmount),
              yourCommission: rs(deduction(DeductionType.ARHTI_COMMISSION)),
              mandiCess: `${rs(deduction(DeductionType.MANDI_CESS))} (${percent(MANDI_CESS_RATE)})`,
              farmerTransportShare: deduction(DeductionType.TRANSPORT) ? rs(deduction(DeductionType.TRANSPORT)) : null,
              netPayableToFarmer: rs(s.netPayable),
              status: s.status === 'paid' ? 'farmer paid' : 'farmer not paid yet',
            }
          : null,
      };
    }),

    yourInventoryLots: lots.map((lot) => ({
      lotNumber: lot.lotNumber,
      crop: lot.crop.name,
      grade: lot.grade,
      fromFarmer: `${lot.sourceFarmerName}, ${lot.sourceCity}`,
      receivedKg: lot.receivedQuantityKg,
      notYetAuctionedKg: lot.availableQuantityKg,
      boughtFromFarmerAt: pk(lot.purchasePricePerKg),
      valueAtCostOfUnauctioned: rs(lot.availableQuantityKg * lot.purchasePricePerKg),
      status: plainStatus(lot.status),
    })),

    yourAuctions: auctions.map((auction) => {
      const top = auction.bids[0];
      const cost = auction.inventoryLot.purchasePricePerKg;
      const live = auction.status === AuctionStatus.ACTIVE;
      const atTop =
        live && top
          ? (() => {
              const value = auction.quantityKg * top.amountPerKg;
              const commission = vendorCommission(value, commissionRate);
              const margin = (top.amountPerKg - cost) * auction.quantityKg;
              return {
                auctionValue: rs(value),
                vendorPaysYouCommission: rs(commission),
                yourTradingMargin: `${rs(margin)} ((${pk(top.amountPerKg)} - ${pk(cost)}) x ${auction.quantityKg.toLocaleString('en-PK')} kg)`,
                youEarnOnThisLot: rs(Math.round(commission) + Math.round(margin)),
              };
            })()
          : null;
      return {
        auctionNumber: auction.auctionNumber,
        crop: auction.inventoryLot.crop.name,
        quantityKg: auction.quantityKg,
        status: plainStatus(auction.status),
        reserve: pk(auction.reservePrice),
        yourCost: pk(cost),
        topBid: top ? `${pk(top.amountPerKg)} by ${top.bidder.name}` : 'no bids yet',
        bids: auction.bidCount,
        endsAt: live ? auction.endTime.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : null,
        ...(atTop ? { ifSoldAtTopBid: atTop } : {}),
      };
    }),

    yourRecentSales: sales.map((sale) => {
      const lot = sale.auction.inventoryLot;
      const cost = lot.purchasePricePerKg;
      const margin = (sale.ratePerKg - cost) * sale.quantityKg;
      // The farmer's commission on this lot's deal, in proportion to the kg in
      // this sale (a lot can be auctioned in parts), once the farmer is paid.
      const settlement = lot.deal.settlement;
      const farmerCommission =
        settlement?.status === 'paid' && lot.receivedQuantityKg > 0
          ? (settlement.deductions[0]?.amount ?? 0) * (sale.quantityKg / lot.receivedQuantityKg)
          : 0;
      return {
        saleNumber: sale.saleNumber,
        crop: lot.crop.name,
        vendor: vendorName(sale.vendor),
        sold: `${sale.quantityKg.toLocaleString('en-PK')} kg at ${pk(sale.ratePerKg)}, ${rs(sale.grossAmount)}`,
        vendorPaidCommission: rs(sale.commission),
        vendorPaidInAll: rs(sale.grossAmount + sale.commission),
        yourTradingMargin: `${rs(margin)} (bought from the farmer at ${pk(cost)})`,
        farmerCommissionOnThisLot:
          settlement?.status === 'paid'
            ? `${rs(farmerCommission)} (deal ${lot.deal.dealNumber})`
            : 'farmer not paid yet, so not counted',
        youEarnedOnThisSale: `${rs(Math.round(margin) + Math.round(sale.commission) + Math.round(farmerCommission))} (trading margin + vendor commission + farmer commission on this lot)`,
        date: isoDate(sale.createdAt),
      };
    }),

    priceRanking: ranking.forModel,
    supportedCrops: ranking.crops,
    otherArhtisNotVisibleToYou: competitors,
  };

  const knownIds = [
    ...deals.map((deal) => deal.dealNumber),
    ...lots.map((lot) => lot.lotNumber),
    ...auctions.map((auction) => auction.auctionNumber),
    ...sales.map((sale) => sale.saleNumber),
    ...demands.map((demand) => demand.requestNumber),
  ];

  return { forModel, ...allowed(), knownIds: [...new Set(knownIds)], competitors };
}

/* ------------------------------------------------------------------ *
 * Vendor context: live auctions (as /auctions shows them), the vendor's own
 * purchases, warehouse, wholesale offers and orders. Never the arhti's cost
 * or farmer prices.
 * ------------------------------------------------------------------ */

async function getVendorContext(userId: string, message: string): Promise<TraderContext> {
  const { rs, pk, addRates, allowed } = amountRecorder();

  const [vendor, liveAuctions, myBids, purchases, stocks, offers, orders] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { vendorProfile: true } }),
    prisma.auction.findMany({
      where: { status: AuctionStatus.ACTIVE, endTime: { gt: new Date() } },
      include: {
        inventoryLot: { select: { sourceFarmerName: true, sourceCity: true, crop: { select: { name: true } } } },
        mandi: { select: { name: true, city: true } },
        arhti: { select: { name: true, arhtiProfile: { select: { businessName: true, commissionRate: true } } } },
        bids: { orderBy: { amountPerKg: 'desc' }, take: 1, include: { bidder: { select: { id: true, name: true } } } },
      },
      orderBy: { endTime: 'asc' },
      take: MARKET_RECORDS,
    }),
    prisma.bid.groupBy({ by: ['auctionId'], where: { bidderId: userId }, _max: { amountPerKg: true } }),
    prisma.arhtiVendorSale.findMany({
      where: { vendorId: userId },
      include: {
        auction: { select: { auctionNumber: true, mandi: { select: { name: true } }, inventoryLot: { select: { crop: { select: { name: true } } } } } },
        arhti: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.vendorInventory.findMany({
      where: { vendorId: userId },
      include: { crop: true },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.vendorOffer.findMany({
      where: { vendorId: userId },
      include: { crop: true, stock: { select: { stockNumber: true, costPerKg: true } } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.vendorShopkeeperSale.findMany({
      where: { vendorId: userId },
      include: {
        shopkeeper: { select: { name: true, shopkeeperProfile: { select: { shopName: true, city: true } } } },
        offer: { select: { offerNumber: true, crop: { select: { name: true } }, stock: { select: { costPerKg: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
  ]);

  const ranking = await getPriceRanking(vendor?.vendorProfile?.warehouseCity ?? null, message);
  addRates(ranking.allowedPerKg);

  const myBidOn = new Map(myBids.map((b) => [b.auctionId, b._max.amountPerKg]));

  // Totals over everything, as the vendor's insights page shows them.
  const [allPurchases, allSales] = await Promise.all([
    prisma.arhtiVendorSale.aggregate({ where: { vendorId: userId }, _sum: { grossAmount: true, commission: true, quantityKg: true }, _count: true }),
    prisma.vendorShopkeeperSale.findMany({
      where: { vendorId: userId },
      select: { quantityKg: true, grossAmount: true, offer: { select: { stock: { select: { costPerKg: true } } } } },
    }),
  ]);
  const soldKg = allSales.reduce((sum, s) => sum + s.quantityKg, 0);
  const revenue = allSales.reduce((sum, s) => sum + s.grossAmount, 0);
  const costOfSold = allSales.reduce((sum, s) => sum + s.quantityKg * s.offer.stock.costPerKg, 0);
  const stockKg = stocks.reduce((sum, s) => sum + s.availableKg, 0);
  const stockValue = stocks.reduce((sum, s) => sum + s.availableKg * s.costPerKg, 0);

  const forModel = {
    today: karachiToday(),

    vendor: {
      name: vendor?.name ?? null,
      business: vendor?.vendorProfile?.businessName ?? null,
      warehouseCity: vendor?.vendorProfile?.warehouseCity ?? null,
      deliversTo: cityList(vendor?.vendorProfile?.servesCities),
    },

    summary: {
      paidAtMandi: `${rs((allPurchases._sum.grossAmount ?? 0) + (allPurchases._sum.commission ?? 0))} for ${(allPurchases._sum.quantityKg ?? 0).toLocaleString('en-PK')} kg in ${allPurchases._count} lot(s), of which arhti commission ${rs(allPurchases._sum.commission ?? 0)}`,
      wholesaleRevenue: `${rs(revenue)} for ${soldKg.toLocaleString('en-PK')} kg sold to shopkeepers`,
      grossMarginOnWholesale: `${rs(revenue - costOfSold)} (wholesale revenue minus your cost incl. commission of the kg sold)`,
      stockInWarehouse: `${stockKg.toLocaleString('en-PK')} kg not yet on offer, worth ${rs(stockValue)} at your cost`,
    },

    liveAuctions: liveAuctions.map((auction) => {
      const rate = auction.arhti.arhtiProfile?.commissionRate ?? DEFAULT_COMMISSION_RATE;
      const top = auction.bids[0];
      const nextMin = top ? top.amountPerKg + auction.minimumIncrement : auction.reservePrice;
      const mine = myBidOn.get(auction.id) ?? null;
      return {
        auctionNumber: auction.auctionNumber,
        crop: auction.inventoryLot.crop.name,
        quantityKg: auction.quantityKg,
        grade: auction.grade,
        mandi: `${auction.mandi.name}, ${auction.mandi.city}`,
        arhti: auction.arhti.arhtiProfile?.businessName ?? auction.arhti.name,
        grownBy: `${auction.inventoryLot.sourceFarmerName}, ${auction.inventoryLot.sourceCity}`,
        reserve: pk(auction.reservePrice),
        topBid: top ? `${pk(top.amountPerKg)} by ${top.bidder.id === userId ? 'you' : top.bidder.name}` : 'no bids yet',
        youLead: !!top && top.bidder.id === userId,
        yourHighestBid: mine !== null ? pk(mine) : null,
        bids: auction.bidCount,
        arhtiCommission: `${percent(rate)} on top of the winning price, paid by the winner`,
        nextMinimumBid: pk(nextMin),
        youPayAtNextMinimumBid: `${pk(vendorPaysPerKg(nextMin, rate))} incl. commission, ${rs(nextMin * auction.quantityKg * (1 + rate))} for ${auction.quantityKg.toLocaleString('en-PK')} kg`,
        ...(top
          ? {
              ifYouWinAtTopBid: `${rs(top.amountPerKg * auction.quantityKg)} + ${rs(vendorCommission(top.amountPerKg * auction.quantityKg, rate))} commission = ${rs(top.amountPerKg * auction.quantityKg * (1 + rate))}`,
            }
          : {}),
        endsAt: auction.endTime.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      };
    }),

    lotsYouWon: purchases.map((sale) => ({
      saleNumber: sale.saleNumber,
      auctionNumber: sale.auction.auctionNumber,
      crop: sale.auction.inventoryLot.crop.name,
      mandi: sale.auction.mandi.name,
      arhti: sale.arhti.name,
      bought: `${sale.quantityKg.toLocaleString('en-PK')} kg at ${pk(sale.ratePerKg)}, ${rs(sale.grossAmount)}`,
      commissionPaid: rs(sale.commission),
      paidInAll: rs(sale.grossAmount + sale.commission),
      costPerKgInclCommission: pk((sale.grossAmount + sale.commission) / sale.quantityKg),
      date: isoDate(sale.createdAt),
    })),

    warehouseStock: stocks.map((stock) => ({
      stockNumber: stock.stockNumber,
      crop: stock.crop.name,
      grade: stock.grade,
      from: `${stock.sourceFarmCity} farm, ${stock.sourceMandiCity} mandi`,
      boughtKg: stock.quantityKg,
      notYetOnOfferKg: stock.availableKg,
      costPerKgInclCommission: pk(stock.costPerKg),
      valueOfUnofferedAtCost: rs(stock.availableKg * stock.costPerKg),
      status: plainStatus(stock.status),
    })),

    yourWholesaleOffers: offers.map((offer) => ({
      offerNumber: offer.offerNumber,
      crop: offer.crop.name,
      stockNumber: offer.stock.stockNumber,
      price: pk(offer.pricePerKg),
      yourCost: pk(offer.stock.costPerKg),
      marginPerKg: pk(offer.pricePerKg - offer.stock.costPerKg),
      remainingKg: offer.remainingKg,
      offeredKg: offer.offeredQuantityKg,
      minimumOrderKg: offer.minOrderKg,
      deliversTo: cityList(offer.deliveryCities),
      deliveryHours: offer.deliveryEtaHours,
      status: plainStatus(offer.status),
    })),

    ordersFromShopkeepers: orders.map((sale) => ({
      saleNumber: sale.saleNumber,
      shop: sale.shopkeeper.shopkeeperProfile?.shopName ?? sale.shopkeeper.name,
      city: sale.shopkeeper.shopkeeperProfile?.city ?? sale.deliveryCity,
      crop: sale.offer.crop.name,
      sold: `${sale.quantityKg.toLocaleString('en-PK')} kg at ${pk(sale.ratePerKg)}, ${rs(sale.grossAmount)}`,
      yourMargin: `${rs((sale.ratePerKg - sale.offer.stock.costPerKg) * sale.quantityKg)} (${pk(sale.ratePerKg - sale.offer.stock.costPerKg)} over your cost)`,
      status: plainStatus(sale.status),
      date: isoDate(sale.createdAt),
    })),

    priceRanking: ranking.forModel,
    supportedCrops: ranking.crops,
  };

  const knownIds = [
    ...liveAuctions.map((a) => a.auctionNumber),
    ...purchases.flatMap((s) => [s.saleNumber, s.auction.auctionNumber]),
    ...stocks.map((s) => s.stockNumber),
    ...offers.map((o) => o.offerNumber),
    ...orders.map((s) => s.saleNumber),
  ];

  return { forModel, ...allowed(), knownIds: [...new Set(knownIds)], competitors: [] };
}

/* ------------------------------------------------------------------ *
 * Shopkeeper context: wholesale offers (as /wholesale shows them), the
 * shopkeeper's own purchases, shop stock, listings and customer orders.
 * Never the vendor's cost, the auction price or anyone else's margin.
 * ------------------------------------------------------------------ */

async function getShopkeeperContext(userId: string, message: string): Promise<TraderContext> {
  const { rs, pk, addRates, allowed } = amountRecorder();

  const [shopkeeper, market, purchases, stocks, listings, orders] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { shopkeeperProfile: true } }),
    prisma.vendorOffer.findMany({
      where: { status: OfferListingStatus.ACTIVE, remainingKg: { gt: 0 } },
      include: {
        crop: true,
        vendor: { select: { name: true, vendorProfile: { select: { businessName: true, warehouseCity: true } } } },
        stock: { select: { sourceFarmCity: true, sourceMandiCity: true } },
      },
      orderBy: { pricePerKg: 'asc' },
      take: MARKET_RECORDS,
    }),
    prisma.vendorShopkeeperSale.findMany({
      where: { shopkeeperId: userId },
      include: {
        vendor: { select: { name: true, vendorProfile: { select: { businessName: true } } } },
        offer: { select: { crop: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.shopkeeperInventory.findMany({
      where: { shopkeeperId: userId },
      include: { crop: true },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.retailListing.findMany({
      where: { shopkeeperId: userId },
      include: { crop: true, stock: { select: { stockNumber: true, costPerKg: true } } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_RECORDS,
    }),
    prisma.consumerOrder.findMany({
      where: { shopkeeperId: userId },
      include: {
        consumer: { select: { name: true } },
        items: { include: { listing: { select: { title: true, crop: { select: { name: true } } } } } },
      },
      orderBy: { placedAt: 'desc' },
      take: RECENT_RECORDS,
    }),
  ]);

  const city = shopkeeper?.shopkeeperProfile?.city ?? null;
  const ranking = await getPriceRanking(city, message);
  const competitors = await competitorsOf(userId, 'SHOPKEEPER');
  addRates(ranking.allowedPerKg);

  // Totals over everything, as the shop's insights and orders pages show them.
  const [allPurchases, soldItems] = await Promise.all([
    prisma.vendorShopkeeperSale.aggregate({ where: { shopkeeperId: userId }, _sum: { grossAmount: true, quantityKg: true }, _count: true }),
    prisma.consumerOrderItem.findMany({
      where: { order: { shopkeeperId: userId, status: { not: ConsumerOrderStatus.CANCELLED } } },
      select: { quantityKg: true, lineTotal: true, listing: { select: { stock: { select: { costPerKg: true } } } } },
    }),
  ]);
  const soldKg = soldItems.reduce((sum, i) => sum + i.quantityKg, 0);
  const retailRevenue = soldItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const costOfSold = soldItems.reduce((sum, i) => sum + i.quantityKg * i.listing.stock.costPerKg, 0);
  const openOrders = orders.filter((o) => !([ConsumerOrderStatus.DELIVERED, ConsumerOrderStatus.CANCELLED] as ConsumerOrderStatus[]).includes(o.status));
  const backRoomKg = stocks.reduce((sum, s) => sum + (s.status === StockStatus.SOLD_OUT ? 0 : s.availableKg), 0);

  const forModel = {
    today: karachiToday(),

    shop: {
      name: shopkeeper?.shopkeeperProfile?.shopName ?? shopkeeper?.name ?? null,
      city,
      rating: shopkeeper?.shopkeeperProfile?.ratingCount
        ? `${shopkeeper.shopkeeperProfile.rating.toFixed(1)} from ${shopkeeper.shopkeeperProfile.ratingCount} customers`
        : 'no ratings yet',
    },

    summary: {
      boughtWholesale: `${rs(allPurchases._sum.grossAmount ?? 0)} for ${(allPurchases._sum.quantityKg ?? 0).toLocaleString('en-PK')} kg in ${allPurchases._count} order(s)`,
      retailSales: `${rs(retailRevenue)} for ${soldKg.toLocaleString('en-PK')} kg sold to customers (not counting delivery fees or cancelled orders)`,
      grossMarginOnRetail: `${rs(retailRevenue - costOfSold)} (retail sales minus your wholesale cost of the kg sold)`,
      backRoomStock: `${backRoomKg.toLocaleString('en-PK')} kg in the shop not yet on the shelf`,
      openCustomerOrders: openOrders.length,
    },

    wholesaleMarket: market.map((offer) => ({
      crop: offer.crop.name,
      vendor: offer.vendor.vendorProfile?.businessName ?? offer.vendor.name,
      vendorWarehouse: offer.vendor.vendorProfile?.warehouseCity ?? null,
      grownIn: `${offer.stock.sourceFarmCity}, traded at ${offer.stock.sourceMandiCity} mandi`,
      grade: offer.grade,
      price: pk(offer.pricePerKg),
      availableKg: offer.remainingKg,
      minimumOrderKg: offer.minOrderKg,
      deliversTo: cityList(offer.deliveryCities),
      deliversToYourCity: !!city && cityList(offer.deliveryCities).includes(city),
      deliveryHours: offer.deliveryEtaHours,
    })),

    yourWholesalePurchases: purchases.map((sale) => ({
      saleNumber: sale.saleNumber,
      vendor: sale.vendor.vendorProfile?.businessName ?? sale.vendor.name,
      crop: sale.offer.crop.name,
      bought: `${sale.quantityKg.toLocaleString('en-PK')} kg at ${pk(sale.ratePerKg)}, ${rs(sale.grossAmount)}`,
      status: plainStatus(sale.status),
      date: isoDate(sale.createdAt),
    })),

    shopStock: stocks.map((stock) => ({
      stockNumber: stock.stockNumber,
      crop: stock.crop.name,
      grade: stock.grade,
      boughtKg: stock.quantityKg,
      notYetOnShelfKg: stock.availableKg,
      yourCost: pk(stock.costPerKg),
      status: plainStatus(stock.status),
    })),

    yourRetailListings: listings.map((listing) => ({
      title: listing.title,
      crop: listing.crop.name,
      stockNumber: listing.stock.stockNumber,
      price: pk(listing.pricePerKg),
      yourCost: pk(listing.stock.costPerKg),
      marginPerKg: pk(listing.pricePerKg - listing.stock.costPerKg),
      remainingKg: listing.remainingKg,
      soldKg: listing.listedQuantityKg - listing.remainingKg,
      packSizeKg: listing.packSizeKg,
      status: plainStatus(listing.status),
    })),

    customerOrders: orders.map((order) => ({
      orderNumber: order.orderNumber,
      customer: order.consumer.name,
      items: order.items.map((item) => `${item.quantityKg.toLocaleString('en-PK')} kg ${item.listing.crop.name} at ${pk(item.pricePerKg)} = ${rs(item.lineTotal)}`),
      deliveryFee: rs(order.deliveryFee),
      total: rs(order.totalAmount),
      status: plainStatus(order.status),
      placed: isoDate(order.placedAt),
    })),

    priceRanking: ranking.forModel,
    supportedCrops: ranking.crops,
    otherShopsNotVisibleToYou: competitors,
  };

  const knownIds = [
    ...purchases.map((s) => s.saleNumber),
    ...stocks.map((s) => s.stockNumber),
    ...orders.map((o) => o.orderNumber),
  ];

  return { forModel, ...allowed(), knownIds: [...new Set(knownIds)], competitors };
}

const CONTEXT_FOR: Record<TraderRole, (userId: string, message: string) => Promise<TraderContext>> = {
  ARHTI: getArhtiContext,
  VENDOR: getVendorContext,
  SHOPKEEPER: getShopkeeperContext,
};

/* ------------------------------------------------------------------ *
 * Ask
 * ------------------------------------------------------------------ */

async function understandTrader(
  role: TraderRole,
  message: string,
  history: StoredHistory[],
  context: TraderContext
): Promise<{ result: TraderAiResult; script: MessageScript }> {
  const script = messageScript(message);
  const romanUrdu = script === 'latin' && romanUrduLikely(message);

  // "CONTEXT" and the field names of the data (e.g. ifYouWinAtTopBid) must
  // never reach the user.
  const fieldNames = new Set<string>(['CONTEXT']);
  const collectKeys = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(collectKeys);
    else if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) {
        if (/[a-z][A-Z]/.test(key)) fieldNames.add(key);
        collectKeys(inner);
      }
    }
  };
  collectKeys(context.forModel);
  const internalNamesIn = (text: string) => [...fieldNames].filter((name) => new RegExp(`\\b${name}\\b`).test(text));

  const input = JSON.stringify({
    USER_MESSAGE_SCRIPT: script === 'urdu' ? 'urdu_script' : 'english_letters',
    ROMAN_URDU_LIKELY: romanUrdu,
    latestMessage: message,
    recentConversation: history.slice(-HISTORY_FOR_MODEL).map((item) => ({ role: item.role, text: withoutGuidance(item.text) })),
    CONTEXT: context.forModel,
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: instructionsFor(role) },
    { role: 'user', content: input },
  ];

  // Problems code can detect, each with the correction sent on the retry.
  const problemsIn = (result: TraderAiResult) => {
    const problems: { kind: 'language' | 'amount' | 'voice' | 'internal' | 'privacy'; fix: string }[] = [];
    if (
      !replyMatchesScript(result.reply, script) ||
      // An English or Roman Urdu reply has no Urdu-script words at all.
      (script === 'latin' && countScripts(result.reply).urdu > 0) ||
      (romanUrdu && result.language === 'english') ||
      (result.generalGuidance !== null && !inExpectedLanguage(result.generalGuidance, script, romanUrdu))
    ) {
      const wanted =
        script === 'urdu'
          ? 'Urdu script'
          : romanUrdu
            ? 'Roman Urdu (Urdu written in English letters)'
            : 'English letters (English or Roman Urdu, matching the user)';
      problems.push({ kind: 'language', fix: `The reply used the wrong language or script. Rewrite "reply" and "generalGuidance" entirely in ${wanted}.` });
    }
    const text = `${result.reply}\n${result.generalGuidance ?? ''}`;
    const badRates = unknownPerKgPrices(text, context.allowedPerKg);
    if (badRates.length) {
      console.warn('Trader AI stated per-kg prices not in the data:', badRates);
      problems.push({ kind: 'amount', fix: `These per-kg prices are not in CONTEXT: ${badRates.join(', ')}. Remove them; quote only prices exactly as given in CONTEXT.` });
    }
    // A known per-kg price written without "per kg" ("92 روپے") is not an invented amount.
    const badTotals = unknownRupeeTotals(text, [...context.allowedTotals, ...context.allowedPerKg]);
    if (badTotals.length) {
      console.warn('Trader AI stated amounts not in the data:', badTotals);
      problems.push({ kind: 'amount', fix: `These rupee amounts are not in CONTEXT: ${badTotals.join(', ')}. Do not calculate amounts yourself; quote only amounts exactly as given in CONTEXT, or say the figure is not available.` });
    }
    const leaked = internalNamesIn(text);
    if (leaked.length) {
      console.warn('Trader AI showed internal names:', leaked);
      problems.push({ kind: 'internal', fix: `The reply shows internal names (${leaked.join(', ')}). Never name the data source or its fields; say it in plain words.` });
    }
    const pricedCompetitor = context.competitors.find((name) =>
      result.reply
        .split(/(?<=[.!?۔؟])\s+|\n/)
        .some((sentence) => sentence.includes(name) && (perKgPricesIn(sentence).length > 0 || rupeeTotalsIn(sentence).length > 0))
    );
    if (pricedCompetitor) {
      console.warn('Trader AI gave figures for a competitor:', pricedCompetitor);
      problems.push({ kind: 'privacy', fix: `The reply gives prices or amounts for ${pricedCompetitor}, whose trading the user cannot see. Remove them and say that is not visible to the user.` });
    }
    if (speaksAsUser(result.reply)) {
      console.warn('Trader AI spoke as the user.');
      problems.push({ kind: 'voice', fix: 'The reply speaks as the user ("I/my", "mujhe/maine/mera", "مجھے/میں نے/میرا"). You are the assistant: rewrite it addressing the user as "you" ("aap", "آپ").' });
    }
    return problems;
  };

  const startedAt = Date.now();
  let { result, raw, usage } = await callModel(messages);
  console.info('Trader AI usage:', JSON.stringify(usage));
  result = normalizeResult(result, context.knownIds);

  let problems = problemsIn(result);
  if (problems.length && Date.now() - startedAt < RETRY_BUDGET_MS) {
    ({ result, raw, usage } = await callModel([
      ...messages,
      { role: 'assistant', content: raw },
      { role: 'user', content: `${problems.map((p) => p.fix).join(' ')} Keep every other fact the same. Return the same JSON object.` },
    ]));
    console.info('Trader AI usage (retry):', JSON.stringify(usage));
    result = normalizeResult(result, context.knownIds);
    problems = problemsIn(result);
  }

  // An amount the server did not calculate, a reply speaking as the user or
  // figures for a competitor are never shown: the rule-based assistant answers instead.
  const blocking = problems.find((p) => p.kind === 'amount' || p.kind === 'voice' || p.kind === 'privacy');
  if (blocking) throw new Error(`Trader AI reply still not acceptable: ${blocking.fix}`);

  // A sentence that still names the internal data source is left out.
  const withoutInternal = (text: string) =>
    text
      .split(/\n/)
      .map((line) => line.split(/(?<=[.!?۔؟])\s+/).filter((sentence) => internalNamesIn(sentence).length === 0).join(' '))
      .filter((line) => line.trim())
      .join('\n');
  result = {
    ...result,
    reply: withoutInternal(result.reply) || result.reply,
    generalGuidance: result.generalGuidance ? withoutInternal(result.generalGuidance) || null : null,
  };

  // Same as the farmer chat: better no guidance line than a bad one.
  if (
    result.generalGuidance !== null &&
    (!inExpectedLanguage(result.generalGuidance, script, romanUrdu) || speaksAsUser(result.generalGuidance))
  ) {
    console.warn('Trader AI guidance failed the language or voice check; dropped.');
    result = { ...result, generalGuidance: null };
  }

  return {
    result: {
      ...result,
      reply: fixIdentifiers(result.reply, context.knownIds),
      generalGuidance: result.generalGuidance ? fixIdentifiers(result.generalGuidance, context.knownIds) : null,
    },
    script,
  };
}

function traderRole(role: UserRole): TraderRole | null {
  return role === UserRole.ARHTI || role === UserRole.VENDOR || role === UserRole.SHOPKEEPER ? role : null;
}

/** AgriConnect AI for arhtis, vendors and shopkeepers. Called from askAi in natural-ai.ts. */
export async function askTraderAi(formData: FormData) {
  const user = await requireCapability('shared.ai');
  const role = traderRole(user.role);
  if (!role) return legacyAskAi(formData);

  const parsed = askAiSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((error) => error.message).join(', ') };
  }
  const { sessionId, message } = parsed.data;

  const session = await createOrResumeSession(sessionId, user.id, user.role);
  const oldContext = asRecord(session.context);
  const history = getHistory(oldContext);

  try {
    const context = await CONTEXT_FOR[role](user.id, message);
    const { result, script } = await understandTrader(role, message, history, context);
    const language = replyLanguage(result, script, message, history);
    const replyText = composeReply(result, language);

    const nextHistory = [
      ...history,
      { role: 'user' as const, text: message },
      { role: 'ai' as const, text: replyText },
    ].slice(-12);

    await prisma.agentSession.update({
      where: { id: session.id },
      data: {
        context: { ...oldContext, role: user.role, history: nextHistory } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Only the user's own pages; anything else the model names is ignored.
    const view = VIEW_LINKS[role][result.suggestedView] ?? null;
    revalidatePath('/ai-assistant');

    return {
      success: true as const,
      sessionId: session.id,
      tool: 'help',
      reply: replyText,
      replyUrdu: script === 'urdu' ? replyText : undefined,
      suggestedActions: view ? [view] : undefined,
      // Same reply shape as the other assistants; traders never get a pending action.
      pendingActionId: undefined as string | undefined,
      pendingActionType: undefined as string | undefined,
      pendingActionSummary: undefined as string | undefined,
    };
  } catch (error) {
    console.error('Trader AgriConnect AI failed:', error);

    // The rule-based assistant still answers if the model, the key or the
    // free quota fails, continuing the same session.
    const fallbackFormData = new FormData();
    fallbackFormData.set('sessionId', session.id);
    fallbackFormData.set('message', message);
    return legacyAskAi(fallbackFormData);
  }
}
