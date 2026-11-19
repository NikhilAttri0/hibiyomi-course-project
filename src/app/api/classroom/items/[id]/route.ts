import { NextResponse } from 'next/server';
import { all, run } from '@/server/db';
import { HttpError, body, handler, requireTeacherOf, requireUser } from '@/server/auth';
import { cleanUrl, itemRow } from '@/server/classroom';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Edit title/text/link/due date, lock/unlock, or move up/down. */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const me = await requireUser(['teacher', 'admin']);
  const it = await itemRow(id);
  await requireTeacherOf(me, it.batch_id);
  const p = await body<{ title?: string; body?: string; url?: string; dueAt?: string | null; locked?: boolean; move?: 'up' | 'down'; acceptsSubmissions?: boolean }>(req);
  if (p.title?.trim()) await run('update class_items set title = ? where id = ?', [p.title.trim().slice(0, 160), id]);
  if (p.body !== undefined) await run('update class_items set body = ? where id = ?', [p.body?.trim().slice(0, 4000) || null, id]);
  if (p.url !== undefined) await run('update class_items set url = ? where id = ?', [cleanUrl(p.url), id]);
  if (p.dueAt !== undefined) {
    const d = p.dueAt ? new Date(p.dueAt) : null;
    if (d && isNaN(d.getTime())) throw new HttpError(400, 'Invalid due date.');
    await run('update class_items set due_at = ? where id = ?', [d ? d.toISOString() : null, id]);
  }
  if (typeof p.acceptsSubmissions === 'boolean' && it.kind !== 'practice' && it.kind !== 'recording' && it.kind !== 'homework')
    await run('update class_items set accepts_submissions = ? where id = ?', [p.acceptsSubmissions ? 1 : 0, id]);
  if (typeof p.locked === 'boolean') await run('update class_items set locked = ? where id = ?', [p.locked ? 1 : 0, id]);
  if (p.move) {
    const list = await all<{ id: string }>('select id from class_items where section_id = ? order by position, created_at', [it.section_id as string]);
    const i = list.findIndex((x) => x.id === id);
    const j = p.move === 'up' ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
    for (let k = 0; k < list.length; k++) await run('update class_items set position = ? where id = ?', [k, list[k].id]);
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const me = await requireUser(['teacher', 'admin']);
  const it = await itemRow(id);
  await requireTeacherOf(me, it.batch_id);
  await run(
    `delete from files where id = ? or id in (select file_id from submissions where item_id = ? and file_id is not null)`,
    [it.file_id ?? '', id]
  );
  await run('delete from submissions where item_id = ?', [id]);
  await run('delete from class_items where id = ?', [id]);
  return NextResponse.json({ ok: true });
});
