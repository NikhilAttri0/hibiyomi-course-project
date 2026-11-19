import { NextResponse } from 'next/server';
import { run } from '@/server/db';
import { HttpError, body, handler, requireUser } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const e = await body<{ kanji?: string; kind?: string; grade?: string; mode?: string; correct?: boolean }>(req);
  if (!e.kanji || (e.kind !== 'card' && e.kind !== 'quiz')) throw new HttpError(400, 'Invalid event.');
  await run('insert into review_events (student_id, kanji, kind, grade, mode, correct) values (?, ?, ?, ?, ?, ?)', [
    me.id, e.kanji.slice(0, 8), e.kind, e.grade ?? null, e.mode ?? null, e.correct ? 1 : 0,
  ]);
  return NextResponse.json({ ok: true });
});
