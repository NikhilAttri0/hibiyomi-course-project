import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { HttpError, body, handler, newId, requireTeacherOf, requireUser } from '@/server/auth';
import { ITEM_KINDS, cleanUrl, parseKanjiIds, sectionBatch, type ItemKind } from '@/server/classroom';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface ItemInput {
  sectionId?: string;
  kind?: ItemKind;
  title?: string;
  body?: string;
  url?: string;
  fileId?: string;
  dueAt?: string;
  kanjiIds?: string[];
  locked?: boolean;
  /** Students can hand in a PDF/note for this item (PDFs, links, notes; homework always can). */
  acceptsSubmissions?: boolean;
}

/** Add an item to a section: a PDF, a link, a class recording, homework, a kanji practice assignment, or a note. */
export const POST = handler(async (req: Request) => {
  const me = await requireUser(['teacher', 'admin']);
  const input = await body<ItemInput>(req);
  if (!input.sectionId) throw new HttpError(400, 'Missing section.');
  const batchId = await sectionBatch(input.sectionId);
  await requireTeacherOf(me, batchId);
  if (!input.kind || !ITEM_KINDS.includes(input.kind)) throw new HttpError(400, 'Choose what to add.');
  if (!input.title?.trim()) throw new HttpError(400, 'Give it a title.');

  const url = cleanUrl(input.url);
  if ((input.kind === 'link' || input.kind === 'recording') && !url) throw new HttpError(400, 'Paste the link.');
  if (input.kind === 'file' && !input.fileId) throw new HttpError(400, 'Upload a PDF first.');
  const kanji = parseKanjiIds(input.kanjiIds);
  if (input.kind === 'practice' && !kanji.length) throw new HttpError(400, 'Pick at least one kanji or lesson.');
  if (input.fileId) {
    const f = await one<{ batch_id: string }>('select batch_id from files where id = ?', [input.fileId]);
    if (!f || f.batch_id !== batchId) throw new HttpError(400, 'That file does not belong to this batch.');
  }
  const due = input.dueAt ? new Date(input.dueAt) : null;
  if (due && isNaN(due.getTime())) throw new HttpError(400, 'Invalid due date.');

  const max = await one<{ m: number | null }>('select max(position) as m from class_items where section_id = ?', [input.sectionId]);
  const id = newId();
  await run(
    `insert into class_items (id, section_id, batch_id, kind, title, body, url, file_id, kanji_ids, due_at, locked, position, created_by, accepts_submissions)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.sectionId,
      batchId,
      input.kind,
      input.title.trim().slice(0, 160),
      input.body?.trim().slice(0, 4000) || null,
      url,
      input.fileId || null,
      kanji.length ? JSON.stringify(kanji) : null,
      due ? due.toISOString() : null,
      input.locked ? 1 : 0,
      Number(max?.m ?? -1) + 1,
      me.id,
      input.kind === 'homework' || (input.acceptsSubmissions && input.kind !== 'practice' && input.kind !== 'recording') ? 1 : 0,
    ]
  );
  return NextResponse.json({ id });
});
