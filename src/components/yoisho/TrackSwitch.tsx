'use client';

import { TRACKS, useLearn } from '@/lib/learn-store';
import { cx } from './ui';

/**
 * Shows which course the student is in (N5 = Genki I, N4 = Genki II).
 * Students only see the tracks of their batches; a switch appears only when they have more than one.
 */
export function TrackSwitch({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { track, tracks, setTrack } = useLearn();
  const info = TRACKS.find((t) => t.id === track)!;

  if (tracks.length < 2) {
    return (
      <div className={cx('rounded-2xl border border-line/70 bg-surface', compact ? 'px-2.5 py-1' : 'px-3 py-2.5', className)}>
        <div className={cx('font-extrabold text-brand leading-tight', compact ? 'text-xs' : 'text-sm')}>JLPT {track}</div>
        {!compact && <div className="text-xs text-ink-3">{info.book} · {info.lessons}</div>}
      </div>
    );
  }

  return (
    <div className={cx('rounded-2xl bg-sunken/70 p-1 grid grid-cols-2 gap-1', compact ? 'w-[120px]' : '', className)} role="tablist" aria-label="Course level">
      {TRACKS.filter((t) => tracks.includes(t.id)).map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === track}
          onClick={() => setTrack(t.id)}
          className={cx(
            'rounded-xl text-center transition',
            compact ? 'py-1 text-xs font-extrabold' : 'py-2',
            t.id === track ? 'bg-surface shadow-card text-brand' : 'text-ink-3 hover:text-ink'
          )}
        >
          <div className={cx('font-extrabold leading-tight', compact ? '' : 'text-sm')}>{t.id}</div>
          {!compact && <div className="text-[10px] font-semibold opacity-80">{t.book}</div>}
        </button>
      ))}
    </div>
  );
}
