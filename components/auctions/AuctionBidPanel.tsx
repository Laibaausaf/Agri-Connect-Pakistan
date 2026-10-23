'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Prisma, UserRole } from '@prisma/client';
import { getAuctionLiveState, placeBid } from '@/lib/actions/bid';
import { useSocket } from '@/hooks/useSocket';
import { useI18n } from '@/components/i18n/LanguageProvider';
import {
  Gavel,
  Clock,
  TrendingUp,
  AlertCircle,
  Loader2,
  ArrowRight,
  Scale,
  MapPin,
  User,
  CheckCircle2,
} from 'lucide-react';

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
}: {
  auction: AuctionDetail;
  currentUser: { id: string; name: string; role: UserRole };
  canBid: boolean;
}) {
  const { socket, connected } = useSocket();
  const { t, plural, crop, place, grade, time, rate, isUrdu, error: errorText } = useI18n();
  // "Rs 92" / "92 روپے" and "Rs 92 / kg" / "92 روپے فی کلو"
  const formatCurrency = (n: number) => rate(n);
  const perKgText = (n: number) => (isUrdu ? `${rate(n)} ${t('bid.perKg')}` : `${rate(n)} / kg`);
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
  const currentBidderName = bids[0]?.bidder?.name ?? latestBidderName;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lot info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-[#F8F9F5] border border-[#E5E7EB] flex items-center justify-center text-2xl">
                  {cropEmoji(auction.inventoryLot.crop.name)}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-charcoal">
                    {crop(auction.inventoryLot.crop)} • {grade(auction.grade)}
                  </h1>
                  <p className="text-[11px] text-[#636E72] font-mono">
                    {auction.auctionNumber} · {auction.inventoryLot.lotNumber}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  isEnded
                    ? 'bg-[#F2F4F7] text-[#636E72] border-[#E5E7EB]'
                    : 'bg-agri-900 text-white border-agri-900 animate-pulse'
                }`}
              >
                {isEnded ? t('bid.closed') : t('bid.live')}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-[#F8F9F5] p-3 rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#636E72] mb-1">{t('bid.quantity')}</div>
                <div className="font-semibold text-charcoal flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-agri-900" />
                  {auction.quantityKg.toLocaleString()} {isUrdu ? 'کلو' : 'kg'}
                </div>
              </div>
              <div className="bg-[#F8F9F5] p-3 rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#636E72] mb-1">{t('bid.mandi')}</div>
                <div className="font-semibold text-charcoal flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-agri-900" />
                  {place(auction.mandi.name)}
                </div>
              </div>
              <div className="bg-[#F8F9F5] p-3 rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#636E72] mb-1">{t('bid.arhti')}</div>
                <div className="font-semibold text-charcoal flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-agri-900" />
                  {auction.arhti.name}
                </div>
              </div>
              <div className="bg-[#F8F9F5] p-3 rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#636E72] mb-1">{t('bid.grownBy')}</div>
                <div className="font-semibold text-charcoal">
                  {auction.inventoryLot.sourceFarmerName}
                </div>
                <div className="text-[10px] text-[#636E72]">{place(auction.inventoryLot.sourceCity)}</div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#636E72]">{t('bid.reserve')}</div>
                  <div className="text-sm font-semibold text-charcoal">
                    {perKgText(auction.reservePrice)}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-[10px] text-[#636E72]">{t('bid.increment')}</div>
                  <div className="text-sm font-semibold text-charcoal">
                    +{perKgText(auction.minimumIncrement)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bid history */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-charcoal mb-3 flex items-center gap-2">
              <Gavel className="w-4 h-4 text-agri-900" /> {t('bid.history')}
            </h2>
            {bids.length === 0 ? (
              <div className="text-xs text-[#636E72] py-4">{t('bid.noBids')}</div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {bids.map((bid, idx) => (
                  <div key={bid.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          idx === 0 ? 'bg-agri-900 text-white' : 'bg-[#F2F4F7] text-[#636E72]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-charcoal">{bid.bidder.name}</div>
                        <div className="text-[10px] text-[#636E72]">
                          {time(bid.timestamp, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-bold text-agri-900">{perKgText(bid.amountPerKg)}</div>
                      {idx === 0 && <div className="text-[10px] text-amber-700 font-medium">{t('bid.highest')}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bid panel */}
        <div className="space-y-6">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm sticky top-4">
            <div className="text-[10px] text-[#636E72] uppercase tracking-wider font-bold mb-1">
              {t('bid.current')}
            </div>
            <div className="text-3xl font-bold text-agri-900">{formatCurrency(currentHighestBid)}</div>
            <div className="text-xs text-[#636E72] mt-0.5">{t('bid.perKg')}</div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[#636E72]">
                <TrendingUp className="w-3.5 h-3.5" />
                {plural('auctionHouse.bid', bidCount)}
              </div>
              <div
                className={`flex items-center gap-1.5 font-semibold ${
                  isEnded ? 'text-[#636E72]' : 'text-amber-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {isEnded ? t('bid.ended') : formatTimeLeft(timeLeftMs, (hours, minutes) => t('bid.hoursMinutes', { hours, minutes }))}
              </div>
            </div>

            {currentBidderName && (
              <div className="mt-3 text-[11px] text-[#636E72]">
                {t('bid.highestBidder')} <span className="font-semibold text-charcoal">{currentBidderName}</span>
              </div>
            )}

            {userIsHighest && !isEnded && (
              <div className="mt-4 p-3 rounded-xl bg-[#E8F3EE] border border-[#B7D4C8] flex items-start gap-2 text-xs text-agri-900">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {t('bid.youLead')}
              </div>
            )}

            {canBid && !isEnded && (
              <form action={formAction} className="mt-5 space-y-3">
                <input type="hidden" name="auctionId" value={auction.id} />
                <div>
                  <label className="block text-xs font-medium mb-1">{t('bid.yourBid')}</label>
                  <input
                    ref={amountRef}
                    type="number"
                    name="amountPerKg"
                    min={minimumNextBid}
                    step="1"
                    placeholder={t('bid.minPlaceholder', { amount: minimumNextBid })}
                    required
                    className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500"
                  />
                  <div className="text-[10px] text-[#636E72] mt-1">
                    {t('bid.minValid', { rate: perKgText(minimumNextBid) })}
                  </div>
                </div>

                {state?.error && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {errorText(state.error)}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full bg-agri-900 hover:bg-agri-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-colors"
                >
                  {pending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gavel className="w-4 h-4" />}
                  {t('bid.place')}
                </button>

                <div className="text-[10px] text-center text-[#636E72]">
                  {connected ? t('bid.connected') : t('bid.reconnecting')}
                </div>
              </form>
            )}

            {isEnded && (
              <div className="mt-5 p-3 rounded-xl bg-[#F2F4F7] border border-[#E5E7EB] text-xs text-[#636E72] text-center">
                {t('bid.endedText', { rate: perKgText(currentHighestBid) })}
              </div>
            )}

            {!canBid && !isEnded && (
              <div className="mt-5 p-3 rounded-xl bg-[#F8F9F5] border border-[#E5E7EB] text-xs text-[#636E72] text-center">
                {t('bid.vendorsOnly')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
