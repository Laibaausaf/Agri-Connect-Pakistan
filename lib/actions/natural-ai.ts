'use server';

import { revalidatePath } from 'next/cache';
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
  askAi as legacyAskAi,
  confirmAgentAction as legacyConfirmAgentAction,
  cancelAgentAction as legacyCancelAgentAction,
} from '@/lib/actions/ai';

type AssistantLanguage = 'english' | 'urdu' | 'roman_urdu';

type CropDraft = {
  cropName: string | null;
  quantityKg: number | null;
  variety: string | null;
  grade: string | null;
  originVillage: string | null;
  originCity: string | null;
  originProvince: string | null;
  harvestDate: string | null;
  readyDate: string | null;
  packaging: string | null;
  askingPricePerKg: number | null;
  notes: string | null;
};

type NaturalAiResult = {
  language: AssistantLanguage;
  reply: string;
  action: 'NONE' | 'CREATE_CROP_BATCH';
  readyToConfirm: boolean;
  cropDraft: CropDraft;
  suggestedView:
    | 'NONE'
    | 'CROPS'
    | 'OFFERS'
    | 'DEALS'
    | 'RECORDS'
    | 'MARKET';
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
  MARKET: {
    label: 'Market',
    href: '/market',
  },
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
            phone: true,
            arhtiProfile: {
              select: {
                businessName: true,
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
            phone: true,
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
      take: 12,
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
      quantityKg: batch.quantityKg,
      availableKg: batch.availableKg,
      grade: batch.grade,
      originCity: batch.originCity,
      originProvince: batch.originProvince,
      harvestDate: batch.harvestDate,
      readyDate: batch.readyDate,
      askingPricePerKg: batch.askingPricePerKg,
      status: batch.status,
    })),

    directArhtiOffers: offers.map((offer) => ({
      id: offer.id,
      arhti:
        offer.arhti.arhtiProfile?.businessName ??
        offer.arhti.name,

      arhtiContact: offer.arhti.phone,

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

      arhtiPhone: deal.arhti.phone,

      quantityKg: deal.agreedQuantityKg,

      pricePerKg: deal.agreedPricePerKg,

      grossAmount: deal.grossAmount,

      destinationMandi: deal.destinationMandi.name,

      status: deal.status,

      driver: deal.pickup?.driverName ?? null,

      driverPhone: deal.pickup?.driverPhone ?? null,

      vehiclePlate: deal.pickup?.vehiclePlate ?? null,

      scheduledPickup: deal.pickup?.scheduledAt ?? null,
    })),

    payments: settlements.map((settlement) => ({
      dealNumber: settlement.deal.dealNumber,

      crop: settlement.deal.crop.name,

      arhti: settlement.deal.arhti.name,

      grossAmount: settlement.grossAmount,

      deductions: settlement.deductionsTotal,

      netPayable: settlement.netPayable,

      status: settlement.status,
    })),

    publicMandiPrices: marketPrices.map((price) => ({
      crop: price.crop.name,
      cropUrdu: price.crop.nameUrdu,

      mandi: price.mandi.name,

      city: price.mandi.city,

      ratePerKg: price.ratePerKg,

      trend: price.trend,

      changePercent: price.changePercent,

      recordedAt: price.recordedAt,
    })),

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
        'MARKET',
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

function extractResponseText(data: unknown): string | null {
  const root = asRecord(data);

  if (typeof root.output_text === 'string') {
    return root.output_text;
  }

  if (!Array.isArray(root.output)) {
    return null;
  }

  for (const outputItem of root.output) {
    const item = asRecord(outputItem);

    if (!Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      const content = asRecord(contentItem);

      if (
        content.type === 'output_text' &&
        typeof content.text === 'string'
      ) {
        return content.text;
      }
    }
  }

  return null;
}

async function understandFarmer(
  message: string,
  history: StoredHistory[],
  draft: CropDraft,
  farmerContext: Awaited<
    ReturnType<typeof getFarmerContext>
  >
): Promise<NaturalAiResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

const baseUrl =
  process.env.OPENROUTER_BASE_URL ??
  'https://openrouter.ai/api/v1';

const model =
  process.env.OPENROUTER_MODEL ??
  'openrouter/auto';

if (!apiKey) {
  throw new Error(
    'OPENROUTER_API_KEY is not configured on the server.'
  );
}

  const today = new Date().toISOString();

  const instructions = `
You are AgriConnect AI, a conversational agricultural assistant for Pakistani farmers.

The current user is a FARMER.

Your job is to understand natural everyday language, not keywords.

The farmer may speak or type:

- English
- Urdu script
- Roman Urdu
- mixed Urdu + English
- informal Pakistani speech
- incomplete follow-up sentences
- multiple questions in one message

Examples of Roman Urdu:
"mujhe batao kis arhti ne request bheji hai"
"mere tamatar ka kya rate chal raha hai"
"meri payment ayi hai?"
"mera crop list kar do"
"mere 5000 kilo tamatar ready hain"
"Bilal wali offer kitni hai?"
"aur doosri wali?"
"kal pickup hai ya nahi?"

Understand meaning despite spelling differences such as:
mujhe / mjhe / mjy / muje
chahiye / chahye
arhti / aarti / arhati
tamatar / tomato / tamater
paisa / pese / payment
fasal / crop
bhao / rate / qeemat

IMPORTANT BUSINESS RULES:

1. Never invent database information.
2. Only use information provided in FARMER_CONTEXT.
3. The farmer can only see their own crops, offers, deals and payments.
4. Arhti demand requests are public sourcing requests.
5. "Which arhti sent me a request?" may mean:
   - a direct FarmerArhtiOffer sent specifically to the farmer, OR
   - open ArhtiDemandRequests matching crops the farmer currently has.
   Explain the difference naturally when useful.
6. Never expose another farmer's private data.
7. Farmer cannot bid in mandi auctions.
8. Farmer does not choose the mandi when creating the crop batch.
9. Never claim an action happened unless the server confirms it.
10. For any database write, prepare the action and require confirmation.

CONVERSATION:

Use conversation history.

Resolve follow-ups naturally.

Example:
User: "kis arhti ne offer bheji?"
Assistant lists offers.
User: "sab se achi konsi hai?"
You understand they mean the offers from the previous turn.

MULTIPLE QUESTIONS:

If the farmer asks several things at once, answer ALL of them.

Example:
"mera tomato rate kya hai aur koi offer bhi ayi hai aur pickup kab hai?"

Answer:
- relevant mandi rate
- relevant pending offer
- relevant pickup/deal information

Do not select only one intent.

LANGUAGE:

Respond in the farmer's style.

If they speak English -> English.
If Urdu script -> Urdu.
If Roman Urdu -> natural Roman Urdu.
If mixed Roman Urdu + English -> respond similarly.

Roman Urdu should sound conversational, not like formal machine translation.

CROP CREATION:

When the farmer asks you to add/list/register their crop, set:

action = CREATE_CROP_BATCH

Extract information conversationally.

Required for actual creation:
- cropName
- quantityKg
- originCity
- originProvince
- harvestDate

Grade can default to "Standard" if farmer does not know it.

If user says crop is "ready today":
harvestDate may be today and readyDate today.

If user says "ready tomorrow":
harvestDate may be today and readyDate tomorrow unless they clearly specify otherwise.

You may infer a province from a well-known Pakistani city/district.
Examples:
Swabi -> Khyber Pakhtunkhwa
Islamabad -> Islamabad Capital Territory
Rawalpindi -> Punjab
Lahore -> Punjab
Multan -> Punjab
Peshawar -> Khyber Pakhtunkhwa
Karachi -> Sindh
Quetta -> Balochistan

Do not require:
- mandi
- auction price
- arhti

askingPricePerKg is optional.

If required information is missing:
readyToConfirm = false
and ask only a simple natural question for the missing information.

Example:
Farmer: "mera tomato crop list kar do"
Assistant: "Bilkul. Kitne kilo tomato hain aur kis shehar/gaon mein hain?"

If enough information is available:
readyToConfirm = true

Before confirmation, clearly summarize what will be created.

Never tell the farmer to fill the technical form when the assistant already has enough information.

SUPPORTED CROPS:

Only prepare a crop listing for a crop appearing in FARMER_CONTEXT.supportedCrops.

TODAY:
${today}
`;

  const input = JSON.stringify(
    {
      latestMessage: message,

      recentConversation: history,

      existingCropDraft: draft,

      FARMER_CONTEXT: farmerContext,
    },
    null,
    2
  );

  // Hard stop so a slow or hung OpenRouter request can never freeze the chat.
  // On abort the askAi catch block falls back to the rule-based assistant.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  const response = await fetch(
  `${baseUrl}/chat/completions`,
  {
    method: 'POST',
    signal: controller.signal,

    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AgriConnect Pakistan',
    },

    body: JSON.stringify({
      model,

      messages: [
        {
          role: 'system',
          content: instructions,
        },
        {
          role: 'user',
          content: input,
        },
      ],

      temperature: 0.2,

      response_format: {
        type: 'json_schema',

        json_schema: {
          name: 'agriconnect_farmer_assistant',
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    }),
  }
);

clearTimeout(timeoutId);

 if (!response.ok) {
  const body = await response.text();

  console.error(
    'OpenRouter API error:',
    response.status,
    body
  );

  throw new Error(
    `AI service returned ${response.status}`
  );
}

const data = await response.json();

const output =
  data?.choices?.[0]?.message?.content;

if (!output || typeof output !== 'string') {
  console.error(
    'Unexpected OpenRouter response:',
    data
  );

  throw new Error(
    'AI returned no usable response.'
  );
}

const parsed =
  JSON.parse(output) as NaturalAiResult;
  return {
    ...parsed,

    cropDraft: {
      ...EMPTY_DRAFT,
      ...parsed.cropDraft,
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

    if (
      aiResult.action === 'CREATE_CROP_BATCH' &&
      aiResult.readyToConfirm
    ) {
      const missing = missingCropFields(mergedDraft);

      if (missing.length === 0) {
        const crop = farmerContext.supportedCrops.find(
          (candidate) =>
            candidate.name.toLowerCase() ===
              mergedDraft.cropName?.toLowerCase() ||
            candidate.nameUrdu === mergedDraft.cropName
        );

        if (crop) {
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

              payload: {
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
              } as Prisma.InputJsonValue,
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
    };
  } catch (error) {
    console.error('Natural AgriConnect AI failed:', error);

    /*
     * Important hackathon fallback:
     *
     * The existing rule-based assistant still works if the LLM service or
     * API key fails.
     */
    return legacyAskAi(formData);
  }
}

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

  await prisma.$transaction(async (tx) => {
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

    await tx.agentAction.update({
      where: {
        id: action.id,
      },

      data: {
        status: AgentActionStatus.CONFIRMED,

        confirmedAt: new Date(),
      },
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

export async function cancelAgentAction(
  formData: FormData
) {
  return legacyCancelAgentAction(formData);
}