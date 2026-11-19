import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { HttpError, body, handler } from '@/server/auth';
import { ensureMember, requireAdmin, requireBatchInScope, syncAccountRole } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { scope } = await requireAdmin();
  const b = await requireBatchInScope(scope, id);
  const { teacherId } = await body<{ teacherId?: string }>(req);
  const t = await one<{ role: string }>('select role from users where id = ?', [teacherId ?? '']);
  if (!t) throw new HttpError(404, 'Person not found.');
  const m = await one<{ role: string }>('select role from org_members where org_id = ? and user_id = ?', [b.org_id, teacherId!]);
  const isStaff = t.role === 'admin' || (m && m.role !== 'student') || (scope.all && t.role === 'teacher');
  if (!isStaff) throw new HttpError(400, 'Only teachers of this institution can be assigned to a batch.');
  await run('insert or ignore into batch_teachers (batch_id, teacher_id) values (?, ?)', [id, teacherId!]);
  if (b.org_id && t.role !== 'admin') {
    await ensureMember(b.org_id, teacherId!, 'teacher');
    await syncAccountRole(teacherId!);
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { scope } = await requireAdmin();
  await requireBatchInScope(scope, id);
  const teacherId = new URL(req.url).searchParams.get('teacherId') ?? '';
  await run('delete from batch_teachers where batch_id = ? and teacher_id = ?', [id, teacherId]);
  return NextResponse.json({ ok: true });
});
