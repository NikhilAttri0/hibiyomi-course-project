'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KANJI_BY_ID,
  formatInterval,
  scheduleNext,
  speakJapanese,
  useLearn,
  vocabFor,
  type Grade,
} from '@/lib/learn-store';
import { Icon } from '../icons';
import { useNav } from '../nav';
import { Empty, Kbd, cx, recallTone } from '../ui';

const GRADES: { id: Grade; label: string; jp: string; tone: string; key: string }[] = [
  { id: 'again', label: 'Again', jp: 'もう一度', tone: 'sakura', key: '1' },
  { id: 'hard', label: 'Hard', jp: '難しい', tone: 'kin', key: '2' },
  { id: 'good', label: 'Good', jp: '良い', tone: 'matcha', key: '3' },
  { id: 'easy', label: 'Easy', jp: '簡単', tone: 'ai', key: '4' },
];

interface Session {
  queue: string[];
  index: number;
  results: Record<Grade, number>;
  total: number;
}

export default function StudyView() {
  const s = useLearn();
  const { go, param } = useNav();
  const [session, setSession] = useState<Session | null>(null);
  const [flipped, setFlipped] = useState(false);

  const start = useCallback(
    (ids: string[]) => {
      setSession({ queue: ids, index: 0, results: { again: 0, hard: 0, good: 0, easy: 0 }, total: ids.length });
      setFlipped(false);
    },
    []
  );

  // Auto-start: a teacher's practice assignment (#/study/k:id,id…), otherwise whatever is due.
  useEffect(() => {
    if (param?.startsWith('k:')) {
      const ids = param.slice(2).split(',').filter((id) => s.viewById[id]);
      if (ids.length) return start(ids);
    }
    if (session === null && s.dueQueue.length > 0) start(s.dueQueue.map((v) => v.kanji.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  const currentId = session && session.index < session.queue.length ? session.queue[session.index] : null;
  const view = currentId ? s.viewById[currentId] : null;
  const kanji = currentId ? KANJI_BY_ID[currentId] : null;

  const previews = useMemo(() => {
    if (!view) return null;
    return Object.fromEntries(GRADES.map((g) => [g.id, formatInterval(scheduleNext(view.srs, g.id))])) as Record<Grade, string>;
  }, [view]);

  const grade = useCallback(
    (g: Grade) => {
      if (!session || !currentId || !flipped) return;
      s.gradeCard(currentId, g);
      setSession((prev) => {
        if (!prev) return prev;
        const queue = g === 'again' ? [...prev.queue, currentId] : prev.queue; // relearn later this session
        return { ...prev, queue, index: prev.index + 1, results: { ...prev.results, [g]: prev.results[g] + 1 } };
      });
      setFlipped(false);
    },
    [session, currentId, flipped, s]
  );

  const say = useCallback(() => {
    if (!kanji || !s.settings.audio) return;
    speakJapanese((kanji.kunyomi?.[0] ?? kanji.onyomi?.[0] ?? kanji.character).replace(/^-/, ''), s.settings.speechRate);
  }, [kanji, s.settings.audio, s.settings.speechRate]);

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!currentId) return;
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) setFlipped(true);
        return;
      }
      const g = GRADES.find((x) => x.key === e.key);
      if (g && flipped) grade(g.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentId, flipped, grade]);

  /* --------------------------- Empty / finished states --------------------------- */

  if (!session) {
    const ahead = s.atRisk.slice(0, 8).map((v) => v.kanji.id);
    const nextNew = s.views.filter((v) => v.srs.lastReview === null).slice(0, 5);
    return (
      <Empty
        icon="check"
        title="All caught up — お疲れ様!"
        body={
          nextNew.length
            ? `No reviews are due and today's new kanji are done. Want more? The next ones are ${nextNew.map((v) => v.kanji.character).join(' ')}.`
            : 'No kanji are due right now. You can study ahead on the cards with the lowest predicted recall, or take a quiz.'
        }
        action={
          <>
            {nextNew.length > 0 && (
              <button className="btn-primary" onClick={() => start(nextNew.map((v) => v.kanji.id))}>
                Learn {nextNew.length} more
              </button>
            )}
            {ahead.length > 0 && (
              <button className={nextNew.length ? 'btn-ghost' : 'btn-primary'} onClick={() => start(ahead)}>
                Study ahead · {ahead.length}
              </button>
            )}
            <button className="btn-ghost" onClick={() => go('quiz')}>
              Take a quiz
            </button>
          </>
        }
      />
    );
  }

  if (!currentId || !view || !kanji) {
    const r = session.results;
    const answered = r.again + r.hard + r.good + r.easy;
    const firstTry = Math.max(0, answered - r.again);
    return (
      <div className="max-w-xl mx-auto card card-pad text-center py-12 animate-pop">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand text-brand-ink shadow-brand">
          <Icon name="trophy" size={34} />
        </div>
        <div className="mt-5 font-jp text-brand text-sm">よくできました</div>
        <h2 className="text-2xl font-extrabold">Session complete</h2>
        <p className="text-ink-3 mt-1 text-sm">
          {session.total} kanji reviewed · {answered} answers · {Math.round((firstTry / Math.max(1, answered)) * 100)}% remembered
        </p>
        <div className="mt-6 grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <div key={g.id} className="rounded-2xl p-3" style={{ background: `rgb(var(--${g.tone}-soft))` }}>
              <div className="text-xl font-extrabold tabular" style={{ color: `rgb(var(--${g.tone}))` }}>
                {r[g.id]}
              </div>
              <div className="text-[11px] font-semibold text-ink-2">{g.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="btn-primary" onClick={() => go('home')}>
            Back home
          </button>
          <button className="btn-ghost" onClick={() => go('quiz')}>
            Reinforce with a quiz
          </button>
        </div>
      </div>
    );
  }

  /* --------------------------- Active card --------------------------- */

  const progressPct = (session.index / session.queue.length) * 100;
  const vocab = vocabFor(kanji.character)[0];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => go('home')} className="grid h-9 w-9 place-items-center rounded-full bg-surface border border-line/70" aria-label="Exit session">
          <Icon name="x" size={16} />
        </button>
        <div className="flex-1 h-2.5 rounded-full bg-sunken overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-sm font-bold tabular text-ink-2">
          {session.index + 1}/{session.queue.length}
        </span>
      </div>

      {/* Card */}
      <div className="perspective">
        <div
          role="button"
          tabIndex={0}
          aria-label={flipped ? 'Card answer' : 'Reveal answer'}
          onClick={() => !flipped && setFlipped(true)}
          className={cx(
            'relative preserve-3d transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] min-h-[500px] sm:min-h-[460px]',
            flipped && 'rotate-y-180',
            !flipped && 'cursor-pointer'
          )}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden card overflow-hidden flex flex-col">
            <div className="absolute inset-0 paper-grain opacity-60" />
            <div className="relative flex items-center justify-between p-5">
              <span className="chip bg-brand-soft text-brand">JLPT {kanji.jlpt_level}</span>
              <span className="chip bg-sunken text-ink-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(var(--${recallTone(view.recall)}))` }} />
                Recall {Math.round(view.recall * 100)}%
              </span>
            </div>
            <div className="relative flex-1 grid place-items-center">
              <span className="font-mincho font-bold text-[150px] sm:text-[180px] leading-none animate-pop" key={currentId}>
                {kanji.character}
              </span>
            </div>
            <div className="relative p-5 text-center text-sm text-ink-3">
              Recall the meaning and reading, then tap to flip <Kbd>Space</Kbd>
            </div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 card overflow-hidden">
            <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] sm:grid-rows-1 sm:grid-cols-[220px_1fr]">
              <div className="relative bg-sumi text-white grid place-items-center px-6 py-4 sm:p-6 overflow-hidden">
                <div className="absolute inset-0 seigaiha opacity-30" />
                <div className="relative flex sm:block items-center gap-5 text-center">
                  <div className="font-mincho font-bold text-[64px] sm:text-[110px] leading-none">{kanji.character}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      say();
                    }}
                    disabled={!s.settings.audio}
                    className="sm:mt-4 btn btn-sm bg-white/10 hover:bg-white/20 text-white border border-white/15"
                  >
                    <Icon name="speaker" size={15} /> Listen
                  </button>
                  <div className="hidden sm:block mt-3 text-xs text-white/50">{kanji.stroke_count} stroke{kanji.stroke_count === 1 ? "" : "s"}</div>
                </div>
              </div>
              <div className="p-5 sm:p-6 overflow-y-auto">
                <div className="eyebrow">Meaning</div>
                <div className="mt-1 text-2xl font-extrabold tracking-tight">{kanji.meanings.join(', ')}</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-paper border border-line/70 p-3">
                    <div className="eyebrow">Kun&apos;yomi</div>
                    <div className="font-jp mt-1 font-medium">{kanji.kunyomi?.length ? kanji.kunyomi.join('、') : '—'}</div>
                  </div>
                  <div className="rounded-2xl bg-paper border border-line/70 p-3">
                    <div className="eyebrow">On&apos;yomi</div>
                    <div className="font-jp mt-1 font-medium">{kanji.onyomi?.length ? kanji.onyomi.join('、') : '—'}</div>
                  </div>
                </div>
                {kanji.mnemonic && (
                  <div className="mt-4 rounded-2xl bg-brand-soft p-3.5 text-sm">
                    <div className="flex items-center gap-1.5 font-bold text-brand text-xs mb-1">
                      <Icon name="sparkle" size={13} /> MEMORY HOOK
                    </div>
                    <span className="text-ink-2">{kanji.mnemonic}</span>
                  </div>
                )}
                {kanji.confusionNote && (
                  <div className="mt-3 rounded-2xl bg-sakura-soft p-3.5 text-sm">
                    <div className="flex items-center gap-1.5 font-bold text-sakura text-xs mb-1">
                      <Icon name="alert" size={13} /> DON&apos;T CONFUSE WITH {kanji.confusionWith}
                    </div>
                    <span className="text-ink-2">{kanji.confusionNote}</span>
                  </div>
                )}
                {vocab && (
                  <div className="mt-3 text-sm">
                    <span className="eyebrow">Example</span>
                    <div className="font-jp mt-1">
                      {vocab.term} <span className="text-ink-3">({vocab.kana})</span> — {vocab.meanings[0]}
                    </div>
                    {vocab.example_sentences?.[0] && (
                      <div className="font-jp text-ink-3 mt-0.5">
                        {vocab.example_sentences[0]} <span className="font-sans">· {vocab.translations?.[0]}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5">
        {flipped ? (
          <div className="grid grid-cols-4 gap-2 sm:gap-3 animate-rise">
            {GRADES.map((g) => (
              <button
                key={g.id}
                onClick={() => grade(g.id)}
                className="group rounded-2xl border bg-surface py-3 px-2 text-center transition hover:-translate-y-0.5 hover:shadow-lift active:scale-[.97]"
                style={{ borderColor: `rgb(var(--${g.tone}) / .35)` }}
              >
                <div className="text-sm sm:text-base font-extrabold" style={{ color: `rgb(var(--${g.tone}))` }}>
                  {g.label}
                </div>
                <div className="text-[11px] text-ink-3 font-semibold tabular mt-0.5 flex items-center justify-center gap-1.5">
                  {previews?.[g.id]} <Kbd>{g.key}</Kbd>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => setFlipped(true)} className="btn-dark w-full h-14 text-base">
            <Icon name="eye" size={18} /> Show answer
          </button>
        )}
      </div>
    </div>
  );
}
