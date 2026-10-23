import Link from 'next/link';
import { PaymentStatus, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { getI18n } from '@/lib/i18n/server';
import { Badge, CropThumb, EmptyState, PageHeader } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';

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

  const renderSettlement = (settlement: (typeof settlements)[number], openByDefault: boolean) => {
    const deal = settlement.deal;
    const payment = paymentByDeal.get(settlement.dealId);
    const receipt = receiptByDeal.get(settlement.dealId);
    const isPaid = payment?.status === PaymentStatus.PAID;
    const slip = parchee(receipt?.data);
    const quantity = deal.receivedQuantityKg ?? deal.agreedQuantityKg;

    return (
      <article key={settlement.id} className="card overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[17px] font-bold">{crop(deal.crop)}</span>
                <Badge tone={isPaid ? 'green' : 'amber'}>{isPaid ? t('records.paid') : t('records.awaitingBadge')}</Badge>
              </div>
              <div className="mt-0.5 text-sm text-muted">
                {t('records.line', {
                  qty: kg(quantity),
                  rate: perKg(deal.agreedPricePerKg),
                  name: deal.arhti.name,
                  city: place(deal.destinationMandi.city),
                })}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-muted">{t('records.netPayable')}</div>
              <div className={`tabular text-[28px] font-extrabold leading-none ${isPaid ? 'text-goldtext' : 'text-ink'}`}>
                {money(settlement.netPayable)}
              </div>
            </div>
            {isPaid && payment?.paidAt && (
              <div className="text-end text-[13px] text-muted">
                {paymentMethod(payment.method)}
                <br />
                {date(payment.paidAt, { day: 'numeric', month: 'short' })}
              </div>
            )}
          </div>
        </div>

        <details open={openByDefault} className="border-t border-line bg-paper [&[open]>summary_.chev]:rotate-180">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-[15px] font-bold sm:px-5">
            <Icon name="chevronup" size={18} className="chev rotate-180 transition-transform" />
            {t('records.breakdown')}
          </summary>
          <dl className="divide-y divide-line border-t border-line text-sm">
            <div className="flex justify-between gap-3 px-4 py-2.5 sm:px-5">
              <dt className="text-muted">{t('records.gross')}</dt>
              <dd className="tabular font-bold">{money(settlement.grossAmount)}</dd>
            </div>
            {settlement.deductions.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 px-4 py-2.5 sm:px-5">
                <dt className="text-muted">{deduction(item.type, item.description)}</dt>
                <dd className="tabular font-bold text-err-fg">− {money(item.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 px-4 py-2.5 sm:px-5">
              <dt className="font-bold">{t('records.net')}</dt>
              <dd className="tabular font-extrabold text-ok-fg">{money(settlement.netPayable)}</dd>
            </div>
          </dl>
        </details>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-3 sm:px-5">
          <Link href={`/deals/${deal.id}`} className="btn btn-outline btn-sm">
            <Icon name="deal" size={16} />
            {t('records.openDeal')}
          </Link>
          <span className="font-mono text-[12.5px] text-muted">
            {deal.dealNumber}
            {receipt && ` · ${receipt.receiptNumber}`}
            {payment?.reference && isPaid && ` · ${payment.reference}`}
          </span>
          {slip.issuedAt && (
            <span className="text-[13px] text-muted">
              {t('records.parcheeIssued', { date: date(slip.issuedAt, { day: 'numeric', month: 'short' }) })}
            </span>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('records.title')} subtitle={t('records.subtitle')} />

      <div className="card mb-8 overflow-hidden">
        <div className="bg-ok-bg p-5">
          <div className="flex items-center gap-2 text-[15px] font-bold text-ok-fg">
            <Icon name="checkcircle" size={18} />
            {t('records.received')}
          </div>
          <div className="tabular mt-1 text-[40px] font-extrabold leading-tight">{money(earned)}</div>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <span className="flex items-center gap-2 text-[15px] font-bold text-warn-fg">
            <Icon name="clock" size={18} />
            {t('records.awaiting')}
          </span>
          <span className="tabular text-xl font-extrabold">{money(awaited)}</span>
        </div>
      </div>

      {settlements.length === 0 ? (
        <EmptyState
          title={t('records.emptyTitle')}
          message={t('records.emptyMessage')}
          actionHref="/deals"
          actionLabel={t('records.emptyAction')}
        />
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section>
              <h2 className="font-display h-section mb-3 font-semibold">{t('records.awaitingBadge')}</h2>
              <div className="space-y-4">{pending.map((settlement) => renderSettlement(settlement, false))}</div>
            </section>
          )}
          {paid.length > 0 && (
            <section>
              <h2 className="font-display h-section mb-3 font-semibold">{t('records.paidDeals')}</h2>
              <div className="space-y-4">{paid.map((settlement, i) => renderSettlement(settlement, i === 0))}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
