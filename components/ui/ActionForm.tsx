'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import { useI18n } from '@/components/i18n/LanguageProvider';
import Icon, { type IconName } from '@/components/ui/Icon';

export type ActionResult = { error?: string; success?: boolean } | null | undefined | void;

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  submitLabel: string;
  submitLabelUrdu?: string;
  successMessage?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'inline';
  /** Icon shown before the label. */
  icon?: IconName;
  hidden?: Record<string, string | number>;
  disabled?: boolean;
  disabledReason?: string;
};

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  danger: 'btn-danger',
  inline: 'btn-secondary btn-sm',
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
  icon,
}: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => action(formData),
    null
  );

  const { isUrdu, errorList, plural } = useI18n();
  const isInline = variant === 'inline';

  // One language at a time: the Urdu label (if given) only in Urdu mode.
  const label = isUrdu && submitLabelUrdu ? submitLabelUrdu : submitLabel;

  return (
    <form action={formAction} className={className}>
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {/* Forms with fields list what to fix at the top; a lone button shows it beside the button. */}
      {state?.error && children && (
        <FixList items={errorList(state.error)} title={plural('form.fix', errorList(state.error).length)} className="mb-4 mt-0" />
      )}
      {children}

      {state?.error && !children && <FixList items={errorList(state.error)} title={plural('form.fix', errorList(state.error).length)} />}
      {state?.success && successMessage && (
        <div role="status" className="ac-up mt-3 flex items-start gap-2 rounded-2xl bg-ok-bg p-3 text-sm font-semibold text-ok-fg">
          <Icon name="checkcircle" size={18} className="mt-0.5" />
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || disabled}
        title={disabled ? disabledReason : undefined}
        className={`btn ${isInline ? 'mt-2' : 'mt-4 w-full'} ${variants[variant]}`}
      >
        {pending ? <Icon name="refresh" size={18} className="animate-spin" /> : icon && <Icon name={icon} size={18} />}
        {label}
      </button>
    </form>
  );
}

/** "N things to fix" summary for a form, one line per problem. */
export function FixList({ items, title, className = 'mt-3' }: { items: string[]; title: string; className?: string }) {
  return (
    <div role="alert" className={`ac-shake ${className} rounded-2xl border-[1.5px] border-err-fg bg-err-bg p-3 text-err-fg`}>
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <Icon name="alert" size={18} />
        {title}
      </div>
      <ul className="mt-1.5 space-y-1 ps-7 text-sm font-semibold">
        {items.map((item, i) => (
          <li key={i} className="list-disc">
            {item}
          </li>
        ))}
      </ul>
    </div>
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
  const { isUrdu } = useI18n();
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink">{isUrdu && labelUrdu ? labelUrdu : label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass = 'field-input';
