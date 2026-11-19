'use client';

import type { ReactNode } from 'react';
import type { MasteryBand } from '@/lib/learn-store';
import { Icon, type IconName } from './icons';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Yoisho hanko-style mark. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="relative grid place-items-center rounded-[30%] bg-brand text-brand-ink shadow-brand shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="font-mincho font-extrabold leading-none" style={{ fontSize: size * 0.56 }}>
        よ
      </span>
      <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-ink ring-2 ring-canvas" />
    </div>
  );
}

export function Ring({
  value,
  size = 72,
  stroke = 7,
  tone = 'brand',
  children,
}: {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  tone?: 'brand' | 'matcha' | 'sakura' | 'ai' | 'kin' | 'white';
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = tone === 'white' ? 'rgb(255 255 255)' : `rgb(var(--${tone}))`;
  const track = tone === 'white' ? 'rgb(255 255 255 / .25)' : 'rgb(var(--sunken))';
  return (
    <div className="relative grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Bar({ value, tone = 'brand', className }: { value: number; tone?: string; className?: string }) {
  return (
    <div className={cx('h-2 rounded-full bg-sunken overflow-hidden', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: `rgb(var(--${tone}))` }}
      />
    </div>
  );
}

export const BAND_META: Record<MasteryBand, { label: string; tone: string; jp: string }> = {
  mastered: { label: 'Mastered', tone: 'matcha', jp: '習得' },
  learning: { label: 'Learning', tone: 'kin', jp: '学習中' },
  weak: { label: 'Needs work', tone: 'sakura', jp: '要復習' },
  new: { label: 'New', tone: 'ai', jp: '新規' },
};

export function BandChip({ band }: { band: MasteryBand }) {
  const m = BAND_META[band];
  return (
    <span className="chip" style={{ background: `rgb(var(--${m.tone}-soft))`, color: `rgb(var(--${m.tone}))` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(var(--${m.tone}))` }} />
      {m.label}
    </span>
  );
}

export function recallTone(r: number) {
  return r >= 0.85 ? 'matcha' : r >= 0.65 ? 'kin' : 'sakura';
}

export function SectionTitle({
  title,
  jp,
  sub,
  action,
}: {
  title: string;
  jp?: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        {jp && <div className="font-jp text-xs text-brand font-medium mb-0.5">{jp}</div>}
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {sub && <p className="text-sm text-ink-3 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  icon,
  label,
  value,
  unit,
  hint,
  tone = 'brand',
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span
          className="grid h-9 w-9 place-items-center rounded-2xl"
          style={{ background: `rgb(var(--${tone}-soft))`, color: `rgb(var(--${tone}))` }}
        >
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold tracking-tight tabular">{value}</span>
        {unit && <span className="text-sm text-ink-3 font-medium">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="hidden sm:inline-grid min-w-[20px] h-5 px-1 place-items-center rounded-md border border-current/20 bg-black/5 text-[10px] font-semibold opacity-70">
      {children}
    </kbd>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card card-pad text-center py-14 animate-rise">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-brand-soft text-brand">
        <Icon name={icon} size={26} />
      </div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">{body}</p>
      {action && <div className="mt-6 flex justify-center gap-3">{action}</div>}
    </div>
  );
}
