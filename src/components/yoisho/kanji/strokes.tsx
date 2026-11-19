'use client';

import { useEffect, useState } from 'react';

/** KanjiVG stroke data (CC BY-SA 3.0, Ulrich Apel) for the Genki kanji: path per stroke + number label positions. */
export interface StrokeData {
  s: string[]; // SVG path "d" per stroke, in a 109×109 box, in stroke order
  n: [number, number][]; // where to draw each stroke number
}
export type StrokeMap = Record<string, StrokeData>;

let cache: StrokeMap | null = null;
let pending: Promise<StrokeMap> | null = null;

export function loadStrokes(): Promise<StrokeMap> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch('/kanjivg/strokes.json')
    .then((r) => {
      if (!r.ok) throw new Error('Could not load stroke data');
      return r.json() as Promise<StrokeMap>;
    })
    .then((d) => (cache = d))
    .catch((e) => {
      pending = null;
      throw e;
    });
  return pending;
}

export function useStrokes() {
  const [data, setData] = useState<StrokeMap | null>(cache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (cache) return;
    loadStrokes()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return { data, error };
}

export const KANJIVG_CREDIT = 'Stroke data: KanjiVG © Ulrich Apel, CC BY-SA 3.0';

/** Faint guide grid (cross + border) used behind stroke diagrams. */
export function GuideGrid({ dashed = true }: { dashed?: boolean }) {
  return (
    <g stroke="rgb(var(--line))" strokeWidth={0.6} fill="none">
      <rect x={0.5} y={0.5} width={108} height={108} rx={6} />
      <line x1={54.5} y1={2} x2={54.5} y2={107} strokeDasharray={dashed ? '2 2' : undefined} />
      <line x1={2} y1={54.5} x2={107} y2={54.5} strokeDasharray={dashed ? '2 2' : undefined} />
    </g>
  );
}
