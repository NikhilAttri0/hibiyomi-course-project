import { NextResponse } from 'next/server';
import { all, one, run } from '@/server/db';
import { HttpError, body, handler, hashPassword, isEmail, newId, setSessionCookie } from '@/server/auth';
import { SIGNUP_PER_IP, assertNotLocked, clientIp, recordHit } from '@/server/rate-limit';
import { getSettings } from '@/server/settings';
import { SELF_ORG_ID, ensureMember } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Sign-up. With a class join code the learner joins that batch (and its institution);
 * without one they join Self-study. The very first account on a fresh install becomes the platform admin.
 */
export const POST = handler(async (req: Request) => {
  const ipKey = `signup:ip:${clientIp(req)}`;
  await assertNotLocked(ipKey, 'Too many new accounts from your network.');
  await recordHit(ipKey, SIGNUP_PER_IP);
  const { email, password, fullName, joinCode } = await body<{ email?: string; password?: string; fullName?: string; joinCode?: string }>(req);
  if (!fullName?.trim()) throw new HttpError(400, 'Enter your full name.');
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (!password || password.length < 8) throw new HttpError(400, 'Use at least 8 characters for your password.');
  const mail = email.trim().toLowerCase();
  if (await one('select 1 from users where email = ?', [mail])) {
    throw new HttpError(409, 'An account with this email already exists. Sign in instead.');
  }
  let batch: { id: string; name: string; org_id: string | null } | null = null;
  if (joinCode?.trim()) {
    batch = await one<{ id: string; name: string; org_id: string | null }>('select id, name, org_id from batches where upper(join_code) = upper(?)', [joinCode.trim()]);
    if (!batch) throw new HttpError(400, 'That join code does not match any batch. Check it with your teacher.');
  }
  const isFirst = (await all('select 1 from users limit 1')).length === 0;
  // After setup, only people with a valid batch join code can create an account (admin can switch this off).
  if (!isFirst && !batch && (await getSettings()).signupRequiresCode) {
    throw new HttpError(400, 'A class join code is required to sign up right now. Ask your teacher for it.');
  }
  const id = newId();
  await run('insert into users (id, email, full_name, role, password_hash) values (?, ?, ?, ?, ?)', [
    id,
    mail,
    (fullName ?? '').trim(),
    isFirst ? 'admin' : 'student',
    hashPassword(password),
  ]);
  if (isFirst) await ensureMember('org-default', id, 'owner');
  else if (batch) {
    await run('insert or ignore into batch_students (batch_id, student_id) values (?, ?)', [batch.id, id]);
    await ensureMember(batch.org_id ?? 'org-default', id, 'student');
  } else await ensureMember(SELF_ORG_ID, id, 'student');
  const res = NextResponse.json({ ok: true, role: isFirst ? 'admin' : 'student', joined: batch?.name ?? null });
  await setSessionCookie(res, id);
  return res;
});
