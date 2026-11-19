import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { body, handler, newJoinCode } from '@/server/auth';
import { requireAdmin, requireBatchInScope } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Rename, or create a fresh join code (regenerate: true). */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { scope } = await requireAdmin();
  const b = await requireBatchInScope(scope, id);
  const { name, term, regenerate } = await body<{ name?: string; term?: string; regenerate?: boolean }>(req);
  if (regenerate) await run('update batches set join_code = ? where id = ?', [await newJoinCode(b.level), id]);
  if (name?.trim()) await run('update batches set name = ? where id = ?', [name.trim(), id]);
  if (term !== undefined) await run('update batches set term = ? where id = ?', [term?.trim() || null, id]);
  return NextResponse.json({ batch: await one('select * from batches where id = ?', [id]) });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { scope } = await requireAdmin();
  await requireBatchInScope(scope, id);
  await run('delete from batch_students where batch_id = ?', [id]);
  await run('delete from batch_teachers where batch_id = ?', [id]);
  await run('delete from batches where id = ?', [id]);
  return NextResponse.json({ ok: true });
});
