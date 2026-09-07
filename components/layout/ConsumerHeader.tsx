'use client';

import Link from 'next/link';
import { MapPin, Leaf, LogOut } from 'lucide-react';
import { logout } from '@/lib/actions/auth';

type ConsumerHeaderProps = {
  name: string;
  location: string;
};

export default function ConsumerHeader({ name, location }: ConsumerHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB]">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link href="/shop" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-agri-900 text-white flex items-center justify-center">
            <Leaf className="w-4.5 h-4.5" />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-sm text-agri-900">AgriConnect Fresh</div>
            <div className="flex items-center gap-1 text-[11px] text-[#636E72]">
              <MapPin className="w-3 h-3 text-agri-900" />
              <span className="truncate max-w-[160px]">{location}</span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-[#636E72]">Hi, {name.split(' ')[0]}</span>
          <form action={logout}>
            <button
              type="submit"
              className="p-2 rounded-lg bg-[#F8F9F5] border border-[#E5E7EB] text-[#636E72] hover:text-charcoal"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
