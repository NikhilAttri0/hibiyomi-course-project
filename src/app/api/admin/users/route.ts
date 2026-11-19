import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { one, run } from '@/server/db';
import { HttpError, body, handler, hashPassword, isEmail, newId } from '@/server/auth';
import { SELF_ORG_ID, ensureMember, requireAdmin, requireOrgInScope, syncAccountRole, type AdminScope } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ORG_ROLES = ['student', 'teacher', 'admin'] as const;
type OrgRoleIn = (typeof ORG_ROLES)[number];
const tempPassword = () => `Yoisho-${randomBytes(4).toString('hex')}`;

async function assertCanManageUser(scope: AdminScope, userId: string) {
  const u = await one<{ role: string }>('select role from users where id = ?', [userId]);
  if (!u) throw new HttpError(404, 'User not found.');
  if (scope.all) return u;
  if (u.role === 'admin') throw new HttpError(403, 'Only the platform admin can change this account.');
  const ok = await one(
    `select 1 from org_members where user_id = ? and org_id in (${scope.orgIds.map(() => '?').join(',')})`,
    [userId, ...scope.orgIds]
  );
  if (!ok) throw new HttpError(403, 'That person is not part of your institution.');
  return u;
}

/** Create an account inside an institution (e.g. a teacher) with a temporary password the admin hands over. */
export const POST = handler(async (req: Request) => {
  const { scope } = await requireAdmin();
  const { email, fullName, orgRole, orgId, platformAdmin } = await body<{
    email?: string;
    fullName?: string;
    orgRole?: OrgRoleIn;
    orgId?: string;
    platformAdmin?: boolean;
  }>(req);
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (platformAdmin && !scope.all) throw new HttpError(403, 'Only the platform admin can create platform admins.');
  const role = orgRole && ORG_ROLES.includes(orgRole) ? orgRole : 'student';
  const org = platformAdmin ? null : await requireOrgInScope(scope, orgId ?? (scope.all ? 'org-default' : scope.orgIds[0]));
  const mail = email.trim().toLowerCase();
  const existing = await one<{ id: string }>('select id from users where email = ?', [mail]);
  if (existing) {
    // Already has an account: just add them to the institution.
    if (!org) throw new HttpError(409, 'An account with this email already exists.');
    await ensureMember(org.id, existing.id, role);
    await syncAccountRole(existing.id);
    return NextResponse.json({ userId: existing.id, existing: true });
  }
  const pw = tempPassword();
  const id = newId();
  await run('insert into users (id, email, full_name, role, password_hash, must_change_password) values (?, ?, ?, ?, ?, 1)', [
    id, mail, (fullName ?? '').trim(), platformAdmin ? 'admin' : role === 'student' ? 'student' : 'teacher', hashPassword(pw),
  ]);
  await ensureMember(org?.id ?? 'org-default', id, platformAdmin ? 'owner' : role);
  return NextResponse.json({ userId: id, tempPassword: pw });
});

/**
 * Reset a password ({ userId, resetPassword }), change someone's role in an institution
 * ({ userId, orgId, orgRole }) or, platform admin only, make/unmake a platform admin ({ userId, platformAdmin }).
 */
export const PATCH = handler(async (req: Request) => {
  const { me, scope } = await requireAdmin();
  const p = await body<{ userId?: string; resetPassword?: boolean; orgId?: string; orgRole?: OrgRoleIn; platformAdmin?: boolean }>(req);
  if (!p.userId) throw new HttpError(400, 'Invalid request.');
  const target = await assertCanManageUser(scope, p.userId);

  if (p.resetPassword) {
    // An institution admin may only reset accounts that belong to their institution(s) alone,
    // so nobody can take over a learner's account by adding them to an institution first.
    if (!scope.all) {
      const elsewhere = await one(
        `select 1 from org_members where user_id = ? and org_id not in (${scope.orgIds.map(() => '?').join(',')})`,
        [p.userId, ...scope.orgIds]
      );
      if (elsewhere) throw new HttpError(403, 'This person also belongs elsewhere. Ask them to change it themselves, or contact the platform admin.');
    }
    const t = await one<{ email: string }>('select email from users where id = ?', [p.userId]);
    await run('delete from rate_limits where key = ?', [`login:acct:${t!.email}`]); // unlock after a reset
    const pw = tempPassword();
    await run('update users set password_hash = ?, must_change_password = 1 where id = ?', [hashPassword(pw), p.userId]);
    return NextResponse.json({ tempPassword: pw });
  }
  if (typeof p.platformAdmin === 'boolean') {
    if (!scope.all) throw new HttpError(403, 'Only the platform admin can do this.');
    if (p.userId === me.id && !p.platformAdmin) throw new HttpError(400, 'You cannot remove your own admin role.');
    if (p.platformAdmin) await run(`update users set role = 'admin' where id = ?`, [p.userId]);
    else {
      await run(`update users set role = 'student' where id = ?`, [p.userId]);
      await syncAccountRole(p.userId);
    }
    return NextResponse.json({ ok: true });
  }
  if (p.orgId && p.orgRole && ORG_ROLES.includes(p.orgRole)) {
    await requireOrgInScope(scope, p.orgId);
    if (p.userId === me.id && !scope.all && p.orgRole !== 'admin') throw new HttpError(400, 'You cannot remove your own admin role.');
    const cur = await one<{ role: string }>('select role from org_members where org_id = ? and user_id = ?', [p.orgId, p.userId]);
    if (cur?.role === 'owner' && !scope.all) throw new HttpError(403, 'Only the platform admin can change the owner.');
    if (cur) await run('update org_members set role = ? where org_id = ? and user_id = ?', [p.orgRole, p.orgId, p.userId]);
    else await ensureMember(p.orgId, p.userId, p.orgRole);
    if (p.orgRole === 'student')
      await run('delete from batch_teachers where teacher_id = ? and batch_id in (select id from batches where org_id = ?)', [p.userId, p.orgId]);
    if (target.role !== 'admin') await syncAccountRole(p.userId);
    return NextResponse.json({ ok: true });
  }
  throw new HttpError(400, 'Invalid request.');
});

/** Remove someone from an institution (and its batches). They keep their account and progress. */
export const DELETE = handler(async (req: Request) => {
  const { me, scope } = await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const userId = sp.get('userId') ?? '';
  const orgId = sp.get('orgId') ?? '';
  await requireOrgInScope(scope, orgId);
  const target = await assertCanManageUser(scope, userId);
  if (userId === me.id) throw new HttpError(400, 'You cannot remove yourself.');
  const cur = await one<{ role: string }>('select role from org_members where org_id = ? and user_id = ?', [orgId, userId]);
  if (cur?.role === 'owner' && !scope.all) throw new HttpError(403, 'Only the platform admin can remove the owner.');
  await run('delete from batch_students where student_id = ? and batch_id in (select id from batches where org_id = ?)', [userId, orgId]);
  await run('delete from batch_teachers where teacher_id = ? and batch_id in (select id from batches where org_id = ?)', [userId, orgId]);
  await run('delete from org_members where org_id = ? and user_id = ?', [orgId, userId]);
  if (!(await one('select 1 from org_members where user_id = ?', [userId]))) await ensureMember(SELF_ORG_ID, userId, 'student');
  if (target.role !== 'admin') await syncAccountRole(userId);
  return NextResponse.json({ ok: true });
});
