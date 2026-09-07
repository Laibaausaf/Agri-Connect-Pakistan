# AgriConnect — Pakistan's Digital Supply Chain, Farm to Counter

A Next.js 15 application that models Pakistan's agricultural supply chain as it actually works: produce changes hands five times between the field and the customer, and each handover is a real transfer of ownership with its own price, quantity and paper trail.

Every account has exactly one role, and each role is a genuinely different application — a farmer never sees a bid button, a consumer never sees a mandi rate.

## The chain

```
FARMER  ──▶  ARHTI  ──▶  VENDOR  ──▶  SHOPKEEPER  ──▶  CONSUMER
        deal        auction       wholesale        retail
```

| Role | Job | Home |
|---|---|---|
| **FARMER** | Grows and logs harvests, answers arhti offers, gets paid | `/for-you` |
| **ARHTI** | Buys from farmers, weighs produce in, auctions it to vendors | `/for-you` |
| **VENDOR** | Bids in mandi auctions, resells wholesale to shopkeepers | `/for-you` |
| **SHOPKEEPER** | Buys wholesale, stocks a shop, sells retail | `/for-you` |
| **CONSUMER** | Orders from nearby shops | `/shop` |
| **ADMIN** | Network oversight and full-chain traceability | `/admin` |

There is no generic "buyer" and no role switcher. The former `BUYER` role was split: wholesale purchasers became `VENDOR`, retail procurement became `SHOPKEEPER`.

## Inventory model

Produce is never represented as one listing that travels unchanged. Each stage creates a **new record that points back to its parent**, so any object can be traced to the field it grew in:

```
FarmerCropBatch          farmer logs a harvest
  └─ FarmerArhtiOffer / FarmerArhtiDeal   price agreed
       └─ PickupRecord + DeliveryTracking transport (no driver account)
            └─ ArhtiInventoryLot          created at the weighbridge
                 └─ Auction + Bid         mandi price discovery
                      └─ VendorInventory  vendor owns it on winning
                           └─ VendorOffer
                                └─ VendorShopkeeperSale
                                     └─ ShopkeeperInventory
                                          └─ RetailListing
                                               └─ ConsumerOrder
```

Every downstream row carries `rootBatchId`, so `/admin/trace` can reconstruct the whole journey from a consumer order back to the harvest.

## Ownership transfers

`lib/inventory.ts` is the only sanctioned way stock moves. Each transfer draws down the parent and creates the child **inside one `prisma.$transaction`**, so quantities can never diverge:

| Function | Decrements |
|---|---|
| `drawFromBatch` | `FarmerCropBatch.availableKg` |
| `drawFromArhtiLot` | `ArhtiInventoryLot.availableQuantityKg` |
| `drawFromVendorStock` | `VendorInventory.availableKg` |
| `drawFromVendorOffer` | `VendorOffer.remainingKg` |
| `drawFromShopkeeperStock` | `ShopkeeperInventory.availableKg` |
| `drawFromRetailListing` | `RetailListing.remainingKg` |

These refuse to go negative, so overselling, re-auctioning sold quantity and duplicate ownership are impossible rather than merely discouraged. Status transitions (`IN_STOCK` → `LOW_STOCK` → `SOLD_OUT`) are derived from the remaining quantity, never set by hand.

Two rules worth knowing:

- **A farmer's crop batch needs no mandi.** Destination is decided later, in the arhti deal — the farmer is a producer, not a market participant.
- **Money is calculated on the verified weight, not the agreed weight.** Weighing on the kanta is the moment ownership transfers, so a 5,000 kg deal that arrives as 4,920 kg settles on 4,920 kg.

## Permissions

Access is capability-based, defined once in `lib/permissions.ts` and consumed by route guards, server actions, navigation and AI tools alike. There are no scattered role-string comparisons.

- `can(role, capability)` / `canAny(role, ...)` — capability checks
- `canAccessPath(role, pathname)` — route checks via `ROUTE_CAPABILITIES` (longest prefix wins)
- `requireCapability(capability)` — used by **every** server action; returns the user or throws

Enforcement is layered, not cosmetic:

1. `middleware.ts` blocks unauthorized page routes (redirect to the role's home) and API routes (403 JSON).
2. Every exported server action calls `requireCapability` before touching the database — verified statically by `npm run verify`.
3. Confidential rows are filtered in the Prisma `where` clause, not hidden in the UI.

Hiding a nav link is never the security boundary. A farmer who types `/auction-house` is redirected; a shopkeeper who strips the client-side `min` attribute off an order form is still rejected by the server.

### Visibility

`SupplyChainEvent` rows carry `isConfidential`. Margins, purchase costs and settlement breakdowns are marked confidential: each party sees its own transactions, the admin sees the entire chain, and the public sees only anonymized aggregates. A farmer viewing their own deal does not see what the arhti later sold their produce for.

## Transaction types

| Record | Handover | Money |
|---|---|---|
| `FarmerArhtiDeal` | Farmer → Arhti | `Settlement` + `SettlementDeduction` (commission, transport, mandi cess) |
| `ArhtiVendorSale` | Arhti → Vendor | `PaymentRecord` (`ARHTI_VENDOR`) |
| `VendorShopkeeperSale` | Vendor → Shopkeeper | `PaymentRecord` (`VENDOR_SHOPKEEPER`) |
| `ConsumerOrder` | Shopkeeper → Consumer | `PaymentRecord` (`CONSUMER_RETAIL`) |

Ratings require a completed transaction — a delivered order or a finished deal — and cannot be self-issued.

## Demo accounts

Password for all accounts: `demo123`

| Email | Role | Who |
|---|---|---|
| `farmer@demo.pk` | FARMER | Zubair Khan — Swabi |
| `farmer2@demo.pk` | FARMER | Ghulam Rasool — Okara |
| `arhti@demo.pk` | ARHTI | Haji Aslam — Islamabad Sabzi Mandi |
| `arhti2@demo.pk` | ARHTI | Malik Tanveer — Badami Bagh, Lahore |
| `vendor@demo.pk` | VENDOR | Bilal Traders Wholesale — Islamabad |
| `vendor2@demo.pk` | VENDOR | Kareem Wholesale Supply — Rawalpindi |
| `shopkeeper@demo.pk` | SHOPKEEPER | Green Mart — G-11, Islamabad |
| `shopkeeper2@demo.pk` | SHOPKEEPER | Fresh Corner — F-10, Islamabad |
| `consumer@demo.pk` | CONSUMER | Ayesha Siddiqui — G-11/3 |
| `admin@demo.pk` | ADMIN | Mandi Administration |

Every role logs in with real work waiting: the farmer has two competing offers, the arhti has a truck to weigh, the vendor has a live auction, the shopkeeper has an order to fulfil, the consumer has a delivered order to rate.

## Demo flow

The seed contains one flagship chain, batch `FB-2025-1001`, already complete end to end:

**5,000 kg Swabi tomato → Rs 74/kg farm gate → 4,920 kg verified at the Islamabad kanta → Rs 92/kg mandi auction → Rs 104/kg wholesale → Rs 145/kg on the Green Mart shelf.**

The grower keeps 51% of the shelf price. Open `/admin/trace`, pick `FB-2025-1001`, and every handover is listed with quantity, rate, timestamp and transaction reference.

To walk it live instead:

1. **Farmer** (`farmer@demo.pk`) — log a harvest at `/crops/new`; note that no mandi is requested. Review the two competing offers at `/arhti-requests` and accept one.
2. **Arhti** (`arhti@demo.pk`) — the accepted deal appears at `/receiving`. Enter the kanta weight; this creates the inventory lot and the farmer's settlement in one transaction. Auction the lot from `/inventory`.
3. **Vendor** (`vendor@demo.pk`) — bid at `/auctions`. On winning, the lot becomes `VendorInventory` at `/stock`; list it on the wholesale shop.
4. **Shopkeeper** (`shopkeeper@demo.pk`) — order from `/wholesale`, then put it on the shelf from `/shop-stock`.
5. **Consumer** (`consumer@demo.pk`) — order from `/shop`, track it at `/orders`, rate the shop once delivered.
6. **Admin** (`admin@demo.pk`) — trace the batch you just moved at `/admin/trace`.

## Getting started

```bash
npm install          # also runs prisma generate
npm run db:migrate   # apply migrations
npm run db:seed      # load the demo supply chain
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Resetting the demo

```bash
npm run db:reset     # wipe, re-migrate and re-seed
```

The admin console also has a guarded reset form.

### Checks

```bash
npm run typecheck    # tsc --noEmit
npm run verify       # 147 business-rule and conservation checks
npm run build        # production build
```

`npm run verify` (`scripts/verify-rules.ts`) is the executable version of the domain rules. It asserts the permission matrix (farmer cannot bid, shopkeeper cannot bid, consumer cannot reach wholesale, only the arhti runs auctions), proves every exported server action is gated by scanning `lib/actions/` for a `requireCapability` call, and checks quantity conservation at every stage — that each batch's harvested weight still equals what remains plus what it committed downstream. It runs against the live database, so it also passes after you move stock through the UI.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions) |
| Language | TypeScript 5 (strict) |
| UI | React 19, Tailwind CSS |
| Database | SQLite via Prisma 6 |
| Auth | NextAuth v5 (credentials, JWT) |
| Realtime | Socket.IO (live auction bidding) |
| Validation | Zod |

## Layout

```
app/(app)/
  for-you/          role dashboard (farmer, arhti, vendor, shopkeeper)
  crops/            farmer batches            arhti-requests/  offers to answer
  deals/            farmer–arhti deals        records/         farmer payments
  sourcing/         arhti's farmer market     demand/          arhti buy requests
  receiving/        kanta / weight entry      inventory/       arhti mandi stock
  auction-house/    arhti's auctions          sales/           arhti commission
  auctions/         vendor bidding floor      stock/           vendor warehouse
  wholesale-shop/   vendor's shelf            purchases/       vendor buys
  wholesale/        shopkeeper procurement    shop-stock/      shop back room
  storefront/       shopkeeper's shelf        retail-orders/   fulfilment queue
  shop/  nearby/  orders/                     consumer storefront
  admin/  admin/trace/                        oversight and traceability
  messages/  insights/  ai-assistant/  profile/

lib/
  permissions.ts    capabilities, route map, role homes
  authz.ts          requireCapability / requireAuth
  inventory.ts      ownership transfer engine
  supplychain.ts    recordChainEvent
  navigation.ts     per-role nav                actions/  server actions by stage
```

## AI assistant

One visible "AgriConnect AI", but its context and tools are gated by the same capabilities as the rest of the app — it cannot surface data the signed-in role could not otherwise reach. Intent classification is rule-based with domain specialists (price, crop, logistics, settlement), so there is no external LLM dependency. Replies are bilingual English/Urdu. Consumers do not have it.

## License

Built as a hackathon MVP. See repository for license details.
