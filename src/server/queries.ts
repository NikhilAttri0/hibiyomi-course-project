import { all, one } from './db';
import type { SessionUser } from './auth';

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  created_at: string;
}

const SUMMARY_COLS =
  'avg_mastery, mastered, weak, due_count, reviews_total, reviews_7d, accuracy_7d, streak, last_active, updated_at';

export async function batchRoster(batchId: string) {
  const rows = await all<ProfileRow & { joined_at: string; has_state: number } & Record<string, unknown>>(
    `select u.id, u.email, u.full_name, u.role, u.created_at, bs.joined_at,
            s.student_id as has_state, ${SUMMARY_COLS.split(', ').map((c) => `s.${c}`).join(', ')}
       from batch_students bs
       join users u on u.id = bs.student_id
       left join student_state s on s.student_id = u.id
      where bs.batch_id = ?
      order by lower(coalesce(nullif(u.full_name, ''), u.email))`,
    [batchId]
  );
  return rows.map((r) => ({
    profile: { id: r.id, email: r.email, full_name: r.full_name, role: r.role, created_at: r.created_at },
    joined_at: r.joined_at,
    summary: r.has_state
      ? {
          avg_mastery: Number(r.avg_mastery),
          mastered: Number(r.mastered),
          weak: Number(r.weak),
          due_count: Number(r.due_count),
          reviews_total: Number(r.reviews_total),
          reviews_7d: Number(r.reviews_7d),
          accuracy_7d: Number(r.accuracy_7d),
          streak: Number(r.streak),
          last_active: (r.last_active as string) ?? null,
          updated_at: r.updated_at as string,
        }
      : null,
  }));
}

export async function visibleBatches(user: SessionUser) {
  if (user.role === 'admin') return all(`select * from batches order by created_at desc`);
  return all(
    `select b.* from batches b
      where b.id in (select batch_id from batch_teachers where teacher_id = ?)
         or b.org_id in (select org_id from org_members where user_id = ? and role in ('owner','admin'))
      order by b.created_at desc`,
    [user.id, user.id]
  );
}

export async function getBatch(id: string) {
  return one(`select * from batches where id = ?`, [id]);
}
