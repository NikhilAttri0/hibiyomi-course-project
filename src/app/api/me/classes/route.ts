import { NextResponse } from 'next/server';
import { all } from '@/server/db';
import { handler, requireUser } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Batches the user can open a classroom for, with each batch's live class link. */
export const GET = handler(async () => {
  const me = await requireUser();
  const cols = `b.id, b.name, b.level, b.term, c.live_url, c.live_note, c.updated_at as live_updated_at`;
  const rows =
    me.role === 'admin'
      ? await all(`select ${cols} from batches b left join class_info c on c.batch_id = b.id order by b.created_at desc`)
      : me.role === 'teacher'
        ? await all(
            `select ${cols} from batches b left join class_info c on c.batch_id = b.id
              where b.id in (select batch_id from batch_teachers where teacher_id = ?)
                 or b.org_id in (select org_id from org_members where user_id = ? and role in ('owner','admin'))
              order by b.created_at desc`,
            [me.id, me.id]
          )
        : await all(
            `select ${cols} from batches b join batch_students s on s.batch_id = b.id left join class_info c on c.batch_id = b.id
              where s.student_id = ? order by s.joined_at desc`,
            [me.id]
          );
  return NextResponse.json({ classes: rows });
});
