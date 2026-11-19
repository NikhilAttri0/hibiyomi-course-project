'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { Icon, type IconName } from '../icons';
import { Logo, cx } from '../ui';
import ChangePassword from '../ChangePassword';

function useThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('yoisho_theme', next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };
  return { theme, toggle };
}

export default function StaffShell({ title, jp, children }: { title: string; jp: string; children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const path = usePathname();
  const { theme, toggle } = useThemeToggle();

  const tabs: { href: string; label: string; icon: IconName; show: boolean }[] = [
    { href: '/teacher', label: 'Teacher', icon: 'chart', show: profile?.role === 'teacher' || profile?.role === 'admin' },
    { href: '/admin', label: 'Admin', icon: 'settings', show: profile?.role === 'admin' || !!profile?.orgAdmin },
    { href: '/app', label: 'Practice', icon: 'cards', show: true },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center gap-3 px-4 sm:px-8 h-16">
          <Link href="/" aria-label="Home">
            <Logo size={34} />
          </Link>
          <div className="min-w-0 mr-2">
            <div className="font-jp text-[11px] text-brand font-medium leading-none">{jp}</div>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight truncate">{title}</h1>
          </div>
          <nav className="hidden md:flex items-center gap-1 rounded-full bg-sunken/70 p-1">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cx(
                    'flex items-center gap-1.5 h-8 px-3.5 rounded-full text-sm font-semibold transition',
                    path === t.href ? 'bg-surface shadow-card text-ink' : 'text-ink-3 hover:text-ink'
                  )}
                >
                  <Icon name={t.icon} size={15} />
                  {t.label}
                </Link>
              ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-full bg-surface border border-line/70" aria-label="Toggle dark mode">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-sm font-bold">{profile?.full_name || profile?.email}</div>
              <div className="text-[11px] text-ink-3 capitalize">{profile?.role}</div>
            </div>
            <button
              onClick={() => void signOut().then(() => (window.location.href = '/'))}
              className="btn-ghost btn-sm"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="md:hidden flex gap-1 px-4 pb-3 overflow-x-auto no-scrollbar">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={cx(
                  'shrink-0 flex items-center gap-1.5 h-8 px-3.5 rounded-full text-sm font-semibold',
                  path === t.href ? 'bg-ink text-canvas' : 'bg-surface border border-line text-ink-2'
                )}
              >
                <Icon name={t.icon} size={14} />
                {t.label}
              </Link>
            ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-6 pb-16">
        {profile?.must_change_password ? (
          <div className="card card-pad mb-6 border-kin/40 bg-kin-soft">
            <div className="font-bold">You&apos;re using a temporary password</div>
            <p className="text-sm text-ink-2 mb-3">Choose your own password now. The temporary one was shared with you by an admin.</p>
            <ChangePassword />
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked; text stays selectable */
        }
      }}
      className="btn-ghost btn-sm h-8 px-3 text-xs"
    >
      <Icon name={done ? 'check' : 'copy'} size={13} />
      {done ? 'Copied' : label}
    </button>
  );
}

export function Toast({ message, tone = 'ok', onDone }: { message: string | null; tone?: 'ok' | 'err'; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div
      role="status"
      className={cx(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full px-5 py-3 text-sm font-semibold shadow-lift animate-rise',
        tone === 'ok' ? 'bg-ink text-canvas' : 'bg-sakura text-white'
      )}
    >
      {message}
    </div>
  );
}
