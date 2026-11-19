import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { HttpError, body, handler } from '@/server/auth';
import { batchRoster } from '@/server/queries';
import { ensureMember, requireAdmin, requireBatchInScope } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { scope } = await requireAdmin();
  await requireBatchInScope(scope, id);
  return NextResponse.json({ students: await batchRoster(id) });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { scope } = await requireAdmin();
  const b = await requireBatchInScope(scope, id);
  const { studentId } = await body<{ studentId?: string }>(req);
  if (!(await one('select 1 from users where id = ?', [studentId ?? '']))) throw new HttpError(404, 'Student not found.');
  // An institution admin may only add people who already belong to the institution.
  if (!scope.all && !(await one('select 1 from org_members where org_id = ? and user_id = ?', [b.org_id, studentId!])))
    throw new HttpError(403, 'That person is not part of your institution.');
  await run('insert or ignore into batch_students (batch_id, student_id) values (?, ?)', [id, studentId!]);
  if (b.org_id) await ensureMember(b.org_id, studentId!, 'student');
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { scope } = await requireAdmin();
  await requireBatchInScope(scope, id);
  const studentId = new URL(req.url).searchParams.get('studentId') ?? '';
  await run('delete from batch_students where batch_id = ? and student_id = ?', [id, studentId]);
  return NextResponse.json({ ok: true });
});
