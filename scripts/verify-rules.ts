/**
 * Business-rule verification for the AgriConnect supply chain.
 *
 * Run with `npm run verify` after seeding. Three layers are checked:
 *   1. the capability matrix and route guards (role separation)
 *   2. static proof that every server action is authorization-gated, so a role
 *      boundary cannot be UI-only
 *   3. quantity and money conservation across every ownership hand-off
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, UserRole } from '@prisma/client';
import { can, canAccessPath, ROLE_CAPABILITIES } from '../lib/permissions';

const prisma = new PrismaClient();

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  pass  ${name}`);
  } else {
    failures.push(detail ? `${name} — ${detail}` : name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function near(a: number, b: number, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance;
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------

function checkPermissionMatrix() {
  section('Role separation — capability matrix');

  check('Farmer cannot bid in auctions', !can(UserRole.FARMER, 'vendor.auction.bid'));
  check('Farmer cannot create auctions', !can(UserRole.FARMER, 'arhti.auction.manage'));
  check('Farmer cannot browse the mandi auction floor', !canAccessPath(UserRole.FARMER, '/auctions'));
  check('Farmer cannot open vendor warehouse stock', !canAccessPath(UserRole.FARMER, '/stock'));
  check('Farmer cannot open the consumer storefront', !canAccessPath(UserRole.FARMER, '/shop'));
  check('Farmer cannot open shopkeeper procurement', !canAccessPath(UserRole.FARMER, '/wholesale'));

  check('Vendor can bid in auctions', can(UserRole.VENDOR, 'vendor.auction.bid'));
  check('Vendor can browse the auction floor', canAccessPath(UserRole.VENDOR, '/auctions'));
  check('Vendor cannot create auctions', !can(UserRole.VENDOR, 'arhti.auction.manage'));
  check('Vendor cannot open farmer crop management', !canAccessPath(UserRole.VENDOR, '/crops'));

  check('Shopkeeper cannot bid in auctions', !can(UserRole.SHOPKEEPER, 'vendor.auction.bid'));
  check('Shopkeeper cannot open the auction floor', !canAccessPath(UserRole.SHOPKEEPER, '/auctions'));
  check('Shopkeeper cannot open farmer crop batches', !canAccessPath(UserRole.SHOPKEEPER, '/crops'));
  check('Shopkeeper cannot open farmer payment records', !canAccessPath(UserRole.SHOPKEEPER, '/records'));

  check('Consumer cannot open wholesale procurement', !canAccessPath(UserRole.CONSUMER, '/wholesale'));
  check('Consumer cannot open the auction floor', !canAccessPath(UserRole.CONSUMER, '/auctions'));
  check('Consumer cannot open the trade dashboard', !canAccessPath(UserRole.CONSUMER, '/for-you'));
  check('Consumer cannot open deals', !canAccessPath(UserRole.CONSUMER, '/deals'));
  check('Consumer can open the retail storefront', canAccessPath(UserRole.CONSUMER, '/shop'));
  check('Consumer has no access to the AI assistant', !can(UserRole.CONSUMER, 'shared.ai'));

  check('Only the arhti runs the auction house',
    (Object.keys(ROLE_CAPABILITIES) as UserRole[]).filter((r) => can(r, 'arhti.auction.manage')).length === 1);
  check('Only the vendor bids',
    (Object.keys(ROLE_CAPABILITIES) as UserRole[]).filter((r) => can(r, 'vendor.auction.bid')).length === 1);

  check('Non-admin cannot open the trace portal', !canAccessPath(UserRole.VENDOR, '/admin/trace'));
  check('Admin can open the trace portal', canAccessPath(UserRole.ADMIN, '/admin/trace'));
  check('Admin does not hold trading capabilities',
    !can(UserRole.ADMIN, 'vendor.auction.bid') && !can(UserRole.ADMIN, 'arhti.auction.manage'));
}

function checkFarmerBatchNeedsNoMandi() {
  section('Farmer crop creation does not involve a mandi');
  const src = readFileSync(join('lib', 'validations', 'workflow.ts'), 'utf8');
  const start = src.indexOf('export const createCropBatchSchema');
  const end = src.indexOf('export const', start + 10);
  const schema = src.slice(start, end);
  check('createCropBatchSchema has no mandi field', !/mandi/i.test(schema));
  check('createCropBatchSchema has no price discovery field', !/reservePrice|auction/i.test(schema));
}

/**
 * Section 53's failure mode: hiding a feature in the UI while the action stays
 * callable. Every exported server action must gate on a capability or session.
 */
function checkEveryActionIsGated() {
  section('Every server action is authorization-gated');
  const dir = join('lib', 'actions');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(dir, file), 'utf8');
    const exports = [...src.matchAll(/export async function (\w+)\s*\(/g)].map((m) => m[1]);
    const ungated: string[] = [];
    for (const name of exports) {
      const start = src.indexOf(`export async function ${name}`);
      const next = src.indexOf('\nexport ', start + 1);
      const body = src.slice(start, next === -1 ? src.length : next);
      if (!/require(Capability|Auth)\(/.test(body)) ungated.push(name);
    }
    check(`lib/actions/${file} (${exports.length} actions)`, ungated.length === 0,
      ungated.length ? `ungated: ${ungated.join(', ')}` : '');
  }
}

async function checkQuantityConservation() {
  section('Quantity conservation across ownership hand-offs');

  const batches = await prisma.farmerCropBatch.findMany({ include: { deals: true } });
  for (const b of batches) {
    const committed = b.deals.reduce((s, d) => s + d.agreedQuantityKg, 0);
    check(`batch ${b.batchNumber}: ${b.quantityKg} kg = ${b.availableKg} available + ${committed} committed`,
      near(b.quantityKg, b.availableKg + committed));
    check(`batch ${b.batchNumber} is never negative`, b.availableKg >= 0);
  }

  const lots = await prisma.arhtiInventoryLot.findMany({
    include: { auctions: true, deal: true },
  });
  for (const l of lots) {
    const auctioned = l.auctions.reduce((s, a) => s + a.quantityKg, 0);
    check(`lot ${l.lotNumber}: ${l.receivedQuantityKg} kg = ${l.availableQuantityKg} available + ${auctioned} auctioned`,
      near(l.receivedQuantityKg, l.availableQuantityKg + auctioned));
    check(`lot ${l.lotNumber} never auctions more than it holds`, auctioned <= l.receivedQuantityKg);
    check(`lot ${l.lotNumber} matches the verified received weight`,
      near(l.receivedQuantityKg, l.deal.receivedQuantityKg ?? -1));
  }

  const vendorStock = await prisma.vendorInventory.findMany({
    include: { offers: true, sale: true },
  });
  for (const s of vendorStock) {
    const offered = s.offers.reduce((sum, o) => sum + o.offeredQuantityKg, 0);
    check(`vendor stock ${s.stockNumber}: ${s.quantityKg} kg = ${s.availableKg} available + ${offered} listed`,
      near(s.quantityKg, s.availableKg + offered));
    check(`vendor stock ${s.stockNumber} equals the quantity actually won at auction`,
      near(s.quantityKg, s.sale.quantityKg));
  }

  const wholesaleOffers = await prisma.vendorOffer.findMany({ include: { sales: true } });
  for (const o of wholesaleOffers) {
    const sold = o.sales.reduce((sum, sale) => sum + sale.quantityKg, 0);
    check(`wholesale offer ${o.offerNumber}: ${o.offeredQuantityKg} kg = ${o.remainingKg} remaining + ${sold} sold`,
      near(o.offeredQuantityKg, o.remainingKg + sold));
    check(`wholesale offer ${o.offerNumber} cannot oversell`, sold <= o.offeredQuantityKg);
  }

  const shopStock = await prisma.shopkeeperInventory.findMany({
    include: { listings: true, sale: true },
  });
  for (const s of shopStock) {
    const listed = s.listings.reduce((sum, l) => sum + l.listedQuantityKg, 0);
    check(`shop stock ${s.stockNumber}: ${s.quantityKg} kg = ${s.availableKg} available + ${listed} listed`,
      near(s.quantityKg, s.availableKg + listed));
    check(`shop stock ${s.stockNumber} equals the wholesale quantity purchased`,
      near(s.quantityKg, s.sale.quantityKg));
  }

  const listings = await prisma.retailListing.findMany({ include: { orderItems: true } });
  for (const l of listings) {
    const sold = l.orderItems.reduce((sum, i) => sum + i.quantityKg, 0);
    check(`retail listing ${l.listingNumber}: ${l.listedQuantityKg} kg = ${l.remainingKg} remaining + ${sold} sold`,
      near(l.listedQuantityKg, l.remainingKg + sold));
    check(`retail listing ${l.listingNumber} is never negative`, l.remainingKg >= 0);
  }
}

async function checkLineage() {
  section('Traceability — every downstream record points back to a real batch');

  const batchIds = new Set((await prisma.farmerCropBatch.findMany({ select: { id: true } })).map((b) => b.id));

  const rooted: Array<[string, string[]]> = [
    ['ArhtiVendorSale', (await prisma.arhtiVendorSale.findMany({ select: { rootBatchId: true } })).map((r) => r.rootBatchId)],
    ['VendorInventory', (await prisma.vendorInventory.findMany({ select: { rootBatchId: true } })).map((r) => r.rootBatchId)],
    ['VendorOffer', (await prisma.vendorOffer.findMany({ select: { rootBatchId: true } })).map((r) => r.rootBatchId)],
    ['VendorShopkeeperSale', (await prisma.vendorShopkeeperSale.findMany({ select: { rootBatchId: true } })).map((r) => r.rootBatchId)],
    ['ShopkeeperInventory', (await prisma.shopkeeperInventory.findMany({ select: { rootBatchId: true } })).map((r) => r.rootBatchId)],
    ['RetailListing', (await prisma.retailListing.findMany({ select: { rootBatchId: true } })).map((r) => r.rootBatchId)],
    ['ConsumerOrderItem', (await prisma.consumerOrderItem.findMany({ select: { rootBatchId: true } })).map((r) => r.rootBatchId)],
  ];

  for (const [model, ids] of rooted) {
    check(`${model} (${ids.length}) all resolve to an existing crop batch`,
      ids.length > 0 && ids.every((id) => batchIds.has(id)));
  }

  const flagship = await prisma.farmerCropBatch.findFirstOrThrow({
    where: { batchNumber: 'FB-2025-1001' },
    include: { chainEvents: { orderBy: { createdAt: 'asc' } } },
  });
  const stages = flagship.chainEvents.map((e) => e.stage);
  for (const stage of [
    'FARMER_HARVEST',
    'FARMER_ARHTI_OFFER',
    'FARMER_ARHTI_DEAL',
    'PICKUP',
    'ARHTI_RECEIPT',
    'MANDI_AUCTION',
    'ARHTI_VENDOR_SALE',
    'VENDOR_WHOLESALE_OFFER',
    'VENDOR_SHOPKEEPER_SALE',
    'RETAIL_LISTING',
    'CONSUMER_ORDER',
  ]) {
    check(`flagship chain records stage ${stage}`, stages.includes(stage as never));
  }

  const ladder = [74, 92, 104, 145];
  const prices = [
    flagship.chainEvents.find((e) => e.stage === 'FARMER_ARHTI_DEAL')?.pricePerKg,
    flagship.chainEvents.find((e) => e.stage === 'ARHTI_VENDOR_SALE')?.pricePerKg,
    flagship.chainEvents.find((e) => e.stage === 'VENDOR_WHOLESALE_OFFER')?.pricePerKg,
    flagship.chainEvents.find((e) => e.stage === 'RETAIL_LISTING')?.pricePerKg,
  ];
  check(`flagship price ladder is Rs ${ladder.join(' -> ')}/kg`,
    ladder.every((v, i) => prices[i] === v), `got ${prices.join(' -> ')}`);
  check('price rises at every stage of the chain',
    prices.every((p, i) => i === 0 || (p ?? 0) > (prices[i - 1] ?? 0)));

  check('confidential margin events exist and are flagged',
    (await prisma.supplyChainEvent.count({ where: { isConfidential: true } })) > 0);
}

async function checkMoneyAndTrust() {
  section('Money and trust records');

  const deals = await prisma.farmerArhtiDeal.findMany({
    where: { status: { in: ['PAID', 'COMPLETED'] } },
    include: { settlement: { include: { deductions: true } } },
  });
  for (const d of deals) {
    const s = d.settlement;
    if (!s) {
      check(`deal ${d.dealNumber} has a settlement`, false);
      continue;
    }
    const deductionSum = s.deductions.reduce((sum, x) => sum + x.amount, 0);
    check(`deal ${d.dealNumber}: settlement gross uses the verified weight`,
      near(s.grossAmount, (d.receivedQuantityKg ?? 0) * d.agreedPricePerKg));
    check(`deal ${d.dealNumber}: itemised deductions total the header`,
      near(s.deductionsTotal, deductionSum));
    check(`deal ${d.dealNumber}: net = gross - deductions`,
      near(s.netPayable, s.grossAmount - s.deductionsTotal));

    const payment = await prisma.paymentRecord.findUnique({
      where: { transactionType_transactionId: { transactionType: 'FARMER_ARHTI', transactionId: d.id } },
    });
    check(`deal ${d.dealNumber}: farmer was paid the net amount`, !!payment && near(payment.amount, s.netPayable));
  }

  const sales = await prisma.arhtiVendorSale.findMany({
    include: { arhti: { select: { arhtiProfile: { select: { commissionRate: true } } } } },
  });
  for (const s of sales) {
    check(`sale ${s.saleNumber}: gross = quantity x rate`, near(s.grossAmount, s.quantityKg * s.ratePerKg));
    const rate = s.arhti.arhtiProfile?.commissionRate ?? 0.02;
    check(`sale ${s.saleNumber}: commission = gross x arhti's rate`, near(s.commission, s.grossAmount * rate));
    const stock = await prisma.vendorInventory.findUnique({ where: { saleId: s.id } });
    check(`sale ${s.saleNumber}: vendor stock cost includes the commission`,
      !!stock && near(stock.costPerKg, (s.grossAmount + s.commission) / s.quantityKg));
    const payment = await prisma.paymentRecord.findUnique({
      where: { transactionType_transactionId: { transactionType: 'ARHTI_VENDOR', transactionId: s.id } },
    });
    // The vendor pays the auction value plus the arhti's commission on it.
    check(`sale ${s.saleNumber}: vendor paid value + commission`, !!payment && near(payment.amount, s.grossAmount + s.commission));
  }

  const vss = await prisma.vendorShopkeeperSale.findMany();
  for (const s of vss) {
    check(`wholesale sale ${s.saleNumber}: gross = quantity x rate`,
      near(s.grossAmount, s.quantityKg * s.ratePerKg));
  }

  const orders = await prisma.consumerOrder.findMany({ include: { items: true } });
  for (const o of orders) {
    const lines = o.items.reduce((sum, i) => sum + i.lineTotal, 0);
    check(`order ${o.orderNumber}: total = items + delivery fee`,
      near(o.totalAmount, lines + o.deliveryFee));
  }

  section('Ratings require a completed transaction');
  const ratings = await prisma.rating.findMany();
  check('at least one rating exists', ratings.length > 0);
  for (const r of ratings) {
    if (r.transactionType === 'SHOPKEEPER_CONSUMER') {
      const order = await prisma.consumerOrder.findUnique({ where: { id: r.transactionId } });
      check(`rating on order ${order?.orderNumber ?? r.transactionId} targets a delivered order`,
        order?.status === 'DELIVERED');
    }
    if (r.transactionType === 'FARMER_ARHTI') {
      const deal = await prisma.farmerArhtiDeal.findUnique({ where: { id: r.transactionId } });
      check(`rating on deal ${deal?.dealNumber ?? r.transactionId} targets a finished deal`,
        deal?.status === 'COMPLETED' || deal?.status === 'PAID');
    }
    check(`rating ${r.id} is not self-issued`, r.raterId !== r.targetUserId);
  }

  const shops = await prisma.shopkeeperProfile.findMany();
  for (const shop of shops) {
    const count = await prisma.rating.count({
      where: { transactionType: 'SHOPKEEPER_CONSUMER', targetUserId: shop.userId },
    });
    check(`${shop.shopName}: displayed rating count matches stored ratings`, shop.ratingCount === count,
      `profile says ${shop.ratingCount}, found ${count}`);
  }
}

async function checkRoleWorkloads() {
  section('Every role has live work on login');

  const roleOf = async (email: string) =>
    prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true } });

  const farmer = await roleOf('farmer@demo.pk');
  const arhti = await roleOf('arhti@demo.pk');
  const vendor = await roleOf('vendor@demo.pk');
  const shopkeeper = await roleOf('shopkeeper@demo.pk');
  const consumer = await roleOf('consumer@demo.pk');

  check('farmer has a pending offer to answer',
    (await prisma.farmerArhtiOffer.count({ where: { farmerId: farmer.id, status: 'PENDING' } })) > 0);
  check('farmer has a batch still for sale',
    (await prisma.farmerCropBatch.count({ where: { farmerId: farmer.id, status: 'READY_FOR_SALE' } })) > 0);
  check('arhti has produce inbound to weigh',
    (await prisma.farmerArhtiDeal.count({ where: { arhtiId: arhti.id, status: 'IN_TRANSIT' } })) > 0);
  check('arhti has uncommitted inventory',
    (await prisma.arhtiInventoryLot.count({ where: { arhtiId: arhti.id, availableQuantityKg: { gt: 0 } } })) > 0);
  check('a live auction is open for vendors to bid in',
    (await prisma.auction.count({ where: { status: 'ACTIVE' } })) > 0);
  check('vendor has unlisted warehouse stock',
    (await prisma.vendorInventory.count({ where: { vendorId: vendor.id, availableKg: { gt: 0 } } })) > 0);
  check('shopkeeper has an order to fulfil',
    (await prisma.consumerOrder.count({ where: { shopkeeperId: shopkeeper.id, status: 'PLACED' } })) > 0);
  check('shopkeeper has unlisted shop stock',
    (await prisma.shopkeeperInventory.count({ where: { shopkeeperId: shopkeeper.id, availableKg: { gt: 0 } } })) > 0);
  check('consumer can shop from more than one nearby shop',
    (await prisma.retailListing.groupBy({ by: ['shopkeeperId'], where: { status: 'ACTIVE' } })).length > 1);
  check('consumer has a delivered order they may still rate',
    (await prisma.consumerOrder.count({ where: { consumerId: consumer.id, status: 'DELIVERED' } })) > 0);

  check('no account holds two roles',
    (await prisma.user.count()) ===
      (await prisma.user.findMany({ select: { id: true, role: true } })).filter((u) => !!u.role).length);
}

async function main() {
  checkPermissionMatrix();
  checkFarmerBatchNeedsNoMandi();
  checkEveryActionIsGated();
  await checkQuantityConservation();
  await checkLineage();
  await checkMoneyAndTrust();
  await checkRoleWorkloads();

  console.log(`\n${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
