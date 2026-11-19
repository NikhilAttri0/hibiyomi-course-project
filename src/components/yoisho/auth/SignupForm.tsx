'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { friendlyAuthError, homeFor, useAuth } from '@/lib/auth';
import AuthLayout, { Field, FormError } from './AuthLayout';

export default function SignupForm() {
  const { signUp, session, profile, configured } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [rules, setRules] = useState<{ signupRequiresCode: boolean; firstAccount: boolean } | null>(null);
  const [path, setPath] = useState<'self' | 'class'>(params.get('code') ? 'class' : 'self');

  useEffect(() => {
    apiFetch<{ signupRequiresCode: boolean; firstAccount: boolean }>('/api/auth/config')
      .then(setRules)
      .catch(() => setRules({ signupRequiresCode: false, firstAccount: false }));
  }, []);
  const codeRequired = !!rules?.signupRequiresCode;
  const usingCode = codeRequired || path === 'class';

  useEffect(() => {
    if (session && profile) router.replace(homeFor(profile.role));
  }, [session, profile, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (usingCode && !code.trim()) return setError('Enter the class join code your teacher gave you.');
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp({ email, password, fullName: name, joinCode: usingCode ? code : undefined });
      if (needsConfirmation) setSentTo(email);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout jp="確認メール" title="Check your email" sub={`We sent a confirmation link to ${sentTo}.`}>
        <div className="card card-pad text-sm text-ink-2 space-y-3">
          <p>Open the link in that email, then sign in. {code && <>You&apos;ll be added to the batch with code <b>{code.toUpperCase()}</b> automatically.</>}</p>
          <p className="text-ink-3">No email after a few minutes? Check spam, or ask your admin to confirm your account.</p>
          <Link href="/login" className="btn-primary w-full">
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      jp="はじめまして"
      title="Create your account"
      sub={usingCode ? 'Enter the join code from your teacher to land straight in your class.' : 'Learn JLPT kanji and vocabulary at your own pace — free.'}
    >
      {!configured ? (
        <FormError message="Accounts are not set up yet: add your Supabase keys to .env.local (see DEPLOY.md)." />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {rules && !rules.firstAccount && !codeRequired && (
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-sunken/70 p-1" role="tablist" aria-label="How will you learn?">
              {(
                [
                  ['self', 'Learn on my own'],
                  ['class', 'I have a class code'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={path === id}
                  onClick={() => setPath(id)}
                  className={'h-10 rounded-xl text-sm font-semibold transition ' + (path === id ? 'bg-surface shadow-card text-ink' : 'text-ink-3')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <Field id="signup-name" label="Full name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Field id="signup-email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            id="signup-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {rules?.firstAccount ? (
            <div className="rounded-2xl bg-brand-soft text-sm text-ink-2 px-4 py-3">
              <b className="text-brand">First account on this site.</b> It becomes the <b>admin</b>, who creates batches and teacher logins.
            </div>
          ) : usingCode ? (
            <Field
              id="signup-code"
              label="Class join code"
              placeholder="e.g. N5-7KQ2XM"
              autoCapitalize="characters"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              hint="Ask your teacher for the code of your class."
            />
          ) : (
            <p className="rounded-2xl bg-brand-soft text-sm text-ink-2 px-4 py-3">
              You’ll pick N5 or N4 and study on your own. Joining a class later (Settings → My batches) keeps all your progress.
            </p>
          )}
          <FormError message={error} />
          <button type="submit" disabled={busy} className="btn-primary w-full h-12">
            {busy ? 'Creating account…' : 'Create account'}
          </button>
          <p className="text-sm text-ink-3 text-center pt-2">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
