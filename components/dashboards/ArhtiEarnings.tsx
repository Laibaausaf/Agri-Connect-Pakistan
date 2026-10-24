import type { ArhtiEarnings as Earnings } from '@/lib/earnings';
import type { I18n } from '@/lib/i18n';
import BrandGlow from '@/components/ui/BrandGlow';

/**
 * The arhti's earnings, split by who pays: farmers (commission on paid
 * settlements), vendors (commission paid on top of the auction price) and the
 * arhti's own trading margin. The total is the sum of the three.
 */
export default function ArhtiEarnings({ earnings, i18n, footer }: { earnings: Earnings; i18n: I18n; footer?: React.ReactNode }) {
  const { t, money, kg } = i18n;
  // Shown in whole rupees; the total is the sum of the rounded parts so the
  // figures on screen always add up.
  const farmers = Math.round(earnings.farmerCommission);
  const vendors = Math.round(earnings.vendorCommission);
  const margin = Math.round(earnings.tradingMargin);
  const total = farmers + vendors + margin;
  const parts = [
    { label: t('earn.fromFarmers'), hint: t('earn.fromFarmersHint', { count: earnings.paidSettlements }), value: farmers, dot: 'bg-gold' },
    { label: t('earn.fromVendors'), hint: t('earn.fromVendorsHint', { count: earnings.salesCount }), value: vendors, dot: 'bg-[#9FD8B1]' },
    { label: t('earn.margin'), hint: t('earn.marginHint', { qty: kg(earnings.soldKg) }), value: margin, dot: 'bg-white' },
  ];
  return (
    <section className="relative overflow-hidden rounded-hero bg-brand p-5 text-white sm:p-6">
      <BrandGlow />
      <div className="relative grid gap-5 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <h2 className="text-[15px] font-bold text-[#D6E6D9]">{t('earn.title')}</h2>
          <div className="tabular mt-1 text-[40px] font-extrabold leading-tight text-[#F6C871]">{money(total)}</div>
          <div className="text-[12.5px] text-[#D6E6D9]">
            {t('earn.total')} · {t('earn.totalHint')}
          </div>
          {/* How the total splits between the three sources */}
          <div className="mt-3 flex h-2 gap-1 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
            {total > 0 &&
              parts.map((part) =>
                part.value > 0 ? <span key={part.label} className={`h-full rounded-full ${part.dot}`} style={{ flexGrow: part.value }} /> : null
              )}
          </div>
        </div>
        <ul className="space-y-3">
          {parts.map((part) => (
            <li key={part.label} className="flex items-start gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm ${part.dot}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-snug">{part.label}</span>
                <span className="block text-[12.5px] text-[#D6E6D9]">{part.hint}</span>
              </span>
              <span className="tabular shrink-0 text-[17px] font-extrabold">{money(part.value)}</span>
            </li>
          ))}
        </ul>
      </div>
      {earnings.pendingSettlements > 0 && (
        <p className="relative mt-4 border-t border-white/15 pt-3 text-[13px] text-[#D6E6D9]">
          {t('earn.pending', { amount: money(earnings.farmerCommissionPending), count: earnings.pendingSettlements })}
        </p>
      )}
      {footer && <div className="relative mt-3">{footer}</div>}
    </section>
  );
}
