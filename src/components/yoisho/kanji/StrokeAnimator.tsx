'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StrokeData } from './strokes';
import { GuideGrid } from './strokes';
import { Icon } from '../icons';
import { cx } from '../ui';

const SPEEDS = [0.5, 1, 2] as const;

/** Animated stroke order: draws each stroke in turn, with step controls, speed and stroke numbers. */
export default function StrokeAnimator({ char, data, size = 320 }: { char: string; data: StrokeData; size?: number }) {
  const total = data.s.length;
  const [shown, setShown] = useState(0); // strokes fully drawn
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [numbers, setNumbers] = useState(true);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    setShown(0);
    setPlaying(true);
  }, [char]);

  const onEnd = useCallback(() => setShown((n) => Math.min(n + 1, total)), [total]);

  // At the end: stop, or start over after a short pause when looping.
  useEffect(() => {
    if (!playing || shown < total) return;
    if (!loop) return setPlaying(false);
    const t = setTimeout(() => setShown(0), 900);
    return () => clearTimeout(t);
  }, [shown, total, loop, playing]);

  const animating = playing && shown < total;
  const dur = 0.55 / speed;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 109 109" width={size} height={size} className="max-w-full h-auto rounded-3xl bg-paper border border-line/70" role="img" aria-label={`Stroke order of ${char}`}>
        <GuideGrid />
        {/* ghost of the whole character */}
        <g fill="none" stroke="rgb(var(--line))" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          {data.s.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g fill="none" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          {data.s.map((d, i) =>
            i < shown ? (
              <path key={`${char}-${i}`} d={d} stroke="rgb(var(--ink))" />
            ) : i === shown && animating ? (
              <path
                key={`${char}-${i}-a-${shown}`}
                d={d}
                stroke="rgb(var(--brand))"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1}
                style={{ animation: `kvg-draw ${dur}s ease-in-out forwards` }}
                onAnimationEnd={onEnd}
              />
            ) : null
          )}
        </g>
        {numbers && (
          <g fontSize={7.5} fontWeight={700} fill="rgb(var(--brand))" style={{ fontFamily: 'inherit' }}>
            {data.n.map(([x, y], i) => (
              <text key={i} x={x} y={y} opacity={i < shown + (animating ? 1 : 0) ? 1 : 0.35}>
                {i + 1}
              </text>
            ))}
          </g>
        )}
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className="btn-ghost btn-sm px-3" aria-label="Previous stroke" onClick={() => (setPlaying(false), setShown((n) => Math.max(0, n - 1)))}>
          <Icon name="arrowLeft" size={15} />
        </button>
        <button
          className="btn-primary btn-sm"
          onClick={() => {
            if (shown >= total) setShown(0);
            setPlaying((p) => !(p && shown < total));
          }}
        >
          <Icon name={animating ? 'clock' : shown >= total ? 'refresh' : 'play'} size={14} />
          {animating ? 'Pause' : shown >= total ? 'Replay' : 'Play'}
        </button>
        <button className="btn-ghost btn-sm px-3" aria-label="Next stroke" onClick={() => (setPlaying(false), setShown((n) => Math.min(total, n + 1)))}>
          <Icon name="arrowRight" size={15} />
        </button>
        <span className="text-sm font-bold tabular text-ink-2 w-14 text-center">
          {shown}/{total}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <div className="flex rounded-full bg-sunken/70 p-0.5">
          {SPEEDS.map((sp) => (
            <button key={sp} onClick={() => setSpeed(sp)} className={cx('h-7 px-3 rounded-full font-bold', speed === sp ? 'bg-surface shadow-card' : 'text-ink-3')}>
              {sp}×
            </button>
          ))}
        </div>
        <button onClick={() => setNumbers((x) => !x)} className={cx('h-8 px-3 rounded-full font-semibold border', numbers ? 'bg-brand-soft text-brand border-brand/30' : 'border-line text-ink-3')}>
          Numbers
        </button>
        <button onClick={() => setLoop((x) => !x)} className={cx('h-8 px-3 rounded-full font-semibold border', loop ? 'bg-brand-soft text-brand border-brand/30' : 'border-line text-ink-3')}>
          Loop
        </button>
      </div>
    </div>
  );
}

/** Textbook-style stroke-order strip: one small frame per stroke, the new stroke highlighted. */
export function StrokeStrip({ data }: { data: StrokeData }) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
      {data.s.map((_, i) => (
        <figure key={i} className="relative">
          <svg viewBox="0 0 109 109" className="w-full h-auto rounded-xl bg-paper border border-line/70">
            <GuideGrid />
            <g fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
              {data.s.slice(0, i + 1).map((d, j) => (
                <path key={j} d={d} stroke={j === i ? 'rgb(var(--brand))' : 'rgb(var(--ink))'} />
              ))}
            </g>
          </svg>
          <figcaption className="absolute left-1.5 top-1 text-[10px] font-bold text-ink-3 tabular">{i + 1}</figcaption>
        </figure>
      ))}
    </div>
  );
}
