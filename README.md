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
- `requireCapability(capability)` — called by server actions before they touch the database; returns the user or throws

Enforcement is layered, not cosmetic:

1. `middleware.ts` blocks unauthorized page routes (redirect to the role's home) and API routes (403 JSON).
2. Exported server actions call `requireCapability` (or `requireAuth`) before touching the database — checked statically by `npm run verify`, which currently flags one exception: `logout` in `lib/actions/auth.ts`.
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

After a fresh seed (`npm run db:setup` or `npm run db:reset`), every role logs in with real work waiting: the farmer has two competing offers, the arhti has a truck to weigh, the vendor has a live auction, the shopkeeper has an order to fulfil, the consumer has a delivered order to rate. The seeded auction closes about 6 hours after seeding; run `npm run db:reset` to open a fresh one.

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

Requires Node.js 18.18 or later.

```bash
npm install                 # also runs prisma generate
cp .env.example .env        # Windows (cmd): copy .env.example .env
```

Open `.env` and set `NEXTAUTH_SECRET` to a random string of at least 32 characters. This prints one (works on Windows, macOS and Linux):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`AI_API_KEY` is optional (see [Environment variables](#environment-variables)). Then:

```bash
npm run db:setup            # create the tables and load the demo supply chain
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in as `farmer@demo.pk` / `demo123` (or any [demo account](#demo-accounts)).

`npm run db:setup` uses `prisma db push`, which creates the tables straight from `prisma/schema.prisma`. The repository does not ship migration files, so `npm run db:migrate` (`prisma migrate dev`) does not work on a fresh clone; don't use it for setup.

### Environment variables

| Variable | Required | What it is and how to get it |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file, relative to `prisma/`. Keep the default `file:./dev.db`. |
| `NEXTAUTH_SECRET` | Yes | Secret that signs the login session. Any random string of 32+ characters (command above). `AUTH_SECRET` is also accepted. |
| `AI_API_KEY` | No | API key for the AI assistant (farmer and arhti chats). Create one in the [Alibaba Cloud Model Studio](https://www.alibabacloud.com/help/en/model-studio/) console, **Singapore** region (keys only work in the region they were created in). Without a key the assistant still works, using its rule-based fallback. |
| `AI_BASE_URL` | No | OpenAI-compatible endpoint. Default: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (Model Studio, Singapore). |
| `AI_MODEL` | No | Model name. Default: `qwen-plus-2025-12-01`. |
| `AI_MODEL_TRADER` | No | Model for the arhti assistant (vendors and shopkeepers later), e.g. another `qwen-plus` snapshot with its own free quota. Falls back to `AI_MODEL`. |

### Resetting the demo

```bash
npm run db:reset     # drop all data, recreate the tables and re-seed
```

The admin console also has a guarded reset form.

### Checks

```bash
npm run typecheck    # tsc --noEmit
npm run verify       # business-rule and conservation checks
npm run build        # production build
```

`npm run verify` (`scripts/verify-rules.ts`) is the executable version of the domain rules. It asserts the permission matrix (farmer cannot bid, shopkeeper cannot bid, consumer cannot reach wholesale, only the arhti runs auctions), scans `lib/actions/` for exported server actions that do not call `requireCapability` or `requireAuth` (it currently reports `logout` in `lib/actions/auth.ts`), and checks quantity conservation at every stage — that each batch's harvested weight still equals what remains plus what it committed downstream. It runs against the live database, so it also checks stock you move through the UI. Some checks (such as "a live auction is open") depend on the demo data being fresh.

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
| AI (farmer assistant) | Qwen (`qwen-plus-2025-12-01`) on Alibaba Cloud Model Studio, OpenAI-compatible API |

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

One visible "AgriConnect AI" at `/ai-assistant`, available to farmers, arhtis, vendors and shopkeepers (consumers and the admin do not have it). Its data access is gated by the same capabilities as the rest of the app, so it cannot surface data the signed-in role could not otherwise reach.

- **Farmers** get an LLM assistant (`lib/actions/natural-ai.ts`) for post-harvest questions: prices and price trends, which mandis pay more, what they will receive after commission, mandi cess and transport, selling now or holding, storage and transport. It also reads the farmer's own crops, offers, deals and payments, and can list a crop by chat (the listing is created only after the farmer presses Confirm). It replies in the farmer's language and script: English, Urdu or Roman Urdu. It is instructed to refer questions about growing the crop to the local agriculture extension office.
- **Arhtis** get a Qwen-powered assistant (`lib/actions/trader-ai.ts`) built the same way as the farmer chat. It answers questions only, from the arhti's own records: Farmer Market batches, offers, buy requests, deals, kanta weighing, settlements, inventory lots, auctions, sales, earnings (commission from farmers, commission from vendors, trading margin) and mandi prices. Other people's confidential figures (another arhti's deals, vendors' or shopkeepers' costs and margins) are never sent to the model.
- **Vendors and shopkeepers** get the rule-based assistant (`lib/actions/ai.ts`): keyword matching to role-specific tools, with English and Urdu replies.
- **Fallback:** if the LLM call fails for any reason (no API key, network error, timeout, invalid response, free quota used up), the message is answered by the rule-based assistant instead (farmers and arhtis).
- **Voice input** uses the browser's Web Speech API (Urdu or English); the recognised text is placed in the input box for the farmer to check before sending.

## How we use Alibaba Cloud

The farmer and arhti assistants run on **Qwen** through **Alibaba Cloud Model Studio** (Singapore region), using its OpenAI-compatible Chat Completions endpoint.

- **Model:** `qwen-plus-2025-12-01` (configurable via `AI_MODEL`; endpoint via `AI_BASE_URL`). The arhti assistant uses `AI_MODEL_TRADER` when it is set, so it can run on a separate free quota.
- **JSON mode:** requests use `response_format: { type: "json_object" }`. Every reply is validated with Zod before use; anything that does not validate falls back to the rule-based assistant.
- **Facts are computed on the server, not by the model:** price rankings per crop (highest first, kept separate for app mandi records and the AMIS tomato report) and net-amount estimates (using the same commission, mandi cess and transport rules as the real settlement) are calculated in code and sent to Qwen as ready-made text. After Qwen replies, the server corrects altered deal and batch numbers, re-asks once (when the first reply was quick) if the reply quotes a per-kg price that is not in the data or is in the wrong language (the arhti assistant also checks every rupee total, and falls back to the rule-based assistant if one is still not in the data), and adds general advice under a fixed "general guidance (not live data)" label.
- **Cost control:** we run on Model Studio's free quota with the console's "stop when free quota is exhausted" setting turned on, so usage can never be billed. When the free quota is used up, Model Studio returns `403 AllocationQuota.FreeTierOnly` and the app falls back to the rule-based assistant. Each request has a 30-second timeout.

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).
