'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { homeFor, useAuth, type Profile, type Role } from '@/lib/auth';
import { Logo } from '../ui';

export function Splash({ label = 'よいしょ…' }: { label?: string }) {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="flex flex-col items-center gap-4 animate-pop">
        <Logo size={56} />
        <p className="text-sm text-ink-3 font-jp">{label}</p>
      </div>
    </div>
  );
}

/** Renders children only for a signed-in user with one of the allowed roles; otherwise redirects. */
export default function Guard({ roles, allow, children }: { roles?: Role[]; allow?: (p: Profile) => boolean; children: ReactNode }) {
  const { configured, loading, session, profile } = useAuth();
  const router = useRouter();
  const allowed = !!profile && (!roles || roles.includes(profile.role)) && (!allow || allow(profile));

  useEffect(() => {
    if (!configured || loading) return;
    if (!session) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    else if (profile && !allowed) router.replace(homeFor(profile.role));
  }, [configured, loading, session, profile, allowed, router]);

  if (!configured) return <>{children}</>; // demo mode without a backend
  if (loading || !session || !profile || !allowed) return <Splash />;
  return <>{children}</>;
}
