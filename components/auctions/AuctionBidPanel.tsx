'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Prisma, UserRole } from '@prisma/client';
import { getAuctionLiveState, placeBid } from '@/lib/actions/bid';
import { useSocket } from '@/hooks/useSocket';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { vendorPaysPerKg } from '@/lib/commission';
import Icon, { type IconName } from '@/components/ui/Icon';
import BrandGlow from '@/components/ui/BrandGlow';

type BidWithBidder = Prisma.BidGetPayload<{ include: { bidder: true } }>;

type AuctionDetail = Prisma.AuctionGetPayload<{
  include: {
    inventoryLot: { include: { crop: true } };
    mandi: true;
    arhti: true;
    bids: { include: { bidder: true } };
  };
}>;

type PlacedBid = {
  id: string;
  auctionId: string;
  bidderId: string;
  amountPerKg: number;
  timestamp: string | Date;
  bidder: { id: string; name: string };
};

type BidState =
  | {
      error?: string;
      success?: boolean;
      currentHighestBid?: number;
      bidCount?: number;
      bid?: PlacedBid;
    }
  | null;

/** How often the page re-checks the auction while the live connection is down. */
const POLL_MS = 4000;

function formatTimeLeft(ms: number, hoursLabel: (hours: number, minutes: string) => string) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return hoursLabel(hours, minutes.toString().padStart(2, '0'));
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function cropEmoji(name: string) {
  const n = name.toLowerCase();
  if (n.includes('tomato')) return '🍅';
  if (n.includes('potato')) return '🥔';
  if (n.includes('onion')) return '🧅';
  return '🌾';
}

export default function AuctionBidPanel({
  auction,
  currentUser,
  canBid,
  commissionRate,
}: {
  auction: AuctionDetail;
  currentUser: { id: string; name: string; role: UserRole };
  canBid: boolean;
  /** The arhti's commission, paid by the winning vendor on top of the bid. */
  commissionRate: number;
}) {
  const { socket, connected } = useSocket();
  const { t, plural, crop, place, grade, time, rate, number, isUrdu, error: errorText } = useI18n();
  // "Rs 92" / "92 روپے" and "Rs 92 / kg" / "92 روپے فی کلو"
  const formatCurrency = (n: number) => rate(n);
  const perKgText = (n: number) => (isUrdu ? `${rate(n)} ${t('bid.perKg')}` : `${rate(n)} / kg`);
  // Two decimals, for amounts that include the commission (e.g. Rs 83.64).
  const perKgExact = (n: number) => t('common.perKgExact', { amount: number(n, 2) });
  const amountRef = useRef<HTMLInputElement>(null);

  const [currentHighestBid, setCurrentHighestBid] = useState(
    auction.currentHighestBid ?? auction.reservePrice
  );
  const [bidCount, setBidCount] = useState(auction.bidCount);
  const [bids, setBids] = useState<BidWithBidder[]>(
    [...auction.bids].sort((a, b) => b.amountPerKg - a.amountPerKg)
  );
  const [timeLeftMs, setTimeLeftMs] = useState(
    Math.max(0, auction.endTime.getTime() - Date.now())
  );
  const [isEnded, setIsEnded] = useState(
    auction.status !== 'ACTIVE' || auction.endTime.getTime() <= Date.now()
  );
  const [latestBidderName, setLatestBidderName] = useState<string | undefined>();
  const [typedBid, setTypedBid] = useState<number | null>(null);

  const [state, formAction, pending] = useActionState(
    async (_prev: BidState, formData: FormData): Promise<BidState> => placeBid(formData),
    null
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, auction.endTime.getTime() - Date.now());
      setTimeLeftMs(remaining);
      if (remaining === 0) {
        setIsEnded(true);
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [auction.endTime]);

  useEffect(() => {
    if (!socket) return;

    const onUpdate = (payload: {
      auctionId: string;
      currentHighestBid: number;
      bidCount: number;
      latestBidderId: string;
      latestBidderName: string;
      latestBidAmount: number;
      bidId: string;
      endsAt: string;
    }) => {
      if (payload.auctionId !== auction.id) return;

      setCurrentHighestBid((prev) => Math.max(prev, payload.currentHighestBid));
      setBidCount((prev) => Math.max(prev, payload.bidCount));
      setLatestBidderName(payload.latestBidderName);

      setBids((prev) => {
        if (prev.some((b) => b.id === payload.bidId)) return prev;
        return [
          {
            id: payload.bidId,
            auctionId: payload.auctionId,
            bidderId: payload.latestBidderId,
            amountPerKg: payload.latestBidAmount,
            timestamp: new Date(),
            bidder: { id: payload.latestBidderId, name: payload.latestBidderName } as BidWithBidder['bidder'],
          },
          ...prev,
        ].sort((a, b) => b.amountPerKg - a.amountPerKg);
      });
    };

    const onClosed = (payload: { auctionId: string; sold: boolean; winningBid?: number }) => {
      if (payload.auctionId !== auction.id) return;
      if (payload.winningBid) setCurrentHighestBid((prev) => Math.max(prev, payload.winningBid!));
      setIsEnded(true);
    };

    // Rooms do not survive a reconnect, so join again every time we connect.
    const join = () => socket.emit('join-auction', auction.id);
    socket.on('connect', join);
    if (socket.connected) join();
    socket.on('auction:update', onUpdate);
    socket.on('auction:closed', onClosed);

    return () => {
      socket.emit('leave-auction', auction.id);
      socket.off('connect', join);
      socket.off('auction:update', onUpdate);
      socket.off('auction:closed', onClosed);
    };
  }, [socket, auction.id]);

  // Fallback while the live connection is down (for example on hosting without
  // WebSockets): re-check the auction every few seconds. Stops as soon as the
  // socket connects or the auction ends.
  useEffect(() => {
    if (connected || isEnded) return;
    let stopped = false;
    const check = async () => {
      const live = await getAuctionLiveState(auction.id).catch(() => null);
      if (stopped || !live) return;
      if (live.currentHighestBid != null) {
        setCurrentHighestBid((prev) => Math.max(prev, live.currentHighestBid!));
      }
      setBidCount((prev) => Math.max(prev, live.bidCount));
      setBids((prev) => {
        const known = new Set(prev.map((b) => b.id));
        const added = live.bids.filter((b) => !known.has(b.id));
        if (added.length === 0) return prev;
        return [...prev, ...(added as unknown as BidWithBidder[])].sort((a, b) => b.amountPerKg - a.amountPerKg);
      });
      if (live.status !== 'ACTIVE') setIsEnded(true);
    };
    const timer = setInterval(check, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [connected, isEnded, auction.id]);

  useEffect(() => {
    if (state?.success && amountRef.current) {
      amountRef.current.value = '';
      setTypedBid(null);
    }
    if (state?.currentHighestBid) {
      setCurrentHighestBid((prev) => Math.max(prev, state.currentHighestBid!));
    }
    if (state?.bidCount) {
      setBidCount((prev) => Math.max(prev, state.bidCount!));
    }
    if (state?.bid) {
      setBids((prev) => {
        const placed = state.bid! as BidWithBidder;
        if (prev.some((b) => b.id === placed.id)) return prev;
        return [...prev, placed].sort((a, b) => b.amountPerKg - a.amountPerKg);
      });
      setLatestBidderName(state.bid.bidder.name);
    }
  }, [state]);

  const highestBidderId = bids[0]?.bidderId;
  const userIsHighest = highestBidderId === currentUser.id;
  const minimumNextBid = currentHighestBid + auction.minimumIncrement;
  const commissionPercent = (commissionRate * 100).toFixed(1);
  const payBid = typedBid && typedBid >= minimumNextBid ? typedBid : minimumNextBid;
  const currentBidderName = bids[0]?.bidder?.name ?? latestBidderName;

  // The − / + buttons only fill the bid box; the server still checks the bid.
  const step = (direction: 1 | -1) => {
    const input = amountRef.current;
    if (!input) return;
    const current = Number(input.value) || minimumNextBid;
    const next = Math.max(minimumNextBid, current + direction * auction.minimumIncrement);
    input.value = String(next);
    setTypedBid(next);
  };
  const fact = (icon: IconName, label: string, value: React.ReactNode, hint?: React.ReactNode) => (
    <div className="flex gap-2.5 p-4">
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-forest" />
      <div className="min-w-0">
        <div className="text-[12.5px] text-muted">{label}</div>
        <div className="text-[15px] font-bold">{value}</div>
        {hint && <div className="text-[12.5px] text-muted">{hint}</div>}
      </div>
    </div>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Bid panel: first on phones, beside the lot on desktop */}
      <div className="space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
        <section className="relative overflow-hidden rounded-hero bg-brand p-5 text-white">
          <BrandGlow />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-[#D6E6D9]">{t('bid.current')}</div>
                <div key={currentHighestBid} className="ac-pop tabular text-[44px] font-extrabold leading-none text-[#F6C871]">
                  {formatCurrency(currentHighestBid)}
                </div>
                <div className="mt-1 text-[13px] text-[#D6E6D9]">
                  {t('bid.perKg')} · {plural('auctionHouse.bid', bidCount)}
                </div>
              </div>
              <div className="text-end">
                <div className="flex items-center justify-end gap-1 text-[13px] font-semibold text-[#D6E6D9]">
                  <Icon name="clock" size={15} />
                  {isEnded ? t('bid.closed') : t('auctionHouse.closesIn')}
                </div>
                <div className="tabular text-[24px] font-extrabold">
                  {isEnded ? t('bid.ended') : formatTimeLeft(timeLeftMs, (hours, minutes) => t('bid.hoursMinutes', { hours, minutes }))}
                </div>
              </div>
            </div>
            {currentBidderName && (
              <div className="mt-3 text-[13px] text-[#D6E6D9]">
                {t('bid.highestBidder')} <span className="font-bold text-white">{currentBidderName}</span>
              </div>
            )}
            {userIsHighest && !isEnded && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/[.14] px-3 py-2.5 text-sm font-bold">
                <Icon name="checkcircle" size={18} />
                {t('bid.youLead')}
              </div>
            )}
          </div>
        </section>

        {canBid && !isEnded && (
          <form action={formAction} className="card space-y-3 p-5">
            <input type="hidden" name="auctionId" value={auction.id} />
            <label htmlFor="bid-amount" className="block text-[15px] font-bold">
              {t('bid.yourBid')}
            </label>
            <div className="flex items-stretch gap-2" dir="ltr">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t('bid.lower')}
                className="ac-press inline-flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-sage text-[11px] font-bold"
              >
                <Icon name="minus" size={18} />
                {formatCurrency(auction.minimumIncrement)}
              </button>
              <input
                id="bid-amount"
                ref={amountRef}
                type="number"
                name="amountPerKg"
                min={minimumNextBid}
                step="1"
                placeholder={t('bid.minPlaceholder', { amount: minimumNextBid })}
                required
                aria-invalid={state?.error ? true : undefined}
                className="tabular h-16 min-w-0 flex-1 rounded-2xl border-2 border-gold bg-sf px-4 text-center text-[26px] font-extrabold text-ink placeholder:text-base placeholder:font-semibold placeholder:text-muted focus:outline-none focus:ring-4 focus:ring-gold/30 aria-[invalid=true]:border-err-fg aria-[invalid=true]:bg-err-bg"
                onInput={(e) => setTypedBid(Number((e.target as HTMLInputElement).value) || null)}
              />
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t('bid.higher')}
                className="ac-press inline-flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-sage text-[11px] font-bold"
              >
                <Icon name="plus" size={18} />
                {formatCurrency(auction.minimumIncrement)}
              </button>
            </div>
            <p className="text-[13px] text-muted">{t('bid.minValid', { rate: perKgText(minimumNextBid) })}</p>
            <p className="text-[13px]">
              {t('bid.youPay', {
                bid: perKgText(payBid),
                rate: perKgExact(vendorPaysPerKg(payBid, commissionRate)),
                percent: commissionPercent,
              })}
            </p>

            {state?.error && (
              <div role="alert" className="ac-shake flex items-start gap-2 rounded-2xl bg-err-bg p-3 text-sm font-bold text-err-fg">
                <Icon name="alert" size={18} className="mt-0.5" />
                {errorText(state.error)}
              </div>
            )}

            <button type="submit" disabled={pending} className="btn btn-primary w-full">
              <Icon name={pending ? 'refresh' : 'gavel'} size={20} className={pending ? 'animate-spin' : ''} />
              {payBid ? t('bid.placeAt', { rate: perKgText(payBid) }) : t('bid.place')}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[12.5px] text-muted">
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-ok-fg' : 'bg-warn-fg'}`} />
              {connected ? t('bid.connected') : t('bid.reconnecting')}
            </p>
          </form>
        )}

        {isEnded && (
          <div className="card p-4 text-center text-sm text-muted">{t('bid.endedText', { rate: perKgText(currentHighestBid) })}</div>
        )}
        {!canBid && !isEnded && <div className="card p-4 text-center text-sm text-muted">{t('bid.vendorsOnly')}</div>}
      </div>

      {/* Lot */}
      <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
        <section className="card overflow-hidden">
          <div className="flex items-center gap-4 p-5">
            {auction.inventoryLot.crop.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={auction.inventoryLot.crop.imageUrl} alt={crop(auction.inventoryLot.crop)} className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-sage text-3xl">{cropEmoji(auction.inventoryLot.crop.name)}</span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display h-section font-semibold">
                  {crop(auction.inventoryLot.crop)} · {grade(auction.grade)}
                </h1>
                {isEnded ? (
                  <span className="inline-flex h-7 items-center rounded-full bg-sage px-2.5 text-[12.5px] font-bold">{t('bid.closed')}</span>
                ) : (
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-gold px-2.5 text-[12.5px] font-extrabold text-ongold">
                    <span className="ac-pulse h-2 w-2 rounded-full bg-current" />
                    {t('bid.live')}
                  </span>
                )}
              </div>
              <p className="font-mono text-[12.5px] text-muted">
                {auction.auctionNumber} · {auction.inventoryLot.lotNumber}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-line sm:grid-cols-3 [&>*]:border-b [&>*]:border-line">
            {fact('scale', t('bid.quantity'), `${auction.quantityKg.toLocaleString()} ${isUrdu ? 'کلو' : 'kg'}`)}
            {fact('pin', t('bid.mandi'), place(auction.mandi.name))}
            {fact('user', t('bid.arhti'), auction.arhti.name)}
            {fact('sprout', t('bid.grownBy'), auction.inventoryLot.sourceFarmerName, place(auction.inventoryLot.sourceCity))}
            {fact('tag', t('bid.reserve'), perKgText(auction.reservePrice))}
            {fact('trendup', t('bid.increment'), `+${perKgText(auction.minimumIncrement)}`)}
          </div>
          <p className="flex items-start gap-2 px-5 py-3 text-[13px] text-muted">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-bold text-ink">{t('bid.commission')}:</span> {t('bid.commissionNote', { rate: commissionPercent })}
            </span>
          </p>
        </section>

        <section>
          <h2 className="font-display h-section mb-3 flex items-center gap-2 font-semibold">
            <Icon name="gavel" size={22} />
            {t('bid.history')}
          </h2>
          {bids.length === 0 ? (
            <p className="card p-4 text-sm text-muted">{t('bid.noBids')}</p>
          ) : (
            <ol className="card divide-y divide-line">
              {bids.map((bid, idx) => (
                <li key={bid.id} className={`flex items-center gap-3 px-4 py-3 ${idx === 0 ? 'ac-flash' : ''}`}>
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${idx === 0 ? 'bg-gold text-ongold' : 'bg-sage'}`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{bid.bidder.name}</div>
                    <div className="text-[12.5px] text-muted">{time(bid.timestamp, { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="text-end">
                    <div className="tabular text-lg font-extrabold">{perKgText(bid.amountPerKg)}</div>
                    {idx === 0 && <div className="text-[12.5px] font-bold text-goldtext">{t('bid.highest')}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
