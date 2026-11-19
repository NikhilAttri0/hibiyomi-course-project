'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLearn } from '@/lib/learn-store';
import { Icon, type IconName } from './icons';
import { Logo, cx } from './ui';
import SettingsSheet from './SettingsSheet';
import HomeView from './views/HomeView';
import StudyView from './views/StudyView';
import QuizView from './views/QuizView';
import LibraryView from './views/LibraryView';
import ProgressView from './views/ProgressView';
import ClassroomView from './views/ClassroomView';
import VocabView from './views/VocabView';
import { NavContext, type Route } from './nav';
import Link from 'next/link';
import { useAccount } from './account';
import { TrackSwitch } from './TrackSwitch';

const NAV: { id: Route; label: string; jp: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', jp: 'ホーム', icon: 'home' },
  { id: 'classroom', label: 'Classroom', jp: '教室', icon: 'folder' },
  { id: 'study', label: 'Review', jp: '復習', icon: 'cards' },
  { id: 'quiz', label: 'Quiz', jp: 'テスト', icon: 'bolt' },
  { id: 'library', label: 'Kanji Library', jp: '漢字', icon: 'book' },
  { id: 'vocab', label: 'Vocabulary', jp: '語彙', icon: 'note' },
  { id: 'progress', label: 'Progress', jp: '進歩', icon: 'chart' },
];

const ROUTES = new Set<string>(NAV.map((n) => n.id));

function parseHash(): { route: Route; param: string | null } {
  const [r, p] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { route: (ROUTES.has(r) ? r : 'home') as Route, param: p || null };
}

export default function AppShell() {
  const store = useLearn();
  const [{ route, param }, setLoc] = useState<{ route: Route; param: string | null }>({ route: 'home', param: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const account = useAccount();

  // Hash-based routing so refresh, back/forward and deep links all work.
  useEffect(() => {
    const sync = () => setLoc(parseHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const go = useCallback((r: Route, p: string | null = null) => {
    const next = `#/${r}${p ? `/${p}` : ''}`;
    if (window.location.hash !== next) window.location.hash = next;
    else setLoc({ route: r, param: p });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Theme application (system / light / dark).
  const theme = store.settings.theme;
  useEffect(() => {
    if (!store.ready) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, store.ready]);

  if (!store.ready) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-4 animate-pop">
          <Logo size={56} />
          <p className="text-sm text-ink-3 font-jp">よいしょ…</p>
        </div>
      </div>
    );
  }

  const due = store.dueQueue.length;
  // The classroom needs an account (it lives on the server); hide it in the offline demo.
  const nav = account ? NAV : NAV.filter((n) => n.id !== 'classroom');
  const current = NAV.find((n) => n.id === route)!;

  return (
    <NavContext.Provider value={{ route, param, go }}>
      <div className="min-h-screen lg:pl-[272px]">
        {/* ---------------- Desktop sidebar ---------------- */}
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[272px] flex-col border-r border-line/70 bg-paper/80 backdrop-blur-xl px-4 py-6">
          <button onClick={() => go('home')} className="flex items-center gap-3 px-2 text-left">
            <Logo />
            <div>
              <div className="text-[17px] font-extrabold tracking-tight leading-tight">Yoisho Learn</div>
              <div className="text-xs text-ink-3">by Yoisho Academy</div>
            </div>
          </button>

          <TrackSwitch className="mt-6" />

          <nav className="mt-4 flex flex-col gap-1" aria-label="Main">
            {nav.map((n) => {
              const active = route === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => go(n.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'group flex items-center gap-3 rounded-2xl px-3 h-12 text-sm font-semibold transition-all',
                    active ? 'bg-ink text-canvas shadow-lift' : 'text-ink-2 hover:bg-sunken/70 hover:text-ink'
                  )}
                >
                  <span
                    className={cx(
                      'grid h-8 w-8 place-items-center rounded-xl transition',
                      active ? 'bg-brand text-brand-ink' : 'bg-surface border border-line/70 text-ink-2 group-hover:text-brand'
                    )}
                  >
                    <Icon name={n.icon} size={17} />
                  </span>
                  <span className="flex-1 text-left">{n.label}</span>
                  {n.id === 'study' && due > 0 && (
                    <span className="min-w-[24px] h-6 px-1.5 grid place-items-center rounded-full bg-brand text-brand-ink text-xs font-bold tabular">
                      {due}
                    </span>
                  )}
                  {n.id !== 'study' && <span className={cx('font-jp text-[11px]', active ? 'text-canvas/50' : 'text-ink-3/70')}>{n.jp}</span>}
                </button>
              );
            })}
          </nav>

          {account && account.role !== 'student' && (
            <Link
              href={account.role === 'admin' ? '/admin' : '/teacher'}
              className="mt-4 flex items-center gap-3 rounded-2xl px-3 h-11 text-sm font-semibold text-brand bg-brand-soft hover:opacity-90"
            >
              <Icon name="chart" size={17} />
              {account.role === 'admin' ? 'Admin panel' : 'Teacher dashboard'}
              <Icon name="arrowRight" size={15} className="ml-auto" />
            </Link>
          )}

          <div className="mt-auto space-y-3">
            <div className="rounded-3xl bg-sumi text-white p-4 relative overflow-hidden">
              <div className="absolute inset-0 seigaiha opacity-40" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs text-white/60 font-semibold">
                  <Icon name="flame" size={14} className="text-brand" /> STREAK
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular">
                  {store.streak} <span className="text-sm font-semibold text-white/60">days</span>
                </div>
                <div className="mt-3 flex gap-1">
                  {store.last14.slice(-7).map((d) => (
                    <span
                      key={d.date}
                      title={`${d.label}: ${d.reviews} reviews`}
                      className={cx('h-1.5 flex-1 rounded-full', d.reviews > 0 ? 'bg-brand' : 'bg-white/15')}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center gap-3 rounded-2xl p-2 hover:bg-sunken/70 transition text-left"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand font-bold">
                {store.student.name[0]}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold truncate">{store.student.name}</span>
                <span className="block text-xs text-ink-3">
                  JLPT {store.student.level} · {store.xp.toLocaleString()} XP
                  {store.syncStatus !== 'local' && (
                    <span className={store.syncStatus === 'error' ? 'text-sakura' : ''}>
                      {' · '}
                      {store.syncStatus === 'saving' ? 'saving…' : store.syncStatus === 'error' ? 'not saved' : 'saved'}
                    </span>
                  )}
                </span>
              </span>
              <Icon name="settings" size={18} className="text-ink-3" />
            </button>
          </div>
        </aside>

        {/* ---------------- Top bar ---------------- */}
        <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/80 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl flex items-center gap-3 px-4 sm:px-6 lg:px-10 h-16">
            <button onClick={() => go('home')} className="lg:hidden" aria-label="Home">
              <Logo size={34} />
            </button>
            <div className="min-w-0">
              <div className="font-jp text-[11px] text-brand font-medium leading-none">{current.jp}</div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight truncate">{current.label}</h1>
            </div>
            <TrackSwitch compact className="lg:hidden" />
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-surface border border-line/70 h-10 pl-3 pr-4">
                <Icon name="target" size={16} className="text-brand" />
                <span className="text-xs font-semibold tabular">
                  {store.today.reviews}/{store.today.goal}
                </span>
                <div className="w-16 h-1.5 rounded-full bg-sunken overflow-hidden">
                  <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${store.today.pct}%` }} />
                </div>
              </div>
              {route !== 'study' && (
                <button onClick={() => go('study')} className="btn-primary btn-sm">
                  <Icon name="play" size={14} />
                  <span className="hidden sm:inline">Review</span>
                  {due > 0 && <span className="tabular">{due}</span>}
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="lg:hidden grid h-9 w-9 place-items-center rounded-full bg-surface border border-line/70"
                aria-label="Settings"
              >
                <Icon name="settings" size={17} />
              </button>
            </div>
          </div>
        </header>

        {/* ---------------- Page ---------------- */}
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 pt-6 pb-28 lg:pb-12" key={route}>
          {route === 'home' && <HomeView />}
          {route === 'classroom' && <ClassroomView />}
          {route === 'vocab' && <VocabView />}
          {route === 'study' && <StudyView />}
          {route === 'quiz' && <QuizView />}
          {route === 'library' && <LibraryView />}
          {route === 'progress' && <ProgressView />}
        </main>

        {/* ---------------- Mobile tab bar ---------------- */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line/70 bg-paper/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
          aria-label="Main"
        >
          <div className="flex overflow-x-auto no-scrollbar max-w-2xl mx-auto [&>button]:min-w-[64px] [&>button]:flex-1">
            {nav.map((n) => {
              const active = route === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => go(n.id)}
                  className={cx('relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold', active ? 'text-brand' : 'text-ink-3')}
                >
                  <Icon name={n.icon} size={20} />
                  {n.label.split(' ')[0]}
                  {n.id === 'study' && due > 0 && (
                    <span className="absolute top-1.5 right-[22%] h-4 min-w-[16px] px-1 rounded-full bg-brand text-brand-ink text-[9px] grid place-items-center">
                      {due}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </NavContext.Provider>
  );
}
