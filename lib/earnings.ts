import { DeductionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { kg } from '@/lib/inventory';

/**
 * What an arhti actually earns, split by who pays it:
 * - commission deducted from farmers, counted once the settlement is paid
 *   (commission on settlements still awaiting payment is reported separately
 *   as pending and left out of the total);
 * - commission vendors pay on top of the auction price, paid at close;
 * - trading margin: (auction price - price paid to the farmer) x kg sold.
 * Each figure covers different kilograms (paid settlements vs lots sold at
 * auction), so they add up to the total but are not matched kg by kg.
 */
export async function getArhtiEarnings(arhtiId: string) {
  const [farmerDeductions, sales] = await Promise.all([
    prisma.settlementDeduction.findMany({
      where: { type: DeductionType.ARHTI_COMMISSION, settlement: { deal: { arhtiId } } },
      select: { amount: true, settlement: { select: { status: true } } },
    }),
    prisma.arhtiVendorSale.findMany({
      where: { arhtiId },
      select: {
        quantityKg: true,
        ratePerKg: true,
        grossAmount: true,
        commission: true,
        auction: { select: { inventoryLot: { select: { purchasePricePerKg: true } } } },
      },
    }),
  ]);

  let farmerCommission = 0;
  let farmerCommissionPending = 0;
  let paidSettlements = 0;
  let pendingSettlements = 0;
  for (const d of farmerDeductions) {
    if (d.settlement.status === 'paid') {
      farmerCommission += d.amount;
      paidSettlements += 1;
    } else {
      farmerCommissionPending += d.amount;
      pendingSettlements += 1;
    }
  }

  const vendorCommission = sales.reduce((sum, s) => sum + s.commission, 0);
  const tradingMargin = sales.reduce(
    (sum, s) => sum + (s.ratePerKg - s.auction.inventoryLot.purchasePricePerKg) * s.quantityKg,
    0
  );
  const soldKg = sales.reduce((sum, s) => sum + s.quantityKg, 0);
  const auctionValue = sales.reduce((sum, s) => sum + s.grossAmount, 0);

  return {
    farmerCommission: kg(farmerCommission),
    farmerCommissionPending: kg(farmerCommissionPending),
    paidSettlements,
    pendingSettlements,
    vendorCommission: kg(vendorCommission),
    tradingMargin: kg(tradingMargin),
    total: kg(farmerCommission + vendorCommission + tradingMargin),
    salesCount: sales.length,
    soldKg: kg(soldKg),
    auctionValue: kg(auctionValue),
  };
}

export type ArhtiEarnings = Awaited<ReturnType<typeof getArhtiEarnings>>;
