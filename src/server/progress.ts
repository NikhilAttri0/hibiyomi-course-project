import { all } from './db';

interface Srs {
  reps?: number;
  lastReview?: number | null;
  interval?: number;
}
interface StoredState {
  srs?: Record<string, Srs>;
  log?: { kanjiId?: string; ts?: number }[];
}

/** Latest practice time per kanji: card reviews (SRS) and quiz answers (log). */
export type Touches = Record<string, { lastReview?: number | null }>;

/** Parsed SRS map per student of a batch (from the synced progress blob). */
export async function batchSrs(batchId: string) {
  const rows = await all<{ id: string; full_name: string; email: string; state: string | null }>(
    `select u.id, u.full_name, u.email, s.state
       from batch_students bs join users u on u.id = bs.student_id
       left join student_state s on s.student_id = u.id
      where bs.batch_id = ?
      order by lower(coalesce(nullif(u.full_name, ''), u.email))`,
    [batchId]
  );
  return rows.map((r) => {
    const srs: Touches = {};
    try {
      const st = r.state ? (JSON.parse(r.state) as StoredState) : {};
      for (const [k, v] of Object.entries(st.srs ?? {})) srs[k] = { lastReview: Number(v?.lastReview ?? 0) || null };
      for (const e of st.log ?? []) {
        if (!e?.kanjiId || !e.ts) continue;
        if (!srs[e.kanjiId] || Number(srs[e.kanjiId].lastReview ?? 0) < e.ts) srs[e.kanjiId] = { lastReview: e.ts };
      }
    } catch {
      /* ignore corrupt state */
    }
    return { id: r.id, name: r.full_name || r.email, email: r.email, srs };
  });
}

/** How many of the assigned kanji the student reviewed since the assignment was posted. */
export function practiceProgress(srs: Touches, kanjiIds: string[], sinceIso: string) {
  const since = Date.parse(sinceIso) || 0;
  let done = 0;
  let last = 0;
  for (const k of kanjiIds) {
    const s = srs[k];
    const t = Number(s?.lastReview ?? 0);
    if (t && t >= since) {
      done++;
      last = Math.max(last, t);
    }
  }
  return { done, total: kanjiIds.length, finished: kanjiIds.length > 0 && done >= kanjiIds.length, lastAt: last ? new Date(last).toISOString() : null };
}
