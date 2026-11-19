import { NextResponse } from 'next/server';
import { one } from '@/server/db';
import { HttpError, body, handler, setSessionCookie, verifyPassword } from '@/server/auth';
import { LOGIN_PER_ACCOUNT, LOGIN_PER_IP, assertNotLocked, clearHits, clientIp, recordHit } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = handler(async (req: Request) => {
  const { email, password } = await body<{ email?: string; password?: string }>(req);
  const mail = (email ?? '').trim().toLowerCase();
  const accountKey = `login:acct:${mail}`;
  const ipKey = `login:ip:${clientIp(req)}`;

  // Too many wrong passwords for this account (or from this network) → temporarily locked.
  await assertNotLocked(accountKey, 'Too many wrong passwords for this account.');
  await assertNotLocked(ipKey, 'Too many sign-in attempts from your network.');

  const u = await one<{ id: string; password_hash: string; role: string }>('select id, password_hash, role from users where email = ?', [mail]);
  if (!u || !password || !verifyPassword(password, u.password_hash)) {
    await recordHit(accountKey, LOGIN_PER_ACCOUNT);
    await recordHit(ipKey, LOGIN_PER_IP);
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  await clearHits(accountKey);
  const res = NextResponse.json({ ok: true, role: u.role });
  await setSessionCookie(res, u.id);
  return res;
});
