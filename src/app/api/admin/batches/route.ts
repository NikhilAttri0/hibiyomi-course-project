import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { HttpError, body, handler, newId, newJoinCode } from '@/server/auth';
import { requireAdmin, requireOrgInScope } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

/** Create a batch inside one of the admin's institutions. */
export const POST = handler(async (req: Request) => {
  const { me, scope } = await requireAdmin();
  const { name, level, term, orgId } = await body<{ name?: string; level?: string; term?: string; orgId?: string }>(req);
  if (!name?.trim()) throw new HttpError(400, 'Give the batch a name.');
  const target = orgId ?? (scope.all ? 'org-default' : scope.orgIds[0]);
  const org = await requireOrgInScope(scope, target);
  if (org.kind !== 'institution') throw new HttpError(400, 'Batches belong to an institution, not to Self-study.');
  const lvl = LEVELS.includes(level ?? '') ? level! : 'N5';
  const id = newId();
  await run('insert into batches (id, name, level, term, join_code, created_by, org_id) values (?, ?, ?, ?, ?, ?, ?)', [
    id, name.trim(), lvl, term?.trim() || null, await newJoinCode(lvl), me.id, org.id,
  ]);
  return NextResponse.json({ batch: await one('select * from batches where id = ?', [id]) });
});
