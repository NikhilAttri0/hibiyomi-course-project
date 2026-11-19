import { NextResponse } from 'next/server';
import { all, one } from '@/server/db';
import { HttpError, handler, requireUser, requireViewerOf, teachesBatch } from '@/server/auth';
import { fileMeta, parseKanjiIds } from '@/server/classroom';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Everything in one batch's classroom. Students get locked items as titles only. */
export const GET = handler(async (req: Request) => {
  const me = await requireUser();
  const batchId = new URL(req.url).searchParams.get('batchId') ?? '';
  if (!batchId) throw new HttpError(400, 'Missing batch.');
  await requireViewerOf(me, batchId);
  const canEdit = await teachesBatch(me, batchId);

  const [batch, info, sections, items, studentCount] = await Promise.all([
    one('select id, name, level, term from batches where id = ?', [batchId]),
    one<{ live_url: string | null; live_note: string | null; updated_at: string }>('select live_url, live_note, updated_at from class_info where batch_id = ?', [batchId]),
    all<Record<string, unknown> & { id: string; locked: number }>('select id, title, position, locked from class_sections where batch_id = ? order by position, created_at', [batchId]),
    all<Record<string, unknown> & { id: string; section_id: string; locked: number; file_id: string | null; kanji_ids: string | null }>(
      'select * from class_items where batch_id = ? order by position, created_at',
      [batchId]
    ),
    one<{ n: number }>('select count(*) as n from batch_students where batch_id = ?', [batchId]),
  ]);
  if (!batch) throw new HttpError(404, 'Batch not found.');

  const files = await fileMeta(items.map((i) => i.file_id as string));
  const lockedSections = new Set(sections.filter((s) => Number(s.locked)).map((s) => s.id));

  let mine: Record<string, unknown> = {};
  let counts: Record<string, number> = {};
  if (canEdit) {
    const rows = await all<{ item_id: string; n: number }>(
      'select item_id, count(*) as n from submissions where item_id in (select id from class_items where batch_id = ?) group by item_id',
      [batchId]
    );
    counts = Object.fromEntries(rows.map((r) => [r.item_id, Number(r.n)]));
  } else {
    const subs = await all<{ item_id: string; file_id: string | null; note: string | null; submitted_at: string }>(
      'select item_id, file_id, note, submitted_at from submissions where student_id = ? and item_id in (select id from class_items where batch_id = ?)',
      [me.id, batchId]
    );
    const subFiles = await fileMeta(subs.map((s) => s.file_id as string));
    mine = Object.fromEntries(subs.map((s) => [s.item_id, { ...s, file: s.file_id ? subFiles[s.file_id] ?? null : null }]));
  }

  const shapedItems = items.map((i) => {
    const locked = !!Number(i.locked) || lockedSections.has(i.section_id);
    const base = {
      id: i.id,
      section_id: i.section_id,
      kind: i.kind,
      takes_submissions: i.kind === 'homework' || !!Number(i.accepts_submissions),
      title: i.title,
      due_at: i.due_at,
      locked,
      position: Number(i.position),
      created_at: i.created_at,
    };
    if (locked && !canEdit) return base; // students only see that something is coming
    return {
      ...base,
      body: i.body,
      url: i.url,
      file: i.file_id ? files[i.file_id] ?? null : null,
      kanji_ids: parseKanjiIds(i.kanji_ids),
      item_locked: !!Number(i.locked),
      submissions: canEdit ? counts[i.id] ?? 0 : undefined,
    };
  });

  return NextResponse.json({
    batch,
    canEdit,
    studentCount: Number(studentCount?.n ?? 0),
    live: info ?? null,
    sections: sections.map((s) => ({ ...s, locked: !!Number(s.locked), position: Number(s.position) })),
    items: shapedItems,
    mySubmissions: mine,
  });
});
