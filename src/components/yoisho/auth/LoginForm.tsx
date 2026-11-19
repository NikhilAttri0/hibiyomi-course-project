'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { friendlyAuthError, homeFor, useAuth } from '@/lib/auth';
import AuthLayout, { Field, FormError } from './AuthLayout';

export default function LoginForm() {
  const { signIn, session, profile, configured } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session && profile) router.replace(next && next.startsWith('/') ? next : homeFor(profile.role));
  }, [session, profile, next, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout jp="おかえりなさい" title="Sign in" sub="Students, teachers and admins all sign in here.">
      {!configured ? (
        <FormError message="Accounts are not set up yet: add your Supabase keys to .env.local (see DEPLOY.md)." />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field id="login-email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            id="login-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormError message={error} />
          <button type="submit" disabled={busy} className="btn-primary w-full h-12">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-sm text-ink-3 text-center pt-2">
            New student?{' '}
            <Link href="/signup" className="font-semibold text-brand hover:underline">
              Create an account
            </Link>
          </p>
          <p className="text-xs text-ink-3 text-center">Teachers receive their login from the academy admin.</p>
        </form>
      )}
    </AuthLayout>
  );
}
