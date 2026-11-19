'use client';

import Link from 'next/link';
import { homeFor, useAuth } from '@/lib/auth';
import { Icon, type IconName } from './icons';
import { Logo } from './ui';

const ROLES: { icon: IconName; jp: string; title: string; body: string; points: string[] }[] = [
  {
    icon: 'cards',
    jp: '生徒',
    title: 'Students',
    body: 'Sign up, enter your batch code, and practise every day.',
    points: ['Spaced-repetition review', 'Adaptive quizzes with look-alike traps', 'Your progress follows you to any device'],
  },
  {
    icon: 'chart',
    jp: '先生',
    title: 'Teachers',
    body: 'See only the batches assigned to you, and who needs help.',
    points: ['Mastery and activity per student', 'Kanji the whole batch is forgetting', 'Share the join code with new students'],
  },
  {
    icon: 'settings',
    jp: '管理者',
    title: 'Admins',
    body: 'Run the academy: batches, teachers and people.',
    points: ['Create batches with join codes', 'Assign teachers to batches', 'Create teacher logins, change roles'],
  },
];

export default function Landing() {
  const { session, profile, configured } = useAuth();
  const signedIn = !!session && !!profile;

  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-6xl flex items-center gap-3 px-5 sm:px-8 h-20">
        <Logo size={38} />
        <div>
          <div className="font-extrabold leading-tight">Yoisho Learn</div>
          <div className="text-xs text-ink-3">by Yoisho Academy</div>
        </div>
        <nav className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link href={homeFor(profile!.role)} className="btn-primary btn-sm">
              Open dashboard <Icon name="arrowRight" size={14} />
            </Link>
          ) : configured ? (
            <>
              <Link href="/login" className="btn-ghost btn-sm">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary btn-sm">
                Create account
              </Link>
            </>
          ) : (
            <Link href="/app" className="btn-primary btn-sm">
              Try the demo
            </Link>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8 pb-20">
        <section className="relative overflow-hidden rounded-4xl bg-brand text-white shadow-brand mt-2">
          <div className="absolute inset-0 seigaiha opacity-70" />
          <div className="absolute right-4 sm:right-10 -bottom-10 sm:-bottom-16 font-mincho font-extrabold text-[180px] sm:text-[300px] leading-none text-white/15 select-none">
            待
          </div>
          <div className="relative p-7 sm:p-12 max-w-2xl">
            <span className="chip bg-white/20 text-white">
              <Icon name="sparkle" size={13} /> Adaptive kanji practice for Yoisho Academy
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
              What are you about to forget? Review that first.
            </h1>
            <p className="mt-4 text-white/85 text-lg leading-relaxed max-w-xl">
              Yoisho Learn tracks each student&apos;s memory of every kanji and schedules the next review just before it fades.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {signedIn ? (
                <Link href={homeFor(profile!.role)} className="btn bg-white text-[#141414] hover:bg-white/90 h-12 px-6">
                  Continue as {profile!.full_name || profile!.email}
                </Link>
              ) : (
                <>
                  <Link href={configured ? '/signup' : '/app'} className="btn bg-white text-[#141414] hover:bg-white/90 h-12 px-6">
                    {configured ? 'I’m a student — sign up' : 'Open the practice demo'}
                  </Link>
                  {configured && (
                    <Link href="/login" className="btn bg-black/15 border border-white/25 text-white hover:bg-black/25 h-12 px-6">
                      Teacher or admin sign in
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.title} className="card card-pad">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Icon name={r.icon} size={20} />
              </span>
              <div className="mt-4 font-jp text-xs text-brand">{r.jp}</div>
              <h2 className="text-xl font-extrabold">{r.title}</h2>
              <p className="mt-1 text-sm text-ink-3">{r.body}</p>
              <ul className="mt-4 space-y-2">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-ink-2">
                    <Icon name="check" size={16} className="text-matcha shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-4xl bg-sumi text-white p-7 sm:p-10 relative overflow-hidden">
          <div className="absolute inset-0 seigaiha opacity-25" />
          <div className="relative grid gap-6 md:grid-cols-3">
            {[
              ['1', 'Admin creates a batch', 'Each batch gets a join code like N5-7KQ2XM and one or more teachers.'],
              ['2', 'Students join with the code', 'At sign-up or later from Settings. They start practising right away.'],
              ['3', 'Teachers follow progress', 'Mastery, streaks and the kanji the batch is forgetting, in one place.'],
            ].map(([n, t, b]) => (
              <div key={n}>
                <div className="font-mincho text-4xl font-bold text-brand">{['一', '二', '三'][Number(n) - 1]}</div>
                <div className="mt-2 font-bold">{t}</div>
                <p className="mt-1 text-sm text-white/65">{b}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
