'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Role = 'student' | 'teacher' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
  must_change_password?: number;
  /** Organizations this user belongs to (institutions and/or Self-study). */
  orgs?: { id: string; name: string; slug: string; kind: 'institution' | 'self'; role: 'owner' | 'admin' | 'teacher' | 'student' }[];
  /** Owner or admin of at least one institution. */
  orgAdmin?: boolean;
}

interface AuthCtx {
  /** Always true now: accounts are built into the app (no external service to configure). */
  configured: boolean;
  loading: boolean;
  /** Kept for compatibility with components that check for a session. */
  session: { user: { id: string } } | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; fullName: string; joinCode?: string }) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Where each role lands after signing in. */
export function homeFor(role: Role | undefined) {
  // Institution owners/admins have role 'teacher' and land on the teacher dashboard (Admin tab is one click away).
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  return '/app';
}

export function friendlyAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|load failed|networkerror/i.test(msg)) return 'Could not reach the server. Is `npm run dev` still running?';
  return msg;
}

/** fetch wrapper for the app's own API: JSON in/out, readable errors. */
export async function apiFetch<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const { user } = await apiFetch<{ user: Profile | null }>('/api/auth/me');
      setProfile(user);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));
  }, [refreshProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
      await refreshProfile();
    },
    [refreshProfile]
  );

  const signUp = useCallback(
    async ({ email, password, fullName, joinCode }: { email: string; password: string; fullName: string; joinCode?: string }) => {
      await apiFetch('/api/auth/signup', { method: 'POST', body: { email, password, fullName, joinCode } });
      await refreshProfile();
      return { needsConfirmation: false };
    },
    [refreshProfile]
  );

  const signOut = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setProfile(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      configured: true,
      loading,
      session: profile ? { user: { id: profile.id } } : null,
      profile,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [loading, profile, signIn, signUp, signOut, refreshProfile]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}
