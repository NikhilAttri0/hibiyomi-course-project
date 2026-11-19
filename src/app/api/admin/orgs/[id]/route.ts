import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { HttpError, body, handler, requireUser } from '@/server/auth';
import { requireAdmin, requireOrgInScope } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Rename an institution (its owner/admins or the platform admin). */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { scope } = await requireAdmin();
  await requireOrgInScope(scope, id);
  const { name } = await body<{ name?: string }>(req);
  if (!name?.trim()) throw new HttpError(400, 'Give the institution a name.');
  await run('update organizations set name = ? where id = ?', [name.trim().slice(0, 80), id]);
  return NextResponse.json({ org: await one('select * from organizations where id = ?', [id]) });
});

/** Platform admin: remove an empty institution. */
export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireUser(['admin']);
  const org = await one<{ kind: string }>('select kind from organizations where id = ?', [id]);
  if (!org) throw new HttpError(404, 'Institution not found.');
  if (org.kind === 'self' || id === 'org-default') throw new HttpError(400, 'This organization cannot be removed.');
  if (await one('select 1 from batches where org_id = ?', [id])) throw new HttpError(400, 'Delete or move its batches first.');
  await run('delete from org_members where org_id = ?', [id]);
  await run('delete from organizations where id = ?', [id]);
  return NextResponse.json({ ok: true });
});
