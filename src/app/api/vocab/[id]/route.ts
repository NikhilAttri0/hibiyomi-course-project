import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { HttpError, handler, requireUser } from '@/server/auth';
import { assertVocabEditor } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const me = await requireUser(['teacher', 'admin']);
  const w = await one<{ org_id: string | null }>('select org_id from vocab_custom where id = ?', [id]);
  if (!w) throw new HttpError(404, 'Word not found.');
  await assertVocabEditor(me, w.org_id ?? 'org-default');
  await run('delete from vocab_custom where id = ?', [id]);
  return NextResponse.json({ ok: true });
});
