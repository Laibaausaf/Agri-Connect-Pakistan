'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability, type SessionUser } from '@/lib/authz';
import { can, type Capability, ROLE_LABEL } from '@/lib/permissions';
import { askAiSchema, confirmAgentActionSchema } from '@/lib/validations/ai';
import {
  AMIS_DEFAULT_CITIES,
  AMIS_TOMATO_PRICES,
  AMIS_TOMATO_REPORT_DATE,
  AMIS_TOMATO_SOURCE,
} from '@/lib/data/amis-tomato-prices';
import {
  AuctionStatus,
  ConsumerOrderStatus,
  CropBatchStatus,
  DealStatus,
  OfferListingStatus,
  OfferStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

export type ToolName =
  | 'prices'
  | 'myCrops'
  | 'myOffers'
  | 'myDeals'
  | 'myPayments'
  | 'sourcing'
  | 'receiving'
  | 'arhtiInventory'
  | 'arhtiAuctions'
  | 'arhtiSales'
  | 'vendorAuctions'
  | 'vendorStock'
  | 'vendorWholesale'
  | 'shopWholesale'
  | 'shopStock'
  | 'shopOrders'
  | 'adminChain'
  | 'help';

type ToolReply = {
  reply: string;
  replyUrdu?: string;
  suggestedActions?: { label: string; href: string }[];
  pendingAction?: {
    actionType: string;
    humanSummary: string;
    payload: Prisma.InputJsonValue;
  };
};

type AiTool = {
  name: ToolName;
  /** Null means every role that can open the assistant may use it. */
  capability: Capability | null;
  keywords: string[];
  /** Shown when a role asks for something this tool covers but cannot access. */
  describe: string;
  run: (user: SessionUser, text: string) => Promise<ToolReply>;
};

function money(n: number) {
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`;
}

function kg(n: number) {
  return `${Math.round(n).toLocaleString('en-PK')} kg`;
}

function human(value: string) {
  return value.replace(/_/g, ' ').toLowerCase();
}

function detectLanguage(text: string): 'en' | 'ur' | 'mixed' {
  const hasUrdu = /[\u0600-\u06FF]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  if (hasUrdu && hasEnglish) return 'mixed';
  if (hasUrdu) return 'ur';
  return 'en';
}

function cropFrom(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('tomato') || lower.includes('ٹماٹر')) return 'Tomato';
  if (lower.includes('potato') || lower.includes('آلو')) return 'Potato';
  if (lower.includes('onion') || lower.includes('پیاز')) return 'Onion';
  return null;
}

/* ------------------------------------------------------------------ *
 * Shared tool: published mandi rates. Safe for every role because it
 * only reads the public MarketPrice table, never a counterparty's cost.
 * ------------------------------------------------------------------ */

async function pricesTool(_user: SessionUser, text: string): Promise<ToolReply> {
  const crop = cropFrom(text);
  const lowerText = text.toLowerCase();

  // The supplied AMIS PDF contains a dated tomato report. Prefer that source
  // over demo MarketPrice rows whenever the user asks about tomato.
  if (crop === 'Tomato') {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cityAliases: Record<string, string[]> = {
      'TTSingh': ['ttsingh', 't t singh', 't.t. singh', 'tobateksingh'],
      'RahimYarKhan': ['rahim yar khan', 'rahimyarkhan'],
      'BahawalPur': ['bahawalpur', 'bahawal pur'],
      'DGKHAN': ['dg khan', 'dgkhan', 'dera ghazi khan'],
      'MandiBahaudin': ['mandi bahaudin', 'mandi bahauddin'],
      'PirMahal': ['pir mahal', 'pirmahal'],
      'Jauharabad': ['jauharabad', 'joharabad'],
    };
    const matchedCity = AMIS_TOMATO_PRICES.find((row) => {
      const names = [row.city, ...(cityAliases[row.city] ?? [])];
      return names.some((name) => {
        const normalizedName = normalize(name);
        return normalizedName.length >= 4 && normalize(lowerText).includes(normalizedName);
      });
    });

    const rows = matchedCity
      ? [matchedCity]
      : AMIS_DEFAULT_CITIES
          .map((city) => AMIS_TOMATO_PRICES.find((row) => row.city === city))
          .filter((row): row is (typeof AMIS_TOMATO_PRICES)[number] => Boolean(row));

    const quantityMatch = text.match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:kg|kgs|kilograms|کلو)/i);
    const quantityKg = quantityMatch ? Number(quantityMatch[1].replace(/,/g, '')) : null;

    const lines = rows.map((row) => {
      if (row.fqp === null) {
        return `${row.city}: no Min/Max/FQP price was reported in this AMIS table.`;
      }
      const fqpPerKg = row.fqp / 100;
      const minText = row.min === null ? 'not reported' : `${money(row.min / 100)}/kg`;
      const maxText = row.max === null ? 'not reported' : `${money(row.max / 100)}/kg`;
      const line = `${row.city}: FQP ${money(row.fqp)} per 100 kg (about ${money(fqpPerKg)}/kg); reported range ${minText}–${maxText}.`;
      if (quantityKg && quantityKg > 0 && matchedCity?.city === row.city) {
        return `${line} At ${kg(quantityKg)}, the FQP-based wholesale reference is about ${money(quantityKg * fqpPerKg)} before transport, commission, grading, and other costs.`;
      }
      return line;
    });

    const locationNote = /islamabad/i.test(text)
      ? ' Islamabad is not listed in this tomato table; Rawalpindi is a separate listed market and should not be treated as an Islamabad quote.'
      : '';
    const unitWarning =
      'Unit caution: the supplied PDF does not print the price unit. The per-kg figures above assume AMIS prices are reported per 100 kg; verify this against the original AMIS page before relying on the conversion.';
    const farmerNote =
      'These are mandi/wholesale reference prices, not guaranteed farm-gate offers or a promise of what a farmer will receive. Compare them with actual arhti offers.';

    return {
      reply: `AMIS tomato price reference — ${AMIS_TOMATO_REPORT_DATE}\\nSource: ${AMIS_TOMATO_SOURCE}\\n\\n${lines.join('\\n')}\\n\\n${unitWarning}${locationNote}\\n${farmerNote}`,
      replyUrdu: `AMIS ٹماٹر قیمت حوالہ — ${AMIS_TOMATO_REPORT_DATE}\\n${lines.join('\\n')}\\n\\nیہ منڈی کے حوالہ جاتی نرخ ہیں، کسان کو ملنے والی یقینی قیمت نہیں۔ فراہم کردہ PDF میں قیمت کی اکائی واضح نہیں، اس لیے فی کلو تبدیلی کی تصدیق ضروری ہے۔`,
      suggestedActions: [{ label: 'Add crop batch', href: '/crops/new' }],
    };
  }

  const prices = await prisma.marketPrice.findMany({
    where: crop ? { crop: { name: crop } } : undefined,
    include: { crop: true, mandi: true },
    orderBy: { recordedAt: 'desc' },
    take: crop ? 5 : 6,
  });

  if (!prices.length) {
    return {
      reply: 'No matching price records are available in the app database. I cannot provide a verified current quote from the attached documents for this crop yet.',
      replyUrdu: 'اس فصل کے لیے ایپ میں قیمت کا ریکارڈ موجود نہیں۔ منسلک دستاویزات سے موجودہ تصدیق شدہ نرخ فراہم نہیں کیا جا سکتا۔',
    };
  }

  const lines = prices.map((p) => {
    const date = p.recordedAt.toISOString().slice(0, 10);
    return `${p.crop.name} · ${p.mandi.name}: ${money(p.ratePerKg)}/kg (app database record dated ${date}; source/current status not independently verified)`;
  });
  const urduLines = prices.map(
    (p) => `${p.crop.nameUrdu ?? p.crop.name} · ${p.mandi.name}: ${money(p.ratePerKg)}/کلو`
  );

  return {
    reply: `App database price records (not verified as live official quotations):\\n\\n${lines.join('\\n')}\\n\\nUse these only as application reference data unless their source and date are independently confirmed.`,
    replyUrdu: `ایپ کے ڈیٹابیس میں قیمتوں کا ریکارڈ (موجودہ سرکاری نرخ کے طور پر تصدیق شدہ نہیں):\\n\\n${urduLines.join('\\n')}`,
  };
}

/* ------------------------------------------------------------------ *
 * Farmer tools
 * ------------------------------------------------------------------ */

async function myCropsTool(user: SessionUser, text: string): Promise<ToolReply> {
  const wantsCreate = /create|new|add|list|banao|bana|لگا|بنا|شامل/i.test(text);

  if (wantsCreate) {
    const crop = cropFrom(text);
    return {
      reply: `I can start a new crop batch for you${
        crop ? ` (${crop})` : ''
      }. You do not need to pick a mandi — your arhti decides the destination when they make an offer. Confirm and I will open the form.`,
      replyUrdu: 'میں آپ کی نئی فصل کا اندراج شروع کر سکتا ہوں۔ منڈی چننے کی ضرورت نہیں۔',
      pendingAction: {
        actionType: 'OPEN_CROP_BATCH_FORM',
        humanSummary: crop ? `Open the new ${crop} batch form` : 'Open the new crop batch form',
        payload: { href: '/crops/new', crop },
      },
    };
  }

  const batches = await prisma.farmerCropBatch.findMany({
    where: { farmerId: user.id, status: { notIn: [CropBatchStatus.ARCHIVED, CropBatchStatus.SOLD_OUT] } },
    include: { crop: true, _count: { select: { offers: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (!batches.length) {
    return {
      reply: 'You have no active crop batches. Say "add a tomato batch" and I will open the form.',
      replyUrdu: 'آپ کی کوئی فعال فصل درج نہیں۔',
      suggestedActions: [{ label: 'Add Crop Batch', href: '/crops/new' }],
    };
  }

  const lines = batches.map(
    (b) =>
      `${b.batchNumber} · ${b.crop.name} ${b.grade}: ${kg(b.availableKg)} unsold of ${kg(
        b.quantityKg
      )} — ${human(b.status)}${b._count.offers ? `, ${b._count.offers} offer(s)` : ''}`
  );

  return {
    reply: `Your crop batches:\n\n${lines.join('\n')}`,
    replyUrdu: `آپ کی فصلیں:\n\n${batches.map((b) => `${b.batchNumber} · ${b.crop.nameUrdu ?? b.crop.name}`).join('\n')}`,
    suggestedActions: [{ label: 'My Crops', href: '/crops' }],
  };
}

async function myOffersTool(user: SessionUser): Promise<ToolReply> {
  const offers = await prisma.farmerArhtiOffer.findMany({
    where: { farmerId: user.id, status: OfferStatus.PENDING },
    include: {
      batch: { include: { crop: true } },
      arhti: { select: { name: true } },
      destinationMandi: { select: { name: true, city: true } },
    },
    orderBy: { pricePerKg: 'desc' },
    take: 5,
  });

  if (!offers.length) {
    return {
      reply: 'No arhti is waiting on your answer right now. Offers arrive once your batch is marked ready for sale.',
      replyUrdu: 'ابھی کوئی آڑھتی آپ کے جواب کا منتظر نہیں۔',
      suggestedActions: [{ label: 'Arhti Requests', href: '/arhti-requests' }],
    };
  }

  const lines = offers.map(
    (o) =>
      `${o.arhti.name} — ${money(o.pricePerKg)}/kg for ${kg(o.quantityKg)} of ${
        o.batch.crop.name
      }, to ${o.destinationMandi.name}, transport ${human(o.transportResponsibility)}`
  );

  const best = offers[0];
  return {
    reply: `${offers.length} offer(s) waiting for you:\n\n${lines.join(
      '\n'
    )}\n\nBest rate is ${money(best.pricePerKg)}/kg — that works out to ${money(
      best.pricePerKg * best.quantityKg
    )} before transport.`,
    replyUrdu: `${offers.length} آفر آپ کے جواب کی منتظر ہیں۔ بہترین نرخ ${money(best.pricePerKg)}/کلو۔`,
    suggestedActions: [{ label: 'Review Offers', href: '/arhti-requests' }],
  };
}

async function myDealsTool(user: SessionUser): Promise<ToolReply> {
  const deals = await prisma.farmerArhtiDeal.findMany({
    where: {
      farmerId: user.id,
      status: { notIn: [DealStatus.CANCELLED, DealStatus.COMPLETED] },
    },
    include: {
      batch: { include: { crop: true } },
      arhti: { select: { name: true, phone: true } },
      pickup: { select: { driverName: true, driverPhone: true, scheduledAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (!deals.length) {
    return {
      reply: 'No deal is in progress. Accept an arhti offer to start one.',
      replyUrdu: 'کوئی سودا جاری نہیں۔',
      suggestedActions: [{ label: 'My Deals', href: '/deals' }],
    };
  }

  const nextStep: Record<string, string> = {
    [DealStatus.AGREED]: 'waiting for the arhti to send a driver',
    [DealStatus.PICKUP_SCHEDULED]: 'have the crop bagged and ready',
    [DealStatus.PICKED_UP]: 'crop has left your farm',
    [DealStatus.IN_TRANSIT]: 'on the way to the mandi',
    [DealStatus.RECEIVED_BY_ARHTI]: 'landed at the mandi, waiting for the kanta',
    [DealStatus.WEIGHT_VERIFIED]: 'weighed, settlement being prepared',
    [DealStatus.PAYMENT_PENDING]: 'settlement raised, payment on its way',
    [DealStatus.PAID]: 'paid — check your records for the receipt',
    [DealStatus.DISPUTED]: 'disputed — talk to your arhti',
  };

  const lines = deals.map((d) => {
    const driver = d.pickup ? ` Driver: ${d.pickup.driverName} (${d.pickup.driverPhone}).` : '';
    return `${d.dealNumber} · ${d.batch.crop.name} ${kg(d.agreedQuantityKg)} at ${money(
      d.agreedPricePerKg
    )}/kg with ${d.arhti.name} — ${human(d.status)}: ${nextStep[d.status] ?? 'in progress'}.${driver}`;
  });

  return {
    reply: `Deals in progress:\n\n${lines.join('\n')}`,
    replyUrdu: `جاری سودے:\n\n${deals.map((d) => `${d.dealNumber} · ${human(d.status)}`).join('\n')}`,
    suggestedActions: [{ label: 'My Deals', href: '/deals' }],
  };
}

async function myPaymentsTool(user: SessionUser): Promise<ToolReply> {
  const [paid, pending, recent] = await Promise.all([
    prisma.settlement.aggregate({
      where: { farmerId: user.id, status: 'paid' },
      _sum: { netPayable: true },
    }),
    prisma.settlement.aggregate({
      where: { farmerId: user.id, status: 'pending' },
      _sum: { netPayable: true },
      _count: true,
    }),
    prisma.settlement.findMany({
      where: { farmerId: user.id },
      include: { deal: { include: { batch: { include: { crop: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);

  const lines = recent.map(
    (s) =>
      `${s.deal.dealNumber} · ${s.deal.batch.crop.name}: ${money(s.netPayable)} — ${s.status}`
  );

  return {
    reply: `Payments received: ${money(paid._sum.netPayable ?? 0)}.\nAwaiting payment: ${money(
      pending._sum.netPayable ?? 0
    )} across ${pending._count} settlement(s).${lines.length ? `\n\nRecent:\n${lines.join('\n')}` : ''}`,
    replyUrdu: `موصول رقم: ${money(paid._sum.netPayable ?? 0)}۔ زیر التوا: ${money(
      pending._sum.netPayable ?? 0
    )}۔`,
    suggestedActions: [{ label: 'Payments & Records', href: '/records' }],
  };
}

/* ------------------------------------------------------------------ *
 * Arhti tools
 * ------------------------------------------------------------------ */

async function sourcingTool(_user: SessionUser, text: string): Promise<ToolReply> {
  const crop = cropFrom(text);
  const batches = await prisma.farmerCropBatch.findMany({
    where: {
      status: CropBatchStatus.READY_FOR_SALE,
      availableKg: { gt: 0 },
      ...(crop ? { crop: { name: crop } } : {}),
    },
    include: { crop: true, farmer: { select: { name: true } } },
    orderBy: { harvestDate: 'desc' },
    take: 5,
  });

  if (!batches.length) {
    return {
      reply: `No ${crop ?? 'crop'} batches are open for offers right now.`,
      replyUrdu: 'ابھی کوئی فصل دستیاب نہیں۔',
      suggestedActions: [{ label: 'Farmer Market', href: '/sourcing' }],
    };
  }

  const lines = batches.map(
    (b) =>
      `${b.crop.name} ${b.grade} · ${kg(b.availableKg)} from ${b.originCity} (${b.farmer.name})${
        b.askingPricePerKg ? `, asking ${money(b.askingPricePerKg)}/kg` : ', no asking price'
      }`
  );

  return {
    reply: `Fresh batches you can bid on:\n\n${lines.join('\n')}`,
    replyUrdu: `دستیاب فصلیں:\n\n${batches.map((b) => `${b.crop.nameUrdu ?? b.crop.name} · ${b.originCity}`).join('\n')}`,
    suggestedActions: [{ label: 'Farmer Market', href: '/sourcing' }],
  };
}

async function receivingTool(user: SessionUser): Promise<ToolReply> {
  const deals = await prisma.farmerArhtiDeal.findMany({
    where: {
      arhtiId: user.id,
      status: { in: [DealStatus.PICKUP_SCHEDULED, DealStatus.PICKED_UP, DealStatus.IN_TRANSIT] },
    },
    include: {
      batch: { include: { crop: true } },
      farmer: { select: { name: true } },
      pickup: { select: { driverName: true, vehiclePlate: true, expectedArrivalAt: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });

  if (!deals.length) {
    return {
      reply: 'Nothing is on the road to your mandi. Make an offer on the Farmer Market to start a consignment.',
      replyUrdu: 'ابھی کوئی گاڑی راستے میں نہیں۔',
      suggestedActions: [{ label: 'Farmer Market', href: '/sourcing' }],
    };
  }

  const lines = deals.map(
    (d) =>
      `${d.dealNumber} · ${d.batch.crop.name} ${kg(d.agreedQuantityKg)} from ${d.farmer.name} (${
        d.sourceCity
      }) — ${human(d.status)}${d.pickup ? `, ${d.pickup.driverName} / ${d.pickup.vehiclePlate ?? 'no plate'}` : ''}`
  );

  return {
    reply: `${deals.length} consignment(s) inbound:\n\n${lines.join(
      '\n'
    )}\n\nWeigh each one on the kanta when it lands — the received weight, not the agreed weight, becomes your inventory.`,
    replyUrdu: `${deals.length} گاڑیاں راستے میں ہیں۔`,
    suggestedActions: [{ label: 'Receive & Verify', href: '/receiving' }],
  };
}

async function arhtiInventoryTool(user: SessionUser): Promise<ToolReply> {
  const lots = await prisma.arhtiInventoryLot.findMany({
    where: { arhtiId: user.id, availableQuantityKg: { gt: 0 } },
    include: { crop: true, _count: { select: { auctions: true } } },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  if (!lots.length) {
    return {
      reply: 'Your mandi store is empty. Receive a consignment to build inventory.',
      replyUrdu: 'گودام خالی ہے۔',
      suggestedActions: [{ label: 'Receive & Verify', href: '/receiving' }],
    };
  }

  const idle = lots.filter((l) => l._count.auctions === 0);
  const lines = lots.map(
    (l) =>
      `${l.lotNumber} · ${l.crop.name} ${l.grade}: ${kg(l.availableQuantityKg)} available, cost ${money(
        l.purchasePricePerKg
      )}/kg from ${l.sourceCity}${l._count.auctions ? '' : ' — not auctioned yet'}`
  );

  return {
    reply: `Mandi inventory:\n\n${lines.join('\n')}${
      idle.length ? `\n\n${idle.length} lot(s) have never been auctioned. Idle stock loses grade every day.` : ''
    }`,
    replyUrdu: `گودام کا اسٹاک:\n\n${lots.map((l) => `${l.lotNumber} · ${kg(l.availableQuantityKg)}`).join('\n')}`,
    suggestedActions: [{ label: 'Mandi Inventory', href: '/inventory' }],
  };
}

async function arhtiAuctionsTool(user: SessionUser): Promise<ToolReply> {
  const auctions = await prisma.auction.findMany({
    where: { arhtiId: user.id, status: AuctionStatus.ACTIVE },
    include: { inventoryLot: { include: { crop: true } } },
    orderBy: { endTime: 'asc' },
    take: 5,
  });

  if (!auctions.length) {
    return {
      reply: 'You have no live auctions. Open one from a lot in your mandi inventory.',
      replyUrdu: 'کوئی نیلامی جاری نہیں۔',
      suggestedActions: [{ label: 'Auction House', href: '/auction-house' }],
    };
  }

  const lines = auctions.map((a) => {
    const top = a.currentHighestBid ?? a.reservePrice;
    const cost = a.inventoryLot.purchasePricePerKg;
    const spread = cost > 0 ? Math.round(((top - cost) / cost) * 100) : 0;
    const mins = Math.max(0, Math.round((a.endTime.getTime() - Date.now()) / 60000));
    return `${a.auctionNumber} · ${a.inventoryLot.crop.name} ${kg(a.quantityKg)}: top ${money(
      top
    )}/kg vs cost ${money(cost)}/kg (${spread >= 0 ? '+' : ''}${spread}%), ${a.bidCount} bid(s), ${mins} min left`;
  });

  return {
    reply: `Live auctions:\n\n${lines.join('\n')}`,
    replyUrdu: `جاری نیلامیاں:\n\n${auctions.map((a) => `${a.auctionNumber} · ${a.bidCount} بولیاں`).join('\n')}`,
    suggestedActions: [{ label: 'Auction House', href: '/auction-house' }],
  };
}

async function arhtiSalesTool(user: SessionUser): Promise<ToolReply> {
  const [totals, recent] = await Promise.all([
    prisma.arhtiVendorSale.aggregate({
      where: { arhtiId: user.id },
      _sum: { grossAmount: true, commission: true, quantityKg: true },
      _count: true,
    }),
    prisma.arhtiVendorSale.findMany({
      where: { arhtiId: user.id },
      include: {
        auction: { include: { inventoryLot: { include: { crop: true } } } },
        vendor: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);

  const lines = recent.map(
    (s) =>
      `${s.saleNumber} · ${s.auction.inventoryLot.crop.name} ${kg(s.quantityKg)} to ${
        s.vendor.name
      } at ${money(s.ratePerKg)}/kg, commission ${money(s.commission)}`
  );

  return {
    reply: `${totals._count} mandi sale(s), ${kg(totals._sum.quantityKg ?? 0)} moved for ${money(
      totals._sum.grossAmount ?? 0
    )}. Your commission: ${money(totals._sum.commission ?? 0)}.${
      lines.length ? `\n\nRecent:\n${lines.join('\n')}` : ''
    }`,
    replyUrdu: `کل فروخت ${money(totals._sum.grossAmount ?? 0)}، کمیشن ${money(totals._sum.commission ?? 0)}۔`,
    suggestedActions: [{ label: 'Sales & Commission', href: '/sales' }],
  };
}

/* ------------------------------------------------------------------ *
 * Vendor tools
 * ------------------------------------------------------------------ */

async function vendorAuctionsTool(user: SessionUser, text: string): Promise<ToolReply> {
  const crop = cropFrom(text);
  const [auctions, myBids] = await Promise.all([
    prisma.auction.findMany({
      where: {
        status: AuctionStatus.ACTIVE,
        ...(crop ? { inventoryLot: { crop: { name: crop } } } : {}),
      },
      include: { inventoryLot: { include: { crop: true } }, mandi: { select: { name: true } } },
      orderBy: { endTime: 'asc' },
      take: 5,
    }),
    prisma.bid.findMany({
      where: { bidderId: user.id, auction: { status: AuctionStatus.ACTIVE } },
      select: { auctionId: true, amountPerKg: true },
    }),
  ]);

  if (!auctions.length) {
    return {
      reply: `No live ${crop ?? 'mandi'} auctions right now. Arhtis open new lots through the day.`,
      replyUrdu: 'ابھی کوئی نیلامی جاری نہیں۔',
      suggestedActions: [{ label: 'Mandi Auctions', href: '/auctions' }],
    };
  }

  const mine = new Map(myBids.map((b) => [b.auctionId, b.amountPerKg]));
  const lines = auctions.map((a) => {
    const top = a.currentHighestBid ?? a.reservePrice;
    const my = mine.get(a.id);
    const state = my === undefined ? 'no bid from you' : my >= top ? 'you lead' : `you are outbid at ${money(my)}`;
    const mins = Math.max(0, Math.round((a.endTime.getTime() - Date.now()) / 60000));
    return `${a.auctionNumber} · ${a.inventoryLot.crop.name} ${a.grade} ${kg(a.quantityKg)} at ${
      a.mandi.name
    }: top ${money(top)}/kg, next bid ${money(top + a.minimumIncrement)}/kg, ${mins} min left — ${state}`;
  });

  return {
    reply: `Live mandi auctions:\n\n${lines.join('\n')}`,
    replyUrdu: `جاری نیلامیاں:\n\n${auctions
      .map((a) => `${a.auctionNumber} · ${a.inventoryLot.crop.nameUrdu ?? a.inventoryLot.crop.name}`)
      .join('\n')}`,
    suggestedActions: [{ label: 'Mandi Auctions', href: '/auctions' }],
  };
}

async function vendorStockTool(user: SessionUser): Promise<ToolReply> {
  const stocks = await prisma.vendorInventory.findMany({
    where: { vendorId: user.id, availableKg: { gt: 0 } },
    include: { crop: true, offers: { where: { status: OfferListingStatus.ACTIVE }, select: { id: true } } },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  if (!stocks.length) {
    return {
      reply: 'Your warehouse is empty. Win a mandi auction to bring stock in.',
      replyUrdu: 'گودام خالی ہے۔',
      suggestedActions: [{ label: 'Mandi Auctions', href: '/auctions' }],
    };
  }

  const unlisted = stocks.filter((s) => s.offers.length === 0);
  const lines = stocks.map(
    (s) =>
      `${s.stockNumber} · ${s.crop.name} ${s.grade}: ${kg(s.availableKg)} available, cost ${money(
        s.costPerKg
      )}/kg from ${s.sourceMandiCity}${s.offers.length ? '' : ' — not listed for wholesale'}`
  );

  return {
    reply: `Warehouse stock:\n\n${lines.join('\n')}${
      unlisted.length
        ? `\n\n${unlisted.length} lot(s) are not on your wholesale shop, so no shopkeeper can see them.`
        : ''
    }`,
    replyUrdu: `گودام:\n\n${stocks.map((s) => `${s.stockNumber} · ${kg(s.availableKg)}`).join('\n')}`,
    suggestedActions: [
      { label: 'My Warehouse', href: '/stock' },
      ...(unlisted.length ? [{ label: 'List Wholesale Offer', href: '/wholesale-shop/new' }] : []),
    ],
  };
}

async function vendorWholesaleTool(user: SessionUser): Promise<ToolReply> {
  const offers = await prisma.vendorOffer.findMany({
    where: { vendorId: user.id, status: OfferListingStatus.ACTIVE, remainingKg: { gt: 0 } },
    include: { crop: true, stock: { select: { costPerKg: true } } },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  if (!offers.length) {
    return {
      reply: 'Your wholesale shop has no live offers.',
      replyUrdu: 'تھوک دکان میں کوئی آفر نہیں۔',
      suggestedActions: [{ label: 'List Wholesale Offer', href: '/wholesale-shop/new' }],
    };
  }

  const lines = offers.map((o) => {
    const margin = o.stock.costPerKg > 0
      ? Math.round(((o.pricePerKg - o.stock.costPerKg) / o.stock.costPerKg) * 100)
      : 0;
    const sold = o.offeredQuantityKg - o.remainingKg;
    return `${o.offerNumber} · ${o.crop.name}: ${money(o.pricePerKg)}/kg (${margin >= 0 ? '+' : ''}${margin}% on cost), ${kg(
      o.remainingKg
    )} left of ${kg(o.offeredQuantityKg)}${sold > 0 ? `, ${kg(sold)} sold` : ''}`;
  });

  return {
    reply: `Live wholesale offers:\n\n${lines.join('\n')}`,
    replyUrdu: `تھوک آفرز:\n\n${offers.map((o) => `${o.offerNumber} · ${money(o.pricePerKg)}/کلو`).join('\n')}`,
    suggestedActions: [{ label: 'My Wholesale Shop', href: '/wholesale-shop' }],
  };
}

/* ------------------------------------------------------------------ *
 * Shopkeeper tools
 * ------------------------------------------------------------------ */

async function shopWholesaleTool(user: SessionUser, text: string): Promise<ToolReply> {
  const crop = cropFrom(text);
  const profile = await prisma.shopkeeperProfile.findUnique({
    where: { userId: user.id },
    select: { city: true },
  });

  const offers = await prisma.vendorOffer.findMany({
    where: {
      status: OfferListingStatus.ACTIVE,
      remainingKg: { gt: 0 },
      ...(crop ? { crop: { name: crop } } : {}),
    },
    include: { crop: true, vendor: { select: { name: true } } },
    orderBy: { pricePerKg: 'asc' },
    take: 8,
  });

  if (!offers.length) {
    return {
      reply: `No ${crop ?? 'wholesale'} offers are open right now.`,
      replyUrdu: 'ابھی کوئی تھوک آفر نہیں۔',
      suggestedActions: [{ label: 'Wholesale Market', href: '/wholesale' }],
    };
  }

  const city = profile?.city;
  const deliversHere = (value: unknown) =>
    !city || (Array.isArray(value) && value.some((c) => typeof c === 'string' && c === city));

  const relevant = offers.filter((o) => deliversHere(o.deliveryCities)).slice(0, 5);
  const shown = relevant.length ? relevant : offers.slice(0, 5);

  const lines = shown.map(
    (o) =>
      `${o.crop.name} ${o.grade} from ${o.vendor.name}: ${money(o.pricePerKg)}/kg, min ${kg(
        o.minOrderKg
      )}, ${kg(o.remainingKg)} available, delivery in ~${o.deliveryEtaHours}h`
  );

  return {
    reply: `${relevant.length ? `Cheapest offers delivering to ${city}` : 'Cheapest wholesale offers'}:\n\n${lines.join(
      '\n'
    )}`,
    replyUrdu: `سستی تھوک آفرز:\n\n${shown.map((o) => `${o.crop.nameUrdu ?? o.crop.name} · ${money(o.pricePerKg)}/کلو`).join('\n')}`,
    suggestedActions: [{ label: 'Wholesale Market', href: '/wholesale' }],
  };
}

async function shopStockTool(user: SessionUser): Promise<ToolReply> {
  const stocks = await prisma.shopkeeperInventory.findMany({
    where: { shopkeeperId: user.id, availableKg: { gt: 0 } },
    include: {
      crop: true,
      listings: {
        where: { status: OfferListingStatus.ACTIVE },
        select: { pricePerKg: true, remainingKg: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  if (!stocks.length) {
    return {
      reply: 'Your shop stock is empty. Buy from the wholesale market to restock.',
      replyUrdu: 'دکان کا اسٹاک خالی ہے۔',
      suggestedActions: [{ label: 'Wholesale Market', href: '/wholesale' }],
    };
  }

  const unlisted = stocks.filter((s) => s.listings.length === 0);
  const lines = stocks.map((s) => {
    const shelf = s.listings[0];
    const margin = shelf && s.costPerKg > 0
      ? ` shelf ${money(shelf.pricePerKg)}/kg (+${Math.round(((shelf.pricePerKg - s.costPerKg) / s.costPerKg) * 100)}%)`
      : ' not on the shelf yet';
    return `${s.stockNumber} · ${s.crop.name}: ${kg(s.availableKg)} at cost ${money(s.costPerKg)}/kg —${margin}`;
  });

  return {
    reply: `Shop stock:\n\n${lines.join('\n')}${
      unlisted.length ? `\n\n${unlisted.length} item(s) are not listed, so customers cannot order them.` : ''
    }`,
    replyUrdu: `دکان کا اسٹاک:\n\n${stocks.map((s) => `${s.crop.nameUrdu ?? s.crop.name} · ${kg(s.availableKg)}`).join('\n')}`,
    suggestedActions: [
      { label: 'Shop Stock', href: '/shop-stock' },
      ...(unlisted.length ? [{ label: 'Add Retail Listing', href: '/storefront/new' }] : []),
    ],
  };
}

async function shopOrdersTool(user: SessionUser): Promise<ToolReply> {
  const orders = await prisma.consumerOrder.findMany({
    where: {
      shopkeeperId: user.id,
      status: {
        in: [
          ConsumerOrderStatus.PLACED,
          ConsumerOrderStatus.CONFIRMED,
          ConsumerOrderStatus.PREPARING,
          ConsumerOrderStatus.OUT_FOR_DELIVERY,
        ],
      },
    },
    include: {
      consumer: { select: { name: true } },
      items: { include: { listing: { include: { crop: true } } } },
    },
    orderBy: { placedAt: 'asc' },
    take: 6,
  });

  if (!orders.length) {
    return {
      reply: 'No open customer orders. Everything on the counter is cleared.',
      replyUrdu: 'کوئی نیا آرڈر نہیں۔',
      suggestedActions: [{ label: 'Customer Orders', href: '/retail-orders' }],
    };
  }

  const lines = orders.map((o) => {
    const items = o.items
      .map((i) => `${i.listing.crop.name} ${kg(i.quantityKg)}`)
      .join(', ');
    return `${o.orderNumber} · ${o.consumer.name}: ${items} — ${money(o.totalAmount)}, ${human(o.status)}`;
  });

  return {
    reply: `${orders.length} open order(s):\n\n${lines.join('\n')}`,
    replyUrdu: `${orders.length} آرڈرز زیر التوا:\n\n${orders.map((o) => `${o.orderNumber} · ${human(o.status)}`).join('\n')}`,
    suggestedActions: [{ label: 'Customer Orders', href: '/retail-orders' }],
  };
}

/* ------------------------------------------------------------------ *
 * Admin tool
 * ------------------------------------------------------------------ */

async function adminChainTool(_user: SessionUser, text: string): Promise<ToolReply> {
  const crop = cropFrom(text);
  const [batches, deals, sales, wholesale, retail] = await Promise.all([
    prisma.farmerCropBatch.count(),
    prisma.farmerArhtiDeal.aggregate({
      where: crop ? { batch: { crop: { name: crop } } } : undefined,
      _avg: { agreedPricePerKg: true },
      _count: true,
    }),
    prisma.arhtiVendorSale.aggregate({
      where: crop ? { auction: { inventoryLot: { crop: { name: crop } } } } : undefined,
      _avg: { ratePerKg: true },
      _count: true,
    }),
    prisma.vendorShopkeeperSale.aggregate({
      where: crop ? { offer: { crop: { name: crop } } } : undefined,
      _avg: { ratePerKg: true },
      _count: true,
    }),
    prisma.consumerOrderItem.aggregate({
      where: crop ? { listing: { crop: { name: crop } } } : undefined,
      _avg: { pricePerKg: true },
      _count: true,
    }),
  ]);

  const farm = deals._avg.agreedPricePerKg ?? 0;
  const shelf = retail._avg.pricePerKg ?? 0;
  const share = farm > 0 && shelf > 0 ? Math.round((farm / shelf) * 100) : null;

  return {
    reply: `${crop ?? 'All crops'} price ladder (averages):\n\nFarm gate: ${money(farm)}/kg over ${
      deals._count
    } deal(s)\nMandi auction: ${money(sales._avg.ratePerKg ?? 0)}/kg over ${
      sales._count
    } sale(s)\nWholesale: ${money(wholesale._avg.ratePerKg ?? 0)}/kg over ${
      wholesale._count
    } sale(s)\nRetail shelf: ${money(shelf)}/kg over ${retail._count} order line(s)\n\n${
      share !== null ? `Growers keep ${share}% of the shelf price. ` : ''
    }${batches} batch(es) are traceable end to end.`,
    replyUrdu: `${crop ?? 'تمام فصلیں'}: کھیت ${money(farm)}/کلو، ریٹیل ${money(shelf)}/کلو۔`,
    suggestedActions: [
      { label: 'Supply Chain Trace', href: '/admin/trace' },
      { label: 'Market Insights', href: '/insights' },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Tool registry. A tool only runs if the caller's role holds its
 * capability, so the assistant can never read across the chain.
 * ------------------------------------------------------------------ */

const TOOLS: AiTool[] = [
  {
    name: 'prices',
    capability: null,
    keywords: ['price', 'rate', 'bhao', 'qeemat', 'market', 'mandi rate', 'قیمت', 'بھاؤ', 'نرخ', 'ریٹ'],
    describe: 'published mandi rates',
    run: pricesTool,
  },
  {
    name: 'myCrops',
    capability: 'farmer.batch.manage',
    keywords: ['crop', 'batch', 'fasal', 'harvest', 'فصل', 'کھیت', 'بیچ'],
    describe: 'your crop batches',
    run: myCropsTool,
  },
  {
    name: 'myOffers',
    capability: 'farmer.offers.respond',
    keywords: ['offer', 'arhti', 'bid on my crop', 'آفر', 'آڑھتی'],
    describe: 'offers from arhtis',
    run: (u) => myOffersTool(u),
  },
  {
    name: 'myDeals',
    capability: 'farmer.deals.view',
    keywords: ['deal', 'pickup', 'driver', 'truck', 'transport', 'sauda', 'سودا', 'گاڑی', 'ڈرائیور'],
    describe: 'your deals and pickups',
    run: (u) => myDealsTool(u),
  },
  {
    name: 'myPayments',
    capability: 'farmer.records.view',
    keywords: ['payment', 'paisa', 'settlement', 'receipt', 'ادائیگی', 'رقم', 'حساب', 'رسید'],
    describe: 'your payments and records',
    run: (u) => myPaymentsTool(u),
  },
  {
    name: 'sourcing',
    capability: 'arhti.farmerMarket.browse',
    keywords: ['source', 'sourcing', 'farmer market', 'buy from farmer', 'available crop', 'کسان'],
    describe: 'farmer batches open for offers',
    run: sourcingTool,
  },
  {
    name: 'receiving',
    capability: 'arhti.receive.produce',
    keywords: ['receive', 'kanta', 'weigh', 'weight', 'incoming', 'inbound', 'وزن', 'کانٹا'],
    describe: 'inbound consignments and weighing',
    run: (u) => receivingTool(u),
  },
  {
    name: 'arhtiInventory',
    capability: 'arhti.inventory.manage',
    keywords: ['inventory', 'store', 'godam', 'stock in mandi', 'گودام'],
    describe: 'your mandi inventory',
    run: (u) => arhtiInventoryTool(u),
  },
  {
    name: 'arhtiAuctions',
    capability: 'arhti.auction.manage',
    keywords: ['auction', 'nilam', 'bidding', 'نیلام', 'بولی'],
    describe: 'your mandi auctions',
    run: (u) => arhtiAuctionsTool(u),
  },
  {
    name: 'arhtiSales',
    capability: 'arhti.sales.view',
    keywords: ['commission', 'sale', 'sold', 'کمیشن', 'فروخت'],
    describe: 'your mandi sales and commission',
    run: (u) => arhtiSalesTool(u),
  },
  {
    name: 'vendorAuctions',
    capability: 'vendor.auction.bid',
    keywords: ['auction', 'bid', 'nilam', 'نیلام', 'بولی'],
    describe: 'live mandi auctions you can bid in',
    run: vendorAuctionsTool,
  },
  {
    name: 'vendorStock',
    capability: 'vendor.stock.manage',
    keywords: ['warehouse', 'stock', 'godam', 'inventory', 'گودام', 'اسٹاک'],
    describe: 'your warehouse stock',
    run: (u) => vendorStockTool(u),
  },
  {
    name: 'vendorWholesale',
    capability: 'vendor.offers.manage',
    keywords: ['wholesale', 'offer', 'shop', 'thok', 'تھوک', 'آفر'],
    describe: 'your wholesale offers',
    run: (u) => vendorWholesaleTool(u),
  },
  {
    name: 'shopWholesale',
    capability: 'shopkeeper.wholesale.browse',
    keywords: ['wholesale', 'buy', 'restock', 'supplier', 'thok', 'تھوک', 'خریداری'],
    describe: 'wholesale offers you can buy',
    run: shopWholesaleTool,
  },
  {
    name: 'shopStock',
    capability: 'shopkeeper.stock.manage',
    keywords: ['stock', 'shelf', 'listing', 'dukan', 'اسٹاک', 'دکان'],
    describe: 'your shop stock and listings',
    run: (u) => shopStockTool(u),
  },
  {
    name: 'shopOrders',
    capability: 'shopkeeper.orders.fulfill',
    keywords: ['order', 'customer', 'delivery', 'gahak', 'آرڈر', 'گاہک', 'ڈلیوری'],
    describe: 'your customer orders',
    run: (u) => shopOrdersTool(u),
  },
  {
    name: 'adminChain',
    capability: 'admin.trace',
    keywords: ['trace', 'chain', 'ladder', 'margin', 'supply', 'سپلائی', 'ٹریس'],
    describe: 'the full supply chain price ladder',
    run: adminChainTool,
  },
];

const ROLE_HELP: Record<UserRole, { lines: string[]; href: string }> = {
  FARMER: {
    lines: [
      'today’s mandi rates',
      'offers waiting for your answer',
      'your crop batches, and adding a new one',
      'where your deal and driver have reached',
      'what has been paid and what is pending',
    ],
    href: '/crops',
  },
  ARHTI: {
    lines: [
      'today’s mandi rates',
      'farmer batches open for offers',
      'consignments on the road and kanta weighing',
      'your mandi inventory and idle lots',
      'live auctions and your spread over cost',
      'sales and commission earned',
    ],
    href: '/sourcing',
  },
  VENDOR: {
    lines: [
      'today’s mandi rates',
      'live auctions and whether you lead or are outbid',
      'warehouse stock and what is not listed yet',
      'your wholesale offers and margin on cost',
    ],
    href: '/auctions',
  },
  SHOPKEEPER: {
    lines: [
      'today’s mandi rates',
      'the cheapest wholesale offers delivering to your city',
      'shop stock and what is not on the shelf',
      'open customer orders to fulfil',
    ],
    href: '/wholesale',
  },
  CONSUMER: { lines: ['nearby shops and your orders'], href: '/shop' },
  ADMIN: {
    lines: [
      'today’s mandi rates',
      'the farm-gate to shelf price ladder',
      'which batches are traceable end to end',
    ],
    href: '/admin/trace',
  },
};

function helpFor(user: SessionUser): ToolReply {
  const help = ROLE_HELP[user.role];
  return {
    reply: `I am AgriConnect AI, working as your ${ROLE_LABEL[
      user.role
    ]} assistant. I can tell you about:\n\n${help.lines
      .map((l) => `• ${l}`)
      .join('\n')}\n\nI only ever read what your role is allowed to see.`,
    replyUrdu: 'میں اے گری کنیکٹ اے آئی ہوں اور صرف آپ کے کردار کی معلومات دیکھ سکتا ہوں۔',
    suggestedActions: [{ label: 'Open my workspace', href: help.href }],
  };
}

/**
 * Picks the tool whose keywords best match the question, then refuses it if the
 * caller's role does not hold its capability. Refusing out loud is deliberate:
 * a farmer asking about auctions should learn that their arhti handles that,
 * not silently receive auction data.
 */
function selectTool(user: SessionUser, text: string): { tool: AiTool | null; blocked: AiTool | null } {
  const lower = text.toLowerCase();
  const scored = TOOLS.map((tool) => ({
    tool,
    score: tool.keywords.filter((k) => lower.includes(k)).length,
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const permitted = scored.find((s) => s.tool.capability === null || can(user.role, s.tool.capability));
  if (permitted) return { tool: permitted.tool, blocked: null };
  return { tool: null, blocked: scored[0]?.tool ?? null };
}

function refusal(user: SessionUser, tool: AiTool): ToolReply {
  const label = ROLE_LABEL[user.role];
  const owner: Partial<Record<ToolName, string>> = {
    vendorAuctions: 'Mandi auctions are run by arhtis and bid on by wholesale vendors.',
    arhtiAuctions: 'Only an arhti can open a mandi auction.',
    arhtiInventory: 'Mandi inventory belongs to the arhti who received the crop.',
    shopWholesale: 'The wholesale market is for shopkeepers buying from vendors.',
    adminChain: 'Confidential chain pricing is restricted to mandi administration.',
    myPayments: 'Those payment records belong to the farmer.',
  };

  return {
    reply: `I cannot show you ${tool.describe} — that is outside what a ${label} account can see.${
      owner[tool.name] ? ` ${owner[tool.name]}` : ''
    }\n\nAsk me about what is on your own desk instead, or say "help" to see the list.`,
    replyUrdu: 'یہ معلومات آپ کے کردار کے دائرے میں نہیں ہیں۔',
    suggestedActions: [{ label: 'Open my workspace', href: ROLE_HELP[user.role].href }],
  };
}

export async function askAi(formData: FormData) {
  const user = await requireCapability('shared.ai');

  const parsed = askAiSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(', ') };

  const { sessionId, message } = parsed.data;

  let session = sessionId
    ? await prisma.agentSession.findUnique({ where: { id: sessionId } })
    : null;
  // A session id from another account must never be resumed.
  if (session && session.userId !== user.id) session = null;

  if (!session) {
    session = await prisma.agentSession.create({
      data: { userId: user.id, context: { role: user.role } },
    });
  }

  const language = detectLanguage(message);
  const { tool, blocked } = selectTool(user, message);

  let result: ToolReply;
  let toolName: ToolName;
  if (tool) {
    toolName = tool.name;
    result = await tool.run(user, message);
  } else if (blocked) {
    toolName = 'help';
    result = refusal(user, blocked);
  } else {
    toolName = 'help';
    result = helpFor(user);
  }

  const context = (session.context as Record<string, unknown>) ?? {};
  const history = Array.isArray(context.history) ? context.history : [];
  history.push({ role: 'user', text: message, tool: toolName, language });
  history.push({ role: 'ai', text: result.reply, tool: toolName });

  await prisma.agentSession.update({
    where: { id: session.id },
    data: { context: { ...context, role: user.role, history }, updatedAt: new Date() },
  });

  let pendingActionId: string | undefined;
  if (result.pendingAction) {
    const action = await prisma.agentAction.create({
      data: {
        sessionId: session.id,
        actionType: result.pendingAction.actionType,
        payload: result.pendingAction.payload,
        humanSummary: result.pendingAction.humanSummary,
        status: 'PENDING',
      },
    });
    pendingActionId = action.id;
  }

  revalidatePath('/ai-assistant');

  return {
    success: true as const,
    sessionId: session.id,
    tool: toolName,
    reply: result.reply,
    replyUrdu: result.replyUrdu,
    suggestedActions: result.suggestedActions,
    pendingActionId,
    pendingActionType: result.pendingAction?.actionType,
    pendingActionSummary: result.pendingAction?.humanSummary,
  };
}

export async function confirmAgentAction(formData: FormData) {
  const user = await requireCapability('shared.ai');

  const parsed = confirmAgentActionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(', ') };

  const action = await prisma.agentAction.findUnique({
    where: { id: parsed.data.actionId },
    include: { session: true },
  });
  if (!action) return { error: 'Action not found' };
  if (action.session.userId !== user.id) return { error: 'Forbidden' };
  if (action.status !== 'PENDING') return { error: 'Action already processed' };

  await prisma.agentAction.update({
    where: { id: action.id },
    data: { status: 'CONFIRMED', confirmedAt: new Date() },
  });

  const payload = (action.payload as Record<string, unknown>) ?? {};
  const href = typeof payload.href === 'string' ? payload.href : undefined;

  revalidatePath('/ai-assistant');

  return { success: true as const, actionType: action.actionType, href };
}

export async function cancelAgentAction(formData: FormData) {
  const user = await requireCapability('shared.ai');
  const actionId = formData.get('actionId');
  if (typeof actionId !== 'string' || !actionId) return { error: 'Action ID is required' };

  const action = await prisma.agentAction.findUnique({
    where: { id: actionId },
    include: { session: true },
  });
  if (!action) return { error: 'Action not found' };
  if (action.session.userId !== user.id) return { error: 'Forbidden' };
  if (action.status !== 'PENDING') return { error: 'Action already processed' };

  await prisma.agentAction.update({ where: { id: actionId }, data: { status: 'CANCELLED' } });

  revalidatePath('/ai-assistant');

  return { success: true as const };
}

export async function loadAgentSessions() {
  const user = await requireCapability('shared.ai');
  return prisma.agentSession.findMany({
    where: { userId: user.id },
    include: { actions: true },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });
}

/** Quick prompts shown in the chat UI, scoped to what the role can actually ask. */
export async function roleQuickPrompts() {
  const user = await requireCapability('shared.ai');
  const prompts: Record<UserRole, string[]> = {
    FARMER: ['Tomato rate today?', 'Any offers for me?', 'Where is my deal?', 'What has been paid?'],
    ARHTI: ['Tomato rate today?', 'What can I source?', 'What is inbound?', 'How are my auctions?'],
    VENDOR: ['Live auctions?', 'What is in my warehouse?', 'How are my wholesale offers?', 'Onion rate today?'],
    SHOPKEEPER: ['Cheapest wholesale potato?', 'My shop stock?', 'Any open orders?', 'Tomato rate today?'],
    CONSUMER: ['Help'],
    ADMIN: ['Tomato price ladder', 'Trace the chain', 'Mandi rates today'],
  };
  return prompts[user.role];
}
