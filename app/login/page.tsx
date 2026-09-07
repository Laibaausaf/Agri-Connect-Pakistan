'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sprout, Loader2, AlertCircle } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { label: 'Farmer', email: 'farmer@demo.pk' },
  { label: 'Arhti', email: 'arhti@demo.pk' },
  { label: 'Vendor', email: 'vendor@demo.pk' },
  { label: 'Shopkeeper', email: 'shopkeeper@demo.pk' },
  { label: 'Consumer', email: 'consumer@demo.pk' },
  { label: 'Admin', email: 'admin@demo.pk' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('farmer@demo.pk');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const requestedPath = new URLSearchParams(window.location.search).get('callbackUrl');
      const redirectTo =
        requestedPath && requestedPath.startsWith('/') && !requestedPath.startsWith('//')
          ? requestedPath
          : '/for-you';

      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        redirectTo,
      });

      if (!result?.ok || result.error) {
        setError('Invalid email or password. Try a demo account.');
        return;
      }

      router.replace(result.url || redirectTo);
      router.refresh();
    } catch {
      setError('Unable to sign in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-agri-900 flex items-center justify-center">
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-agri-900">AgriConnect</span>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Welcome back</h1>
        <p className="text-center text-[#636E72] mb-6">Sign in to your account</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-agri-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-agri-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-agri-900 hover:bg-agri-800 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-6">
          <p className="text-center text-sm text-[#636E72] mb-2">
            Demo accounts — password <span className="font-medium">demo123</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => setEmail(account.email)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  email === account.email
                    ? 'bg-agri-900 text-white border-agri-900'
                    : 'bg-[#F2F4F7] text-[#636E72] border-[#E5E7EB] hover:bg-[#E8F3EE]'
                }`}
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center text-sm">
          <Link href="/" className="text-agri-700 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
