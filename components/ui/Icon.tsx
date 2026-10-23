// The design's icon set: one 24px stroke family, 2px lines, rounded ends.
// Generated from the redesign's components/Icon.html; edit paths there, not here.
import type { ReactNode } from 'react';

const ICONS: Record<string, { body: ReactNode; filled?: boolean }> = {
  home: { body: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></> },
  sprout: { body: <><path d="M12 21v-9" /><path d="M12 12C12 8 9 5 4 5c0 4 3 7 8 7Z" /><path d="M12 14c0-4 3-7 8-7 0 4-3 7-8 7Z" /></> },
  handshake: { body: <><path d="m11 17 2 2a1.5 1.5 0 0 0 2-2" /><path d="m14 14 2.5 2.5a1.5 1.5 0 0 0 2-2l-3.9-3.9a2.8 2.8 0 0 0-4 0l-.9.9a1.5 1.5 0 0 1-2-2l2.8-2.8a3.9 3.9 0 0 1 4.8-.6l.5.3a3 3 0 0 0 2.1.4L21 6" /><path d="m21 3 1 11h-2" /><path d="M3 3 2 14l6.5 6.5a1.5 1.5 0 0 0 2-2" /><path d="M3 4h8" /></> },
  deal: { body: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="m9 13 2 2 4-4" /></> },
  list: { body: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h6M9 18h3" /></> },
  wallet: { body: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M16 15h2" /><path d="M6 6V5a1 1 0 0 1 1-1h10" /></> },
  banknote: { body: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></> },
  message: { body: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.9A8 8 0 1 1 21 12Z" /></> },
  sparkles: { body: <><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8Z" /><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8Z" /></> },
  user: { body: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
  users: { body: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 20a7 7 0 0 0-3-5.7" /></> },
  bell: { body: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></> },
  mic: { body: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></> },
  sun: { body: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> },
  moon: { body: <><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></> },
  globe: { body: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" /></> },
  pin: { body: <><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></> },
  plus: { body: <><path d="M12 5v14M5 12h14" /></> },
  minus: { body: <><path d="M5 12h14" /></> },
  pluscircle: { body: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></> },
  arrowright: { body: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></> },
  arrowleft: { body: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></> },
  chevrondown: { body: <><path d="m6 9 6 6 6-6" /></> },
  chevronup: { body: <><path d="m6 15 6-6 6 6" /></> },
  chevronright: { body: <><path d="m9 6 6 6-6 6" /></> },
  check: { body: <><path d="m5 12 5 5L20 7" /></> },
  checkcircle: { body: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></> },
  clock: { body: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  alert: { body: <><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></> },
  info: { body: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></> },
  xcircle: { body: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></> },
  x: { body: <><path d="M6 6l12 12M18 6 6 18" /></> },
  truck: { body: <><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></> },
  scale: { body: <><path d="M12 3v18" /><path d="M7 21h10" /><path d="M5 7h14" /><path d="m5 7-3 7a3 3 0 0 0 6 0Z" /><path d="m19 7-3 7a3 3 0 0 0 6 0Z" /></> },
  gavel: { body: <><path d="m14 13-8.5 8.5a2.1 2.1 0 0 1-3-3L11 10" /><path d="m16 16 6-6" /><path d="m8 8 6-6" /><path d="m9 7 8 8" /><path d="m21 11-8-8" /></> },
  warehouse: { body: <><path d="M3 21V8l9-5 9 5v13" /><path d="M7 21v-8h10v8" /><path d="M7 17h10" /></> },
  store: { body: <><path d="M4 10v10h16V10" /><path d="M3 4h18l-1.5 6a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0Z" /><path d="M10 20v-5h4v5" /></> },
  cart: { body: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6" /></> },
  package: { body: <><path d="M21 8 12 3 3 8v8l9 5 9-5Z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" /></> },
  receipt: { body: <><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21Z" /><path d="M9 8h6M9 12h6M9 16h4" /></> },
  chart: { body: <><path d="M3 3v18h18" /><path d="M8 17v-5M13 17V8M18 17v-9" /></> },
  route: { body: <><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5" /></> },
  shield: { body: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" /></> },
  camera: { body: <><path d="M4 8h3l2-3h6l2 3h3v12H4Z" /><circle cx="12" cy="13.5" r="3.5" /></> },
  image: { body: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></> },
  calendar: { body: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  send: { body: <><path d="M21 3 10 14" /><path d="M21 3 14 21l-4-7-7-4Z" /></> },
  search: { body: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></> },
  logout: { body: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></> },
  menu: { body: <><path d="M4 7h16M4 12h16M4 17h16" /></> },
  grid: { body: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></> },
  trendup: { body: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></> },
  trenddown: { body: <><path d="m3 7 6 6 4-4 8 8" /><path d="M15 17h6v-6" /></> },
  phone: { body: <><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2" /></> },
  star: { body: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z" /></> },
  tag: { body: <><path d="M3 12V4h8l10 10-8 8Z" /><circle cx="7.5" cy="8.5" r="1.5" /></> },
  refresh: { body: <><path d="M20 11a8 8 0 0 0-14.6-4.5L3 9" /><path d="M3 4v5h5" /><path d="M4 13a8 8 0 0 0 14.6 4.5L21 15" /><path d="M21 20v-5h-5" /></> },
  pause: { body: <><path d="M8 5v14M16 5v14" /></> },
  play: { body: <><path d="M7 4v16l13-8Z" /></> },
  eye: { body: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> },
  lock: { body: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> },
  mail: { body: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></> },
  archive: { body: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v11h14V9" /><path d="M10 13h4" /></> },
  upload: { body: <><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M4 15v5h16v-5" /></> },
  live: { body: <><circle cx="12" cy="12" r="2" /><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></> },
  compass: { body: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></> },
  speaker: { body: <><path d="M4 9h4l5-4v14l-5-4H4Z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></> },
  edit: { body: <><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></> },
  leaf: { body: <><path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15Z" /><path d="M5 19 13 11" /></> },
  flag: { body: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></> },
  building: { body: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /><path d="M10 21v-3h4v3" /></> },
  dot: { filled: true, body: <><circle cx="12" cy="12" r="5" fill="currentColor" /></> },
};

export type IconName = 'home' | 'sprout' | 'handshake' | 'deal' | 'list' | 'wallet' | 'banknote' | 'message' | 'sparkles' | 'user' | 'users' | 'bell' | 'mic' | 'sun' | 'moon' | 'globe' | 'pin' | 'plus' | 'minus' | 'pluscircle' | 'arrowright' | 'arrowleft' | 'chevrondown' | 'chevronup' | 'chevronright' | 'check' | 'checkcircle' | 'clock' | 'alert' | 'info' | 'xcircle' | 'x' | 'truck' | 'scale' | 'gavel' | 'warehouse' | 'store' | 'cart' | 'package' | 'receipt' | 'chart' | 'route' | 'shield' | 'camera' | 'image' | 'calendar' | 'send' | 'search' | 'logout' | 'menu' | 'grid' | 'trendup' | 'trenddown' | 'phone' | 'star' | 'tag' | 'refresh' | 'pause' | 'play' | 'eye' | 'lock' | 'mail' | 'archive' | 'upload' | 'live' | 'compass' | 'speaker' | 'edit' | 'leaf' | 'flag' | 'building' | 'dot';

/** Icons that point a direction and so mirror in right-to-left (Urdu) layouts. */
const DIRECTIONAL = new Set<IconName>(['arrowright', 'arrowleft', 'chevronright', 'send', 'logout', 'trendup', 'trenddown', 'truck', 'play']);

export default function Icon({
  name,
  size = 20,
  stroke = 2,
  className = '',
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const icon = ICONS[name] ?? ICONS.dot;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={icon.filled ? undefined : 'none'}
      stroke={icon.filled ? undefined : 'currentColor'}
      strokeWidth={icon.filled ? undefined : stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${DIRECTIONAL.has(name) ? 'rtl:-scale-x-100' : ''} ${className}`}
    >
      {icon.body}
    </svg>
  );
}
