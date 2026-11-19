'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveQuizResult } from '@/lib/classroom-api';
import { KANJI, KANJI_BY_CHAR, lessonOf, primaryReading, speakJapanese, useLearn, type KanjiItem, type QuizMode } from '@/lib/learn-store';
import { wordsForKanji } from '@/lib/vocab';
import WordQuiz from '../WordQuiz';
import { useLessonVocab } from '../vocab/useLessonVocab';
import { Icon, type IconName } from '../icons';
import { useNav } from '../nav';
import { Kbd, Ring, cx } from '../ui';

type ModeChoice = QuizMode | 'mixed';

interface Question {
  kanji: KanjiItem;
  mode: QuizMode;
  options: KanjiItem[];
}

interface Answer {
  q: Question;
  picked: string;
  correct: boolean;
  ms: number;
}

const MODES: { id: ModeChoice; title: string; jp: string; desc: string; icon: IconName }[] = [
  { id: 'meaning', title: 'Meaning', jp: '意味', desc: 'See the kanji, pick its meaning', icon: 'book' },
  { id: 'reading', title: 'Reading', jp: '読み', desc: 'See the kanji, pick its reading', icon: 'speaker' },
  { id: 'kanji', title: 'Recognition', jp: '認識', desc: 'See the meaning, pick the kanji', icon: 'eye' },
  { id: 'mixed', title: 'Mixed', jp: '混合', desc: 'A bit of everything', icon: 'sparkle' },
];

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const readingOf = (k: KanjiItem) => primaryReading(k).replace(/\./g, '');

/** Distractors favour real confusions: the known look-alike first, then same visual group, then random. */
function buildOptions(k: KanjiItem, mode: QuizMode, deck: KanjiItem[]): KanjiItem[] {
  const pool: KanjiItem[] = [];
  const add = (x?: KanjiItem) => {
    if (!x || x.id === k.id || pool.some((p) => p.id === x.id)) return;
    if (mode === 'reading' && readingOf(x) === readingOf(k)) return;
    pool.push(x);
  };
  add(k.confusionWith ? KANJI_BY_CHAR[k.confusionWith] : undefined);
  deck.filter((x) => k.visual_similarity_group && x.visual_similarity_group === k.visual_similarity_group).forEach(add);
  shuffle(deck.filter((x) => k.semantic_category && x.semantic_category === k.semantic_category)).forEach(add);
  shuffle(deck).forEach(add);
  return shuffle([k, ...pool.slice(0, 3)]);
}

export default function QuizView() {
  const s = useLearn();
  const { go } = useNav();
  const [mode, setMode] = useState<ModeChoice>('mixed');
  const [length, setLength] = useState(10);
  const [focusWeak, setFocusWeak] = useState(true);
  const [what, setWhat] = useState<'kanji' | 'words' | 'vocab'>('kanji');
  const [qLesson, setQLesson] = useState<number | 'all'>('all');
  const lessonVocab = useLessonVocab(s.track);

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  const start = useCallback(() => {
    // Quiz on kanji the student has already met; before that, use the first Genki lesson.
    const scope = qLesson === 'all' ? s.views : s.views.filter((v) => lessonOf(v.kanji) === qLesson);
    const studied = scope.filter((v) => v.progress.total_attempts > 0);
    const pool = qLesson !== 'all' ? scope : studied.length >= 4 ? studied : scope.slice(0, Math.max(length, 15));
    const ordered = focusWeak
      ? [...pool].sort((a, b) => a.recall * (a.progress.overall_mastery / 100) - b.recall * (b.progress.overall_mastery / 100))
      : shuffle(pool);
    const picks = shuffle(ordered.slice(0, Math.max(length, Math.ceil(length * 1.3))).map((v) => v.kanji)).slice(0, length);
    const qs = picks.map((k, i) => {
      const m: QuizMode = mode === 'mixed' ? (['meaning', 'reading', 'kanji'] as const)[i % 3] : mode;
      return { kanji: k, mode: m, options: buildOptions(k, m, s.deck) };
    });
    setQuestions(qs);
    setIdx(0);
    setAnswers([]);
    setPicked(null);
    setStartedAt(Date.now());
  }, [focusWeak, length, mode, s.views, s.deck, qLesson]);

  const q = questions?.[idx];

  const choose = useCallback(
    (id: string) => {
      if (!q || picked) return;
      const correct = id === q.kanji.id;
      setPicked(id);
      setAnswers((a) => [...a, { q, picked: id, correct, ms: Date.now() - startedAt }]);
      s.recordQuiz(q.kanji.id, q.mode, correct);
      if (s.settings.audio && q.mode !== 'kanji') speakJapanese(readingOf(q.kanji), s.settings.speechRate);
    },
    [q, picked, startedAt, s]
  );

  const next = useCallback(() => {
    if (!questions) return;
    setPicked(null);
    setIdx((i) => i + 1);
    setStartedAt(Date.now());
  }, [questions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q) return;
      const n = Number(e.key);
      if (!picked && n >= 1 && n <= q.options.length) choose(q.options[n - 1].id);
      if (picked && (e.key === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, picked, choose, next]);

  const score = useMemo(() => answers.filter((a) => a.correct).length, [answers]);
  const savedRef = useRef<Question[] | null>(null);
  useEffect(() => {
    if (questions && !q && answers.length === questions.length && savedRef.current !== questions) {
      savedRef.current = questions;
      saveQuizResult({ kind: 'kanji', track: s.track, lesson: qLesson === 'all' ? null : qLesson, score, total: questions.length });
    }
  }, [questions, q, answers.length, score, s.track, qLesson]);

  /* ----------------------------- Setup ----------------------------- */
  if (!questions) {
    const lessonNums =
      what === 'vocab'
        ? s.track === 'N5'
          ? Array.from({ length: 12 }, (_, i) => i + 1)
          : Array.from({ length: 11 }, (_, i) => i + 13)
        : s.lessons.map((l) => l.lesson);
    const chooser = (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-3xl bg-sunken/70 p-1.5">
          {(
            [
              ['kanji', 'Kanji', '漢字'],
              ['words', 'Kanji words', '熟語'],
              ['vocab', 'Lesson vocabulary', '単語'],
            ] as const
          ).map(([id, label, jp]) => (
            <button
              key={id}
              onClick={() => (setWhat(id), setQLesson('all'))}
              className={cx('rounded-2xl py-2.5 px-2 text-center transition', what === id ? 'bg-surface shadow-card' : 'text-ink-3 hover:text-ink')}
            >
              <div className="font-bold text-sm">{label}</div>
              <div className="font-jp text-[11px] text-brand">{jp}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {(['all', ...lessonNums] as const).map((l) => (
            <button
              key={l}
              onClick={() => setQLesson(l)}
              className={cx(
                'shrink-0 h-9 px-3.5 rounded-full border text-sm font-semibold transition',
                qLesson === l ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-2 hover:border-ink/30'
              )}
            >
              {l === 'all' ? 'All lessons' : `L${l}`}
            </button>
          ))}
        </div>
      </div>
    );

    if (what !== 'kanji') {
      const pool =
        what === 'words'
          ? (qLesson === 'all' ? s.lessons.map((l) => l.lesson) : [qLesson]).flatMap((n) =>
              wordsForKanji(KANJI.filter((k) => lessonOf(k) === n).map((k) => k.character))
            )
          : (lessonVocab.words ?? []).filter((w) => qLesson === 'all' || w.lesson === qLesson);
      const label = `${what === 'words' ? 'Kanji words' : 'Lesson vocabulary'} · ${qLesson === 'all' ? `all ${s.track} lessons` : `Lesson ${qLesson}`}`;
      return (
        <div className="max-w-3xl mx-auto space-y-6 animate-rise">
          {chooser}
          {what === 'vocab' && lessonVocab.words !== null && pool.length < 4 ? (
            <div className="card card-pad text-sm text-ink-3 text-center py-10">
              {qLesson === 'all' ? 'No lesson word lists yet.' : `Lesson ${qLesson} has no word list yet.`} Teachers add them under Vocabulary.
            </div>
          ) : (
            <WordQuiz
              key={`${what}-${qLesson}-${pool.length}`}
              words={pool}
              title={label}
              record={{ kind: what === 'words' ? 'kanji-words' : 'vocab', lesson: qLesson === 'all' ? null : qLesson }}
            />
          )}
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-rise">
        {chooser}
        <div className="relative overflow-hidden rounded-4xl bg-sumi text-white p-6 sm:p-8">
          <div className="absolute inset-0 seigaiha opacity-30" />
          <div className="absolute -right-4 -top-10 font-mincho text-[180px] font-extrabold text-white/[.06] leading-none">試</div>
          <div className="relative">
            <div className="font-jp text-brand text-sm">小テスト</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Adaptive quiz</h2>
            <p className="text-white/65 mt-2 max-w-md text-sm leading-relaxed">
              Wrong answers use your real look-alike kanji as distractors, and anything you miss is sent straight back into
              your review queue.
            </p>
          </div>
        </div>

        <div>
          <div className="eyebrow mb-3">Question type</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cx(
                  'rounded-3xl border p-4 text-left transition',
                  mode === m.id ? 'border-brand bg-brand-soft shadow-card' : 'border-line bg-surface hover:border-ink/25'
                )}
              >
                <span className={cx('grid h-9 w-9 place-items-center rounded-xl', mode === m.id ? 'bg-brand text-brand-ink' : 'bg-sunken text-ink-2')}>
                  <Icon name={m.icon} size={17} />
                </span>
                <div className="mt-3 font-bold">{m.title}</div>
                <div className="font-jp text-[11px] text-brand">{m.jp}</div>
                <div className="text-xs text-ink-3 mt-1 leading-snug">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="eyebrow mb-3">Length</div>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 15].map((n) => (
                <button
                  key={n}
                  onClick={() => setLength(n)}
                  className={cx('h-11 rounded-2xl font-bold text-sm transition', length === n ? 'bg-ink text-canvas' : 'bg-sunken/70 text-ink-2 hover:bg-sunken')}
                >
                  {n} Qs
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setFocusWeak((v) => !v)} className="card p-4 text-left flex items-center gap-4">
            <span className={cx('grid h-11 w-11 place-items-center rounded-2xl transition', focusWeak ? 'bg-brand text-brand-ink' : 'bg-sunken text-ink-3')}>
              <Icon name="target" size={20} />
            </span>
            <span className="flex-1">
              <span className="block font-bold text-sm">Focus on weak kanji</span>
              <span className="block text-xs text-ink-3">Prioritise low recall & low mastery</span>
            </span>
            <span className={cx('relative h-7 w-12 rounded-full transition', focusWeak ? 'bg-brand' : 'bg-sunken')}>
              <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', focusWeak ? 'left-6' : 'left-1')} />
            </span>
          </button>
        </div>

        <button onClick={start} className="btn-primary w-full h-14 text-base">
          <Icon name="bolt" size={18} /> Start {length}-question quiz
        </button>
      </div>
    );
  }

  /* ----------------------------- Results ----------------------------- */
  if (!q) {
    const pct = Math.round((score / questions.length) * 100);
    const avgSec = answers.length ? answers.reduce((a, x) => a + x.ms, 0) / answers.length / 1000 : 0;
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-pop">
        <div className="card card-pad text-center py-10">
          <Ring value={pct} size={140} stroke={11} tone={pct >= 80 ? 'matcha' : pct >= 60 ? 'kin' : 'sakura'}>
            <div>
              <div className="text-4xl font-extrabold tabular">{pct}%</div>
              <div className="text-xs text-ink-3">
                {score}/{questions.length}
              </div>
            </div>
          </Ring>
          <div className="mt-5 font-jp text-brand text-sm">{pct >= 80 ? '素晴らしい！' : pct >= 60 ? 'いいね！' : 'がんばって！'}</div>
          <h2 className="text-2xl font-extrabold">{pct >= 80 ? 'Excellent work' : pct >= 60 ? 'Solid progress' : 'Keep going'}</h2>
          <p className="text-sm text-ink-3 mt-1">
            Avg. {avgSec.toFixed(1)}s per answer · +{answers.reduce((a, x) => a + (x.correct ? 12 : 3), 0)} XP
            {score < questions.length && ` · ${questions.length - score} missed kanji added to your review queue`}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="btn-primary" onClick={start}>
              <Icon name="refresh" size={16} /> Try again
            </button>
            {score < questions.length ? (
              <button className="btn-ghost" onClick={() => go('study')}>
                Review missed
              </button>
            ) : (
              <button className="btn-ghost" onClick={() => setQuestions(null)}>
                New quiz
              </button>
            )}
          </div>
        </div>

        <div className="card divide-y divide-line/70">
          {answers.map((a, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <span
                className="grid h-8 w-8 place-items-center rounded-full shrink-0"
                style={{ background: `rgb(var(--${a.correct ? 'matcha' : 'sakura'}-soft))`, color: `rgb(var(--${a.correct ? 'matcha' : 'sakura'}))` }}
              >
                <Icon name={a.correct ? 'check' : 'x'} size={15} />
              </span>
              <span className="font-mincho text-2xl font-bold w-8">{a.q.kanji.character}</span>
              <span className="flex-1 min-w-0 text-sm">
                <span className="font-semibold">{a.q.kanji.meanings[0]}</span>
                <span className="text-ink-3 font-jp"> · {readingOf(a.q.kanji)}</span>
              </span>
              <span className="text-xs text-ink-3 capitalize">{a.q.mode}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ----------------------------- Question ----------------------------- */
  const isCorrect = picked === q.kanji.id;
  const prompt =
    q.mode === 'kanji' ? (
      <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center px-4">{q.kanji.meanings.slice(0, 2).join(', ')}</div>
    ) : (
      <div className="font-mincho font-bold text-[110px] sm:text-[130px] leading-none">{q.kanji.character}</div>
    );
  const label = (k: KanjiItem) => (q.mode === 'meaning' ? k.meanings.slice(0, 2).join(', ') : q.mode === 'reading' ? readingOf(k) : k.character);
  const question = q.mode === 'meaning' ? 'What does this kanji mean?' : q.mode === 'reading' ? 'How is this kanji read?' : 'Which kanji matches this meaning?';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => setQuestions(null)}
          className="grid h-9 w-9 place-items-center rounded-full bg-surface border border-line/70"
          aria-label="Quit quiz"
        >
          <Icon name="x" size={16} />
        </button>
        <div className="flex-1 flex gap-1">
          {questions.map((_, i) => {
            const a = answers[i];
            return (
              <span
                key={i}
                className="h-2.5 flex-1 rounded-full transition-colors"
                style={{ background: a ? `rgb(var(--${a.correct ? 'matcha' : 'sakura'}))` : i === idx ? 'rgb(var(--brand))' : 'rgb(var(--sunken))' }}
              />
            );
          })}
        </div>
        <span className="text-sm font-bold tabular text-ink-2">
          {score} <Icon name="check" size={14} className="inline -mt-0.5 text-matcha" />
        </span>
      </div>

      <div className={cx('card overflow-hidden', picked && !isCorrect && 'animate-shake')}>
        <div className="relative grid place-items-center min-h-[240px] sm:min-h-[260px] bg-paper border-b border-line/70">
          <div className="absolute inset-0 paper-grain opacity-70" />
          <span className="absolute top-4 left-4 chip bg-brand-soft text-brand capitalize">{q.mode}</span>
          <span className="absolute top-4 right-4 text-xs text-ink-3 font-semibold tabular">
            {idx + 1} / {questions.length}
          </span>
          <div className="relative animate-pop" key={idx}>
            {prompt}
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="text-sm font-semibold text-ink-2 mb-3">{question}</div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {q.options.map((o, i) => {
              const state = !picked ? 'idle' : o.id === q.kanji.id ? 'right' : o.id === picked ? 'wrong' : 'dim';
              return (
                <button
                  key={o.id}
                  onClick={() => choose(o.id)}
                  disabled={!!picked}
                  className={cx(
                    'flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-all',
                    state === 'idle' && 'border-line bg-surface hover:border-brand hover:-translate-y-0.5',
                    state === 'right' && 'border-matcha bg-matcha-soft',
                    state === 'wrong' && 'border-sakura bg-sakura-soft',
                    state === 'dim' && 'border-line/60 opacity-50'
                  )}
                >
                  <span
                    className={cx(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold',
                      state === 'right' ? 'bg-matcha text-white' : state === 'wrong' ? 'bg-sakura text-white' : 'bg-sunken text-ink-3'
                    )}
                  >
                    {state === 'right' ? <Icon name="check" size={14} /> : state === 'wrong' ? <Icon name="x" size={14} /> : i + 1}
                  </span>
                  <span className={cx('font-semibold', q.mode === 'kanji' ? 'font-mincho text-3xl' : q.mode === 'reading' ? 'font-jp text-lg' : 'text-[15px]')}>
                    {label(o)}
                  </span>
                </button>
              );
            })}
          </div>

          {picked && (
            <div className="mt-4 animate-rise">
              <div
                className="rounded-2xl p-4 text-sm"
                style={{ background: `rgb(var(--${isCorrect ? 'matcha' : 'sakura'}-soft))` }}
              >
                <div className="font-bold" style={{ color: `rgb(var(--${isCorrect ? 'matcha' : 'sakura'}))` }}>
                  {isCorrect ? '正解! Correct' : `Not quite — it's ${q.kanji.character} (${readingOf(q.kanji)}) “${q.kanji.meanings[0]}”`}
                </div>
                <div className="text-ink-2 mt-1">
                  {!isCorrect && q.kanji.confusionNote && q.options.find((o) => o.id === picked)?.character === q.kanji.confusionWith
                    ? q.kanji.confusionNote
                    : q.kanji.mnemonic}
                </div>
              </div>
              <button onClick={next} className="btn-dark w-full mt-3 h-12">
                {idx + 1 === questions.length ? 'See results' : 'Next question'} <Kbd>↵</Kbd>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
