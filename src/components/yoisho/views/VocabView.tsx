'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LESSONS, useLearn } from '@/lib/learn-store';
import { addCustomWords, deleteCustomWord, type CustomWord } from '@/lib/classroom-api';
import { CATEGORY_ORDER, parseVocabText } from '@/lib/vocab-import';
import { starterTheme } from '@/lib/starter-vocab';
import WordQuiz from '../WordQuiz';
import { Flashcards, Speak } from '../vocab/shared';
import { useLessonVocab } from '../vocab/useLessonVocab';
import { Icon } from '../icons';
import { useAccount } from '../account';
import { useNav } from '../nav';
import { cx } from '../ui';

type Mode = 'list' | 'cards' | 'quiz';

const catRank = (c: string) => {
  const i = CATEGORY_ORDER.indexOf(c);
  return i < 0 ? CATEGORY_ORDER.length - 1.5 : i;
};

export function groupByCategory(words: CustomWord[]) {
  const m = new Map<string, CustomWord[]>();
  for (const w of words) m.set(w.category || '', [...(m.get(w.category || '') ?? []), w]);
  return [...m.entries()].sort((a, b) => catRank(a[0]) - catRank(b[0]));
}

/* --------------------------- teacher import --------------------------- */

function ImportPanel({ track, lesson, existing, onDone }: { track: 'N5' | 'N4'; lesson: number; existing: number; onDone: () => void }) {
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(existing > 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseVocabText(text), [text]);
  const counts = useMemo(() => groupByCategory(parsed.words.map((w, i) => ({ ...w, id: String(i), lesson, position: i }))), [parsed, lesson]);

  return (
    <div className="card card-pad space-y-4">
      <div>
        <h3 className="font-extrabold text-lg">Lesson {lesson} word list</h3>
        <p className="text-sm text-ink-3 mt-1">
          Paste the lesson’s vocabulary from your copy of the book (or a spreadsheet). One word per line —{' '}
          <span className="font-jp">reading&nbsp;&nbsp;kanji&nbsp;&nbsp;meaning</span>, kanji optional. Headings like <b>Nouns</b>, <b>い-adjectives</b>,{' '}
          <b>U-verbs</b>, <b>Ru-verbs</b>, <b>Irregular verbs</b>, <b>Adverbs and other expressions</b> group the words the way the book does.
        </p>
      </div>
      <textarea
        className="input h-auto min-h-[220px] py-3 font-jp leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Nouns\nおなか\t\tstomach\nあし\t足\tleg; foot\n\nい-adjectives\nせまい\t狭い\tnarrow; not spacious'}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.tsv,text/plain,text/csv"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) setText(await f.text());
          }}
        />
        <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={14} /> Load .csv / .txt
        </button>
        {existing > 0 && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
            Replace the {existing} word{existing === 1 ? '' : 's'} already in L{lesson}
          </label>
        )}
      </div>

      {text.trim() && (
        <div className="rounded-2xl bg-paper border border-line/70 p-3 text-sm">
          <b>{parsed.words.length}</b> word{parsed.words.length === 1 ? '' : 's'} found
          {counts.length > 0 && (
            <span className="text-ink-3">
              {' '}
              — {counts.map(([c, ws]) => `${c || 'Other'} ${ws.length}`).join(' · ')}
            </span>
          )}
          {parsed.skipped.length > 0 && (
            <details className="mt-1 text-xs text-ink-3">
              <summary className="cursor-pointer">{parsed.skipped.length} line(s) skipped</summary>
              <ul className="mt-1 font-jp">
                {parsed.skipped.slice(0, 20).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {msg && <p className={cx('text-sm font-medium', msg.ok ? 'text-matcha' : 'text-sakura')}>{msg.text}</p>}
      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={busy || !parsed.words.length}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              const { added } = await addCustomWords(track, lesson, parsed.words, replace);
              setText('');
              setMsg({ ok: true, text: `Saved ${added} words to Lesson ${lesson}. Students see them now.` });
              onDone();
            } catch (e) {
              setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving…' : `Save ${parsed.words.length || ''} words`}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- view ------------------------------- */

export default function VocabView() {
  const s = useLearn();
  const account = useAccount();
  const { go } = useNav();
  const staff = !!account && account.role !== 'student';
  const track = s.track;
  const { words, reload, teacherCount } = useLessonVocab(track);
  const lessonNums = useMemo(() => (track === 'N5' ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.from({ length: 11 }, (_, i) => i + 13)), [track]);
  const [lesson, setLesson] = useState(lessonNums[0]);
  const [mode, setMode] = useState<Mode>('list');
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  useEffect(() => setLesson(lessonNums[0]), [lessonNums]);

  const inLesson = useMemo(() => (words ?? []).filter((w) => w.lesson === lesson), [words, lesson]);
  const groups = useMemo(() => groupByCategory(inLesson), [inLesson]);
  const countFor = (l: number) => (words ?? []).filter((w) => w.lesson === l).length;
  const isStarter = inLesson.length > 0 && inLesson.every((w) => w.starter);
  const title = starterTheme(lesson) ?? LESSONS.find((l) => l.lesson === lesson)?.title;

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return (words ?? []).filter((w) => w.term.includes(q) || w.kana.includes(q) || w.meaning.toLowerCase().includes(q)).slice(0, 100);
  }, [query, words]);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-4xl bg-sumi text-white p-6 sm:p-7">
        <div className="absolute inset-0 seigaiha opacity-25" />
        <div className="absolute -right-4 -bottom-10 font-mincho text-[150px] font-extrabold text-white/[.06] leading-none select-none">単語</div>
        <div className="relative flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[220px]">
            <div className="font-jp text-brand text-sm">単語 · {track === 'N5' ? 'Genki I' : 'Genki II'}</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Lesson vocabulary</h2>
            <p className="text-white/60 text-sm mt-1">The word list at the start of each chapter — revise it, flip flashcards, then quiz yourself.</p>
          </div>
          <div className="flex rounded-full bg-white/10 p-1">
            {(['list', 'cards', 'quiz'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cx('h-9 px-4 rounded-full text-sm font-semibold transition', mode === m ? 'bg-white text-[#141414]' : 'text-white/70')}
              >
                {m === 'list' ? 'Word list' : m === 'cards' ? 'Flashcards' : 'Quiz'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="relative">
        <Icon name="search" size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className="input pl-11 h-12 bg-surface border-line/70" placeholder={`Search all ${track} lesson words`} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {hits ? (
        <div className="card overflow-hidden">
          {hits.length === 0 ? (
            <p className="p-6 text-sm text-ink-3">No words match “{query}”.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {hits.map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-5 py-3">
                  <Speak text={w.kana || w.term} label={`Listen to ${w.term}`} />
                  <span className="font-jp text-lg font-bold">{w.kana || w.term}</span>
                  <span className="font-jp text-sm text-ink-3">{w.term !== w.kana ? w.term : ''}</span>
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
            {lessonNums.map((n) => {
              const c = countFor(n);
              return (
                <button
                  key={n}
                  onClick={() => (setLesson(n), setImporting(false))}
                  className={cx(
                    'shrink-0 h-10 px-4 rounded-full border text-sm font-semibold transition',
                    n === lesson ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-2 hover:border-ink/30',
                    !c && n !== lesson && 'opacity-60'
                  )}
                >
                  L{n}
                  {c > 0 && <span className={cx('ml-1 text-[11px] tabular', n === lesson ? 'text-canvas/60' : 'text-ink-3')}>{c}</span>}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-extrabold tracking-tight">
                第{lesson}課 · Lesson {lesson}
                {title && <span className="text-ink-3 font-semibold text-base"> · {title}</span>}
              </h3>
              <p className="text-xs text-ink-3">
                {inLesson.length} word{inLesson.length === 1 ? '' : 's'}
                {groups.length > 1 && ` · ${groups.map(([c, ws]) => `${c || 'Other'} ${ws.length}`).join(' · ')}`}
              </p>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => go('library', 'words')}>
              <Icon name="book" size={14} /> Kanji words
            </button>
            {staff && (
              <button className={importing ? 'btn-dark btn-sm' : 'btn-primary btn-sm'} onClick={() => setImporting((x) => !x)}>
                <Icon name={importing ? 'x' : 'plus'} size={14} /> {importing ? 'Close' : isStarter ? 'Add the book’s list' : 'Add / replace words'}
              </button>
            )}
          </div>

          {staff && importing && (
            <ImportPanel
              track={track}
              lesson={lesson}
              existing={teacherCount(lesson)}
              onDone={() => {
                reload();
                setImporting(false);
              }}
            />
          )}

          {isStarter && !importing && (
            <div className="rounded-2xl bg-ai-soft text-ai text-sm px-4 py-3 flex items-start gap-2">
              <Icon name="sparkle" size={16} className="mt-0.5 shrink-0" />
              <span>
                <b>Yoisho starter list</b> — key words for this lesson’s theme.{' '}
                {staff ? 'Add the book’s own list for this lesson and it replaces this one for your students.' : 'Your teacher can replace it with the textbook’s list.'}
              </span>
            </div>
          )}

          {words === null ? (
            <div className="card card-pad text-sm text-ink-3">Loading…</div>
          ) : inLesson.length === 0 ? (
            !importing && (
              <div className="card card-pad text-center py-12">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-brand-soft text-brand">
                  <Icon name="note" size={26} />
                </div>
                <h3 className="mt-4 text-lg font-bold">No Lesson {lesson} word list yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">
                  {staff
                    ? 'Paste the chapter’s vocabulary once and every student in this level can revise and quiz it.'
                    : account
                      ? 'Your teacher hasn’t added this lesson’s vocabulary yet. Meanwhile, study the words for this lesson’s kanji.'
                      : 'Lesson word lists come from your teacher once you sign in.'}
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  {staff ? (
                    <button className="btn-primary" onClick={() => setImporting(true)}>
                      <Icon name="plus" size={15} /> Add words
                    </button>
                  ) : (
                    <button className="btn-ghost" onClick={() => go('library', 'words')}>
                      <Icon name="book" size={15} /> Kanji words
                    </button>
                  )}
                </div>
              </div>
            )
          ) : mode === 'quiz' ? (
            <WordQuiz key={`${track}-${lesson}`} words={inLesson} title={`Lesson ${lesson} vocabulary quiz`} record={{ kind: 'vocab', lesson }} />
          ) : mode === 'cards' ? (
            <Flashcards words={inLesson.map((w) => ({ ...w, term: w.term }))} />
          ) : (
            <div className="space-y-4">
              {groups.map(([cat, ws]) => (
                <section key={cat} className="card overflow-hidden">
                  <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                    <span className="eyebrow text-brand">{cat || 'Words'}</span>
                    <span className="text-[11px] text-ink-3 tabular">{ws.length}</span>
                    {ws.length >= 4 && (
                      <button className="ml-auto text-xs font-semibold text-ink-3 hover:text-brand" onClick={() => setMode('quiz')}>
                        Quiz lesson →
                      </button>
                    )}
                  </div>
                  <ul className="divide-y divide-line/50">
                    {ws.map((w) => (
                      <li key={w.id} className="group grid grid-cols-[32px_minmax(0,1fr)_auto] sm:grid-cols-[32px_minmax(0,1.1fr)_minmax(0,.8fr)_minmax(0,1.4fr)_auto] items-center gap-x-3 gap-y-0.5 px-5 py-2.5">
                        <Speak text={w.kana || w.term} label={`Listen to ${w.term}`} />
                        <span className="font-jp text-[17px] font-bold truncate">{w.kana || w.term}</span>
                        <span className="hidden sm:block font-jp text-ink-2 truncate">{w.term !== w.kana ? w.term : ''}</span>
                        <span className="col-start-2 sm:col-start-auto text-sm text-ink-2 sm:text-ink truncate">
                          <span className="sm:hidden font-jp text-ink-3 mr-1.5">{w.term !== w.kana ? w.term : ''}</span>
                          {w.meaning}
                        </span>
                        {staff && !w.starter ? (
                          <button
                            className="row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto grid h-8 w-8 place-items-center rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-sakura-soft hover:text-sakura"
                            aria-label={`Delete ${w.term}`}
                            onClick={async () => {
                              await deleteCustomWord(w.id).catch(() => undefined);
                              reload();
                            }}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
