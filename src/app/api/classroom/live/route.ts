import { NextResponse } from 'next/server';
import { run } from '@/server/db';
import { HttpError, body, handler, requireTeacherOf, requireUser } from '@/server/auth';
import { cleanUrl } from '@/server/classroom';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Set or clear the batch's live class link (Zoom, Meet, Teams…). */
export const PUT = handler(async (req: Request) => {
  const me = await requireUser(['teacher', 'admin']);
  const { batchId, url, note } = await body<{ batchId?: string; url?: string; note?: string }>(req);
  if (!batchId) throw new HttpError(400, 'Missing batch.');
  await requireTeacherOf(me, batchId);
  const link = cleanUrl(url);
  await run(
    `insert into class_info (batch_id, live_url, live_note, updated_at) values (?, ?, ?, ?)
     on conflict (batch_id) do update set live_url = excluded.live_url, live_note = excluded.live_note, updated_at = excluded.updated_at`,
    [batchId, link, (note ?? '').trim().slice(0, 300) || null, new Date().toISOString()]
  );
  return NextResponse.json({ ok: true });
});
