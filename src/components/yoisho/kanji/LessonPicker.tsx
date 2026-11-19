'use client';

import { useEffect, useState } from 'react';
import { useLearn } from '@/lib/learn-store';
import { cx } from '../ui';

export function useLessonState(initial?: number) {
  const s = useLearn();
  const first = s.lessons[0]?.lesson ?? 3;
  const [lesson, setLesson] = useState<number>(initial ?? first);
  useEffect(() => {
    if (!s.lessons.some((l) => l.lesson === lesson)) setLesson(first);
  }, [s.lessons, lesson, first]);
  useEffect(() => {
    if (initial) setLesson(initial);
  }, [initial]);
  return [lesson, setLesson] as const;
}

export function LessonPicker({ lesson, onChange }: { lesson: number; onChange: (l: number) => void }) {
  const s = useLearn();
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
      {s.lessons.map((l) => (
        <button
          key={l.lesson}
          onClick={() => onChange(l.lesson)}
          title={l.title}
          className={cx(
            'shrink-0 h-10 px-4 rounded-full border text-sm font-semibold transition',
            l.lesson === lesson ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-2 hover:border-ink/30'
          )}
        >
          L{l.lesson}
        </button>
      ))}
    </div>
  );
}
