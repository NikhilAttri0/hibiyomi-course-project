'use client';

import { apiFetch } from '@/lib/auth';

export type ItemKind = 'file' | 'link' | 'recording' | 'homework' | 'practice' | 'note';

export interface FileRef {
  id: string;
  name: string;
  size: number;
}
export interface ClassSection {
  id: string;
  title: string;
  position: number;
  locked: boolean;
}
export interface ClassItem {
  id: string;
  section_id: string;
  kind: ItemKind;
  /** Students can hand in a PDF / note (homework, or any item the teacher opened for submissions). */
  takes_submissions: boolean;
  title: string;
  due_at: string | null;
  locked: boolean;
  position: number;
  created_at: string;
  body?: string | null;
  url?: string | null;
  file?: FileRef | null;
  kanji_ids?: string[];
  item_locked?: boolean;
  submissions?: number;
}
export interface MySubmission {
  item_id: string;
  file_id: string | null;
  note: string | null;
  submitted_at: string;
  file: FileRef | null;
}
export interface Classroom {
  batch: { id: string; name: string; level: string; term: string | null };
  canEdit: boolean;
  studentCount: number;
  live: { live_url: string | null; live_note: string | null; updated_at: string } | null;
  sections: ClassSection[];
  items: ClassItem[];
  mySubmissions: Record<string, MySubmission>;
}
export interface ClassLink {
  id: string;
  name: string;
  level: string;
  term: string | null;
  live_url: string | null;
  live_note: string | null;
  live_updated_at: string | null;
}
export interface SubmissionRow {
  student: { id: string; name: string; email: string };
  done: boolean;
  late: boolean;
  submitted_at: string | null;
  note?: string | null;
  file?: FileRef | null;
  progress?: { done: number; total: number };
}

export const fileUrl = (id: string, download = false) => `/api/files/${id}${download ? '?download=1' : ''}`;

export const loadClassroom = (batchId: string) => apiFetch<Classroom>(`/api/classroom?batchId=${encodeURIComponent(batchId)}`);
export const myClasses = () => apiFetch<{ classes: ClassLink[] }>('/api/me/classes').then((r) => r.classes);
export const setLiveLink = (batchId: string, url: string, note: string) => apiFetch('/api/classroom/live', { method: 'PUT', body: { batchId, url, note } });

export const addSection = (batchId: string, title: string, locked = false) =>
  apiFetch<{ id: string }>('/api/classroom/sections', { method: 'POST', body: { batchId, title, locked } });
export const updateSection = (id: string, patch: { title?: string; locked?: boolean; move?: 'up' | 'down' }) =>
  apiFetch(`/api/classroom/sections/${id}`, { method: 'PATCH', body: patch });
export const deleteSection = (id: string) => apiFetch(`/api/classroom/sections/${id}`, { method: 'DELETE' });

export interface NewItem {
  sectionId: string;
  kind: ItemKind;
  title: string;
  body?: string;
  url?: string;
  fileId?: string;
  dueAt?: string;
  kanjiIds?: string[];
  locked?: boolean;
  acceptsSubmissions?: boolean;
}
export const addItem = (item: NewItem) => apiFetch<{ id: string }>('/api/classroom/items', { method: 'POST', body: item });
export const updateItem = (id: string, patch: { title?: string; body?: string; url?: string; dueAt?: string | null; locked?: boolean; move?: 'up' | 'down'; acceptsSubmissions?: boolean }) =>
  apiFetch(`/api/classroom/items/${id}`, { method: 'PATCH', body: patch });
export const deleteItem = (id: string) => apiFetch(`/api/classroom/items/${id}`, { method: 'DELETE' });

export const submitHomework = (itemId: string, fileId?: string, note?: string) =>
  apiFetch(`/api/classroom/items/${itemId}/submit`, { method: 'POST', body: { fileId, note } });
export const withdrawHomework = (itemId: string) => apiFetch(`/api/classroom/items/${itemId}/submit`, { method: 'DELETE' });
export const itemSubmissions = (itemId: string) =>
  apiFetch<{ kind: 'homework' | 'practice'; rows: SubmissionRow[] }>(`/api/classroom/items/${itemId}/submissions`);

export const MAX_PDF_MB = 4;

/** Upload a PDF (raw body). Returns the stored file reference. */
export async function uploadPdf(batchId: string, file: File): Promise<FileRef> {
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Only PDF files can be uploaded.');
  if (file.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`PDF is larger than ${MAX_PDF_MB} MB. Please compress it first.`);
  const res = await fetch(`/api/files?batchId=${encodeURIComponent(batchId)}&name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: file,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Upload failed (${res.status})`);
  return data as FileRef;
}

/* ------------------------------ Vocabulary ------------------------------ */
export interface CustomWord {
  id: string;
  lesson: number;
  term: string;
  kana: string;
  meaning: string;
  category: string;
  position: number;
  /** Yoisho starter list word (shown until a teacher adds the lesson's own list). */
  starter?: boolean;
}
export const loadCustomWords = (track: 'N5' | 'N4') => apiFetch<{ words: CustomWord[] }>(`/api/vocab?track=${track}`).then((r) => r.words);
export const addCustomWords = (
  track: 'N5' | 'N4',
  lesson: number,
  words: { term: string; kana: string; meaning: string; category?: string }[],
  replace = false
) => apiFetch<{ added: number }>('/api/vocab', { method: 'POST', body: { track, lesson, words, replace } });
export const deleteCustomWord = (id: string) => apiFetch(`/api/vocab/${id}`, { method: 'DELETE' });

/* ------------------------------- Reports -------------------------------- */
export const batchReportCsvUrl = (batchId: string, weeks = 4) => `/api/reports/batch/${batchId}?format=csv&weeks=${weeks}`;
export const studentReportCsvUrl = (batchId: string, studentId: string, weeks = 8) =>
  `/api/reports/student/${studentId}?batchId=${batchId}&format=csv&weeks=${weeks}`;
export const batchReportPage = (batchId: string) => `/report/${batchId}`;
export const studentReportPage = (batchId: string, studentId: string) => `/report/${batchId}?student=${studentId}`;

/* ------------------------------- Helpers -------------------------------- */
export const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export function fmtDue(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function dueState(iso: string | null | undefined): 'none' | 'overdue' | 'soon' | 'later' {
  if (!iso) return 'none';
  const t = Date.parse(iso) - Date.now();
  if (t < 0) return 'overdue';
  if (t < 2 * 86_400_000) return 'soon';
  return 'later';
}

/* ------------------------- Leaderboard, badges, risk ------------------------- */
export interface Badge {
  id: string;
  label: string;
  jp: string;
  desc: string;
  icon: string;
}
export interface LeaderRow {
  id: string;
  name: string;
  streak: number;
  mastered: number;
  weekPoints: number;
  allPoints: number;
  weekAccuracy: number | null;
  weekQuizzes: number;
  lastActive?: string | null;
  badges: string[];
}
export interface Leaderboard {
  batch: { id: string; name: string; level: string };
  me: string;
  staff: boolean;
  weekStart: string;
  points: { correct: number; wrong: number; quizCorrect: number; handIn: number };
  badges: Badge[];
  rows: LeaderRow[];
}

export interface RiskRow {
  id: string;
  name: string;
  email: string;
  score: number;
  level: 'high' | 'medium' | 'low';
  reasons: string[];
  daysInactive: number | null;
  weekAnswers: number;
  prevWeekAnswers: number;
  accuracy7d: number | null;
  missing: number;
}
export const loadRisk = (batchId: string) => apiFetch<{ students: RiskRow[] }>(`/api/teacher/batches/${batchId}/risk`).then((r) => r.students);

/** Save a finished quiz for the leaderboard/badges (ignored in the offline demo). */
export function saveQuizResult(r: { kind: 'vocab' | 'kanji-words' | 'kanji' | 'writing'; track?: string; lesson?: number | null; score: number; total: number }) {
  if (r.total < 1) return;
  void apiFetch('/api/me/quiz-results', { method: 'POST', body: r }).catch(() => undefined);
}
