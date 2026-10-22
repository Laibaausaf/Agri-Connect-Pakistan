import Link from 'next/link';
import { PaymentStatus, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { getI18n } from '@/lib/i18n/server';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

type ParcheeData = {
  dealNumber?: string;
  crop?: string;
  arhti?: string;
  mandi?: string;
  quantityKg?: number;
  ratePerKg?: number;
  grossAmount?: number;
  deductions?: number;
  netPayable?: number;
  issuedAt?: string;
};

function parchee(data: unknown): ParcheeData {
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as ParcheeData;
  return {};
}

export default async function RecordsPage() {
  const user = await requireCapability('farmer.records.view');
  const { t, crop, place, kg, perKg, money, date, deduction, paymentMethod } = await getI18n();

  const [settlements, payments] = await Promise.all([
    prisma.settlement.findMany({
      where: { farmerId: user.id },
      include: {
        deductions: true,
        deal: {
          select: {
            id: true,
            dealNumber: true,
            batchId: true,
            agreedPricePerKg: true,
            receivedQuantityKg: true,
            agreedQuantityKg: true,
            receivedAt: true,
            crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
            arhti: { select: { name: true } },
            destinationMandi: { select: { name: true, city: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.paymentRecord.findMany({
      where: { recipientId: user.id, transactionType: TransactionType.FARMER_ARHTI },
      select: { transactionId: true, status: true, paidAt: true, reference: true, method: true },
    }),
  ]);

  const paymentByDeal = new Map(payments.map((p) => [p.transactionId, p]));

  const dealIds = settlements.map((s) => s.dealId);
  const receipts = dealIds.length
    ? await prisma.receipt.findMany({
        where: {
          transactionType: TransactionType.FARMER_ARHTI,
          transactionId: { in: dealIds },
        },
        select: { id: true, receiptNumber: true, transactionId: true, data: true, issuedAt: true },
      })
    : [];
  const receiptByDeal = new Map(receipts.map((r) => [r.transactionId, r]));

  const paid = settlements.filter((s) => paymentByDeal.get(s.dealId)?.status === PaymentStatus.PAID);
  const pending = settlements.filter(
    (s) => paymentByDeal.get(s.dealId)?.status !== PaymentStatus.PAID
  );

  const earned = paid.reduce((sum, s) => sum + s.netPayable, 0);
  const awaited = pending.reduce((sum, s) => sum + s.netPayable, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title={t('records.title')} subtitle={t('records.subtitle')} />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label={t('records.received')} value={money(earned)} tone="accent" />
        <StatCard label={t('records.awaiting')} value={money(awaited)} tone={awaited > 0 ? 'warn' : 'default'} />
      </div>

      {settlements.length === 0 ? (
        <EmptyState
          title={t('records.emptyTitle')}
          message={t('records.emptyMessage')}
          actionHref="/deals"
          actionLabel={t('records.emptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {settlements.map((settlement) => {
            const deal = settlement.deal;
            const payment = paymentByDeal.get(settlement.dealId);
            const receipt = receiptByDeal.get(settlement.dealId);
            const isPaid = payment?.status === PaymentStatus.PAID;
            const slip = parchee(receipt?.data);
            const quantity = deal.receivedQuantityKg ?? deal.agreedQuantityKg;

            return (
              <Card key={settlement.id}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{crop(deal.crop)}</span>
                      <Badge tone={isPaid ? 'green' : 'amber'}>
                        {isPaid ? t('records.paid') : t('records.awaitingBadge')}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {t('records.line', {
                        qty: kg(quantity),
                        rate: perKg(deal.agreedPricePerKg),
                        name: deal.arhti.name,
                        city: place(deal.destinationMandi.city),
                      })}
                    </div>
                    <div className="text-[10px] text-[#636E72] font-mono mt-0.5">
                      {deal.dealNumber}
                      {receipt && ` · ${receipt.receiptNumber}`}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-[10px] text-[#636E72]">{t('records.netPayable')}</div>
                    <div className="text-base font-bold text-agri-900">
                      {money(settlement.netPayable)}
                    </div>
                    {isPaid && payment?.paidAt && (
                      <div className="text-[10px] text-[#636E72]">
                        {paymentMethod(payment.method)} ·{' '}
                        {date(payment.paidAt, { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </div>
                </div>

                <details className="mt-3 border-t border-[#E5E7EB] pt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-agri-900">{t('records.breakdown')}</summary>
                <dl className="mt-3 text-sm space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-[#636E72]">{t('records.gross')}</dt>
                    <dd className="font-semibold text-charcoal">{money(settlement.grossAmount)}</dd>
                  </div>
                  {settlement.deductions.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <dt className="text-[#636E72]">{deduction(item.type, item.description)}</dt>
                      <dd className="text-red-700">− {money(item.amount)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#E5E7EB] pt-1.5">
                    <dt className="font-bold text-charcoal">{t('records.net')}</dt>
                    <dd className="font-bold text-agri-900">{money(settlement.netPayable)}</dd>
                  </div>
                </dl>
                </details>

                <div className="mt-3 flex items-center gap-3">
                  <Link
                    href={`/deals/${deal.id}`}
                    className="text-[11px] font-semibold text-agri-900 hover:underline"
                  >
                    {t('records.openDeal')}
                  </Link>
                  {payment?.reference && isPaid && (
                    <span className="text-[10px] text-[#636E72] font-mono">
                      {payment.reference}
                    </span>
                  )}
                  {slip.issuedAt && (
                    <span className="text-[10px] text-[#636E72]">
                      {t('records.parcheeIssued', { date: date(slip.issuedAt, { day: 'numeric', month: 'short' }) })}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
