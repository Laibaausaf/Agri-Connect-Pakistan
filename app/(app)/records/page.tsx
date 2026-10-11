import Link from 'next/link';
import { PaymentStatus, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  money,
  qty,
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
            crop: { select: { name: true, imageUrl: true } },
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
  const deducted = settlements.reduce((sum, s) => sum + s.deductionsTotal, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Payments & Records"
        titleUrdu="ادائیگی اور پرچی"
        subtitle="See how much you received and what is still due. رقم ملا یا باقی ہے، یہاں دیکھیں۔"
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Received" value={money(earned)} tone="accent" />
        <StatCard label="Awaiting payment" value={money(awaited)} tone={awaited > 0 ? 'warn' : 'default'} />
        
      </div>

      {settlements.length === 0 ? (
        <EmptyState
          title="No settlements yet"
          message="After an arhti weighs your produce at the mandi, the settlement and parchee appear here."
          actionHref="/deals"
          actionLabel="See my deals"
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
                      <span className="text-sm font-bold text-charcoal">{deal.crop.name}</span>
                      <Badge tone={isPaid ? 'green' : 'amber'}>
                        {isPaid ? 'Paid' : 'Awaiting payment'}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {qty(quantity)} at {money(deal.agreedPricePerKg)}/kg to {deal.arhti.name} ·{' '}
                      {deal.destinationMandi.city}
                    </div>
                    <div className="text-[10px] text-[#636E72] font-mono mt-0.5">
                      {deal.dealNumber}
                      {receipt && ` · ${receipt.receiptNumber}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#636E72]">Net payable</div>
                    <div className="text-base font-bold text-agri-900">
                      {money(settlement.netPayable)}
                    </div>
                    {isPaid && payment?.paidAt && (
                      <div className="text-[10px] text-[#636E72]">
                        {payment.method} ·{' '}
                        {payment.paidAt.toLocaleDateString('en-PK', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <details className="mt-3 border-t border-[#E5E7EB] pt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-agri-900">View payment breakdown <span className="font-normal text-[#636E72]">(تفصیل دیکھیں)</span></summary>
                <dl className="mt-3 text-sm space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-[#636E72]">Gross</dt>
                    <dd className="font-semibold text-charcoal">{money(settlement.grossAmount)}</dd>
                  </div>
                  {settlement.deductions.map((deduction) => (
                    <div key={deduction.id} className="flex justify-between">
                      <dt className="text-[#636E72]">{deduction.description}</dt>
                      <dd className="text-red-700">− {money(deduction.amount)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#E5E7EB] pt-1.5">
                    <dt className="font-bold text-charcoal">Net</dt>
                    <dd className="font-bold text-agri-900">{money(settlement.netPayable)}</dd>
                  </div>
                </dl>
                </details>

                <div className="mt-3 flex items-center gap-3">
                  <Link
                    href={`/deals/${deal.id}`}
                    className="text-[11px] font-semibold text-agri-900 hover:underline"
                  >
                    Open deal
                  </Link>
                  {payment?.reference && isPaid && (
                    <span className="text-[10px] text-[#636E72] font-mono">
                      {payment.reference}
                    </span>
                  )}
                  {slip.issuedAt && (
                    <span className="text-[10px] text-[#636E72]">
                      Parchee issued{' '}
                      {new Date(slip.issuedAt).toLocaleDateString('en-PK', {
                        day: 'numeric',
                        month: 'short',
                      })}
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
