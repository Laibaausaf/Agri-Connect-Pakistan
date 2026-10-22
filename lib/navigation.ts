import { UserRole } from '@prisma/client';

export type NavBadgeKey =
  | 'liveAuctions'
  | 'pendingOffers'
  | 'activeDeals'
  | 'awaitingReceipt'
  | 'unreadMessages'
  | 'openOrders'
  | 'lowStock';

export type NavBadges = Partial<Record<NavBadgeKey, number>>;

export type NavEntry = {
  href: string;
  label: string;
  icon: string;
  badge?: NavBadgeKey;
  badgeStyle?: 'live' | 'count' | 'accent';
  primary?: boolean;
};

export type NavSection = {
  title: string;
  items: NavEntry[];
};

/**
 * Each role gets its own navigation shaped around the job it actually does.
 * A farmer never sees auctions; a consumer never sees wholesale trade.
 */
export const ROLE_NAV: Record<UserRole, NavSection[]> = {
  FARMER: [
    {
      title: 'My Farm',
      items: [
        { href: '/for-you', label: 'For You', icon: 'Compass' },
        { href: '/crops', label: 'My Crops', icon: 'Sprout', primary: true },
        {
          href: '/arhti-requests',
          label: 'Arhti Requests',
          icon: 'Handshake',
          badge: 'pendingOffers',
          badgeStyle: 'count',
        },
        {
          href: '/deals',
          label: 'My Deals',
          icon: 'FileCheck',
          badge: 'activeDeals',
          badgeStyle: 'count',
        },
      ],
    },
    {
      title: 'Records',
      items: [
        { href: '/records', label: 'Payments & Records', icon: 'Receipt' },
        {
          href: '/messages',
          label: 'Messages',
          icon: 'MessageSquare',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/ai-assistant', label: 'AgriConnect AI', icon: 'Sparkles' },
        { href: '/profile', label: 'Profile', icon: 'User' },
      ],
    },
  ],

  ARHTI: [
    {
      title: 'Buying (from farmers)',
      items: [
        { href: '/for-you', label: 'For You', icon: 'Compass' },
        { href: '/sourcing', label: 'Farmer Market', icon: 'Sprout', primary: true },
        { href: '/demand', label: 'My Buy Requests', icon: 'ClipboardList' },
        {
          href: '/deals',
          label: 'Farmer Deals',
          icon: 'Handshake',
          badge: 'activeDeals',
          badgeStyle: 'count',
        },
        {
          href: '/receiving',
          label: 'Receive & Verify',
          icon: 'Scale',
          badge: 'awaitingReceipt',
          badgeStyle: 'accent',
        },
      ],
    },
    {
      title: 'Selling (in the mandi)',
      items: [
        { href: '/inventory', label: 'Mandi Inventory', icon: 'Boxes' },
        {
          href: '/auction-house',
          label: 'Auction House',
          icon: 'Gavel',
          badge: 'liveAuctions',
          badgeStyle: 'live',
        },
        { href: '/sales', label: 'Sales & Commission', icon: 'Receipt' },
      ],
    },
    {
      title: 'More',
      items: [
        {
          href: '/messages',
          label: 'Messages',
          icon: 'MessageSquare',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/insights', label: 'Trade Insights', icon: 'BarChart3' },
        { href: '/ai-assistant', label: 'AgriConnect AI', icon: 'Sparkles' },
        { href: '/profile', label: 'Profile', icon: 'User' },
      ],
    },
  ],

  VENDOR: [
    {
      title: 'Procurement',
      items: [
        { href: '/for-you', label: 'For You', icon: 'Compass' },
        {
          href: '/auctions',
          label: 'Mandi Auctions',
          icon: 'Gavel',
          badge: 'liveAuctions',
          badgeStyle: 'live',
          primary: true,
        },
        { href: '/stock', label: 'My Warehouse', icon: 'Boxes' },
      ],
    },
    {
      title: 'Wholesale Shop',
      items: [
        { href: '/wholesale-shop', label: 'My Wholesale Shop', icon: 'Store' },
        {
          href: '/sales',
          label: 'Shopkeeper Orders',
          icon: 'ClipboardList',
          badge: 'openOrders',
          badgeStyle: 'count',
        },
      ],
    },
    {
      title: 'More',
      items: [
        {
          href: '/messages',
          label: 'Messages',
          icon: 'MessageSquare',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/insights', label: 'Trade Insights', icon: 'BarChart3' },
        { href: '/ai-assistant', label: 'AgriConnect AI', icon: 'Sparkles' },
        { href: '/profile', label: 'Profile', icon: 'User' },
      ],
    },
  ],

  SHOPKEEPER: [
    {
      title: 'Buy Stock',
      items: [
        { href: '/for-you', label: 'For You', icon: 'Compass' },
        {
          href: '/wholesale',
          label: 'Wholesale Market',
          icon: 'Store',
          primary: true,
        },
        { href: '/purchases', label: 'My Purchases', icon: 'ClipboardList' },
        {
          href: '/shop-stock',
          label: 'Shop Stock',
          icon: 'Boxes',
          badge: 'lowStock',
          badgeStyle: 'accent',
        },
      ],
    },
    {
      title: 'Sell Retail',
      items: [
        { href: '/storefront', label: 'My Storefront', icon: 'ShoppingBag' },
        {
          href: '/retail-orders',
          label: 'Customer Orders',
          icon: 'PackageCheck',
          badge: 'openOrders',
          badgeStyle: 'count',
        },
      ],
    },
    {
      title: 'More',
      items: [
        {
          href: '/messages',
          label: 'Messages',
          icon: 'MessageSquare',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/insights', label: 'Shop Insights', icon: 'BarChart3' },
        { href: '/ai-assistant', label: 'AgriConnect AI', icon: 'Sparkles' },
        { href: '/profile', label: 'Profile', icon: 'User' },
      ],
    },
  ],

  CONSUMER: [
    {
      title: 'Shop',
      items: [
        { href: '/shop', label: 'Home', icon: 'Home', primary: true },
        { href: '/nearby', label: 'Nearby Shops', icon: 'MapPin' },
        {
          href: '/orders',
          label: 'My Orders',
          icon: 'PackageCheck',
          badge: 'openOrders',
          badgeStyle: 'count',
        },
        { href: '/profile', label: 'Profile', icon: 'User' },
      ],
    },
  ],

  ADMIN: [
    {
      title: 'Mandi Administration',
      items: [
        { href: '/admin', label: 'Admin Console', icon: 'ShieldAlert', primary: true },
        { href: '/admin/trace', label: 'Supply Chain Trace', icon: 'GitBranch' },
        { href: '/insights', label: 'Market Insights', icon: 'BarChart3' },
        {
          href: '/messages',
          label: 'Messages',
          icon: 'MessageSquare',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/profile', label: 'Profile', icon: 'User' },
      ],
    },
  ],
};

/** Bottom bar on mobile: up to five destinations per role. */
export const ROLE_MOBILE_NAV: Record<UserRole, NavEntry[]> = {
  FARMER: [
    { href: '/for-you', label: 'Home', icon: 'Compass' },
    { href: '/crops', label: 'Crops', icon: 'Sprout' },
    { href: '/arhti-requests', label: 'Offers', icon: 'Handshake', badge: 'pendingOffers' },
    { href: '/deals', label: 'Deals', icon: 'FileCheck' },
    { href: '/ai-assistant', label: 'AI', icon: 'Mic' },
  ],
  ARHTI: [
    { href: '/for-you', label: 'Home', icon: 'Compass' },
    { href: '/sourcing', label: 'Sourcing', icon: 'Sprout' },
    { href: '/inventory', label: 'Stock', icon: 'Boxes' },
    { href: '/auction-house', label: 'Auctions', icon: 'Gavel', badge: 'liveAuctions' },
    { href: '/ai-assistant', label: 'AI', icon: 'Mic' },
  ],
  VENDOR: [
    { href: '/for-you', label: 'Home', icon: 'Compass' },
    { href: '/auctions', label: 'Auctions', icon: 'Gavel', badge: 'liveAuctions' },
    { href: '/stock', label: 'Stock', icon: 'Boxes' },
    { href: '/wholesale-shop', label: 'Shop', icon: 'Store' },
    { href: '/ai-assistant', label: 'AI', icon: 'Mic' },
  ],
  SHOPKEEPER: [
    { href: '/for-you', label: 'Home', icon: 'Compass' },
    { href: '/wholesale', label: 'Buy', icon: 'Store' },
    { href: '/shop-stock', label: 'Stock', icon: 'Boxes' },
    { href: '/storefront', label: 'Store', icon: 'ShoppingBag' },
    { href: '/retail-orders', label: 'Orders', icon: 'PackageCheck', badge: 'openOrders' },
  ],
  CONSUMER: [
    { href: '/shop', label: 'Home', icon: 'Home' },
    { href: '/nearby', label: 'Nearby', icon: 'MapPin' },
    { href: '/orders', label: 'Orders', icon: 'PackageCheck', badge: 'openOrders' },
    { href: '/profile', label: 'Profile', icon: 'User' },
  ],
  ADMIN: [
    { href: '/admin', label: 'Console', icon: 'ShieldAlert' },
    { href: '/admin/trace', label: 'Trace', icon: 'GitBranch' },
    { href: '/insights', label: 'Insights', icon: 'BarChart3' },
    { href: '/profile', label: 'Profile', icon: 'User' },
  ],
};

export const ROLE_PRIMARY_ACTION: Partial<Record<UserRole, { href: string; label: string }>> = {
  FARMER: { href: '/crops/new', label: 'Add Crop Batch' },
  ARHTI: { href: '/demand/new', label: 'Post Buy Request' },
  VENDOR: { href: '/wholesale-shop/new', label: 'List Wholesale Offer' },
  SHOPKEEPER: { href: '/storefront/new', label: 'Add Retail Listing' },
};
