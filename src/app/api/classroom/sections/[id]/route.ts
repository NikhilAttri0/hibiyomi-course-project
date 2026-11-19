import { NextResponse } from 'next/server';
import { all, run } from '@/server/db';
import { body, handler, requireTeacherOf, requireUser } from '@/server/auth';
import { sectionBatch } from '@/server/classroom';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Rename, lock/unlock, or move a section up/down. */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const me = await requireUser(['teacher', 'admin']);
  const batchId = await sectionBatch(id);
  await requireTeacherOf(me, batchId);
  const { title, locked, move } = await body<{ title?: string; locked?: boolean; move?: 'up' | 'down' }>(req);
  if (title?.trim()) await run('update class_sections set title = ? where id = ?', [title.trim().slice(0, 120), id]);
  if (typeof locked === 'boolean') await run('update class_sections set locked = ? where id = ?', [locked ? 1 : 0, id]);
  if (move) {
    const list = await all<{ id: string }>('select id from class_sections where batch_id = ? order by position, created_at', [batchId]);
    const i = list.findIndex((s) => s.id === id);
    const j = move === 'up' ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
    for (let k = 0; k < list.length; k++) await run('update class_sections set position = ? where id = ?', [k, list[k].id]);
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const me = await requireUser(['teacher', 'admin']);
  const batchId = await sectionBatch(id);
  await requireTeacherOf(me, batchId);
  // Remove files attached to this section's items and their submissions.
  await run(
    `delete from files where id in (select file_id from class_items where section_id = ? and file_id is not null)
       or id in (select s.file_id from submissions s join class_items i on i.id = s.item_id where i.section_id = ? and s.file_id is not null)`,
    [id, id]
  );
  await run('delete from submissions where item_id in (select id from class_items where section_id = ?)', [id]);
  await run('delete from class_items where section_id = ?', [id]);
  await run('delete from class_sections where id = ?', [id]);
  return NextResponse.json({ ok: true });
});
