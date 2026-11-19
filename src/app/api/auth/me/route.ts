import { NextResponse } from 'next/server';
import { one, run } from '@/server/db';
import { HttpError, body, currentUser, handler, hashPassword, requireUser, verifyPassword } from '@/server/auth';
import { LOGIN_PER_ACCOUNT, assertNotLocked, clearHits, recordHit } from '@/server/rate-limit';
import { myOrgs } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The signed-in user, with the organizations they belong to (orgAdmin = owner/admin somewhere). */
export const GET = handler(async () => {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null });
  const orgs = await myOrgs(user.id);
  return NextResponse.json({ user: { ...user, orgs, orgAdmin: orgs.some((o) => o.role === 'owner' || o.role === 'admin') } });
});

/** Update your own name and/or password. */
export const PATCH = handler(async (req: Request) => {
  const me = await requireUser();
  const { fullName, currentPassword, newPassword } = await body<{ fullName?: string; currentPassword?: string; newPassword?: string }>(req);
  if (typeof fullName === 'string') await run('update users set full_name = ? where id = ?', [fullName.trim(), me.id]);
  if (newPassword) {
    if (newPassword.length < 8) throw new HttpError(400, 'Use at least 8 characters for your new password.');
    const key = `pwchange:${me.id}`;
    await assertNotLocked(key, 'Too many wrong current passwords.');
    const row = await one<{ password_hash: string }>('select password_hash from users where id = ?', [me.id]);
    if (!currentPassword || !verifyPassword(currentPassword, row!.password_hash)) {
      await recordHit(key, LOGIN_PER_ACCOUNT);
      throw new HttpError(400, 'Current password is incorrect.');
    }
    await clearHits(key);
    await run('update users set password_hash = ?, must_change_password = 0 where id = ?', [hashPassword(newPassword), me.id]);
  }
  return NextResponse.json({ user: await currentUser() });
});
