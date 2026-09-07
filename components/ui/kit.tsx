import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  titleUrdu,
  subtitle,
  action,
}: {
  title: string;
  titleUrdu?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold text-charcoal flex items-center gap-2">
          {title}
          {titleUrdu && <span className="text-sm font-normal text-[#636E72]">{titleUrdu}</span>}
        </h1>
        {subtitle && <p className="text-xs text-[#636E72] mt-1 max-w-2xl">{subtitle}</p>}
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
    <div
      className={`bg-white border border-[#E5E7EB] rounded-2xl shadow-sm ${padded ? 'p-4' : ''} ${className}`}
    >
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
  const toneClass =
    tone === 'accent'
      ? 'text-agri-900'
      : tone === 'warn'
        ? 'text-amber-700'
        : 'text-charcoal';
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-wider text-[#636E72] font-bold">{label}</div>
      <div className={`text-xl font-bold mt-1 ${toneClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-[#636E72] mt-0.5">{hint}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'live';
}) {
  const map = {
    neutral: 'bg-[#F2F4F7] text-[#636E72] border-[#E5E7EB]',
    green: 'bg-[#E8F3EE] text-agri-900 border-[#B7D4C8]',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    live: 'bg-agri-900 text-white border-agri-900 animate-pulse',
  };
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide ${map[tone]}`}
    >
      {children}
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
    <div className="bg-white border border-dashed border-[#E5E7EB] rounded-2xl p-8 text-center">
      <div className="text-sm font-semibold text-charcoal">{title}</div>
      <p className="text-xs text-[#636E72] mt-1.5 max-w-md mx-auto">{message}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="inline-flex mt-4 bg-agri-900 hover:bg-agri-800 text-white text-xs font-semibold px-4 py-2 rounded-xl"
        >
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
        className={`${dim} rounded-xl object-cover border border-[#E5E7EB] shrink-0 bg-[#F8F9F5]`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-xl bg-[#F8F9F5] border border-[#E5E7EB] flex items-center justify-center shrink-0`}
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
