import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { HttpError, body, handler, requireUser } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = handler(async () => {
  const me = await requireUser();
  const row = await one<{ state: string }>('select state from student_state where student_id = ?', [me.id]);
  return NextResponse.json({ state: row ? JSON.parse(row.state) : null });
});

export const PUT = handler(async (req: Request) => {
  const me = await requireUser();
  const { state, summary } = await body<{ state?: unknown; summary?: Record<string, number | string | null> }>(req);
  if (!state || typeof state !== 'object' || !summary) throw new HttpError(400, 'Invalid progress data.');
  const json = JSON.stringify(state);
  if (json.length > 2_000_000) throw new HttpError(413, 'Progress data is too large.');
  const n = (k: string) => Number(summary[k] ?? 0) || 0;
  await run(
    `insert into student_state (student_id, state, avg_mastery, mastered, weak, due_count, reviews_total, reviews_7d, accuracy_7d, streak, last_active, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (student_id) do update set state = excluded.state, avg_mastery = excluded.avg_mastery, mastered = excluded.mastered,
       weak = excluded.weak, due_count = excluded.due_count, reviews_total = excluded.reviews_total, reviews_7d = excluded.reviews_7d,
       accuracy_7d = excluded.accuracy_7d, streak = excluded.streak, last_active = excluded.last_active, updated_at = excluded.updated_at`,
    [me.id, json, n('avg_mastery'), n('mastered'), n('weak'), n('due_count'), n('reviews_total'), n('reviews_7d'), n('accuracy_7d'), n('streak'),
      (summary.last_active as string | null) ?? null, new Date().toISOString()]
  );
  return NextResponse.json({ ok: true });
});
