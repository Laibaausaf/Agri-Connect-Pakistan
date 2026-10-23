import { StatCard } from '@/components/ui/kit';
import type { ArhtiEarnings as Earnings } from '@/lib/earnings';
import type { I18n } from '@/lib/i18n';

/**
 * The arhti's earnings, split by who pays: farmers (commission on paid
 * settlements), vendors (commission paid on top of the auction price) and the
 * arhti's own trading margin. The total is the sum of the three.
 */
export default function ArhtiEarnings({ earnings, i18n }: { earnings: Earnings; i18n: I18n }) {
  const { t, money, kg } = i18n;
  // Shown in whole rupees; the total is the sum of the rounded parts so the
  // figures on screen always add up.
  const farmers = Math.round(earnings.farmerCommission);
  const vendors = Math.round(earnings.vendorCommission);
  const margin = Math.round(earnings.tradingMargin);
  return (
    <div className="mb-4">
      <h2 className="text-xs font-bold text-charcoal mb-2">{t('earn.title')}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={t('earn.fromFarmers')}
          value={money(farmers)}
          hint={t('earn.fromFarmersHint', { count: earnings.paidSettlements })}
        />
        <StatCard
          label={t('earn.fromVendors')}
          value={money(vendors)}
          hint={t('earn.fromVendorsHint', { count: earnings.salesCount })}
        />
        <StatCard
          label={t('earn.margin')}
          value={money(margin)}
          hint={t('earn.marginHint', { qty: kg(earnings.soldKg) })}
        />
        <StatCard label={t('earn.total')} value={money(farmers + vendors + margin)} hint={t('earn.totalHint')} tone="accent" />
      </div>
      {earnings.pendingSettlements > 0 && (
        <p className="text-[11px] text-[#636E72] mt-2">
          {t('earn.pending', { amount: money(earnings.farmerCommissionPending), count: earnings.pendingSettlements })}
        </p>
      )}
    </div>
  );
}
