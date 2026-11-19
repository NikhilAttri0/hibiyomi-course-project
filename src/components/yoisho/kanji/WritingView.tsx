'use client';

import { useEffect, useMemo, useState } from 'react';
import { KANJI_BY_ID, lessonOf, primaryReading, speakJapanese, useLearn } from '@/lib/learn-store';
import { saveQuizResult } from '@/lib/classroom-api';
import { useNav } from '../nav';
import { Icon } from '../icons';
import { Ring, cx } from '../ui';
import WritingPad, { type WriteMode, type WriteResult } from './WritingPad';
import { KANJIVG_CREDIT, useStrokes } from './strokes';
import { LessonPicker, useLessonState } from './LessonPicker';

/** Kanji Library → Writing practice: write each kanji of a lesson stroke by stroke, with feedback. */
export default function WritingView({ initialId }: { initialId?: string | null }) {
  const s = useLearn();
  const { go } = useNav();
  const { data, error } = useStrokes();
  const init = initialId ? KANJI_BY_ID[initialId] : undefined;
  const [lesson, setLesson] = useLessonState(init ? lessonOf(init) : undefined);
  const [mode, setMode] = useState<WriteMode>('trace');
  const list = useMemo(() => s.deck.filter((k) => lessonOf(k) === lesson), [s.deck, lesson]);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [session, setSession] = useState<Record<string, WriteResult>>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const i = init ? list.findIndex((k) => k.id === init.id) : -1;
    setIdx(i >= 0 ? i : 0);
    setResult(null);
    setSession({});
  }, [lesson, list, init]);

  const k = list[idx];
  const sd = k && data ? data[k.character] : undefined;
  const allDone = list.length > 0 && Object.keys(session).length >= list.length;

  const finish = (r: WriteResult) => {
    setResult(r);
    if (!k) return;
    const next = { ...session, [k.id]: r };
    setSession(next);
    if (mode === 'memory') {
      s.recordQuiz(k.id, 'writing', r.mistakes === 0 && r.hints === 0);
      if (Object.keys(next).length === list.length)
        saveQuizResult({ kind: 'writing', track: s.track, lesson, score: Object.values(next).filter((x) => !x.mistakes && !x.hints).length, total: list.length });
    }
  };

  const goTo = (i: number) => {
    setIdx((i + list.length) % list.length);
    setResult(null);
  };

  return (
    <div className="space-y-5">
      <LessonPicker lesson={lesson} onChange={(l) => (setLesson(l), go('library', 'write'))} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-sunken/70 p-1">
          {(
            [
              ['trace', 'Trace', 'Outline shown'],
              ['memory', 'From memory', 'Counts toward your writing score'],
            ] as const
          ).map(([m, label, hint]) => (
            <button
              key={m}
              title={hint}
              onClick={() => (setMode(m), setResult(null), setSession({}))}
              className={cx('h-9 px-4 rounded-full text-sm font-semibold transition', mode === m ? 'bg-surface shadow-card text-ink' : 'text-ink-3')}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-3">{mode === 'trace' ? 'Follow the grey outline.' : 'Write it without the outline — counts toward your writing score.'}</span>
        <span className="ml-auto text-sm font-bold tabular text-ink-2">
          {Object.keys(session).length}/{list.length} written
        </span>
      </div>

      {error && <div className="card card-pad text-sm text-sakura">{error}</div>}
      {!data && !error && <div className="card card-pad text-sm text-ink-3">Loading stroke data…</div>}

      {k && sd && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <div className="card card-pad">
            <WritingPad key={`${k.id}-${mode}-${attempt}`} char={k.character} data={sd} mode={mode} onDone={finish} />
          </div>
          <div className="space-y-4">
            <div className="card card-pad">
              <div className="eyebrow">Write this kanji</div>
              <div className="mt-2 text-2xl font-extrabold">{k.meanings.join(', ')}</div>
              <div className="font-jp text-ink-2 mt-1 flex items-center gap-2">
                {[...(k.kunyomi ?? []), ...(k.onyomi ?? [])].slice(0, 4).join('、')}
                <button
                  className="grid h-8 w-8 place-items-center rounded-full bg-sunken hover:text-brand"
                  aria-label="Listen"
                  disabled={!s.settings.audio}
                  onClick={() => speakJapanese(primaryReading(k), s.settings.speechRate)}
                >
                  <Icon name="speaker" size={14} />
                </button>
              </div>
              <div className="mt-2 flex gap-1.5">
                <span className="chip bg-brand-soft text-brand">{sd.s.length} strokes</span>
                <span className="chip bg-sunken text-ink-2">
                  {idx + 1} of {list.length}
                </span>
              </div>
            </div>

            {result && (
              <div className={cx('card card-pad animate-pop', !result.mistakes && !result.hints ? 'border-matcha' : '')}>
                <div className="flex items-center gap-4">
                  <span className="font-mincho text-5xl font-bold">{k.character}</span>
                  <div>
                    <div className={cx('font-extrabold text-lg', !result.mistakes && !result.hints ? 'text-matcha' : 'text-kin')}>
                      {!result.mistakes && !result.hints ? 'Perfect stroke order!' : 'Done — keep practising'}
                    </div>
                    <div className="text-xs text-ink-3">
                      {result.mistakes} mistake{result.mistakes === 1 ? '' : 's'} · {result.hints} hint{result.hints === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="btn-ghost btn-sm" onClick={() => (setResult(null), setAttempt((a) => a + 1))}>
                    <Icon name="refresh" size={14} /> Again
                  </button>
                  <button className="btn-primary btn-sm flex-1" onClick={() => goTo(idx + 1)}>
                    Next kanji <Icon name="arrowRight" size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn-ghost btn-sm flex-1" onClick={() => goTo(idx - 1)}>
                <Icon name="arrowLeft" size={14} /> Previous
              </button>
              <button className="btn-ghost btn-sm flex-1" onClick={() => go('library', `strokes:${k.id}`)}>
                <Icon name="play" size={14} /> Watch strokes
              </button>
              <button className="btn-ghost btn-sm flex-1" onClick={() => goTo(idx + 1)}>
                Skip <Icon name="arrowRight" size={14} />
              </button>
            </div>

            {allDone && (
              <div className="card card-pad text-center">
                {(() => {
                  const perfect = Object.values(session).filter((x) => !x.mistakes && !x.hints).length;
                  const pct = Math.round((perfect / list.length) * 100);
                  return (
                    <>
                      <Ring value={pct} size={96} stroke={9} tone={pct >= 80 ? 'matcha' : pct >= 50 ? 'kin' : 'sakura'}>
                        <div className="text-xl font-extrabold tabular">{pct}%</div>
                      </Ring>
                      <div className="mt-2 font-bold">Lesson {lesson} written</div>
                      <div className="text-xs text-ink-3">
                        {perfect}/{list.length} with perfect stroke order{mode === 'trace' ? ' (trace mode)' : ''}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {list.map((x, i) => {
                const r = session[x.id];
                return (
                  <button
                    key={x.id}
                    onClick={() => goTo(i)}
                    className={cx(
                      'grid h-9 w-9 place-items-center rounded-lg font-mincho font-bold border text-lg',
                      i === idx ? 'border-ink' : 'border-line/70',
                      r ? (!r.mistakes && !r.hints ? 'bg-matcha-soft text-matcha' : 'bg-kin-soft text-kin') : 'bg-surface'
                    )}
                  >
                    {x.character}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-3">{KANJIVG_CREDIT}</p>
          </div>
        </div>
      )}
    </div>
  );
}
