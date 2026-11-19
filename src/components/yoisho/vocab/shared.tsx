'use client';

import { useCallback, useEffect, useState } from 'react';
import { speakJapanese, useLearn } from '@/lib/learn-store';
import type { QuizWord } from '../WordQuiz';
import { Icon } from '../icons';

export function Speak({ text, label }: { text: string; label: string }) {
  const s = useLearn();
  return (
    <button
      type="button"
      disabled={!s.settings.audio}
      onClick={(e) => {
        e.stopPropagation();
        speakJapanese(text, s.settings.speechRate);
      }}
      aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sunken text-ink-2 hover:text-brand"
    >
      <Icon name="speaker" size={15} />
    </button>
  );
}

export function Flashcards({ words }: { words: QuizWord[] }) {
  const s = useLearn();
  const [order, setOrder] = useState<number[]>(() => words.map((_, i) => i));
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [front, setFront] = useState<'jp' | 'en'>('jp');
  useEffect(() => {
    setOrder(words.map((_, k) => k));
    setI(0);
    setShown(false);
  }, [words]);
  const w = words[order[i]];
  const next = useCallback((d: number) => {
    setShown(false);
    setI((x) => (x + d + order.length) % order.length);
  }, [order.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setShown((x) => !x);
      }
      if (e.key === 'ArrowRight') next(1);
      if (e.key === 'ArrowLeft') next(-1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [next]);
  if (!w) return <div className="card card-pad text-sm text-ink-3">No words in this lesson yet.</div>;
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold tabular text-ink-2 flex-1">
          {i + 1} / {order.length}
        </span>
        <button className="btn-ghost btn-sm" onClick={() => setFront((f) => (f === 'jp' ? 'en' : 'jp'))}>
          Show {front === 'jp' ? 'English' : 'Japanese'} first
        </button>
        <button
          className="btn-ghost btn-sm"
          onClick={() => {
            const o = [...order];
            for (let a = o.length - 1; a > 0; a--) {
              const b = Math.floor(Math.random() * (a + 1));
              [o[a], o[b]] = [o[b], o[a]];
            }
            setOrder(o);
            setI(0);
            setShown(false);
          }}
        >
          <Icon name="refresh" size={14} /> Shuffle
        </button>
      </div>
      <button onClick={() => setShown((x) => !x)} className="card w-full min-h-[300px] p-8 grid place-items-center text-center relative overflow-hidden">
        <div className="absolute inset-0 paper-grain opacity-60" />
        <div className="relative">
          {front === 'jp' ? (
            <div className="font-jp text-5xl sm:text-6xl font-bold">{w.term}</div>
          ) : (
            <div className="text-2xl sm:text-3xl font-extrabold">{w.meaning}</div>
          )}
          {shown ? (
            <div className="mt-5 space-y-1 animate-rise">
              {w.kana && <div className="font-jp text-xl text-brand">{w.kana}</div>}
              {front === 'jp' ? <div className="text-lg font-semibold">{w.meaning}</div> : <div className="font-jp text-4xl font-bold">{w.term}</div>}
            </div>
          ) : (
            <div className="mt-6 text-sm text-ink-3">Tap to reveal · Space</div>
          )}
        </div>
      </button>
      <div className="flex items-center justify-center gap-3">
        <button className="btn-ghost" onClick={() => next(-1)}>
          <Icon name="arrowLeft" size={16} /> Prev
        </button>
        <button className="btn-ghost px-4" disabled={!s.settings.audio} onClick={() => speakJapanese(w.kana || w.term, s.settings.speechRate)} aria-label="Listen">
          <Icon name="speaker" size={16} />
        </button>
        <button className="btn-primary" onClick={() => next(1)}>
          Next <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </div>
  );
}

