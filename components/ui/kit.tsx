import Link from 'next/link';
import type { ReactNode } from 'react';
import Icon, { type IconName } from '@/components/ui/Icon';

/**
 * Page title. `title` is already in the chosen language; `titleUrdu` is no
 * longer shown next to it (the language toggle decides which one appears).
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  titleUrdu?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display h-page font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={`card ${padded ? 'p-4 sm:p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'accent' | 'warn';
}) {
  const toneClass = tone === 'accent' ? 'text-goldtext' : tone === 'warn' ? 'text-warn-fg' : 'text-ink';
  return (
    <div className="rounded-2xl bg-sage p-4">
      <div className="text-[12.5px] font-bold text-muted">{label}</div>
      <div className={`tabular mt-1 text-[22px] font-extrabold leading-tight ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const BADGE_TONES = {
  neutral: { className: 'bg-sage text-ink', icon: null },
  green: { className: 'bg-ok-bg text-ok-fg', icon: 'checkcircle' },
  amber: { className: 'bg-warn-bg text-warn-fg', icon: 'clock' },
  red: { className: 'bg-err-bg text-err-fg', icon: 'alert' },
  info: { className: 'bg-info-bg text-info-fg', icon: 'info' },
  live: { className: 'bg-gold text-ongold', icon: null },
} satisfies Record<string, { className: string; icon: IconName | null }>;

/** Status is never shown by colour alone: colour + icon + word. */
export function Badge({
  children,
  tone = 'neutral',
  icon,
  big = false,
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
  icon?: IconName;
  big?: boolean;
}) {
  const style = BADGE_TONES[tone];
  const iconName = icon ?? style.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-bold leading-none ${
        big ? 'h-[34px] px-3 text-sm' : 'h-7 px-2.5 text-[12.5px]'
      } ${style.className}`}
    >
      {tone === 'live' && <span className="ac-pulse h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      {iconName && <Icon name={iconName} size={big ? 17 : 15} stroke={2.4} />}
      <span>{children}</span>
    </span>
  );
}

export function EmptyState({
  title,
  message,
  actionHref,
  actionLabel,
}: {
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-card border-[1.5px] border-dashed border-line bg-sf px-6 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage text-forest">
        <Icon name="sprout" size={28} />
      </span>
      <div className="mt-4 font-display h-card font-semibold text-ink">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{message}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn btn-secondary mt-5">
          <Icon name="arrowright" size={18} />
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function CropThumb({
  imageUrl,
  name,
  size = 'md',
}: {
  imageUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dim = size === 'sm' ? 'w-10 h-10 text-lg' : size === 'lg' ? 'w-20 h-20 text-3xl' : 'w-14 h-14 text-2xl';
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={`${dim} shrink-0 rounded-xl border border-line bg-sage object-cover`}
      />
    );
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-xl border border-line bg-sage`}
    >
      {cropEmoji(name)}
    </div>
  );
}

export function cropEmoji(name: string) {
  const n = name.toLowerCase();
  if (n.includes('tomato')) return '🍅';
  if (n.includes('potato')) return '🥔';
  if (n.includes('onion')) return '🧅';
  if (n.includes('mango')) return '🥭';
  if (n.includes('wheat')) return '🌾';
  if (n.includes('chilli') || n.includes('chili')) return '🌶️';
  return '🌱';
}

export function money(n: number) {
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`;
}

export function qty(n: number) {
  return `${n.toLocaleString('en-PK', { maximumFractionDigits: 1 })} kg`;
}

export function statusTone(status: string): 'neutral' | 'green' | 'amber' | 'red' {
  const s = status.toUpperCase();
  if (['COMPLETED', 'PAID', 'DELIVERED', 'SOLD', 'ACTIVE', 'IN_STOCK', 'READY_FOR_SALE', 'ACCEPTED'].includes(s))
    return 'green';
  if (['CANCELLED', 'REJECTED', 'DISPUTED', 'EXPIRED', 'SOLD_OUT', 'SUSPENDED'].includes(s)) return 'red';
  if (['PENDING', 'PENDING_PAYMENT', 'PAYMENT_PENDING', 'LOW_STOCK', 'NEGOTIATING', 'IN_TRANSIT'].includes(s))
    return 'amber';
  return 'neutral';
}

export function humanStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
