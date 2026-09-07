import type { UserRole } from '@prisma/client';

export type AppRole = UserRole;

/**
 * Every protected action in AgriConnect maps to a capability. Roles are granted
 * capabilities here and nowhere else, so route guards, server actions, navigation
 * and AI tools all derive access from the same source.
 */
export type Capability =
  // Farmer — production and selling to an arhti
  | 'farmer.batch.manage'
  | 'farmer.offers.respond'
  | 'farmer.deals.view'
  | 'farmer.records.view'
  // Arhti — buying side
  | 'arhti.farmerMarket.browse'
  | 'arhti.demand.manage'
  | 'arhti.offers.create'
  | 'arhti.deals.manage'
  | 'arhti.pickup.manage'
  | 'arhti.receive.produce'
  // Arhti — selling side
  | 'arhti.inventory.manage'
  | 'arhti.auction.manage'
  | 'arhti.sales.view'
  // Vendor
  | 'vendor.auction.browse'
  | 'vendor.auction.bid'
  | 'vendor.stock.manage'
  | 'vendor.offers.manage'
  | 'vendor.sales.view'
  // Shopkeeper
  | 'shopkeeper.wholesale.browse'
  | 'shopkeeper.wholesale.purchase'
  | 'shopkeeper.stock.manage'
  | 'shopkeeper.retail.manage'
  | 'shopkeeper.orders.fulfill'
  // Consumer
  | 'consumer.retail.browse'
  | 'consumer.retail.order'
  | 'consumer.orders.view'
  // Shared
  | 'shared.messages'
  | 'shared.ai'
  | 'shared.insights'
  | 'shared.profile'
  // Admin
  | 'admin.console'
  | 'admin.trace'
  | 'admin.users.manage';

const FARMER: Capability[] = [
  'farmer.batch.manage',
  'farmer.offers.respond',
  'farmer.deals.view',
  'farmer.records.view',
  'shared.messages',
  'shared.ai',
  'shared.profile',
];

const ARHTI: Capability[] = [
  'arhti.farmerMarket.browse',
  'arhti.demand.manage',
  'arhti.offers.create',
  'arhti.deals.manage',
  'arhti.pickup.manage',
  'arhti.receive.produce',
  'arhti.inventory.manage',
  'arhti.auction.manage',
  'arhti.sales.view',
  'shared.messages',
  'shared.ai',
  'shared.insights',
  'shared.profile',
];

const VENDOR: Capability[] = [
  'vendor.auction.browse',
  'vendor.auction.bid',
  'vendor.stock.manage',
  'vendor.offers.manage',
  'vendor.sales.view',
  'shared.messages',
  'shared.ai',
  'shared.insights',
  'shared.profile',
];

const SHOPKEEPER: Capability[] = [
  'shopkeeper.wholesale.browse',
  'shopkeeper.wholesale.purchase',
  'shopkeeper.stock.manage',
  'shopkeeper.retail.manage',
  'shopkeeper.orders.fulfill',
  'shared.messages',
  'shared.ai',
  'shared.insights',
  'shared.profile',
];

const CONSUMER: Capability[] = [
  'consumer.retail.browse',
  'consumer.retail.order',
  'consumer.orders.view',
  'shared.profile',
];

const ADMIN: Capability[] = [
  'admin.console',
  'admin.trace',
  'admin.users.manage',
  'shared.messages',
  'shared.insights',
  'shared.profile',
];

export const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  FARMER,
  ARHTI,
  VENDOR,
  SHOPKEEPER,
  CONSUMER,
  ADMIN,
};

export function can(role: UserRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function canAny(role: UserRole, ...capabilities: Capability[]): boolean {
  return capabilities.some((c) => can(role, c));
}

/**
 * Route prefix -> capability required to open it. Longest prefix wins, so
 * `/admin/trace` is checked before `/admin`.
 */
const ROUTE_CAPABILITIES: Array<[string, Capability[]]> = [
  ['/crops', ['farmer.batch.manage']],
  ['/arhti-requests', ['farmer.offers.respond']],
  ['/records', ['farmer.records.view']],

  ['/sourcing', ['arhti.farmerMarket.browse']],
  ['/demand', ['arhti.demand.manage']],
  ['/receiving', ['arhti.receive.produce']],
  ['/inventory', ['arhti.inventory.manage']],
  ['/auction-house', ['arhti.auction.manage']],
  ['/sales', ['arhti.sales.view', 'vendor.sales.view']],

  ['/auctions', ['vendor.auction.browse', 'arhti.auction.manage']],
  ['/stock', ['vendor.stock.manage']],
  ['/wholesale-shop', ['vendor.offers.manage']],

  ['/wholesale', ['shopkeeper.wholesale.browse']],
  ['/purchases', ['shopkeeper.wholesale.purchase']],
  ['/shop-stock', ['shopkeeper.stock.manage']],
  ['/storefront', ['shopkeeper.retail.manage']],
  ['/retail-orders', ['shopkeeper.orders.fulfill']],

  ['/shop', ['consumer.retail.browse']],
  ['/nearby', ['consumer.retail.browse']],
  ['/orders', ['consumer.orders.view']],

  ['/messages', ['shared.messages']],
  ['/ai-assistant', ['shared.ai']],
  ['/insights', ['shared.insights']],

  ['/admin/trace', ['admin.trace']],
  ['/admin', ['admin.console']],
];

/** `/deals` is shared by farmers and arhtis; data is scoped per role in the page. */
const SHARED_ROUTES = ['/for-you', '/profile', '/deals'];

export function capabilitiesForPath(pathname: string): Capability[] | null {
  const matches = ROUTE_CAPABILITIES.filter(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!matches.length) return null;
  matches.sort((a, b) => b[0].length - a[0].length);
  return matches[0][1];
}

export function isSharedRoute(pathname: string): boolean {
  return SHARED_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (isSharedRoute(pathname)) {
    // Consumers have a dedicated storefront experience, not the trade dashboard.
    if (role === 'CONSUMER') return pathname === '/profile' || pathname.startsWith('/profile/');
    if (pathname.startsWith('/deals')) {
      return canAny(role, 'farmer.deals.view', 'arhti.deals.manage');
    }
    return true;
  }
  const capabilities = capabilitiesForPath(pathname);
  if (!capabilities) return true;
  return canAny(role, ...capabilities);
}

export const ROLE_HOME: Record<UserRole, string> = {
  FARMER: '/for-you',
  ARHTI: '/for-you',
  VENDOR: '/for-you',
  SHOPKEEPER: '/for-you',
  CONSUMER: '/shop',
  ADMIN: '/admin',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  FARMER: 'Farmer',
  ARHTI: 'Arhti (Commission Agent)',
  VENDOR: 'Wholesale Vendor',
  SHOPKEEPER: 'Shopkeeper',
  CONSUMER: 'Consumer',
  ADMIN: 'Mandi Admin',
};

export const ROLE_LABEL_URDU: Record<UserRole, string> = {
  FARMER: 'کسان',
  ARHTI: 'آڑھتی',
  VENDOR: 'تھوک فروش',
  SHOPKEEPER: 'دکاندار',
  CONSUMER: 'صارف',
  ADMIN: 'ایڈمن',
};
