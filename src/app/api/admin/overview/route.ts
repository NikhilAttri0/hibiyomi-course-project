import { NextResponse } from 'next/server';
import { all } from '@/server/db';
import { handler } from '@/server/auth';
import { requireAdmin } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Everything the admin panel shows, limited to the institutions this admin manages. */
export const GET = handler(async () => {
  const { me, scope } = await requireAdmin();
  const ids = scope.all ? null : scope.orgIds;
  const inList = (n: number) => Array.from({ length: n }, () => '?').join(',');
  const orgFilter = ids ? `where o.id in (${inList(ids.length)})` : '';
  const [orgs, batches, people, members, links, counts] = await Promise.all([
    all(
      `select o.id, o.name, o.slug, o.kind, o.created_at,
              (select count(*) from org_members m where m.org_id = o.id and m.role = 'student') as students,
              (select count(*) from org_members m where m.org_id = o.id and m.role != 'student') as staff,
              (select count(*) from batches b where b.org_id = o.id) as batches
         from organizations o ${orgFilter}
        order by case o.kind when 'institution' then 0 else 1 end, o.created_at`,
      ids ?? []
    ),
    all(`select * from batches ${ids ? `where org_id in (${inList(ids.length)})` : ''} order by created_at desc`, ids ?? []),
    all(
      `select id, email, full_name, role, created_at from users
        ${ids ? `where id in (select user_id from org_members where org_id in (${inList(ids.length)}))` : ''}
        order by created_at desc`,
      ids ?? []
    ),
    all<{ org_id: string; user_id: string; role: string }>(
      `select org_id, user_id, role from org_members ${ids ? `where org_id in (${inList(ids.length)})` : ''}`,
      ids ?? []
    ),
    all<{ batch_id: string; teacher_id: string }>('select batch_id, teacher_id from batch_teachers'),
    all<{ batch_id: string; n: number }>('select batch_id, count(*) as n from batch_students group by batch_id'),
  ]);
  const batchIds = new Set(batches.map((b) => (b as { id: string }).id));
  return NextResponse.json({
    me: { id: me.id, platformAdmin: scope.all },
    orgs: orgs.map((o) => ({ ...o, students: Number(o.students), staff: Number(o.staff), batches: Number(o.batches) })),
    batches,
    people,
    members,
    links: links.filter((l) => batchIds.has(l.batch_id)),
    counts: Object.fromEntries(counts.filter((c) => batchIds.has(c.batch_id)).map((c) => [c.batch_id, Number(c.n)])),
  });
});
