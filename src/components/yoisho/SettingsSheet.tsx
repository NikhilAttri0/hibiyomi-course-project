'use client';

import { useEffect, useState } from 'react';
import { useLearn, type ThemeMode } from '@/lib/learn-store';
import { Icon, type IconName } from './icons';
import { cx } from './ui';
import Link from 'next/link';
import { useAccount } from './account';
import MyBatches from './MyBatches';
import ChangePassword from './ChangePassword';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx('relative h-7 w-12 rounded-full transition', on ? 'bg-brand' : 'bg-sunken')}
    >
      <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
    </button>
  );
}

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, resetAll, student, xp } = useLearn();
  const [confirmReset, setConfirmReset] = useState(false);
  const account = useAccount();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setConfirmReset(false);
  }, [open]);

  const themes: { id: ThemeMode; label: string; icon: IconName }[] = [
    { id: 'light', label: 'Light', icon: 'sun' },
    { id: 'dark', label: 'Dark', icon: 'moon' },
    { id: 'system', label: 'Auto', icon: 'monitor' },
  ];

  return (
    <div className={cx('fixed inset-0 z-50', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={cx('absolute inset-0 bg-sumi/40 backdrop-blur-sm transition-opacity', open ? 'opacity-100' : 'opacity-0')}
      />
      <aside
        role="dialog"
        aria-label="Settings"
        className={cx(
          'absolute right-0 top-0 h-full w-full max-w-md bg-paper border-l border-line shadow-lift flex flex-col transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-6 h-16 border-b border-line/70">
          <div>
            <div className="font-jp text-[11px] text-brand">設定</div>
            <h2 className="font-extrabold">Settings</h2>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sunken" aria-label="Close settings">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-4 rounded-3xl bg-surface border border-line/70 p-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-brand-ink text-lg font-extrabold">{student.name[0]}</span>
            <div>
              <div className="font-bold">{student.name}</div>
              <div className="text-xs text-ink-3">{account ? account.email : `JLPT ${student.level} track`} · {xp.toLocaleString()} XP</div>
            </div>
          </div>

          {account && <MyBatches userId={account.userId} />}

          {account && (
            <details className="rounded-3xl bg-surface border border-line/70 p-4">
              <summary className="text-sm font-semibold cursor-pointer">Change password</summary>
              <div className="mt-3">
                <ChangePassword />
              </div>
            </details>
          )}

          {account && account.role !== 'student' && (
            <div className="grid grid-cols-2 gap-2">
              <Link href="/teacher" className="btn-ghost btn-sm">
                <Icon name="chart" size={15} /> Teacher view
              </Link>
              {account.role === 'admin' && (
                <Link href="/admin" className="btn-ghost btn-sm">
                  <Icon name="settings" size={15} /> Admin panel
                </Link>
              )}
            </div>
          )}

          <section>
            <div className="eyebrow mb-3">Appearance</div>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => updateSettings({ theme: t.id })}
                  className={cx(
                    'flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-xs font-semibold transition',
                    settings.theme === t.id ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2 hover:border-ink/30'
                  )}
                >
                  <Icon name={t.icon} size={18} />
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="eyebrow">Daily goal</div>
              <div className="text-sm font-bold tabular">{settings.dailyGoal} reviews</div>
            </div>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={settings.dailyGoal}
              onChange={(e) => updateSettings({ dailyGoal: Number(e.target.value) })}
              className="w-full accent-[rgb(var(--brand))]"
              aria-label="Daily goal"
            />
            <div className="flex justify-between text-[11px] text-ink-3 mt-1">
              <span>Casual 5</span>
              <span>Intense 60</span>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="eyebrow">New kanji per day</div>
              <div className="text-sm font-bold tabular">{settings.newPerDay ?? 10}</div>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={settings.newPerDay ?? 10}
              onChange={(e) => updateSettings({ newPerDay: Number(e.target.value) })}
              className="w-full accent-[rgb(var(--brand))]"
              aria-label="New kanji per day"
            />
            <p className="text-[11px] text-ink-3 mt-1">Introduced in Genki order (Lesson 3 → 12). Set 0 to only review.</p>
          </section>

          <section className="rounded-3xl bg-surface border border-line/70 divide-y divide-line/70">
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm font-semibold">Show readings (furigana)</div>
                <div className="text-xs text-ink-3">Display kana under kanji in lists</div>
              </div>
              <Toggle label="Show furigana" on={settings.showFurigana} onChange={(v) => updateSettings({ showFurigana: v })} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm font-semibold">Pronunciation audio</div>
                <div className="text-xs text-ink-3">Uses your device&apos;s Japanese voice</div>
              </div>
              <Toggle label="Audio" on={settings.audio} onChange={(v) => updateSettings({ audio: v })} />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Speech speed</div>
                <div className="text-xs font-bold tabular">{settings.speechRate.toFixed(2)}×</div>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.2}
                step={0.05}
                value={settings.speechRate}
                onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
                className="w-full mt-2 accent-[rgb(var(--brand))]"
                aria-label="Speech speed"
              />
            </div>
          </section>

          <section>
            <div className="eyebrow mb-3">Keyboard shortcuts</div>
            <div className="rounded-3xl bg-surface border border-line/70 p-4 text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <kbd className="font-semibold text-xs bg-sunken rounded-md px-2 py-0.5">Space</kbd><span className="text-ink-2">Flip card</span>
              <kbd className="font-semibold text-xs bg-sunken rounded-md px-2 py-0.5">1 – 4</kbd><span className="text-ink-2">Grade card / pick answer</span>
              <kbd className="font-semibold text-xs bg-sunken rounded-md px-2 py-0.5">Enter</kbd><span className="text-ink-2">Next question</span>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-line/70">
          {confirmReset ? (
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                className="btn flex-1 bg-sakura text-white"
                onClick={() => {
                  resetAll();
                  onClose();
                }}
              >
                {account ? 'Yes, erase my progress' : 'Yes, reset everything'}
              </button>
            </div>
          ) : (
            <button className="btn-ghost w-full text-sakura" onClick={() => setConfirmReset(true)}>
              <Icon name="refresh" size={16} /> {account ? 'Reset my progress' : 'Reset demo progress'}
            </button>
          )}
          {account && (
            <button className="btn-dark w-full mt-2" onClick={() => void account.signOut().then(() => (window.location.href = '/'))}>
              Sign out
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
