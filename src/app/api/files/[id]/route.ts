import { one } from '@/server/db';
import { HttpError, handler, requireUser, teachesBatch } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Download a PDF.
 * - Teachers/admins of the batch: any file in it.
 * - Students: files the teacher attached to unlocked classroom items, and their own uploads.
 *   They can never open another student's homework.
 */
export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const me = await requireUser();
  const f = await one<{ id: string; owner_id: string | null; batch_id: string | null; name: string; mime: string; size: number; data: ArrayBuffer | Uint8Array }>(
    'select * from files where id = ?',
    [id]
  );
  if (!f || !f.batch_id) throw new HttpError(404, 'File not found.');

  let ok = f.owner_id === me.id || (await teachesBatch(me, f.batch_id));
  if (!ok && me.role === 'student') {
    const member = await one('select 1 from batch_students where batch_id = ? and student_id = ?', [f.batch_id, me.id]);
    const published = await one(
      `select 1 from class_items i join class_sections s on s.id = i.section_id
        where i.file_id = ? and i.batch_id = ? and i.locked = 0 and s.locked = 0`,
      [id, f.batch_id]
    );
    ok = !!member && !!published;
  }
  if (!ok) throw new HttpError(403, 'You do not have access to this file.');

  const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
  const inline = new URL(req.url).searchParams.get('download') !== '1';
  const safe = f.name.replace(/[^\w.\- ]/g, '_');
  return new Response(Buffer.from(data.buffer, data.byteOffset, data.byteLength) as unknown as ConstructorParameters<typeof Response>[0], {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(data.byteLength),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
