'use client';

import { useMemo } from 'react';
import { KANJI_BY_ID, lessonOf, useLearn } from '@/lib/learn-store';
import { useNav } from '../nav';
import { Icon } from '../icons';
import { cx } from '../ui';
import StrokeAnimator, { StrokeStrip } from './StrokeAnimator';
import { KANJIVG_CREDIT, useStrokes } from './strokes';
import { LessonPicker, useLessonState } from './LessonPicker';

/** Kanji Library → Stroke order: animated stroke order and a stroke-by-stroke strip for every kanji. */
export default function StrokeOrderView({ initialId }: { initialId?: string | null }) {
  const s = useLearn();
  const { go } = useNav();
  const { data, error } = useStrokes();
  const init = initialId ? KANJI_BY_ID[initialId] : undefined;
  const [lesson, setLesson] = useLessonState(init ? lessonOf(init) : undefined);
  const list = useMemo(() => s.deck.filter((k) => lessonOf(k) === lesson), [s.deck, lesson]);
  const selected = (init && lessonOf(init) === lesson ? init : null) ?? list[0];
  const sd = selected && data ? data[selected.character] : undefined;

  return (
    <div className="space-y-5">
      <LessonPicker lesson={lesson} onChange={(l) => (setLesson(l), go('library', 'strokes'))} />
      <div className="flex flex-wrap gap-1.5">
        {list.map((k) => (
          <button
            key={k.id}
            onClick={() => go('library', `strokes:${k.id}`)}
            className={cx(
              'grid h-12 w-12 place-items-center rounded-2xl border font-mincho text-2xl font-bold transition',
              selected?.id === k.id ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line/70 hover:border-brand/50'
            )}
          >
            {k.character}
          </button>
        ))}
      </div>

      {error && <div className="card card-pad text-sm text-sakura">{error}</div>}
      {!data && !error && <div className="card card-pad text-sm text-ink-3">Loading stroke data…</div>}

      {selected && sd && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
          <div className="card card-pad">
            <StrokeAnimator char={selected.character} data={sd} size={340} />
          </div>
          <div className="space-y-4 min-w-0">
            <div className="card card-pad">
              <div className="flex items-start gap-4">
                <span className="font-mincho text-6xl font-bold leading-none">{selected.character}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-extrabold">{selected.meanings.join(', ')}</div>
                  <div className="font-jp text-sm text-ink-2 mt-1">
                    {[...(selected.kunyomi ?? []), ...(selected.onyomi ?? [])].join('、')}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="chip bg-brand-soft text-brand">{sd.s.length} strokes</span>
                    <span className="chip bg-sunken text-ink-2">Lesson {lessonOf(selected)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary btn-sm" onClick={() => go('library', `write:${selected.id}`)}>
                  <Icon name="pen" size={14} /> Practise writing {selected.character}
                </button>
                <button className="btn-ghost btn-sm" onClick={() => go('library', selected.id)}>
                  <Icon name="book" size={14} /> Kanji details
                </button>
              </div>
            </div>
            <div className="card card-pad">
              <div className="eyebrow mb-3">Stroke by stroke</div>
              <StrokeStrip data={sd} />
            </div>
            <p className="text-[11px] text-ink-3">{KANJIVG_CREDIT}</p>
          </div>
        </div>
      )}
    </div>
  );
}
