import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/for-you"
        className="inline-flex items-center gap-1 text-xs font-medium text-[#636E72] hover:text-agri-900 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
      </Link>
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-charcoal mb-2">{title}</h1>
        <p className="text-sm text-[#636E72]">
          {description ?? 'This page is being prepared for the hackathon demo.'}
        </p>
      </div>
    </div>
  );
}
