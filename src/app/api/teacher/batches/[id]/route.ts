import { NextResponse } from 'next/server';
import { all } from '@/server/db';
import { HttpError, handler, requireUser, teachesBatch } from '@/server/auth';
import { batchRoster, getBatch } from '@/server/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** One batch with its students, their progress and the last 14 days of answers. */
export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const me = await requireUser(['teacher', 'admin']);
  if (!(await teachesBatch(me, id))) throw new HttpError(403, 'You are not assigned to this batch.');
  const batch = await getBatch(id);
  if (!batch) throw new HttpError(404, 'Batch not found.');
  const students = await batchRoster(id);
  const ids = students.map((s) => s.profile.id);
  const marks = ids.map(() => '?').join(',');
  const states = ids.length
    ? await all<{ student_id: string; state: string }>(`select student_id, state from student_state where student_id in (${marks})`, ids)
    : [];
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const events = ids.length
    ? await all(
        `select id, student_id, kanji, kind, grade, mode, correct, created_at from review_events
          where student_id in (${marks}) and created_at >= ? order by created_at desc limit 5000`,
        [...ids, since]
      )
    : [];
  return NextResponse.json({
    batch,
    students,
    states: Object.fromEntries(states.map((s) => [s.student_id, JSON.parse(s.state)])),
    events: events.map((e) => ({ ...e, correct: !!e.correct })),
  });
});
