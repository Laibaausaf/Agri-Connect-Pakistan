import { UserRole } from '@prisma/client';
import type { IconName } from '@/components/ui/Icon';

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
  icon: IconName;
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
        { href: '/for-you', label: 'For You', icon: 'compass' },
        { href: '/crops', label: 'My Crops', icon: 'sprout', primary: true },
        {
          href: '/arhti-requests',
          label: 'Arhti Requests',
          icon: 'handshake',
          badge: 'pendingOffers',
          badgeStyle: 'count',
        },
        {
          href: '/deals',
          label: 'My Deals',
          icon: 'deal',
          badge: 'activeDeals',
          badgeStyle: 'count',
        },
      ],
    },
    {
      title: 'Records',
      items: [
        { href: '/records', label: 'Payments & Records', icon: 'wallet' },
        {
          href: '/messages',
          label: 'Messages',
          icon: 'message',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/ai-assistant', label: 'AgriConnect AI', icon: 'sparkles' },
        { href: '/profile', label: 'Profile', icon: 'user' },
      ],
    },
  ],

  ARHTI: [
    {
      title: 'Buying (from farmers)',
      items: [
        { href: '/for-you', label: 'For You', icon: 'compass' },
        { href: '/sourcing', label: 'Farmer Market', icon: 'sprout', primary: true },
        { href: '/demand', label: 'My Buy Requests', icon: 'list' },
        {
          href: '/deals',
          label: 'Farmer Deals',
          icon: 'handshake',
          badge: 'activeDeals',
          badgeStyle: 'count',
        },
        {
          href: '/receiving',
          label: 'Receive & Verify',
          icon: 'scale',
          badge: 'awaitingReceipt',
          badgeStyle: 'accent',
        },
      ],
    },
    {
      title: 'Selling (in the mandi)',
      items: [
        { href: '/inventory', label: 'Mandi Inventory', icon: 'warehouse' },
        {
          href: '/auction-house',
          label: 'Auction House',
          icon: 'gavel',
          badge: 'liveAuctions',
          badgeStyle: 'live',
        },
        { href: '/sales', label: 'Sales & Commission', icon: 'banknote' },
      ],
    },
    {
      title: 'More',
      items: [
        {
          href: '/messages',
          label: 'Messages',
          icon: 'message',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/insights', label: 'Trade Insights', icon: 'chart' },
        { href: '/ai-assistant', label: 'AgriConnect AI', icon: 'sparkles' },
        { href: '/profile', label: 'Profile', icon: 'user' },
      ],
    },
  ],

  VENDOR: [
    {
      title: 'Procurement',
      items: [
        { href: '/for-you', label: 'For You', icon: 'compass' },
        {
          href: '/auctions',
          label: 'Mandi Auctions',
          icon: 'gavel',
          badge: 'liveAuctions',
          badgeStyle: 'live',
          primary: true,
        },
        { href: '/stock', label: 'My Warehouse', icon: 'warehouse' },
      ],
    },
    {
      title: 'Wholesale Shop',
      items: [
        { href: '/wholesale-shop', label: 'My Wholesale Shop', icon: 'store' },
        {
          href: '/sales',
          label: 'Shopkeeper Orders',
          icon: 'list',
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
          icon: 'message',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/insights', label: 'Trade Insights', icon: 'chart' },
        { href: '/ai-assistant', label: 'AgriConnect AI', icon: 'sparkles' },
        { href: '/profile', label: 'Profile', icon: 'user' },
      ],
    },
  ],

  SHOPKEEPER: [
    {
      title: 'Buy Stock',
      items: [
        { href: '/for-you', label: 'For You', icon: 'compass' },
        {
          href: '/wholesale',
          label: 'Wholesale Market',
          icon: 'store',
          primary: true,
        },
        { href: '/purchases', label: 'My Purchases', icon: 'receipt' },
        {
          href: '/shop-stock',
          label: 'Shop Stock',
          icon: 'package',
          badge: 'lowStock',
          badgeStyle: 'accent',
        },
      ],
    },
    {
      title: 'Sell Retail',
      items: [
        { href: '/storefront', label: 'My Storefront', icon: 'store' },
        {
          href: '/retail-orders',
          label: 'Customer Orders',
          icon: 'cart',
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
          icon: 'message',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/insights', label: 'Shop Insights', icon: 'chart' },
        { href: '/ai-assistant', label: 'AgriConnect AI', icon: 'sparkles' },
        { href: '/profile', label: 'Profile', icon: 'user' },
      ],
    },
  ],

  CONSUMER: [
    {
      title: 'Shop',
      items: [
        { href: '/shop', label: 'Home', icon: 'leaf', primary: true },
        { href: '/nearby', label: 'Nearby Shops', icon: 'pin' },
        {
          href: '/orders',
          label: 'My Orders',
          icon: 'truck',
          badge: 'openOrders',
          badgeStyle: 'count',
        },
        { href: '/profile', label: 'Profile', icon: 'user' },
      ],
    },
  ],

  ADMIN: [
    {
      title: 'Mandi Administration',
      items: [
        { href: '/admin', label: 'Admin Console', icon: 'shield', primary: true },
        { href: '/admin/trace', label: 'Supply Chain Trace', icon: 'route' },
        { href: '/insights', label: 'Market Insights', icon: 'chart' },
        {
          href: '/messages',
          label: 'Messages',
          icon: 'message',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/profile', label: 'Profile', icon: 'user' },
      ],
    },
  ],
};

/**
 * Bottom bar on phones: five tabs per role (Home, the main job, money or stock,
 * the next job, More). "More" opens a sheet with every other page of the role,
 * so each page stays one or two taps away. Consumers have four tabs.
 */
export const MORE_TAB = 'more';

export const ROLE_MOBILE_NAV: Record<UserRole, NavEntry[]> = {
  FARMER: [
    { href: '/for-you', label: 'Home', icon: 'home' },
    { href: '/crops', label: 'Crops', icon: 'sprout' },
    { href: '/arhti-requests', label: 'Offers', icon: 'handshake', badge: 'pendingOffers' },
    { href: '/deals', label: 'Deals', icon: 'deal', badge: 'activeDeals' },
    { href: MORE_TAB, label: 'More', icon: 'grid' },
  ],
  ARHTI: [
    { href: '/for-you', label: 'Home', icon: 'home' },
    { href: '/receiving', label: 'Kanta', icon: 'scale', badge: 'awaitingReceipt' },
    { href: '/inventory', label: 'Stock', icon: 'warehouse' },
    { href: '/auction-house', label: 'Auctions', icon: 'gavel', badge: 'liveAuctions', badgeStyle: 'live' },
    { href: MORE_TAB, label: 'More', icon: 'grid' },
  ],
  VENDOR: [
    { href: '/for-you', label: 'Home', icon: 'home' },
    { href: '/auctions', label: 'Auctions', icon: 'gavel', badge: 'liveAuctions', badgeStyle: 'live' },
    { href: '/stock', label: 'Warehouse', icon: 'warehouse' },
    { href: '/wholesale-shop', label: 'My shop', icon: 'store' },
    { href: MORE_TAB, label: 'More', icon: 'grid' },
  ],
  SHOPKEEPER: [
    { href: '/for-you', label: 'Home', icon: 'home' },
    { href: '/wholesale', label: 'Buy stock', icon: 'store' },
    { href: '/shop-stock', label: 'Stock', icon: 'package', badge: 'lowStock' },
    { href: '/retail-orders', label: 'Orders', icon: 'cart', badge: 'openOrders' },
    { href: MORE_TAB, label: 'More', icon: 'grid' },
  ],
  CONSUMER: [
    { href: '/shop', label: 'Shop', icon: 'leaf' },
    { href: '/nearby', label: 'Nearby', icon: 'pin' },
    { href: '/orders', label: 'Orders', icon: 'truck', badge: 'openOrders' },
    { href: '/profile', label: 'Profile', icon: 'user' },
  ],
  ADMIN: [
    { href: '/admin', label: 'Console', icon: 'shield' },
    { href: '/admin/trace', label: 'Trace', icon: 'route' },
    { href: '/insights', label: 'Prices', icon: 'chart' },
    { href: '/messages', label: 'Messages', icon: 'message', badge: 'unreadMessages' },
    { href: MORE_TAB, label: 'More', icon: 'grid' },
  ],
};

export const ROLE_PRIMARY_ACTION: Partial<Record<UserRole, { href: string; label: string }>> = {
  FARMER: { href: '/crops/new', label: 'Add Crop Batch' },
  ARHTI: { href: '/demand/new', label: 'Post Buy Request' },
  VENDOR: { href: '/wholesale-shop/new', label: 'List Wholesale Offer' },
  SHOPKEEPER: { href: '/storefront/new', label: 'Add Retail Listing' },
};
