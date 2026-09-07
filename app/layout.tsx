import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgriConnect - AI-powered Digital Mandi for Pakistan',
  description: 'Trade crops transparently. From farm to payment.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-charcoal antialiased">{children}</body>
    </html>
  );
}
