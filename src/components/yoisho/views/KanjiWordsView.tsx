'use client';

import { useEffect, useMemo, useState } from 'react';
import { KANJI, LESSONS, lessonOf, useLearn } from '@/lib/learn-store';
import { wordsForKanji, type LessonWord } from '@/lib/vocab';
import WordQuiz from '../WordQuiz';
import { Flashcards, Speak } from '../vocab/shared';
import { Icon } from '../icons';
import { cx } from '../ui';

type Mode = 'list' | 'cards' | 'quiz';

/** Words built from each kanji, with example sentences — part of the Kanji Library. */
export default function KanjiWordsView() {
  const s = useLearn();
  const lessons = s.lessons;
  const [lesson, setLesson] = useState<number>(lessons[0]?.lesson ?? 3);
  const [mode, setMode] = useState<Mode>('list');
  const [query, setQuery] = useState('');
  useEffect(() => setLesson(lessons[0]?.lesson ?? 3), [lessons]);

  const words = useMemo(() => wordsForKanji(KANJI.filter((k) => lessonOf(k) === lesson).map((k) => k.character)), [lesson]);
  const byKanji = useMemo(() => {
    const m = new Map<string, LessonWord[]>();
    words.forEach((w) => m.set(w.kanji, [...(m.get(w.kanji) ?? []), w]));
    return [...m.entries()];
  }, [words]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return lessons
      .flatMap((l) => wordsForKanji(KANJI.filter((k) => lessonOf(k) === l.lesson).map((k) => k.character)).map((w) => ({ ...w, lesson: l.lesson })))
      .filter((w) => w.term.includes(q) || w.kana.includes(q) || w.meaning.toLowerCase().includes(q))
      .slice(0, 80);
  }, [query, lessons]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Icon name="search" size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="input pl-11 h-12 bg-surface border-line/70" placeholder="Search kanji words — Japanese, reading or English" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex rounded-full bg-sunken/70 p-1">
          {(['list', 'cards', 'quiz'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cx('h-9 px-4 rounded-full text-sm font-semibold transition', mode === m ? 'bg-surface shadow-card text-ink' : 'text-ink-3')}
            >
              {m === 'list' ? 'Words' : m === 'cards' ? 'Flashcards' : 'Quiz'}
            </button>
          ))}
        </div>
      </div>

      {hits ? (
        <div className="card overflow-hidden">
          {hits.length === 0 ? (
            <p className="p-6 text-sm text-ink-3">No words match “{query}”.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {hits.map((w, i) => (
                <li key={`${w.term}-${i}`} className="flex items-center gap-3 px-5 py-3">
                  <Speak text={w.kana || w.term} label={`Listen to ${w.term}`} />
                  <span className="font-jp text-lg font-bold">{w.term}</span>
                  <span className="font-jp text-sm text-ink-3">{w.kana}</span>
                  <span className="flex-1 text-sm truncate">{w.meaning}</span>
                  <button className="chip bg-sunken text-ink-2" onClick={() => (setLesson(w.lesson), setQuery(''))}>
                    L{w.lesson}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {lessons.map((l) => (
              <button
                key={l.lesson}
                onClick={() => setLesson(l.lesson)}
                className={cx(
                  'shrink-0 h-10 px-4 rounded-full border text-sm font-semibold transition',
                  l.lesson === lesson ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-2 hover:border-ink/30'
                )}
              >
                L{l.lesson}
              </button>
            ))}
          </div>
          <div>
            <h3 className="text-xl font-extrabold tracking-tight">
              Lesson {lesson} kanji words
              <span className="text-ink-3 font-semibold text-base"> · {LESSONS.find((l) => l.lesson === lesson)?.title}</span>
            </h3>
            <p className="text-xs text-ink-3">{words.length} words using this lesson’s kanji, each kanji with an example sentence</p>
          </div>

          {mode === 'quiz' ? (
            <WordQuiz key={lesson} words={words} title={`Lesson ${lesson} kanji words quiz`} record={{ kind: 'kanji-words', lesson }} />
          ) : mode === 'cards' ? (
            <Flashcards words={words} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {byKanji.map(([char, ws]) => {
                const ex = ws.find((w) => w.sentence)?.sentence;
                return (
                  <article key={char} className="card p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand font-mincho text-3xl font-bold">{char}</span>
                      <ul className="flex-1 min-w-0 space-y-1.5">
                        {ws.map((w) => (
                          <li key={w.term} className="flex items-center gap-2">
                            <span className="font-jp font-bold">{w.term}</span>
                            <span className="font-jp text-xs text-ink-3">{w.kana}</span>
                            <span className="text-sm text-ink-2 truncate flex-1">{w.meaning}</span>
                            <Speak text={w.kana || w.term} label={`Listen to ${w.term}`} />
                          </li>
                        ))}
                      </ul>
                    </div>
                    {ex && (
                      <div className="mt-3 rounded-2xl bg-paper border border-line/70 p-3 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-jp text-[15px]">{ex.jp}</div>
                          <div className="text-xs text-ink-3 mt-0.5">{ex.en}</div>
                        </div>
                        <Speak text={ex.jp} label="Listen to the sentence" />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
