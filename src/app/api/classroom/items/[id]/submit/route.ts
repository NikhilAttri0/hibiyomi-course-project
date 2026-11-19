import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { HttpError, body, handler, newId, requireUser } from '@/server/auth';
import { itemRow } from '@/server/classroom';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Student hands in homework (a PDF they uploaded and/or a short note). Re-submitting replaces it. */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const me = await requireUser(['student']);
  const it = await itemRow(id);
  if (it.kind !== 'homework' && !Number(it.accepts_submissions)) throw new HttpError(400, 'This item does not take submissions.');
  const member = await one('select 1 from batch_students where batch_id = ? and student_id = ?', [it.batch_id, me.id]);
  if (!member) throw new HttpError(403, 'You are not part of this batch.');
  const sec = await one<{ locked: number }>('select locked from class_sections where id = ?', [it.section_id as string]);
  if (Number(it.locked) || Number(sec?.locked)) throw new HttpError(403, 'This homework is locked.');

  const { fileId, note } = await body<{ fileId?: string; note?: string }>(req);
  if (!fileId && !note?.trim()) throw new HttpError(400, 'Attach your PDF or write a note.');
  if (fileId) {
    const f = await one<{ owner_id: string; batch_id: string }>('select owner_id, batch_id from files where id = ?', [fileId]);
    if (!f || f.owner_id !== me.id || f.batch_id !== it.batch_id) throw new HttpError(400, 'Upload your PDF again.');
  }

  const prev = await one<{ file_id: string | null }>('select file_id from submissions where item_id = ? and student_id = ?', [id, me.id]);
  await run(
    `insert into submissions (id, item_id, student_id, file_id, note, submitted_at) values (?, ?, ?, ?, ?, ?)
     on conflict (item_id, student_id) do update set file_id = excluded.file_id, note = excluded.note, submitted_at = excluded.submitted_at`,
    [newId(), id, me.id, fileId || null, note?.trim().slice(0, 2000) || null, new Date().toISOString()]
  );
  if (prev?.file_id && prev.file_id !== fileId) await run('delete from files where id = ? and owner_id = ?', [prev.file_id, me.id]);
  return NextResponse.json({ ok: true });
});

/** Student withdraws their submission. */
export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const me = await requireUser(['student']);
  const prev = await one<{ file_id: string | null }>('select file_id from submissions where item_id = ? and student_id = ?', [id, me.id]);
  if (!prev) throw new HttpError(404, 'Nothing to withdraw.');
  await run('delete from submissions where item_id = ? and student_id = ?', [id, me.id]);
  if (prev.file_id) await run('delete from files where id = ? and owner_id = ?', [prev.file_id, me.id]);
  return NextResponse.json({ ok: true });
});
