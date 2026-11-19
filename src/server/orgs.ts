import { all, one, run } from './db';
import { HttpError, requireUser, type SessionUser } from './auth';

export const SELF_ORG_ID = 'org-self';
export type OrgRole = 'owner' | 'admin' | 'teacher' | 'student';
export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  kind: 'institution' | 'self';
}
const RANK: Record<OrgRole, number> = { student: 0, teacher: 1, admin: 2, owner: 3 };

/** Platform admin sees everything; an institution owner/admin sees only their institution(s). */
export type AdminScope = { all: true } | { all: false; orgIds: string[] };

export async function adminScope(user: SessionUser): Promise<AdminScope> {
  if (user.role === 'admin') return { all: true };
  const rows = await all<{ org_id: string }>(`select org_id from org_members where user_id = ? and role in ('owner','admin')`, [user.id]);
  return { all: false, orgIds: rows.map((r) => r.org_id) };
}

export const inScope = (s: AdminScope, orgId: string | null | undefined) => s.all || (!!orgId && s.orgIds.includes(orgId));

/** Signed-in platform admin or institution owner/admin. */
export async function requireAdmin() {
  const me = await requireUser();
  const scope = await adminScope(me);
  if (!scope.all && scope.orgIds.length === 0) throw new HttpError(403, 'You do not have access to this.');
  return { me, scope };
}

export async function requireOrgInScope(scope: AdminScope, orgId: string | null | undefined) {
  if (!orgId || !inScope(scope, orgId)) throw new HttpError(403, 'You do not manage this institution.');
  const org = await one<OrgRow>('select id, name, slug, kind from organizations where id = ?', [orgId]);
  if (!org) throw new HttpError(404, 'Institution not found.');
  return org;
}

/** The batch, if it belongs to an institution this admin manages. */
export async function requireBatchInScope(scope: AdminScope, batchId: string) {
  const b = await one<{ id: string; org_id: string | null; level: string }>('select id, org_id, level from batches where id = ?', [batchId]);
  if (!b) throw new HttpError(404, 'Batch not found.');
  if (!inScope(scope, b.org_id)) throw new HttpError(403, 'You do not manage this batch.');
  return b;
}

/** Adds the user to the organization, never lowering a role they already have there. */
export async function ensureMember(orgId: string, userId: string, role: OrgRole) {
  const cur = await one<{ role: OrgRole }>('select role from org_members where org_id = ? and user_id = ?', [orgId, userId]);
  if (!cur) await run('insert into org_members (org_id, user_id, role) values (?, ?, ?)', [orgId, userId, role]);
  else if (RANK[role] > RANK[cur.role]) await run('update org_members set role = ? where org_id = ? and user_id = ?', [role, orgId, userId]);
}

/** Keeps the account-wide role in step: anyone who is staff somewhere can open the teacher pages. */
export async function syncAccountRole(userId: string) {
  const u = await one<{ role: string }>('select role from users where id = ?', [userId]);
  if (!u || u.role === 'admin') return;
  const staff = await one(`select 1 from org_members where user_id = ? and role in ('owner','admin','teacher')`, [userId]);
  const next = staff ? 'teacher' : 'student';
  if (u.role !== next) await run('update users set role = ? where id = ?', [next, userId]);
  if (next === 'student') await run('delete from batch_teachers where teacher_id = ?', [userId]);
}

export async function myOrgs(userId: string) {
  return all<OrgRow & { role: OrgRole }>(
    `select o.id, o.name, o.slug, o.kind, m.role from org_members m join organizations o on o.id = m.org_id
      where m.user_id = ? order by case o.kind when 'institution' then 0 else 1 end, o.name`,
    [userId]
  );
}

/** Organization whose lesson word lists this user sees (and edits, if staff). */
export async function primaryOrg(user: SessionUser, wanted?: string | null): Promise<string> {
  const orgs = await myOrgs(user.id);
  if (wanted && (user.role === 'admin' || orgs.some((o) => o.id === wanted))) return wanted;
  const staff = orgs.find((o) => o.role !== 'student' && o.kind === 'institution');
  const inst = orgs.find((o) => o.kind === 'institution');
  return (staff ?? inst)?.id ?? SELF_ORG_ID;
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'institute'
  );
}

/** Staff of the organization (or the platform admin) may edit its lesson word lists. */
export async function assertVocabEditor(me: SessionUser, orgId: string) {
  if (me.role === 'admin') return;
  const m = await one<{ role: string }>('select role from org_members where org_id = ? and user_id = ?', [orgId, me.id]);
  if (!m || m.role === 'student') throw new HttpError(403, 'Only teachers of this institution can change its word lists.');
}
