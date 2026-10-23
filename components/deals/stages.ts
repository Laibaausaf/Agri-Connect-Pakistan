import { DealStatus } from '@prisma/client';

/** The five steps of a farmer–arhti deal, as shown on the deal timeline. */
export const DEAL_STAGES = [
  { status: DealStatus.AGREED, label: 'deal.stage.agreed' },
  { status: DealStatus.PICKUP_SCHEDULED, label: 'deal.stage.booked' },
  { status: DealStatus.IN_TRANSIT, label: 'deal.stage.transit' },
  { status: DealStatus.PAYMENT_PENDING, label: 'deal.stage.weighed' },
  { status: DealStatus.COMPLETED, label: 'deal.stage.paid' },
] as const;

/** Which of the five steps a deal status belongs to (-1 when cancelled). */
export function dealStageIndex(status: DealStatus) {
  switch (status) {
    case DealStatus.AGREED:
      return 0;
    case DealStatus.PICKUP_SCHEDULED:
      return 1;
    case DealStatus.PICKED_UP:
    case DealStatus.IN_TRANSIT:
      return 2;
    case DealStatus.RECEIVED_BY_ARHTI:
    case DealStatus.WEIGHT_VERIFIED:
    case DealStatus.PAYMENT_PENDING:
      return 3;
    case DealStatus.PAID:
    case DealStatus.COMPLETED:
      return 4;
    default:
      return -1;
  }
}
