import { NextResponse } from 'next/server';
import { all, one, run } from '@/server/db';
import { HttpError, body, handler, requireUser } from '@/server/auth';
import { LOGIN_PER_ACCOUNT, assertNotLocked, recordHit } from '@/server/rate-limit';
import { ensureMember } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = handler(async () => {
  const me = await requireUser();
  const batches = await all<{ id: string }>(
    'select b.* from batches b join batch_students s on s.batch_id = b.id where s.student_id = ? order by s.joined_at',
    [me.id]
  );
  const teachers = await all<{ batch_id: string; name: string }>(
    `select t.batch_id, coalesce(nullif(u.full_name, ''), u.email) as name
       from batch_teachers t join users u on u.id = t.teacher_id
      where t.batch_id in (select batch_id from batch_students where student_id = ?)`,
    [me.id]
  );
  return NextResponse.json({
    batches: batches.map((b) => ({ ...b, teachers: teachers.filter((t) => t.batch_id === b.id).map((t) => t.name) })),
  });
});

/** Join a batch with its code. */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const key = `joincode:${me.id}`;
  await assertNotLocked(key, 'Too many wrong join codes.');
  const { code } = await body<{ code?: string }>(req);
  const b = await one<{ id: string; name: string; org_id: string | null }>('select id, name, org_id from batches where upper(join_code) = upper(?)', [(code ?? '').trim()]);
  if (!b) {
    await recordHit(key, LOGIN_PER_ACCOUNT);
    throw new HttpError(404, 'That join code does not match any batch. Check it with your teacher.');
  }
  await run('insert or ignore into batch_students (batch_id, student_id) values (?, ?)', [b.id, me.id]);
  // Progress belongs to the learner, so it carries over; they simply also become part of the institution.
  await ensureMember(b.org_id ?? 'org-default', me.id, 'student');
  return NextResponse.json({ name: b.name });
});

/** Leave a batch. */
export const DELETE = handler(async (req: Request) => {
  const me = await requireUser();
  const batchId = new URL(req.url).searchParams.get('batchId');
  if (!batchId) throw new HttpError(400, 'Missing batch.');
  await run('delete from batch_students where batch_id = ? and student_id = ?', [batchId, me.id]);
  return NextResponse.json({ ok: true });
});
