import Link from 'next/link';
import Icon from '@/components/ui/Icon';

export default function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/for-you"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-forest mb-4"
      >
        <Icon name="arrowleft" size={14} /> Back to dashboard
      </Link>
      <div className="bg-sf border border-line rounded-2xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-ink mb-2">{title}</h1>
        <p className="text-sm text-muted">
          {description ?? 'This page is being prepared for the hackathon demo.'}
        </p>
      </div>
    </div>
  );
}
