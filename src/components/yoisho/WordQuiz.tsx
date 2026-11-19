'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveQuizResult } from '@/lib/classroom-api';
import { speakJapanese, useLearn } from '@/lib/learn-store';
import { Icon } from './icons';
import { Kbd, Ring, cx } from './ui';

export interface QuizWord {
  term: string;
  kana: string;
  meaning: string;
  category?: string;
}

type Mode = 'meaning' | 'japanese' | 'reading' | 'mixed';
type QMode = Exclude<Mode, 'mixed'>;

interface Q {
  w: QuizWord;
  mode: QMode;
  options: QuizWord[];
}

const shuffle = <T,>(a: T[]) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

const hasKanji = (w: QuizWord) => !!w.kana && w.term !== w.kana;
const keyOf = (w: QuizWord) => `${w.term}|${w.kana}|${w.meaning}`;
const label = (w: QuizWord, mode: QMode) => (mode === 'meaning' ? w.meaning : mode === 'reading' ? w.kana : w.term);

function options(w: QuizWord, mode: QMode, pool: QuizWord[]): QuizWord[] {
  const out: QuizWord[] = [];
  const seen = new Set([label(w, mode)]);
  const tryAdd = (x: QuizWord) => {
    const l = label(x, mode);
    if (out.length >= 3 || !l || seen.has(l)) return;
    seen.add(l);
    out.push(x);
  };
  const candidates = mode === 'reading' ? pool.filter(hasKanji) : pool;
  shuffle(candidates.filter((x) => x.category && x.category === w.category)).forEach(tryAdd);
  shuffle(candidates).forEach(tryAdd);
  return shuffle([w, ...out]);
}

const MODES: { id: Mode; title: string; desc: string }[] = [
  { id: 'meaning', title: 'Meaning', desc: 'See Japanese → pick English' },
  { id: 'japanese', title: 'Japanese', desc: 'See English → pick Japanese' },
  { id: 'reading', title: 'Reading', desc: 'See kanji → pick the reading' },
  { id: 'mixed', title: 'Mixed', desc: 'All three' },
];

/** Multiple-choice quiz over any word list (lesson vocabulary or kanji words). Self-contained, not graded into SRS. */
export default function WordQuiz({
  words,
  title,
  onClose,
  record,
}: {
  words: QuizWord[];
  title: string;
  onClose?: () => void;
  /** Saves the finished quiz for the batch leaderboard and badges. */
  record?: { kind: 'vocab' | 'kanji-words'; lesson?: number | null };
}) {
  const s = useLearn();
  const [mode, setMode] = useState<Mode>('meaning');
  const [length, setLength] = useState<number>(10);
  const [qs, setQs] = useState<Q[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<{ q: Q; ok: boolean }[]>([]);

  const readable = useMemo(() => words.filter(hasKanji), [words]);
  const enough = words.length >= 4;

  const start = useCallback(
    (from?: QuizWord[]) => {
      const base = from ?? words;
      const n = length === 0 ? base.length : Math.min(length, base.length);
      const list = shuffle(base).slice(0, n);
      const built = list.map((w, i) => {
        let m: QMode = mode === 'mixed' ? (['meaning', 'japanese', 'reading'] as const)[i % 3] : mode;
        if (m === 'reading' && (!hasKanji(w) || readable.length < 4)) m = 'meaning';
        return { w, mode: m, options: options(w, m, words) };
      });
      saved.current = false;
      setQs(built);
      setIdx(0);
      setPicked(null);
      setResults([]);
    },
    [words, length, mode, readable.length]
  );

  const q = qs?.[idx];
  const saved = useRef(false);
  useEffect(() => {
    if (qs && !q && results.length === qs.length && results.length > 0 && !saved.current) {
      saved.current = true;
      if (record) saveQuizResult({ ...record, track: s.track, score: results.filter((r) => r.ok).length, total: results.length });
    }
  }, [qs, q, results, record, s.track]);

  const choose = useCallback(
    (o: QuizWord) => {
      if (!q || picked) return;
      const ok = label(o, q.mode) === label(q.w, q.mode);
      setPicked(keyOf(o));
      setResults((r) => [...r, { q, ok }]);
      if (s.settings.audio) speakJapanese(q.w.kana || q.w.term, s.settings.speechRate);
    },
    [q, picked, s.settings.audio, s.settings.speechRate]
  );
  const next = useCallback(() => {
    setPicked(null);
    setIdx((i) => i + 1);
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!q) return;
      const n = Number(e.key);
      if (!picked && n >= 1 && n <= q.options.length) choose(q.options[n - 1]);
      if (picked && (e.key === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [q, picked, choose, next]);

  /* ------------------------------ setup ------------------------------ */
  if (!qs) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-rise">
        <div className="card card-pad">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Icon name="bolt" size={20} />
            </span>
            <div className="flex-1">
              <h3 className="font-extrabold text-lg">{title}</h3>
              <p className="text-sm text-ink-3">{words.length} words in this set</p>
            </div>
            {onClose && (
              <button className="grid h-9 w-9 place-items-center rounded-full bg-sunken" onClick={onClose} aria-label="Close quiz">
                <Icon name="x" size={15} />
              </button>
            )}
          </div>
          {!enough ? (
            <p className="mt-4 text-sm text-ink-3">A quiz needs at least 4 words.</p>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MODES.map((m) => {
                  const disabled = m.id === 'reading' && readable.length < 4;
                  return (
                    <button
                      key={m.id}
                      disabled={disabled}
                      onClick={() => setMode(m.id)}
                      className={cx(
                        'rounded-2xl border p-3 text-left transition disabled:opacity-40',
                        mode === m.id ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-ink/25'
                      )}
                    >
                      <div className="font-bold text-sm">{m.title}</div>
                      <div className="text-[11px] text-ink-3 leading-snug mt-0.5">{m.desc}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="eyebrow mr-1">Length</span>
                {[10, 20, 0].map((n) => (
                  <button
                    key={n}
                    onClick={() => setLength(n)}
                    className={cx('h-9 px-4 rounded-full text-sm font-bold transition', length === n ? 'bg-ink text-canvas' : 'bg-sunken/70 text-ink-2')}
                  >
                    {n === 0 ? `All ${words.length}` : `${Math.min(n, words.length)} Qs`}
                  </button>
                ))}
              </div>
              <button className="btn-primary w-full h-12 mt-5" onClick={() => start()}>
                <Icon name="play" size={16} /> Start quiz
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ results ------------------------------ */
  if (!q) {
    const score = results.filter((r) => r.ok).length;
    const pct = Math.round((score / Math.max(1, results.length)) * 100);
    const wrong = results.filter((r) => !r.ok);
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pop">
        <div className="card card-pad text-center py-8">
          <Ring value={pct} size={120} stroke={10} tone={pct >= 80 ? 'matcha' : pct >= 60 ? 'kin' : 'sakura'}>
            <div>
              <div className="text-3xl font-extrabold tabular">{pct}%</div>
              <div className="text-xs text-ink-3">
                {score}/{results.length}
              </div>
            </div>
          </Ring>
          <h3 className="mt-4 text-lg font-extrabold">{pct === 100 ? '満点！ Perfect score' : pct >= 80 ? 'よくできました！' : 'Keep going — がんばって！'}</h3>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {wrong.length > 0 && (
              <button className="btn-primary" onClick={() => start(wrong.map((r) => r.q.w))}>
                <Icon name="refresh" size={15} /> Retry {wrong.length} mistake{wrong.length === 1 ? '' : 's'}
              </button>
            )}
            <button className="btn-ghost" onClick={() => start()}>
              New quiz
            </button>
            <button className="btn-ghost" onClick={() => setQs(null)}>
              Change settings
            </button>
          </div>
        </div>
        {wrong.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 pt-4 pb-2 eyebrow">Review these</div>
            <ul className="divide-y divide-line/60">
              {wrong.map(({ q: x }, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className="font-jp text-lg font-bold">{x.w.term}</span>
                  <span className="font-jp text-sm text-ink-3">{x.w.kana !== x.w.term ? x.w.kana : ''}</span>
                  <span className="flex-1 text-sm">{x.w.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------ question ------------------------------ */
  const prompt = q.mode === 'japanese' ? q.w.meaning : q.w.term;
  const ask = q.mode === 'meaning' ? 'What does this mean?' : q.mode === 'reading' ? 'How is this read?' : 'Which is the Japanese?';
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setQs(null)} className="grid h-9 w-9 place-items-center rounded-full bg-surface border border-line/70" aria-label="Stop quiz">
          <Icon name="x" size={15} />
        </button>
        <div className="flex-1 h-2.5 rounded-full bg-sunken overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${(idx / qs.length) * 100}%` }} />
        </div>
        <span className="text-sm font-bold tabular text-ink-2">
          {idx + 1}/{qs.length}
        </span>
      </div>
      <div className="card p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 paper-grain opacity-60" />
        <div className="relative">
          <div className="eyebrow">{ask}</div>
          <div className={cx('mt-4 font-bold', q.mode === 'japanese' ? 'text-2xl sm:text-3xl' : 'font-jp text-5xl sm:text-6xl')}>{prompt}</div>
          {q.w.category && <div className="mt-3 text-xs text-ink-3">{q.w.category}</div>}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {q.options.map((o, i) => {
          const isRight = label(o, q.mode) === label(q.w, q.mode);
          const isPicked = picked === keyOf(o);
          return (
            <button
              key={keyOf(o)}
              onClick={() => choose(o)}
              disabled={!!picked}
              className={cx(
                'flex items-center gap-3 rounded-3xl border p-4 text-left transition min-h-[64px]',
                !picked && 'bg-surface border-line hover:border-brand/60',
                picked && isRight && 'bg-matcha-soft border-matcha',
                picked && isPicked && !isRight && 'bg-sakura-soft border-sakura',
                picked && !isRight && !isPicked && 'opacity-50 bg-surface border-line'
              )}
            >
              <Kbd>{i + 1}</Kbd>
              <span className={cx('flex-1 font-semibold', q.mode !== 'meaning' && 'font-jp text-lg')}>{label(o, q.mode)}</span>
              {picked && isRight && <Icon name="check" size={18} className="text-matcha" />}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="flex items-center gap-3 rounded-3xl bg-surface border border-line/70 p-4 animate-rise">
          <div className="flex-1 min-w-0">
            <span className="font-jp font-bold text-lg">{q.w.term}</span>
            {q.w.kana && q.w.kana !== q.w.term && <span className="font-jp text-ink-3 ml-2">{q.w.kana}</span>}
            <span className="ml-2 text-sm">— {q.w.meaning}</span>
          </div>
          <button className="btn-primary" onClick={next}>
            {idx + 1 === qs.length ? 'See results' : 'Next'} <Icon name="arrowRight" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
