'use client';

import { useMemo, useState } from 'react';
import {
  KANJI_BY_CHAR,
  lessonOf,
  primaryReading,
  speakJapanese,
  timeAgo,
  useLearn,
  vocabFor,
  type KanjiView,
  type MasteryBand,
} from '@/lib/learn-store';
import { Icon } from '../icons';
import { useNav } from '../nav';
import KanjiWordsView from './KanjiWordsView';
import StrokeOrderView from '../kanji/StrokeOrderView';
import WritingView from '../kanji/WritingView';
import { BAND_META, BandChip, Bar, Ring, cx, recallTone } from '../ui';

type Filter = 'all' | MasteryBand | 'due';

function Detail({ v, onClose }: { v: KanjiView; onClose?: () => void }) {
  const s = useLearn();
  const { go } = useNav();
  const k = v.kanji;
  const p = v.progress;
  const vocab = vocabFor(k.character);
  const twin = k.confusionWith ? KANJI_BY_CHAR[k.confusionWith] : undefined;
  const skills = [
    ['Meaning', p.meaning_score],
    ['Reading', p.reading_score],
    ['Recognition', p.recognition_score],
    ['Writing', p.writing_score],
    ['Vocabulary', p.vocabulary_score],
  ] as const;
  const dueIn = Math.round((v.srs.due - s.now) / 86_400_000);

  return (
    <div className="card overflow-hidden animate-pop" key={k.id}>
      <div className="relative bg-brand text-white p-6 overflow-hidden">
        <div className="absolute inset-0 seigaiha opacity-60" />
        {onClose && (
          <button onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/15" aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        )}
        <div className="relative flex items-center gap-5">
          <div className="grid h-28 w-28 place-items-center rounded-3xl bg-white text-[#141414] shadow-lift">
            <span className="font-mincho text-7xl font-bold leading-none">{k.character}</span>
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-extrabold tracking-tight leading-tight">{k.meanings.join(', ')}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip bg-white/20">{lessonOf(k) >= 13 ? 'Genki II' : 'Genki I'} · L{lessonOf(k)}</span>
              <span className="chip bg-white/20">JLPT {k.jlpt_level}</span>
              <span className="chip bg-white/20">{k.stroke_count} stroke{k.stroke_count === 1 ? "" : "s"}</span>
              {k.grade_level && <span className="chip bg-white/20">Grade {k.grade_level}</span>}
            </div>
            <button
              disabled={!s.settings.audio}
              onClick={() => speakJapanese(primaryReading(k), s.settings.speechRate)}
              className="mt-3 btn btn-sm bg-black/15 hover:bg-black/25 text-white"
            >
              <Icon name="speaker" size={14} /> Listen
            </button>
            <button onClick={() => go('library', `strokes:${k.id}`)} className="mt-3 ml-2 btn btn-sm bg-black/15 hover:bg-black/25 text-white">
              <Icon name="play" size={14} /> Stroke order
            </button>
            <button onClick={() => go('library', `write:${k.id}`)} className="mt-3 ml-2 btn btn-sm bg-black/15 hover:bg-black/25 text-white">
              <Icon name="pen" size={14} /> Write
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-paper border border-line/70 p-3">
            <div className="eyebrow">Kun&apos;yomi 訓</div>
            <div className="font-jp mt-1 font-medium">{k.kunyomi?.length ? k.kunyomi.join('、') : '—'}</div>
          </div>
          <div className="rounded-2xl bg-paper border border-line/70 p-3">
            <div className="eyebrow">On&apos;yomi 音</div>
            <div className="font-jp mt-1 font-medium">{k.onyomi?.length ? k.onyomi.join('、') : '—'}</div>
          </div>
        </div>

        {!!k.components?.length && (
          <div>
            <div className="eyebrow mb-2">Built from</div>
            <div className="flex items-center gap-2 flex-wrap">
              {k.components.map((c, i) => (
                <span key={c + i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-ink-3">+</span>}
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-sunken/70 font-mincho text-2xl font-bold">{c}</span>
                </span>
              ))}
              <span className="text-ink-3">=</span>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand font-mincho text-2xl font-bold">{k.character}</span>
            </div>
          </div>
        )}

        {k.mnemonic && (
          <div className="rounded-2xl bg-brand-soft p-4 text-sm text-ink-2">
            <div className="flex items-center gap-1.5 font-bold text-brand text-xs mb-1">
              <Icon name="sparkle" size={13} /> MEMORY HOOK
            </div>
            {k.mnemonic}
          </div>
        )}

        {twin && (
          <button onClick={() => go('library', twin.id)} className="w-full text-left rounded-2xl bg-sakura-soft p-4 text-sm flex gap-3 items-center">
            <span className="font-mincho text-4xl font-bold text-sakura">{twin.character}</span>
            <span>
              <span className="block font-bold text-sakura text-xs">LOOK-ALIKE · {twin.meanings[0]}</span>
              <span className="text-ink-2">{k.confusionNote}</span>
            </span>
          </button>
        )}

        <div className="grid grid-cols-[auto_1fr] gap-5 items-center rounded-2xl border border-line/70 p-4">
          <Ring value={v.recall * 100} size={84} tone={recallTone(v.recall)}>
            <div className="text-center">
              <div className="text-lg font-extrabold tabular leading-none">{Math.round(v.recall * 100)}%</div>
              <div className="text-[10px] text-ink-3">recall</div>
            </div>
          </Ring>
          <div className="space-y-1.5 text-sm">
            <BandChip band={v.band} />
            <div className="text-ink-2">
              {v.band === 'new' ? (
                <b className="text-ai">Not studied yet</b>
              ) : v.isDue ? (
                <b className="text-brand">Due now</b>
              ) : (
                <>
                  Next review in <b>{dueIn} day{dueIn === 1 ? '' : 's'}</b>
                </>
              )}
            </div>
            <div className="text-xs text-ink-3">
              {p.correct_attempts}/{p.total_attempts} correct · last seen {v.srs.lastReview ? timeAgo(v.srs.lastReview, s.now) : 'never'}
            </div>
          </div>
        </div>

        <div>
          <div className="eyebrow mb-3">Skill breakdown</div>
          <div className="space-y-2.5">
            {skills.map(([label, val]) => (
              <div key={label} className="grid grid-cols-[90px_1fr_36px] items-center gap-3 text-sm">
                <span className="text-ink-2">{label}</span>
                <Bar value={val} tone={val >= 80 ? 'matcha' : val >= 60 ? 'kin' : 'sakura'} />
                <span className="text-right font-bold tabular">{Math.round(val)}</span>
              </div>
            ))}
          </div>
        </div>

        {vocab.length > 0 && (
          <div>
            <div className="eyebrow mb-2">Vocabulary</div>
            <div className="space-y-2">
              {vocab.map((w) => (
                <div key={w.id} className="rounded-2xl bg-paper border border-line/70 p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-jp text-lg font-bold">{w.term}</span>
                    <span className="font-jp text-sm text-ink-3">{w.kana}</span>
                    <span className="ml-auto text-xs text-ink-3">{w.part_of_speech}</span>
                  </div>
                  <div className="text-sm">{w.meanings.join(', ')}</div>
                  {w.example_sentences?.[0] && (
                    <div className="mt-1 text-xs text-ink-3">
                      <span className="font-jp">{w.example_sentences[0]}</span> — {w.translations?.[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LibraryView() {
  const s = useLearn();
  const { param, go } = useNav();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [lesson, setLesson] = useState<number | 'all'>('all');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return s.views.filter((v) => {
      if (lesson !== 'all' && lessonOf(v.kanji) !== lesson) return false;
      if (filter === 'due' && !v.isDue) return false;
      if (filter !== 'all' && filter !== 'due' && v.band !== filter) return false;
      if (!q) return true;
      const k = v.kanji;
      return (
        k.character.includes(q) ||
        k.meanings.some((m) => m.toLowerCase().includes(q)) ||
        [...(k.onyomi ?? []), ...(k.kunyomi ?? [])].some((r) => r.replace(/[.-]/g, '').includes(q))
      );
    });
  }, [s.views, query, filter, lesson]);

  const selected = (param && s.viewById[param]) || null;

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: s.views.length },
    { id: 'due', label: 'Due', count: s.views.filter((v) => v.isDue).length },
    { id: 'new', label: BAND_META.new.label, count: s.bands.new },
    { id: 'weak', label: BAND_META.weak.label, count: s.bands.weak },
    { id: 'learning', label: BAND_META.learning.label, count: s.bands.learning },
    { id: 'mastered', label: BAND_META.mastered.label, count: s.bands.mastered },
  ];

  const section = param === 'words' ? 'words' : param?.startsWith('strokes') ? 'strokes' : param?.startsWith('write') ? 'write' : 'kanji';
  const subId = param && param.includes(':') ? param.split(':')[1] : null;
  const tabs = (
    <div className="flex gap-1 rounded-full bg-sunken/70 p-1 w-fit max-w-full overflow-x-auto no-scrollbar mb-5">
      {(
        [
          ['kanji', null, 'Kanji', 'book'],
          ['words', 'words', 'Kanji words', 'note'],
          ['strokes', 'strokes', 'Stroke order', 'play'],
          ['write', 'write', 'Writing practice', 'pen'],
        ] as const
      ).map(([id, p, label, icon]) => (
        <button
          key={id}
          onClick={() => go('library', p)}
          className={cx(
            'shrink-0 flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold transition',
            section === id ? 'bg-surface shadow-card text-ink' : 'text-ink-3 hover:text-ink'
          )}
        >
          <Icon name={icon} size={15} /> {label}
        </button>
      ))}
    </div>
  );

  if (section !== 'kanji')
    return (
      <>
        {tabs}
        {section === 'words' && <KanjiWordsView />}
        {section === 'strokes' && <StrokeOrderView initialId={subId} />}
        {section === 'write' && <WritingView initialId={subId} />}
      </>
    );

  return (
    <>
    {tabs}
    <div className="grid gap-6 lg:grid-cols-[1fr_400px] items-start">
      <div className="min-w-0 space-y-4">
        <div className="relative">
          <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by kanji, meaning or reading (e.g. 待, wait, まつ)"
            className="input pl-11 h-12 bg-surface border-line/70"
            aria-label="Search kanji"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cx(
                'shrink-0 h-9 px-4 rounded-full text-sm font-semibold border transition',
                filter === f.id ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-2 hover:border-ink/30'
              )}
            >
              {f.label} <span className="opacity-60 tabular ml-0.5">{f.count}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 items-center">
          <span className="eyebrow shrink-0 mr-1">{s.track === 'N5' ? 'Genki I' : 'Genki II'}</span>
          {[{ lesson: 'all' as const, title: 'All lessons', count: s.views.length }, ...s.lessons].map((l) => {
            const active = lesson === l.lesson;
            const learned = l.lesson === 'all' ? null : s.views.filter((v) => lessonOf(v.kanji) === l.lesson && v.band !== 'new').length;
            return (
              <button
                key={String(l.lesson)}
                onClick={() => setLesson(l.lesson)}
                title={l.title}
                className={cx(
                  'shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition tabular',
                  active ? 'bg-brand text-brand-ink border-brand' : 'bg-surface border-line text-ink-2 hover:border-brand/50'
                )}
              >
                {l.lesson === 'all' ? 'All' : `L${l.lesson}`}
                {learned !== null && <span className="opacity-70 ml-1">{learned}/{l.count}</span>}
              </button>
            );
          })}
        </div>
        {lesson !== 'all' && (
          <p className="text-sm text-ink-3 -mt-1">
            {`Lesson ${lesson}: ${s.lessons.find((l) => l.lesson === lesson)?.title}`}
          </p>
        )}

        {list.length === 0 ? (
          <div className="card card-pad text-center text-sm text-ink-3 py-12">{query ? <>No kanji match “{query}”.</> : 'No kanji in this view yet.'}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {list.map((v, i) => {
              const active = selected?.kanji.id === v.kanji.id;
              const tone = BAND_META[v.band].tone;
              return (
                <button
                  key={v.kanji.id}
                  onClick={() => go('library', v.kanji.id)}
                  style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                  className={cx(
                    'animate-rise group relative rounded-3xl border bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift',
                    active ? 'border-brand ring-2 ring-brand/30' : 'border-line/70'
                  )}
                >
                  <div className="flex items-center justify-between h-5">
                    <span className="h-2 w-2 rounded-full" style={{ background: `rgb(var(--${tone}))` }} title={BAND_META[v.band].label} />
                    {v.isDue ? (
                      <span className="chip bg-brand-soft text-brand py-0.5 text-[10px]">DUE</span>
                    ) : (
                      <span className="text-[10px] font-bold text-ink-3">L{lessonOf(v.kanji)}</span>
                    )}
                  </div>
                  <div className="text-center my-2">
                    {s.settings.showFurigana && <div className="font-jp text-[11px] text-ink-3 h-4">{primaryReading(v.kanji).replace(/\./g, '')}</div>}
                    <div className="font-mincho text-6xl font-bold leading-tight group-hover:text-brand transition-colors">{v.kanji.character}</div>
                  </div>
                  <div className="text-sm font-semibold truncate text-center">{v.kanji.meanings[0]}</div>
                  <div className="mt-2.5 h-1.5 rounded-full bg-sunken overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${v.progress.overall_mastery}%`, background: `rgb(var(--${tone}))` }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop detail panel */}
      <div className="hidden lg:block sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto no-scrollbar rounded-3xl">
        {selected ? (
          <Detail v={selected} />
        ) : (
          <div className="card card-pad text-center py-16">
            <div className="font-mincho text-7xl text-ink-3/30 font-bold">字</div>
            <p className="mt-3 text-sm text-ink-3">Select a kanji to see readings, components, memory hooks and your stats.</p>
          </div>
        )}
      </div>

      {/* Mobile detail sheet */}
      {selected && (
        <div className="lg:hidden fixed inset-0 z-40 bg-sumi/40 backdrop-blur-sm overflow-y-auto p-3 pt-10" onClick={() => go('library')}>
          <div onClick={(e) => e.stopPropagation()} className="max-w-lg mx-auto pb-24">
            <Detail v={selected} onClose={() => go('library')} />
          </div>
        </div>
      )}
    </div>
    </>
  );
}
