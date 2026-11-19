import { NextResponse } from 'next/server';
import { run } from '@/server/db';
import { HttpError, body, handler, requireUser } from '@/server/auth';
import { assertNotLocked, recordHit } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KINDS = ['vocab', 'kanji-words', 'kanji', 'writing'];

/** Saves a finished quiz (counts toward the batch leaderboard and badges). */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const { kind, track, lesson, score, total } = await body<{ kind?: string; track?: string; lesson?: number | null; score?: number; total?: number }>(req);
  const t = Math.floor(Number(total)), sc = Math.floor(Number(score));
  if (!kind || !KINDS.includes(kind)) throw new HttpError(400, 'Invalid quiz.');
  if (!(t >= 1 && t <= 500) || !(sc >= 0 && sc <= t)) throw new HttpError(400, 'Invalid score.');
  // Keep the leaderboard fair: at most 120 saved quizzes per hour.
  await assertNotLocked(`quiz:${me.id}`, 'Too many quizzes saved.');
  await recordHit(`quiz:${me.id}`, { max: 120, windowMs: 60 * 60_000, lockMs: 30 * 60_000 });
  await run('insert into quiz_results (student_id, kind, track, lesson, score, total) values (?, ?, ?, ?, ?, ?)', [
    me.id, kind, track === 'N4' || track === 'N5' ? track : null, Number.isFinite(Number(lesson)) ? Number(lesson) : null, sc, t,
  ]);
  return NextResponse.json({ ok: true });
});
