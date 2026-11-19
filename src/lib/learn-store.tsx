'use client';

/**
 * Yoisho Learn — client learning store.
 *
 * Holds every student-facing piece of state for the demo app (kanji progress,
 * spaced-repetition schedule, review log, settings) and persists it to
 * localStorage. All derived numbers (due queue, streak, accuracy, recall
 * probability) are computed from the review log and schedule, so every view
 * stays consistent with every other view.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Kanji, StudentKanjiProgress, Vocabulary } from '@/types';
import { INITIAL_KANJI_DATA, INITIAL_STUDENT_PROGRESS, INITIAL_VOCABULARY_DATA } from '@/lib/mockData';
import { GENKI_CONFUSIONS, GENKI_LESSONS } from '@/lib/genki-kanji';
import { GENKI2_CONFUSIONS, GENKI2_LESSONS } from '@/lib/genki2-kanji';
import { kanjiVocab } from '@/lib/vocab';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Grade = 'again' | 'hard' | 'good' | 'easy';
/** 'writing' = stroke-order writing practice (updates the writing score). */
export type QuizMode = 'meaning' | 'reading' | 'kanji' | 'writing';
export type ThemeMode = 'system' | 'light' | 'dark';

export type KanjiItem = Kanji & { confusionWith?: string; confusionNote?: string };

export interface SrsState {
  ease: number; // SM-2 ease factor (1.3 – 3.0)
  interval: number; // days
  reps: number; // successful reviews in a row
  lapses: number;
  due: number; // epoch ms
  lastReview: number | null; // epoch ms
  stability: number; // days until recall drops to 90%
}

export interface ReviewEvent {
  id: string;
  ts: number;
  kanjiId: string;
  kind: 'card' | 'quiz';
  grade?: Grade;
  mode?: QuizMode;
  correct: boolean;
}

export interface Settings {
  dailyGoal: number;
  showFurigana: boolean;
  audio: boolean;
  speechRate: number;
  theme: ThemeMode;
  /** How many never-seen kanji to introduce per day, in Genki lesson order. */
  newPerDay: number;
  /** Track the student chose (only used when they have access to more than one). */
  track?: Track;
}

export interface DayBucket {
  date: string; // YYYY-MM-DD
  label: string; // Mon, Tue …
  reviews: number;
  correct: number;
}

export type MasteryBand = 'mastered' | 'learning' | 'weak' | 'new';

export interface KanjiView {
  kanji: KanjiItem;
  progress: StudentKanjiProgress;
  srs: SrsState;
  recall: number; // 0–1 probability of recall right now
  band: MasteryBand;
  isDue: boolean;
}

export interface PersistedState {
  version: 3;
  progress: Record<string, StudentKanjiProgress>;
  srs: Record<string, SrsState>;
  log: ReviewEvent[];
  settings: Settings;
}

/* ------------------------------------------------------------------ */
/* Pure helpers (exported so views and tests can reuse them)           */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;
const STORAGE_KEY = 'yoisho_learn_state_v3';

/* ----------------------------- Kanji deck ----------------------------- */

/** Genki lesson number (3–12 = Genki I, 13–23 = Genki II). */
export function lessonOf(k: Kanji): number {
  return Number((k.metadata as { lesson?: number })?.lesson ?? 0);
}

/** Course tracks. N5 = Genki I, N4 = Genki II. */
export type Track = 'N5' | 'N4';
export const TRACKS: { id: Track; book: string; lessons: string }[] = [
  { id: 'N5', book: 'Genki I', lessons: 'Lessons 3–12' },
  { id: 'N4', book: 'Genki II', lessons: 'Lessons 13–23' },
];
export const trackOfLesson = (lesson: number): Track => (lesson >= 13 ? 'N4' : 'N5');
export const trackOf = (k: Kanji): Track => trackOfLesson(lessonOf(k));

/** Maps a batch level (N5…N1) to the track it studies. Levels above N4 use the N4 track until more content exists. */
export function trackForLevel(level: string | null | undefined): Track {
  return level === 'N5' ? 'N5' : 'N4';
}

/**
 * Builds the deck: all 145 Genki I kanji in textbook order, then a few extras.
 * The original 20 demo kanji keep their ids ("kanji-1" …), so progress saved before
 * the deck grew stays attached to the right character.
 */
function buildDeck(): KanjiItem[] {
  const legacy: Record<string, KanjiItem> = Object.fromEntries(INITIAL_KANJI_DATA.map((k) => [k.character, k]));
  const split = (s: string) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
  const stamp = '2026-01-01T00:00:00.000Z';
  const deck: KanjiItem[] = [];
  let order = 0;
  for (const { lesson, rows } of [...GENKI_LESSONS, ...GENKI2_LESSONS]) {
    for (const [char, strokes, meanings, on, kun, components, mnemonic, jlpt] of rows) {
      const old = legacy[char];
      deck.push({
        id: old?.id ?? `k-${char.codePointAt(0)!.toString(16)}`,
        character: char,
        unicode: char.codePointAt(0)!,
        jlpt_level: jlpt,
        grade_level: old?.grade_level ?? null,
        stroke_count: strokes,
        meanings: split(meanings),
        onyomi: split(on),
        kunyomi: split(kun),
        nanori: null,
        radicals: old?.radicals ?? null,
        components: components ? components.split(' ').filter(Boolean) : old?.components ?? null,
        frequency_rank: old?.frequency_rank ?? null,
        commonness: old?.commonness ?? null,
        mnemonic: old?.mnemonic ?? mnemonic,
        visual_similarity_group: old?.visual_similarity_group ?? null,
        semantic_category: old?.semantic_category ?? null,
        metadata: { lesson, order: order++ },
        created_at: old?.created_at ?? stamp,
        updated_at: old?.updated_at ?? stamp,
        confusionWith: old?.confusionWith,
        confusionNote: old?.confusionNote,
      });
    }
  }
  // Look-alike pairs (only pairs within the same book, so each track stays self-contained).
  const byChar = Object.fromEntries(deck.map((k) => [k.character, k]));
  for (const k of deck) {
    // Drop older demo notes that point at a kanji in the other book.
    if (k.confusionWith && (!byChar[k.confusionWith] || trackOf(byChar[k.confusionWith]) !== trackOf(k))) {
      k.confusionWith = undefined;
      k.confusionNote = undefined;
    }
  }
  for (const [a, b, note] of [...GENKI_CONFUSIONS, ...GENKI2_CONFUSIONS]) {
    if (byChar[a] && byChar[b] && trackOf(byChar[a]) !== trackOf(byChar[b])) continue;
    if (!byChar[a] || !byChar[b]) continue;
    byChar[a].confusionWith = b;
    byChar[a].confusionNote = note;
    if (!byChar[b].confusionWith || !byChar[byChar[b].confusionWith!]) {
      byChar[b].confusionWith = a;
      byChar[b].confusionNote = note;
    }
  }
  return deck;
}

export const KANJI: KanjiItem[] = buildDeck();
export const LESSONS: { lesson: number; title: string; count: number; track: Track }[] = [...GENKI_LESSONS, ...GENKI2_LESSONS].map((l) => ({
  lesson: l.lesson,
  title: l.title,
  count: l.rows.length,
  track: trackOfLesson(l.lesson),
}));
export const VOCAB: Vocabulary[] = INITIAL_VOCABULARY_DATA;
export const KANJI_BY_ID: Record<string, KanjiItem> = Object.fromEntries(KANJI.map((k) => [k.id, k]));
export const KANJI_BY_CHAR: Record<string, KanjiItem> = Object.fromEntries(KANJI.map((k) => [k.character, k]));

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Probability of recall after `daysElapsed` for a memory with the given stability (FSRS-style curve). */
export function recallProbability(daysElapsed: number, stability: number): number {
  const s = Math.max(0.2, stability);
  return Math.pow(0.9, Math.max(0, daysElapsed) / s);
}

export function currentRecall(srs: SrsState, now = Date.now()): number {
  if (!srs.lastReview) return 0.3;
  return recallProbability((now - srs.lastReview) / DAY, srs.stability);
}

export function overallMastery(p: Pick<StudentKanjiProgress, 'meaning_score' | 'reading_score' | 'recognition_score' | 'writing_score' | 'vocabulary_score'>) {
  return +(
    p.meaning_score * 0.2 +
    p.reading_score * 0.25 +
    p.recognition_score * 0.2 +
    p.writing_score * 0.1 +
    p.vocabulary_score * 0.25
  ).toFixed(1);
}

export function bandFor(p: StudentKanjiProgress): MasteryBand {
  if (p.total_attempts === 0) return 'new';
  if (p.overall_mastery >= 80) return 'mastered';
  if (p.overall_mastery >= 60) return 'learning';
  return 'weak';
}

/** Next schedule for a grade. Pure, so the UI can preview intervals on the grade buttons. */
export function scheduleNext(s: SrsState, grade: Grade, now = Date.now()): SrsState {
  let { ease, interval, reps, lapses, stability } = s;

  if (grade === 'again') {
    reps = 0;
    lapses += 1;
    ease = clamp(ease - 0.2, 1.3, 3.0);
    interval = 0; // relearn this session
    stability = Math.max(0.3, stability * 0.45);
    return { ease, interval, reps, lapses, stability, lastReview: now, due: now + 10 * 60_000 };
  }

  if (grade === 'hard') {
    ease = clamp(ease - 0.15, 1.3, 3.0);
    interval = Math.max(1, Math.round(Math.max(interval, 1) * 1.2));
  } else if (grade === 'good') {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease));
  } else {
    ease = clamp(ease + 0.15, 1.3, 3.0);
    interval = reps === 0 ? 4 : Math.max(interval + 2, Math.round(interval * ease * 1.3));
  }

  reps += 1;
  stability = Math.max(stability, interval);
  return { ease, interval, reps, lapses, stability, lastReview: now, due: now + interval * DAY };
}

export function formatInterval(s: SrsState): string {
  if (s.interval === 0) return '10m';
  if (s.interval < 30) return `${s.interval}d`;
  if (s.interval < 365) return `${Math.round(s.interval / 30)}mo`;
  return `${(s.interval / 365).toFixed(1)}y`;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DEMO_BREAK = 3 * DAY;

/** Progress record for a kanji the student has never seen. */
function blankProgress(kanjiId: string, now = Date.now()): StudentKanjiProgress {
  const iso = new Date(now).toISOString();
  return {
    id: `prog-${kanjiId}`,
    student_id: 'me',
    kanji_id: kanjiId,
    academy_id: 'yoisho',
    meaning_score: 0,
    reading_score: 0,
    recognition_score: 0,
    writing_score: 0,
    vocabulary_score: 0,
    overall_mastery: 0,
    memory_strength: 0.5,
    difficulty_estimate: 0.5,
    current_interval_days: 0,
    next_review_at: iso,
    last_review_at: null,
    total_attempts: 0,
    correct_attempts: 0,
    incorrect_attempts: 0,
    forget_count: 0,
    consecutive_correct: 0,
    consecutive_incorrect: 0,
    average_response_ms: 0,
    fastest_response_ms: 0,
    slowest_response_ms: 0,
    hint_count: 0,
    confidence_score: 0,
    mature_reviews: 0,
    lapses: 0,
    created_at: iso,
    updated_at: iso,
  } as StudentKanjiProgress;
}

const newSrs = (now = Date.now()): SrsState => ({ ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now, lastReview: null, stability: 0.5 });

function initialSrs(): Record<string, SrsState> {
  const out: Record<string, SrsState> = {};
  for (const k of KANJI) {
    const p = INITIAL_STUDENT_PROGRESS[k.id];
    if (!p) {
      out[k.id] = newSrs();
      continue;
    }
    out[k.id] = {
      ease: clamp(2.6 - p.difficulty_estimate, 1.3, 2.8),
      interval: p.current_interval_days,
      reps: p.consecutive_correct,
      lapses: p.lapses,
      // Demo scenario: shift the seeded schedule back so a realistic handful of cards is due today.
      due: Date.parse(p.next_review_at) - DEMO_BREAK,
      lastReview: p.last_review_at ? Date.parse(p.last_review_at) - DEMO_BREAK : null,
      stability: Math.max(0.5, p.memory_strength * 0.5),
    };
  }
  return out;
}

/** Deterministic demo history for the previous 12 days so charts and streaks have something to show. */
function seedLog(): ReviewEvent[] {
  const now = Date.now();
  const log: ReviewEvent[] = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let d = 12; d >= 1; d--) {
    if (d === 8) continue; // one missed day so the streak is honest
    const count = 8 + Math.floor(rand() * 15);
    for (let i = 0; i < count; i++) {
      const ids = Object.keys(INITIAL_STUDENT_PROGRESS);
      const k = { id: ids[Math.floor(rand() * ids.length)] };
      const correct = rand() > 0.2;
      log.push({
        id: `seed-${d}-${i}`,
        ts: now - d * DAY + i * 90_000,
        kanjiId: k.id,
        kind: rand() > 0.3 ? 'card' : 'quiz',
        grade: correct ? (rand() > 0.6 ? 'easy' : 'good') : 'again',
        correct,
      });
    }
  }
  return log;
}

const DEFAULT_SETTINGS: Settings = {
  dailyGoal: 20,
  showFurigana: true,
  audio: true,
  speechRate: 0.85,
  theme: 'system',
  newPerDay: 10,
};

function freshState(): PersistedState {
  return {
    version: 3,
    progress: {
      ...Object.fromEntries(KANJI.map((k) => [k.id, blankProgress(k.id)])),
      ...structuredCloneSafe(INITIAL_STUDENT_PROGRESS),
    },
    srs: initialSrs(),
    log: seedLog(),
    settings: DEFAULT_SETTINGS,
  };
}

/** A brand-new student: every kanji unseen, no history. */
export function cleanState(): PersistedState {
  const progress: Record<string, StudentKanjiProgress> = {};
  const srs: Record<string, SrsState> = {};
  const now = Date.now();
  for (const k of KANJI) {
    progress[k.id] = blankProgress(k.id, now);
    srs[k.id] = newSrs(now);
  }
  return { version: 3, progress, srs, log: [], settings: DEFAULT_SETTINGS };
}

/** Validates a state blob loaded from storage or the server. */
export function parseState(raw: unknown): PersistedState | null {
  const parsed = raw as PersistedState | null;
  if (parsed && parsed.version === 3 && parsed.progress && parsed.srs && Array.isArray(parsed.log)) {
    // Kanji added to the deck later are merged in as new cards.
    const clean = cleanState();
    return {
      ...parsed,
      progress: { ...clean.progress, ...parsed.progress },
      srs: { ...clean.srs, ...parsed.srs },
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    };
  }
  return null;
}

export interface ProgressSummary {
  avg_mastery: number;
  mastered: number;
  weak: number;
  due_count: number;
  reviews_total: number;
  reviews_7d: number;
  accuracy_7d: number;
  streak: number;
  last_active: string | null;
}

/** Connects the store to an account. Without it the store runs as a local-only demo. */
export interface RemoteSync {
  userId: string;
  name: string;
  initial: PersistedState | null;
  save: (state: PersistedState, summary: ProgressSummary) => Promise<void> | void;
  logEvent: (e: { kanji: string; kind: 'card' | 'quiz'; grade?: Grade; mode?: QuizMode; correct: boolean }) => void;
}

function loadState(key = STORAGE_KEY, fallback: () => PersistedState = freshState): PersistedState {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = parseState(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {
    /* storage blocked or corrupt — fall back to a fresh state */
  }
  return fallback();
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Headline numbers stored next to the state so teachers can list students without parsing it. */
export function summarize(st: PersistedState, now = Date.now()): ProgressSummary {
  const ids = Object.keys(st.progress);
  const studied = ids.filter((id) => st.progress[id].total_attempts > 0);
  const masteries = studied.map((id) => st.progress[id].overall_mastery);
  const week = st.log.filter((e) => e.ts > now - 7 * DAY);
  const days = new Set(st.log.map((e) => dayKey(e.ts)));
  let streak = 0;
  let cursor = days.has(dayKey(now)) ? now : now - DAY;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor -= DAY;
  }
  const last = st.log.length ? Math.max(...st.log.slice(-50).map((e) => e.ts)) : null;
  return {
    avg_mastery: masteries.length ? Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length) : 0,
    mastered: ids.filter((id) => st.progress[id].total_attempts > 0 && st.progress[id].overall_mastery >= 80).length,
    weak: ids.filter((id) => st.progress[id].total_attempts > 0 && st.progress[id].overall_mastery < 60).length,
    // Only reviews of kanji already learned; never-seen kanji are introduced gradually (newPerDay).
    due_count: ids.filter((id) => st.srs[id] && st.srs[id].lastReview !== null && st.srs[id].due <= now).length,
    reviews_total: st.log.length,
    reviews_7d: week.length,
    accuracy_7d: week.length ? Math.round((week.filter((e) => e.correct).length / week.length) * 100) : 0,
    streak,
    last_active: last ? new Date(last).toISOString() : null,
  };
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

interface LearnStore {
  ready: boolean;
  now: number;
  student: { name: string; level: string };
  settings: Settings;
  views: KanjiView[];
  viewById: Record<string, KanjiView>;
  dueQueue: KanjiView[]; // sorted: overdue + lowest recall first
  atRisk: KanjiView[]; // lowest predicted recall, not necessarily due yet
  log: ReviewEvent[];
  today: { reviews: number; correct: number; goal: number; pct: number };
  streak: number;
  accuracy: number; // last 7 days, 0–100
  xp: number;
  last14: DayBucket[];
  avgMastery: number;
  bands: Record<MasteryBand, number>;
  skillAverages: { skill: string; value: number }[];
  gradeCard: (kanjiId: string, grade: Grade) => void;
  recordQuiz: (kanjiId: string, mode: QuizMode, correct: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
  syncStatus: 'local' | 'saved' | 'saving' | 'error';
  /** Active course track and the tracks this student may open. */
  track: Track;
  tracks: Track[];
  setTrack: (t: Track) => void;
  /** Kanji and lessons of the active track only. */
  deck: KanjiItem[];
  lessons: typeof LESSONS;
}

const Ctx = createContext<LearnStore | null>(null);

export function LearnStoreProvider({
  children,
  remote,
  tracks: allowedTracks = ['N5', 'N4'],
}: {
  children: React.ReactNode;
  remote?: RemoteSync;
  /** Tracks this student may study (from their batches). Defaults to both. */
  tracks?: Track[];
}) {
  const storageKey = remote ? `${STORAGE_KEY}_${remote.userId}` : STORAGE_KEY;
  const tracksKey = allowedTracks.join(',');
  const initial = () => {
    if (typeof window === 'undefined') return null;
    if (remote) return remote.initial ?? loadState(storageKey, cleanState);
    return loadState();
  };
  // State is loaded synchronously on first render (this provider only ever renders in the browser),
  // so the app never waits on an effect to leave the loading screen.
  const [state, setState] = useState<PersistedState | null>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [syncStatus, setSyncStatus] = useState<LearnStore['syncStatus']>(remote ? 'saved' : 'local');
  const remoteRef = useRef(remote);
  remoteRef.current = remote;

  // Safety net for environments that render this provider on the server first.
  useEffect(() => {
    setState((prev) => prev ?? initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist locally (instant) and, for signed-in students, to the server (debounced).
  const firstSave = useRef(true);
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      localStorage.setItem('yoisho_theme', state.settings.theme);
    } catch {
      /* ignore quota / private mode */
    }
    const r = remoteRef.current;
    if (!r) return;
    if (firstSave.current && r.initial) {
      firstSave.current = false;
      return; // nothing changed yet
    }
    firstSave.current = false;
    setSyncStatus('saving');
    const t = setTimeout(async () => {
      try {
        const trimmed = { ...state, log: state.log.slice(-3000) };
        await r.save(trimmed, summarize(state));
        setSyncStatus('saved');
      } catch {
        setSyncStatus('error');
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [state, storageKey]);

  // Tick every 30s so "due" and "x min ago" stay live.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const gradeCard = useCallback((kanjiId: string, grade: Grade) => {
    setState((prev) => {
      if (!prev) return prev;
      const ts = Date.now();
      const p = prev.progress[kanjiId];
      const s = prev.srs[kanjiId];
      if (!p || !s) return prev;
      const correct = grade !== 'again';
      const delta = { again: -8, hard: 2, good: 5, easy: 8 }[grade];
      // A first-ever review sets a starting level instead of nudging up from zero.
      const firstSeen = p.total_attempts === 0;
      const start = { again: 20, hard: 40, good: 55, easy: 65 }[grade];
      const bump = (v: number) => (firstSeen ? start : clamp(v + delta, 5, 100));
      const nextS = scheduleNext(s, grade, ts);
      const scores = {
        meaning_score: bump(p.meaning_score),
        reading_score: bump(p.reading_score),
        recognition_score: bump(p.recognition_score),
        writing_score: firstSeen ? Math.round(start * 0.6) : p.writing_score,
        vocabulary_score: firstSeen ? Math.round(start * 0.8) : clamp(p.vocabulary_score + delta / 2, 5, 100),
      };
      const nextP: StudentKanjiProgress = {
        ...p,
        ...scores,
        overall_mastery: overallMastery(scores),
        memory_strength: +nextS.stability.toFixed(1),
        current_interval_days: nextS.interval,
        next_review_at: new Date(nextS.due).toISOString(),
        last_review_at: new Date(ts).toISOString(),
        total_attempts: p.total_attempts + 1,
        correct_attempts: p.correct_attempts + (correct ? 1 : 0),
        incorrect_attempts: p.incorrect_attempts + (correct ? 0 : 1),
        consecutive_correct: correct ? p.consecutive_correct + 1 : 0,
        consecutive_incorrect: correct ? 0 : p.consecutive_incorrect + 1,
        forget_count: p.forget_count + (correct ? 0 : 1),
        lapses: nextS.lapses,
        updated_at: new Date(ts).toISOString(),
      };
      return {
        ...prev,
        progress: { ...prev.progress, [kanjiId]: nextP },
        srs: { ...prev.srs, [kanjiId]: nextS },
        log: [...prev.log, { id: `r-${ts}`, ts, kanjiId, kind: 'card', grade, correct }],
      };
    });
    remoteRef.current?.logEvent({ kanji: KANJI_BY_ID[kanjiId]?.character ?? '?', kind: 'card', grade, correct: grade !== 'again' });
    setNow(Date.now());
  }, []);

  const recordQuiz = useCallback((kanjiId: string, mode: QuizMode, correct: boolean) => {
    setState((prev) => {
      if (!prev) return prev;
      const ts = Date.now();
      const p = prev.progress[kanjiId];
      const s = prev.srs[kanjiId];
      if (!p || !s) return prev;
      const key = mode === 'meaning' ? 'meaning_score' : mode === 'reading' ? 'reading_score' : mode === 'writing' ? 'writing_score' : 'recognition_score';
      const base = p.total_attempts === 0 ? (correct ? 45 : 20) : null; // first contact sets a starting level
      const scores = {
        meaning_score: base ?? p.meaning_score,
        reading_score: base ?? p.reading_score,
        recognition_score: base ?? p.recognition_score,
        writing_score: base !== null ? Math.round(base * 0.6) : p.writing_score,
        vocabulary_score: base !== null ? Math.round(base * 0.8) : p.vocabulary_score,
        [key]: base ?? clamp(p[key] + (correct ? 4 : -7), 5, 100),
      };
      // A missed quiz item comes back into today's review queue.
      const nextS: SrsState = correct
        ? s
        : { ...s, due: Math.min(s.due, ts), stability: Math.max(0.3, s.stability * 0.7) };
      const nextP: StudentKanjiProgress = {
        ...p,
        ...scores,
        overall_mastery: overallMastery(scores),
        memory_strength: +nextS.stability.toFixed(1),
        next_review_at: new Date(nextS.due).toISOString(),
        total_attempts: p.total_attempts + 1,
        correct_attempts: p.correct_attempts + (correct ? 1 : 0),
        incorrect_attempts: p.incorrect_attempts + (correct ? 0 : 1),
        forget_count: p.forget_count + (correct ? 0 : 1),
        updated_at: new Date(ts).toISOString(),
      };
      return {
        ...prev,
        progress: { ...prev.progress, [kanjiId]: nextP },
        srs: { ...prev.srs, [kanjiId]: nextS },
        log: [...prev.log, { id: `q-${ts}-${kanjiId}`, ts, kanjiId, kind: 'quiz', mode, correct }],
      };
    });
    remoteRef.current?.logEvent({ kanji: KANJI_BY_ID[kanjiId]?.character ?? '?', kind: 'quiz', mode, correct });
    setNow(Date.now());
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((prev) => (prev ? { ...prev, settings: { ...prev.settings, ...patch } } : prev));
  }, []);

  const resetAll = useCallback(() => {
    setState(remoteRef.current ? cleanState() : freshState());
    setNow(Date.now());
  }, []);

  const value = useMemo<LearnStore>(() => {
    const st = state ?? (remote ? cleanState() : freshState());
    const tracks: Track[] = tracksKey ? (tracksKey.split(',') as Track[]) : ['N5'];
    const track: Track = st.settings.track && tracks.includes(st.settings.track) ? st.settings.track : tracks[0];
    const deck = KANJI.filter((k) => trackOf(k) === track);
    const views: KanjiView[] = deck.filter((k) => st.progress[k.id] && st.srs[k.id]).map((k) => {
      const progress = st.progress[k.id];
      const srs = st.srs[k.id];
      return { kanji: k, progress, srs, recall: currentRecall(srs, now), band: bandFor(progress), isDue: srs.lastReview !== null && srs.due <= now };
    });
    const viewById = Object.fromEntries(views.map((v) => [v.kanji.id, v]));
    // Reviews first (lowest recall first), then today's share of new kanji in Genki lesson order.
    const reviews = views.filter((v) => v.isDue && v.srs.lastReview !== null).sort((a, b) => a.recall - b.recall);
    const todayStart = new Date(now).setHours(0, 0, 0, 0);
    const firstSeen: Record<string, number> = {};
    for (const e of st.log) if (firstSeen[e.kanjiId] === undefined || e.ts < firstSeen[e.kanjiId]) firstSeen[e.kanjiId] = e.ts;
    const newToday = Object.values(firstSeen).filter((t) => t >= todayStart).length;
    const newSlots = Math.max(0, (st.settings.newPerDay ?? 10) - newToday);
    const fresh = views.filter((v) => v.srs.lastReview === null).slice(0, newSlots); // views are in lesson order
    const dueQueue = [...reviews, ...fresh];
    const atRisk = views.filter((v) => v.srs.lastReview !== null).sort((a, b) => a.recall - b.recall).slice(0, 6);

    const todayKey = dayKey(now);
    const todayEvents = st.log.filter((e) => dayKey(e.ts) === todayKey);
    const todayCorrect = todayEvents.filter((e) => e.correct).length;

    const activeDays = new Set(st.log.map((e) => dayKey(e.ts)));
    let streak = 0;
    let cursor = activeDays.has(todayKey) ? now : now - DAY;
    while (activeDays.has(dayKey(cursor))) {
      streak++;
      cursor -= DAY;
    }

    const week = st.log.filter((e) => e.ts > now - 7 * DAY);
    const accuracy = week.length ? Math.round((week.filter((e) => e.correct).length / week.length) * 100) : 0;
    const xp = st.log.reduce((sum, e) => sum + (e.correct ? 12 : 3), 0);

    const last14: DayBucket[] = [];
    for (let i = 13; i >= 0; i--) {
      const ts = now - i * DAY;
      const key = dayKey(ts);
      const evs = st.log.filter((e) => dayKey(e.ts) === key);
      last14.push({
        date: key,
        label: i === 0 ? 'Today' : new Date(ts).toLocaleDateString('en-US', { weekday: 'short' }),
        reviews: evs.length,
        correct: evs.filter((e) => e.correct).length,
      });
    }

    const studiedViews = views.filter((v) => v.progress.total_attempts > 0);
    const avg = (f: (p: StudentKanjiProgress) => number) =>
      studiedViews.length ? Math.round(studiedViews.reduce((s, v) => s + f(v.progress), 0) / studiedViews.length) : 0;

    const bands: Record<MasteryBand, number> = { mastered: 0, learning: 0, weak: 0, new: 0 };
    views.forEach((v) => bands[v.band]++);

    return {
      ready: state !== null,
      now,
      student: { name: remote?.name || 'Nikhil', level: track },
      settings: st.settings,
      views,
      viewById,
      dueQueue,
      atRisk,
      log: st.log,
      today: {
        reviews: todayEvents.length,
        correct: todayCorrect,
        goal: st.settings.dailyGoal,
        pct: Math.min(100, Math.round((todayEvents.length / Math.max(1, st.settings.dailyGoal)) * 100)),
      },
      streak,
      accuracy,
      xp,
      last14,
      avgMastery: avg((p) => p.overall_mastery),
      bands,
      skillAverages: [
        { skill: 'Meaning', value: avg((p) => p.meaning_score) },
        { skill: 'Reading', value: avg((p) => p.reading_score) },
        { skill: 'Recognition', value: avg((p) => p.recognition_score) },
        { skill: 'Writing', value: avg((p) => p.writing_score) },
        { skill: 'Vocabulary', value: avg((p) => p.vocabulary_score) },
      ],
      gradeCard,
      recordQuiz,
      updateSettings,
      resetAll,
      syncStatus,
      track,
      tracks,
      setTrack: (t: Track) => updateSettings({ track: t }),
      deck,
      lessons: LESSONS.filter((l) => l.track === track),
    };
  }, [state, now, gradeCard, recordQuiz, updateSettings, resetAll, syncStatus, remote, tracksKey]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLearn(): LearnStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLearn must be used inside <LearnStoreProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Browser helpers                                                     */
/* ------------------------------------------------------------------ */

export function speakJapanese(text: string, rate = 0.85) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const clean = text.replace(/[.-]/g, '');
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'ja-JP';
  u.rate = rate;
  const jp = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('ja'));
  if (jp) u.voice = jp;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/** Words + example sentence for a kanji (Genki I & II), shaped like the legacy Vocabulary rows. */
export function vocabFor(char: string): Vocabulary[] {
  const v = kanjiVocab(char);
  if (!v.words.length) return VOCAB.filter((x) => x.term.includes(char));
  const stamp = '2026-01-01T00:00:00.000Z';
  return v.words.map((w, i) => ({
    id: `v-${char}-${i}`,
    term: w.term,
    kana: w.kana,
    kanji_form: w.term,
    meanings: [w.meaning],
    jlpt_level: null,
    part_of_speech: null,
    pitch_accent: null,
    frequency_rank: null,
    example_sentences: i === 0 && v.sentence ? [v.sentence.jp] : null,
    translations: i === 0 && v.sentence ? [v.sentence.en] : null,
    tags: null,
    metadata: {},
    created_at: stamp,
    updated_at: stamp,
  }));
}

/** Primary readable reading for a kanji, without okurigana dots. */
export function primaryReading(k: Kanji): string {
  const r = k.kunyomi?.[0] ?? k.onyomi?.[0] ?? '';
  return r.replace(/^-/, '').replace(/\./g, '');
}
