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
  labelUrdu: string;
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
        { href: '/for-you', label: 'For You', labelUrdu: 'آپ کے لیے', icon: 'Compass' },
        { href: '/crops', label: 'My Crops', labelUrdu: 'میری فصلیں', icon: 'Sprout', primary: true },
        {
          href: '/arhti-requests',
          label: 'Arhti Requests',
          labelUrdu: 'آڑھتی کی طلب',
          icon: 'Handshake',
          badge: 'pendingOffers',
          badgeStyle: 'count',
        },
        {
          href: '/deals',
          label: 'My Deals',
          labelUrdu: 'میرے سودے',
          icon: 'FileCheck',
          badge: 'activeDeals',
          badgeStyle: 'count',
        },
      ],
    },
    {
      title: 'Records',
      items: [
        { href: '/records', label: 'Payments & Records', labelUrdu: 'حساب کتاب', icon: 'Receipt' },
        {
          href: '/messages',
          label: 'Messages',
          labelUrdu: 'پیغامات',
          icon: 'MessageSquare',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/ai-assistant', label: 'AgriConnect AI', labelUrdu: 'اے آئی مددگار', icon: 'Sparkles' },
        { href: '/profile', label: 'Profile', labelUrdu: 'پروفائل', icon: 'User' },
      ],
    },
  ],

  ARHTI: [
    {
      title: 'Buying (from farmers)',
      items: [
        { href: '/for-you', label: 'For You', labelUrdu: 'آپ کے لیے', icon: 'Compass' },
        { href: '/sourcing', label: 'Farmer Market', labelUrdu: 'کسان منڈی', icon: 'Sprout', primary: true },
        { href: '/demand', label: 'My Buy Requests', labelUrdu: 'خریداری کی طلب', icon: 'ClipboardList' },
        {
          href: '/deals',
          label: 'Farmer Deals',
          labelUrdu: 'کسان سودے',
          icon: 'Handshake',
          badge: 'activeDeals',
          badgeStyle: 'count',
        },
        {
          href: '/receiving',
          label: 'Receive & Verify',
          labelUrdu: 'وزن کانٹا',
          icon: 'Scale',
          badge: 'awaitingReceipt',
          badgeStyle: 'accent',
        },
      ],
    },
    {
      title: 'Selling (in the mandi)',
      items: [
        { href: '/inventory', label: 'Mandi Inventory', labelUrdu: 'گودام', icon: 'Boxes' },
        {
          href: '/auction-house',
          label: 'Auction House',
          labelUrdu: 'نیلام گھر',
          icon: 'Gavel',
          badge: 'liveAuctions',
          badgeStyle: 'live',
        },
        { href: '/sales', label: 'Sales & Commission', labelUrdu: 'فروخت', icon: 'Receipt' },
      ],
    },
    {
      title: 'More',
      items: [
        {
          href: '/messages',
          label: 'Messages',
          labelUrdu: 'پیغامات',
          icon: 'MessageSquare',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/insights', label: 'Trade Insights', labelUrdu: 'رپورٹ', icon: 'BarChart3' },
        { href: '/ai-assistant', label: 'AgriConnect AI', labelUrdu: 'اے آئی مددگار', icon: 'Sparkles' },
        { href: '/profile', label: 'Profile', labelUrdu: 'پروفائل', icon: 'User' },
      ],
    },
  ],

  VENDOR: [
    {
      title: 'Procurement',
      items: [
        { href: '/for-you', label: 'For You', labelUrdu: 'آپ کے لیے', icon: 'Compass' },
        {
          href: '/auctions',
          label: 'Mandi Auctions',
          labelUrdu: 'منڈی نیلام',
          icon: 'Gavel',
          badge: 'liveAuctions',
          badgeStyle: 'live',
          primary: true,
        },
        { href: '/stock', label: 'My Warehouse', labelUrdu: 'گودام', icon: 'Boxes' },
      ],
    },
    {
      title: 'Wholesale Shop',
      items: [
        { href: '/wholesale-shop', label: 'My Wholesale Shop', labelUrdu: 'تھوک دکان', icon: 'Store' },
        {
          href: '/sales',
          label: 'Shopkeeper Orders',
          labelUrdu: 'دکاندار آرڈرز',
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
          labelUrdu: 'پیغامات',
          icon: 'MessageSquare',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/insights', label: 'Trade Insights', labelUrdu: 'رپورٹ', icon: 'BarChart3' },
        { href: '/ai-assistant', label: 'AgriConnect AI', labelUrdu: 'اے آئی مددگار', icon: 'Sparkles' },
        { href: '/profile', label: 'Profile', labelUrdu: 'پروفائل', icon: 'User' },
      ],
    },
  ],

  SHOPKEEPER: [
    {
      title: 'Buy Stock',
      items: [
        { href: '/for-you', label: 'For You', labelUrdu: 'آپ کے لیے', icon: 'Compass' },
        {
          href: '/wholesale',
          label: 'Wholesale Market',
          labelUrdu: 'تھوک مارکیٹ',
          icon: 'Store',
          primary: true,
        },
        { href: '/purchases', label: 'My Purchases', labelUrdu: 'خریداری', icon: 'ClipboardList' },
        {
          href: '/shop-stock',
          label: 'Shop Stock',
          labelUrdu: 'دکان کا اسٹاک',
          icon: 'Boxes',
          badge: 'lowStock',
          badgeStyle: 'accent',
        },
      ],
    },
    {
      title: 'Sell Retail',
      items: [
        { href: '/storefront', label: 'My Storefront', labelUrdu: 'میری دکان', icon: 'ShoppingBag' },
        {
          href: '/retail-orders',
          label: 'Customer Orders',
          labelUrdu: 'گاہک آرڈرز',
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
          labelUrdu: 'پیغامات',
          icon: 'MessageSquare',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/insights', label: 'Shop Insights', labelUrdu: 'رپورٹ', icon: 'BarChart3' },
        { href: '/ai-assistant', label: 'AgriConnect AI', labelUrdu: 'اے آئی مددگار', icon: 'Sparkles' },
        { href: '/profile', label: 'Profile', labelUrdu: 'پروفائل', icon: 'User' },
      ],
    },
  ],

  CONSUMER: [
    {
      title: 'Shop',
      items: [
        { href: '/shop', label: 'Home', labelUrdu: 'ہوم', icon: 'Home', primary: true },
        { href: '/nearby', label: 'Nearby Shops', labelUrdu: 'قریبی دکانیں', icon: 'MapPin' },
        {
          href: '/orders',
          label: 'My Orders',
          labelUrdu: 'میرے آرڈرز',
          icon: 'PackageCheck',
          badge: 'openOrders',
          badgeStyle: 'count',
        },
        { href: '/profile', label: 'Profile', labelUrdu: 'پروفائل', icon: 'User' },
      ],
    },
  ],

  ADMIN: [
    {
      title: 'Mandi Administration',
      items: [
        { href: '/admin', label: 'Admin Console', labelUrdu: 'ایڈمن پینل', icon: 'ShieldAlert', primary: true },
        { href: '/admin/trace', label: 'Supply Chain Trace', labelUrdu: 'سپلائی چین', icon: 'GitBranch' },
        { href: '/insights', label: 'Market Insights', labelUrdu: 'رپورٹ', icon: 'BarChart3' },
        {
          href: '/messages',
          label: 'Messages',
          labelUrdu: 'پیغامات',
          icon: 'MessageSquare',
          badge: 'unreadMessages',
          badgeStyle: 'count',
        },
        { href: '/profile', label: 'Profile', labelUrdu: 'پروفائل', icon: 'User' },
      ],
    },
  ],
};

/** Bottom bar on mobile: up to five destinations per role. */
export const ROLE_MOBILE_NAV: Record<UserRole, NavEntry[]> = {
  FARMER: [
    { href: '/for-you', label: 'Home', labelUrdu: 'ہوم', icon: 'Compass' },
    { href: '/crops', label: 'Crops', labelUrdu: 'فصلیں', icon: 'Sprout' },
    { href: '/arhti-requests', label: 'Offers', labelUrdu: 'آفرز', icon: 'Handshake', badge: 'pendingOffers' },
    { href: '/deals', label: 'Deals', labelUrdu: 'سودے', icon: 'FileCheck' },
    { href: '/ai-assistant', label: 'AI', labelUrdu: 'اے آئی', icon: 'Mic' },
  ],
  ARHTI: [
    { href: '/for-you', label: 'Home', labelUrdu: 'ہوم', icon: 'Compass' },
    { href: '/sourcing', label: 'Sourcing', labelUrdu: 'خریداری', icon: 'Sprout' },
    { href: '/inventory', label: 'Stock', labelUrdu: 'گودام', icon: 'Boxes' },
    { href: '/auction-house', label: 'Auctions', labelUrdu: 'نیلام', icon: 'Gavel', badge: 'liveAuctions' },
    { href: '/ai-assistant', label: 'AI', labelUrdu: 'اے آئی', icon: 'Mic' },
  ],
  VENDOR: [
    { href: '/for-you', label: 'Home', labelUrdu: 'ہوم', icon: 'Compass' },
    { href: '/auctions', label: 'Auctions', labelUrdu: 'نیلام', icon: 'Gavel', badge: 'liveAuctions' },
    { href: '/stock', label: 'Stock', labelUrdu: 'گودام', icon: 'Boxes' },
    { href: '/wholesale-shop', label: 'Shop', labelUrdu: 'دکان', icon: 'Store' },
    { href: '/ai-assistant', label: 'AI', labelUrdu: 'اے آئی', icon: 'Mic' },
  ],
  SHOPKEEPER: [
    { href: '/for-you', label: 'Home', labelUrdu: 'ہوم', icon: 'Compass' },
    { href: '/wholesale', label: 'Buy', labelUrdu: 'خریدیں', icon: 'Store' },
    { href: '/shop-stock', label: 'Stock', labelUrdu: 'اسٹاک', icon: 'Boxes' },
    { href: '/storefront', label: 'Store', labelUrdu: 'دکان', icon: 'ShoppingBag' },
    { href: '/retail-orders', label: 'Orders', labelUrdu: 'آرڈرز', icon: 'PackageCheck', badge: 'openOrders' },
  ],
  CONSUMER: [
    { href: '/shop', label: 'Home', labelUrdu: 'ہوم', icon: 'Home' },
    { href: '/nearby', label: 'Nearby', labelUrdu: 'قریب', icon: 'MapPin' },
    { href: '/orders', label: 'Orders', labelUrdu: 'آرڈرز', icon: 'PackageCheck', badge: 'openOrders' },
    { href: '/profile', label: 'Profile', labelUrdu: 'پروفائل', icon: 'User' },
  ],
  ADMIN: [
    { href: '/admin', label: 'Console', labelUrdu: 'پینل', icon: 'ShieldAlert' },
    { href: '/admin/trace', label: 'Trace', labelUrdu: 'ٹریس', icon: 'GitBranch' },
    { href: '/insights', label: 'Insights', labelUrdu: 'رپورٹ', icon: 'BarChart3' },
    { href: '/profile', label: 'Profile', labelUrdu: 'پروفائل', icon: 'User' },
  ],
};

export const ROLE_PRIMARY_ACTION: Partial<Record<UserRole, { href: string; label: string; labelUrdu: string }>> = {
  FARMER: { href: '/crops/new', label: 'Add Crop Batch', labelUrdu: 'فصل شامل کریں' },
  ARHTI: { href: '/demand/new', label: 'Post Buy Request', labelUrdu: 'طلب لگائیں' },
  VENDOR: { href: '/wholesale-shop/new', label: 'List Wholesale Offer', labelUrdu: 'آفر لگائیں' },
  SHOPKEEPER: { href: '/storefront/new', label: 'Add Retail Listing', labelUrdu: 'ریٹیل لسٹنگ' },
};
