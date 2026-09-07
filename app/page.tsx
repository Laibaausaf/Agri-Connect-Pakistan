import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Sparkles,
  Scale,
  Gavel,
  Truck,
  Receipt,
  Eye,
  Sprout,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getMarketSnapshot() {
  const mandi = await prisma.mandi.findFirst({ where: { city: 'Islamabad' } });
  if (!mandi) return { mandi: null, prices: [] };
  const prices = await prisma.marketPrice.findMany({
    where: { mandiId: mandi.id },
    include: { crop: true },
    orderBy: { crop: { name: 'asc' } },
    take: 3,
  });
  return { mandi, prices };
}

export default async function LandingPage() {
  const { mandi, prices } = await getMarketSnapshot();

  return (
    <div className="bg-[#F8F9F5] text-[#2D3436] min-h-screen">
      {/* Header */}
      <header className="border-b border-[#E5E7EB] bg-white/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-agri-900 flex items-center justify-center">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-agri-900">AgriConnect</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-[#636E72] hover:text-agri-900"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold bg-agri-900 hover:bg-agri-800 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-12 pb-16 px-4 border-b border-[#E5E7EB]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#E8F3EE] text-agri-900 px-3 py-1 rounded-full text-xs font-semibold mb-6 border border-[#B7D4C8]">
            <span className="w-2 h-2 rounded-full bg-agri-900 animate-ping" />
            Pakistan's First AI-Powered Digital Mandi OS
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-[#2D3436] tracking-tight leading-tight sm:leading-none max-w-3xl mx-auto">
            Trade crops transparently.{' '}
            <span className="text-agri-900 block sm:inline">From farm to payment.</span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-[#636E72] max-w-2xl mx-auto leading-relaxed">
            An AI-powered digital mandi operating system for farmers, buyers, and agricultural traders.
            Real-time auctions, verified weights, direct transport, and instant SBP Raast settlements.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto bg-agri-900 hover:bg-agri-800 text-white font-semibold text-sm px-6 py-3.5 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Enter AgriConnect</span>
              <ArrowRight className="w-4 h-4 text-emerald-200" />
            </Link>
            <Link
              href="#market"
              className="w-full sm:w-auto bg-white hover:bg-[#F8F9F5] text-[#2D3436] border border-[#E5E7EB] font-semibold text-sm px-6 py-3.5 rounded-lg transition-all text-center"
            >
              Explore Market
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-[#636E72]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-agri-900" /> Verified Mandi Scale
            </span>
            <span className="flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-agri-900" /> Transparent Pricing
            </span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-14 px-4 max-w-5xl mx-auto border-b border-[#E5E7EB]">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-[#2D3436] tracking-tight">How It Works</h2>
          <p className="text-sm text-[#636E72] mt-1">Five transparent digital steps replacing middleman opacity</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {[
            { step: '01', title: 'List Crop', desc: 'Farmer sets lot quantity, grade & reserve price.', icon: Sparkles },
            { step: '02', title: 'Get Bids', desc: 'Real-time open auction across buyers & agents.', icon: Gavel },
            { step: '03', title: 'Confirm Trade', desc: 'Winning bid locks in rate. Digital agreement generated.', icon: ShieldCheck },
            { step: '04', title: 'Track Delivery', desc: 'Farmgate truck booking with live transit route.', icon: Truck },
            { step: '05', title: 'Settlement', desc: 'Certified kanta weight & instant Raast deposit.', icon: Receipt },
          ].map((s) => (
            <div key={s.step} className="bg-white p-4 rounded-xl border border-[#E5E7EB] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold text-agri-900 bg-[#E8F3EE] px-2 py-0.5 rounded">{s.step}</span>
                  <s.icon className="w-4 h-4 text-agri-900" />
                </div>
                <h3 className="font-bold text-sm text-[#2D3436] mb-1">{s.title}</h3>
                <p className="text-xs text-[#636E72] leading-normal">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Market Snapshot */}
      <section id="market" className="py-14 px-4 max-w-5xl mx-auto border-b border-[#E5E7EB] scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-agri-900 bg-[#E8F3EE] border border-[#B7D4C8] px-2.5 py-0.5 rounded-full mb-1">
              <span className="w-2 h-2 rounded-full bg-agri-900 animate-pulse" /> Live Mandi Snapshot
            </div>
            <h2 className="text-2xl font-bold text-[#2D3436] tracking-tight">{mandi?.name ?? 'Islamabad Sabzi Mandi'}</h2>
            <p className="text-xs text-[#636E72]">Today's public, privacy-safe verified wholesale clearing prices</p>
          </div>
          <div className="text-xs text-[#636E72] font-mono">
            Today's volume: <strong className="text-[#2D3436]">{mandi?.todayVolumeTonnes ?? 0} tonnes</strong> • Active auctions:{' '}
            <strong className="text-agri-900">{mandi?.activeAuctionsCount ?? 0} live</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {prices.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl border border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-[#2D3436]">{item.crop.name}</h3>
                  <span className="text-xs text-[#636E72]">{item.crop.nameUrdu}</span>
                </div>
                <div
                  className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded border ${
                    item.trend === 'up'
                      ? 'bg-[#E8F3EE] text-agri-900 border-[#B7D4C8]'
                      : item.trend === 'down'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-[#F8F9F5] text-[#636E72] border-[#E5E7EB]'
                  }`}
                >
                  {item.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 mr-1 text-agri-900" />}
                  {item.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 mr-1 text-amber-700" />}
                  <span>{item.changePercent > 0 ? `+${item.changePercent}%` : `${item.changePercent}%`}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-baseline justify-between">
                <span className="text-xs text-[#636E72]">Clearing Rate:</span>
                <span className="text-xl font-bold text-agri-900">
                  Rs {item.ratePerKg} <span className="text-xs font-normal text-[#636E72]">/ kg</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-[#E8F3EE]/60 border border-[#B7D4C8] rounded-xl text-xs text-[#2D3436] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-agri-900" />
            Zero private farmer earnings or debt data is ever displayed publicly.
          </span>
          <Link href="#market" className="text-agri-900 font-semibold hover:underline">
            View All Mandis →
          </Link>
        </div>
      </section>

      {/* Why AgriConnect */}
      <section className="py-14 px-4 max-w-5xl mx-auto border-b border-[#E5E7EB]">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-[#2D3436] tracking-tight">Why AgriConnect</h2>
          <p className="text-sm text-[#636E72] mt-1">Built for the realities of agricultural markets in Pakistan</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { title: 'Transparent Pricing', icon: Scale, desc: 'Open digital bidding eliminates hidden bids. Every deduction is itemized on a verified receipt.' },
            { title: 'Verified Transactions', icon: ShieldCheck, desc: 'Mandi gate weighbridge confirms exact weight before invoice. Settlements via SBP RAAST.' },
            { title: 'AI Assistance', icon: Sparkles, desc: 'Voice-first assistance in Urdu and English for natural commands like listing lots or checking rates.' },
          ].map((f) => (
            <div key={f.title} className="bg-white p-5 rounded-xl border border-[#E5E7EB]">
              <div className="w-10 h-10 rounded-lg bg-[#E8F3EE] text-agri-900 flex items-center justify-center mb-3 border border-[#B7D4C8]">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#2D3436] mb-1.5">{f.title}</h3>
              <p className="text-xs text-[#636E72] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported Roles */}
      <section className="py-14 px-4 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#2D3436] tracking-tight">Supported User Types</h2>
          <p className="text-sm text-[#636E72] mt-1">Tailored interfaces with role-specific data boundaries</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { title: 'Farmer', desc: 'List lots, compare mandi returns, monitor bids & receive Raast payments.' },
            { title: 'Arhti / Agent', desc: 'Manage farmer consignments, coordinate auctions & record transparent commissions.' },
            { title: 'Wholesale Buyer', desc: 'Discover verified grades, place bids & track arriving trucks.' },
            { title: 'Retail Vendor', desc: 'Procure daily wholesale quantities with zero surprise shortfalls.' },
          ].map((r) => (
            <div key={r.title} className="bg-white p-4 rounded-xl border border-[#E5E7EB]">
              <h3 className="font-bold text-sm text-[#2D3436]">{r.title}</h3>
              <p className="text-xs text-[#636E72] mt-1 leading-normal">{r.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/login" className="bg-agri-900 hover:bg-agri-800 text-white font-semibold text-sm px-8 py-3.5 rounded-lg shadow-sm transition-all">
            Create Free Account
          </Link>
        </div>
      </section>
    </div>
  );
}
