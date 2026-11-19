import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { HttpError, body, handler, newId, requireTeacherOf, requireUser } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = handler(async (req: Request) => {
  const me = await requireUser(['teacher', 'admin']);
  const { batchId, title, locked } = await body<{ batchId?: string; title?: string; locked?: boolean }>(req);
  if (!batchId || !title?.trim()) throw new HttpError(400, 'Give the section a title.');
  await requireTeacherOf(me, batchId);
  const max = await one<{ m: number | null }>('select max(position) as m from class_sections where batch_id = ?', [batchId]);
  const id = newId();
  await run('insert into class_sections (id, batch_id, title, position, locked) values (?, ?, ?, ?, ?)', [
    id,
    batchId,
    title.trim().slice(0, 120),
    Number(max?.m ?? -1) + 1,
    locked ? 1 : 0,
  ]);
  return NextResponse.json({ id });
});
