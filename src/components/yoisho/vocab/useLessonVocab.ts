'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadCustomWords, type CustomWord } from '@/lib/classroom-api';
import { starterWords } from '@/lib/starter-vocab';
import { useAccount } from '../account';

const lessonsOf = (track: 'N5' | 'N4') => (track === 'N5' ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.from({ length: 11 }, (_, i) => i + 13));

/**
 * Lesson word lists for a track: the teacher's list for a lesson when one exists,
 * otherwise the Yoisho starter list for that lesson.
 */
export function useLessonVocab(track: 'N5' | 'N4') {
  const account = useAccount();
  const [teacher, setTeacher] = useState<CustomWord[] | null>(null);
  const reload = useCallback(() => {
    if (!account) return setTeacher([]);
    loadCustomWords(track)
      .then(setTeacher)
      .catch(() => setTeacher([]));
  }, [account, track]);
  useEffect(reload, [reload]);

  const words = useMemo(() => {
    if (teacher === null) return null;
    const has = new Set(teacher.map((w) => w.lesson));
    return [...teacher, ...lessonsOf(track).filter((l) => !has.has(l)).flatMap((l) => starterWords(l) as CustomWord[])].sort(
      (a, b) => a.lesson - b.lesson || a.position - b.position
    );
  }, [teacher, track]);

  const teacherCount = useCallback((lesson: number) => (teacher ?? []).filter((w) => w.lesson === lesson).length, [teacher]);
  return { words, reload, teacherCount };
}
