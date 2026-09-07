'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export type ActionResult = { error?: string; success?: boolean } | null | undefined | void;

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  submitLabel: string;
  submitLabelUrdu?: string;
  successMessage?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'inline';
  hidden?: Record<string, string | number>;
  disabled?: boolean;
  disabledReason?: string;
};

const variants = {
  primary: 'bg-agri-900 hover:bg-agri-800 text-white',
  secondary: 'bg-[#F2F4F7] hover:bg-[#E5E7EB] text-charcoal border border-[#E5E7EB]',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  inline: 'bg-agri-900 hover:bg-agri-800 text-white',
};

/**
 * Shared wrapper so every server action gets consistent pending, error and
 * success feedback without repeating useActionState plumbing in each page.
 */
export default function ActionForm({
  action,
  children,
  submitLabel,
  submitLabelUrdu,
  successMessage,
  className = '',
  variant = 'primary',
  hidden,
  disabled,
  disabledReason,
}: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => action(formData),
    null
  );

  const isInline = variant === 'inline';

  return (
    <form action={formAction} className={className}>
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {children}

      {state?.error && (
        <div className="mt-3 p-2.5 rounded-lg bg-red-50 text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {state.error}
        </div>
      )}
      {state?.success && successMessage && (
        <div className="mt-3 p-2.5 rounded-lg bg-[#E8F3EE] text-agri-900 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || disabled}
        title={disabled ? disabledReason : undefined}
        className={`${isInline ? 'mt-2 px-3 py-1.5 text-[11px]' : 'mt-4 w-full py-2.5 text-xs'} ${
          variants[variant]
        } font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {submitLabel}
        {submitLabelUrdu && <span className="font-normal opacity-80">({submitLabelUrdu})</span>}
      </button>
    </form>
  );
}

export function Field({
  label,
  labelUrdu,
  children,
  hint,
}: {
  label: string;
  labelUrdu?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-charcoal mb-1">
        {label}
        {labelUrdu && <span className="font-normal text-[#636E72] ml-1">{labelUrdu}</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-[#636E72] mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-agri-700 bg-white';
