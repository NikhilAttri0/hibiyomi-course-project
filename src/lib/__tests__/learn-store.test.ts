import { KANJI, LESSONS, cleanState, lessonOf, parseState, recallProbability, scheduleNext, summarize, trackForLevel, trackOf, type SrsState } from '@/lib/learn-store';

const DAY = 86_400_000;
const base: SrsState = { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0, lastReview: null, stability: 0.5 };

describe('scheduleNext', () => {
  it('grows intervals with successive good answers', () => {
    const now = Date.now();
    const a = scheduleNext(base, 'good', now);
    const b = scheduleNext(a, 'good', now);
    const c = scheduleNext(b, 'good', now);
    expect([a.interval, b.interval]).toEqual([1, 3]);
    expect(c.interval).toBeGreaterThan(b.interval);
    expect(c.due).toBe(now + c.interval * DAY);
  });

  it('brings a forgotten card back in 10 minutes and counts the lapse', () => {
    const now = Date.now();
    const learned = { ...base, interval: 10, reps: 4, stability: 10 };
    const again = scheduleNext(learned, 'again', now);
    expect(again.due - now).toBe(10 * 60_000);
    expect(again.reps).toBe(0);
    expect(again.lapses).toBe(1);
    expect(again.stability).toBeLessThan(10);
  });

  it('never lets ease drop below 1.3', () => {
    let s = { ...base, ease: 1.35 };
    for (let i = 0; i < 5; i++) s = scheduleNext(s, 'hard');
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
  });
});

describe('recallProbability', () => {
  it('is 90% after exactly one stability period', () => {
    expect(recallProbability(5, 5)).toBeCloseTo(0.9, 5);
    expect(recallProbability(0, 5)).toBe(1);
  });
});

describe('cleanState / parseState / summarize', () => {
  it('starts a new student with every kanji unseen, nothing to review and no history', () => {
    const st = cleanState();
    const sum = summarize(st);
    expect(st.log).toHaveLength(0);
    expect(Object.keys(st.progress)).toHaveLength(KANJI.length);
    expect(sum.due_count).toBe(0); // new kanji are introduced gradually, not counted as overdue reviews
    expect(sum.reviews_total).toBe(0);
    expect(sum.mastered).toBe(0);
  });

  it('rejects malformed blobs and keeps valid ones', () => {
    expect(parseState({ hello: 1 })).toBeNull();
    expect(parseState(null)).toBeNull();
    const st = cleanState();
    expect(parseState(JSON.parse(JSON.stringify(st)))?.version).toBe(3);
  });

  it('computes 7-day accuracy and streak from the log', () => {
    const st = cleanState();
    const now = Date.now();
    st.log = [
      { id: '1', ts: now - 1000, kanjiId: 'kanji-1', kind: 'card', grade: 'good', correct: true },
      { id: '2', ts: now - 2000, kanjiId: 'kanji-2', kind: 'card', grade: 'again', correct: false },
      { id: '3', ts: now - DAY, kanjiId: 'kanji-3', kind: 'quiz', mode: 'meaning', correct: true },
      { id: '4', ts: now - 10 * DAY, kanjiId: 'kanji-3', kind: 'quiz', mode: 'meaning', correct: false },
    ];
    const sum = summarize(st, now);
    expect(sum.reviews_7d).toBe(3);
    expect(sum.accuracy_7d).toBe(67);
    expect(sum.streak).toBe(2);
    expect(sum.reviews_total).toBe(4);
  });
});

describe('Genki decks', () => {
  it('has all 145 Genki I kanji (N5 track) and the Genki II kanji (N4 track), with no duplicates', () => {
    const n5 = KANJI.filter((k) => trackOf(k) === 'N5');
    const n4 = KANJI.filter((k) => trackOf(k) === 'N4');
    expect(n5).toHaveLength(145);
    expect(n4.length).toBeGreaterThanOrEqual(170);
    expect(n5.every((k) => lessonOf(k) >= 3 && lessonOf(k) <= 12)).toBe(true);
    expect(n4.every((k) => lessonOf(k) >= 13 && lessonOf(k) <= 23)).toBe(true);
    expect(new Set(KANJI.map((k) => k.character)).size).toBe(KANJI.length);
    expect(new Set(KANJI.map((k) => k.id)).size).toBe(KANJI.length);
    expect(LESSONS.filter((l) => l.track === 'N5').map((l) => l.count)).toEqual([15, 14, 14, 15, 14, 14, 15, 14, 16, 14]);
    expect(LESSONS.filter((l) => l.track === 'N4')).toHaveLength(11);
  });

  it('keeps the original ids so saved progress stays on the same kanji', () => {
    const byChar = Object.fromEntries(KANJI.map((k) => [k.character, k]));
    expect(byChar['食'].id).toBe('kanji-1');
    expect(byChar['見'].id).toBe('kanji-20');
    expect(byChar['待'].id).toBe('kanji-2');
    expect(lessonOf(byChar['待'])).toBe(22); // now part of Genki II
  });

  it('keeps look-alike pairs inside one track', () => {
    const byChar = Object.fromEntries(KANJI.map((k) => [k.character, k]));
    for (const k of KANJI) {
      if (k.confusionWith) expect(trackOf(byChar[k.confusionWith])).toBe(trackOf(k));
    }
  });

  it('maps batch levels to tracks', () => {
    expect(trackForLevel('N5')).toBe('N5');
    expect(trackForLevel('N4')).toBe('N4');
    expect(trackForLevel('N3')).toBe('N4');
  });

  it('adds new kanji as unseen cards to an older saved state', () => {
    const old = cleanState();
    const onlyOld = Object.fromEntries(Object.entries(old.progress).filter(([id]) => id.startsWith('kanji-')));
    const srs = Object.fromEntries(Object.entries(old.srs).filter(([id]) => id.startsWith('kanji-')));
    const merged = parseState({ ...old, progress: onlyOld, srs })!;
    expect(Object.keys(merged.progress)).toHaveLength(KANJI.length);
  });
});
