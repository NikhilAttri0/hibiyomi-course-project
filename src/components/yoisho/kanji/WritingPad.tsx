'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { StrokeData } from './strokes';
import { GuideGrid } from './strokes';
import { Icon } from '../icons';
import { cx } from '../ui';

type Pt = [number, number];
export type WriteMode = 'trace' | 'memory';
export interface WriteResult {
  mistakes: number;
  strokes: number;
  hints: number;
}

const N = 16; // resample points per stroke

function resample(pts: Pt[], n = N): Pt[] {
  if (pts.length === 0) return [];
  if (pts.length === 1) return Array.from({ length: n }, () => pts[0]);
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = seg[seg.length - 1] || 1;
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * L;
    while (j < seg.length - 1 && seg[j] < t) j++;
    const a = pts[j - 1], b = pts[j];
    const span = seg[j] - seg[j - 1] || 1;
    const f = Math.min(1, Math.max(0, (t - seg[j - 1]) / span));
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

const avgDist = (a: Pt[], b: Pt[]) => a.reduce((s, p, i) => s + Math.hypot(p[0] - b[i][0], p[1] - b[i][1]), 0) / a.length;
const lengthOf = (p: Pt[]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);

/** How well a drawn stroke matches an expected one (lower = better), and whether it was drawn backwards. */
function compare(user: Pt[], expected: Pt[], loose: boolean) {
  const u = resample(user);
  const fwd = avgDist(u, expected);
  const rev = avgDist([...u].reverse(), expected);
  const short = lengthOf(expected) < 18;
  const tol = (loose ? 19 : 15) + (short ? 6 : 0);
  const endTol = tol + 8;
  const okShape = fwd <= tol;
  const okEnds =
    Math.hypot(u[0][0] - expected[0][0], u[0][1] - expected[0][1]) <= endTol &&
    Math.hypot(u[N - 1][0] - expected[N - 1][0], u[N - 1][1] - expected[N - 1][1]) <= endTol;
  return { ok: okShape && okEnds, backwards: !okShape && rev <= tol, score: fwd };
}

/**
 * Writing practice canvas. The student draws each stroke; every stroke is checked for shape,
 * position, direction and order against the KanjiVG strokes. After two misses the stroke is shown.
 */
export default function WritingPad({
  char,
  data,
  mode,
  onDone,
}: {
  char: string;
  data: StrokeData;
  mode: WriteMode;
  onDone: (r: WriteResult) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const measureRef = useRef<SVGGElement>(null);
  const [expected, setExpected] = useState<Pt[][] | null>(null);
  const [done, setDone] = useState(0);
  const [drawing, setDrawing] = useState<Pt[] | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [missesHere, setMissesHere] = useState(0);
  const [hints, setHints] = useState(0);
  const [hint, setHint] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [wrong, setWrong] = useState<Pt[] | null>(null);
  const finished = expected !== null && done >= data.s.length;

  // Sample the expected strokes from hidden path elements.
  useEffect(() => {
    const g = measureRef.current;
    if (!g) return;
    const paths = Array.from(g.querySelectorAll('path'));
    setExpected(
      paths.map((p) => {
        const L = p.getTotalLength();
        return Array.from({ length: N }, (_, k) => {
          const q = p.getPointAtLength((k / (N - 1)) * L);
          return [q.x, q.y] as Pt;
        });
      })
    );
  }, [data]);

  const reset = useCallback(() => {
    setDone(0);
    setDrawing(null);
    setMistakes(0);
    setMissesHere(0);
    setHints(0);
    setHint(false);
    setMsg(null);
    setWrong(null);
  }, []);
  useEffect(reset, [char, mode, reset]);

  useEffect(() => {
    if (finished) onDone({ mistakes, strokes: data.s.length, hints });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const toLocal = (e: RPointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 109, ((e.clientY - r.top) / r.height) * 109];
  };

  const end = () => {
    if (!drawing || !expected || finished) return setDrawing(null);
    const user = drawing.length === 1 ? [drawing[0], [drawing[0][0] + 0.5, drawing[0][1] + 0.5] as Pt] : drawing;
    setDrawing(null);
    if (lengthOf(user) < 2 && lengthOf(expected[done]) > 12) return; // stray tap
    const res = compare(user, expected[done], mode === 'memory');
    if (res.ok) {
      setDone((d) => d + 1);
      setMissesHere(0);
      setHint(false);
      setWrong(null);
      setMsg(done + 1 >= data.s.length ? null : { tone: 'ok', text: `Stroke ${done + 1} ✓` });
      return;
    }
    // Which mistake?
    const laterMatch = expected.slice(done + 1).findIndex((e) => compare(user, e, true).ok);
    const text = res.backwards
      ? `Stroke ${done + 1}: right shape, wrong direction — start from the other end.`
      : laterMatch >= 0
        ? `That’s stroke ${done + 2 + laterMatch}. Write stroke ${done + 1} first.`
        : `Stroke ${done + 1} doesn’t match — check its position and shape.`;
    setMistakes((m) => m + 1);
    setWrong(user);
    setMsg({ tone: 'bad', text });
    const misses = missesHere + 1;
    setMissesHere(misses);
    if (misses >= 2 && !hint) {
      setHint(true);
      setHints((h) => h + 1);
    }
  };

  const ghost = mode === 'trace';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[420px]">
        <svg
          ref={svgRef}
          viewBox="0 0 109 109"
          className={cx('w-full h-auto rounded-4xl bg-paper border-2 select-none', finished ? 'border-matcha' : 'border-line/70')}
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            if (finished) return;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setDrawing([toLocal(e)]);
            setWrong(null);
          }}
          onPointerMove={(e) => drawing && setDrawing((d) => (d ? [...d, toLocal(e)] : d))}
          onPointerUp={end}
          onPointerCancel={() => setDrawing(null)}
          role="img"
          aria-label={`Writing area for ${char}`}
        >
          <GuideGrid />
          <g ref={measureRef} fill="none" stroke={ghost ? 'rgb(var(--line))' : 'none'} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            {data.s.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          {/* accepted strokes */}
          <g fill="none" stroke="rgb(var(--ink))" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
            {data.s.slice(0, done).map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          {/* hint: animate the expected stroke */}
          {hint && !finished && (
            <path
              key={`hint-${done}-${hints}`}
              d={data.s[done]}
              fill="none"
              stroke="rgb(var(--brand))"
              strokeOpacity={0.75}
              strokeWidth={3.2}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1}
              style={{ animation: 'kvg-draw .8s ease-in-out forwards' }}
            />
          )}
          {hint && !finished && expected && (
            <circle cx={expected[done][0][0]} cy={expected[done][0][1]} r={2.6} fill="rgb(var(--brand))" />
          )}
          {wrong && <polyline points={wrong.map((p) => p.join(',')).join(' ')} fill="none" stroke="rgb(var(--sakura))" strokeOpacity={0.6} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
          {drawing && <polyline points={drawing.map((p) => p.join(',')).join(' ')} fill="none" stroke="rgb(var(--ai))" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        <div className="absolute right-3 top-3 chip bg-surface/90 border border-line/70 tabular">
          {Math.min(done, data.s.length)}/{data.s.length}
        </div>
      </div>

      <div className="min-h-[24px] text-sm font-medium text-center px-2">
        {msg && <span className={msg.tone === 'ok' ? 'text-matcha' : msg.tone === 'bad' ? 'text-sakura' : 'text-ink-3'}>{msg.text}</span>}
        {!msg && !finished && <span className="text-ink-3">Write stroke {done + 1} of {data.s.length}</span>}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          className="btn-ghost btn-sm"
          disabled={finished}
          onClick={() => {
            setHint(true);
            setHints((h) => h + 1);
          }}
        >
          <Icon name="eye" size={14} /> Hint
        </button>
        <button className="btn-ghost btn-sm" onClick={reset}>
          <Icon name="refresh" size={14} /> Start over
        </button>
      </div>
      <MemoHint mistakes={mistakes} hints={hints} />
    </div>
  );
}

function MemoHint({ mistakes, hints }: { mistakes: number; hints: number }) {
  const label = useMemo(() => (mistakes || hints ? `${mistakes} mistake${mistakes === 1 ? '' : 's'} · ${hints} hint${hints === 1 ? '' : 's'}` : ''), [mistakes, hints]);
  return label ? <div className="text-xs text-ink-3">{label}</div> : null;
}
