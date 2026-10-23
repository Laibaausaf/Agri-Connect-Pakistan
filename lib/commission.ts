/**
 * The arhti's commission on a mandi auction is paid by the winning vendor on
 * top of the auction price, at the arhti's own rate (the same rate deducted
 * from farmers). Pure helpers so the bid page and the server agree.
 */

/** Used when an arhti has no rate on their profile. */
export const DEFAULT_COMMISSION_RATE = 0.02;

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Commission a vendor pays on an auction value. */
export function vendorCommission(auctionValue: number, commissionRate: number) {
  return round3(auctionValue * commissionRate);
}

/** What the vendor pays per kg for a bid: the bid plus the commission. */
export function vendorPaysPerKg(bidPerKg: number, commissionRate: number) {
  return round3(bidPerKg * (1 + commissionRate));
}
