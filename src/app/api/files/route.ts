import { NextResponse } from 'next/server';
import { run } from '@/server/db';
import { HttpError, handler, newId, requireUser, requireViewerOf } from '@/server/auth';
import { MAX_FILE_BYTES } from '@/server/classroom';
import { assertNotLocked, recordHit } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Upload a PDF to a batch. Body = the raw PDF bytes; ?batchId=&name= in the URL.
 * Teachers upload question/answer sheets; students upload homework answers.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const sp = new URL(req.url).searchParams;
  const batchId = sp.get('batchId') ?? '';
  if (!batchId) throw new HttpError(400, 'Missing batch.');
  await requireViewerOf(me, batchId);
  await assertNotLocked(`upload:${me.id}`, 'Too many uploads.');
  await recordHit(`upload:${me.id}`, { max: 80, windowMs: 60 * 60_000, lockMs: 30 * 60_000 });

  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_FILE_BYTES) throw new HttpError(413, 'PDF is larger than 4 MB. Please compress it first.');
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) throw new HttpError(400, 'The file is empty.');
  if (buf.length > MAX_FILE_BYTES) throw new HttpError(413, 'PDF is larger than 4 MB. Please compress it first.');
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(415, 'Only PDF files can be uploaded.');

  let name =
    Array.from(sp.get('name') ?? 'document.pdf', (c) => (c.charCodeAt(0) < 32 || '\\/"<>:|?*'.includes(c) ? '_' : c))
      .join('')
      .trim()
      .slice(0, 120) || 'document.pdf';
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';

  const id = newId();
  await run('insert into files (id, owner_id, batch_id, name, mime, size, data) values (?, ?, ?, ?, ?, ?, ?)', [
    id,
    me.id,
    batchId,
    name,
    'application/pdf',
    buf.length,
    new Uint8Array(buf),
  ]);
  return NextResponse.json({ id, name, size: buf.length });
});
