import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { one, run } from './db';

export type Role = 'student' | 'teacher' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
  must_change_password: number;
}

const COOKIE = 'yoisho_session';
const MAX_AGE_DAYS = 30;

/* ----------------------------- passwords ----------------------------- */

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

export const newId = () => randomUUID();

/* ------------------------------ sessions ----------------------------- */

/** Signing secret: AUTH_SECRET env var, or a random one generated once and kept in the database. */
async function secret(): Promise<string> {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const row = await one<{ value: string }>(`select value from app_settings where key = 'auth_secret'`);
  if (row) return row.value;
  const s = randomBytes(32).toString('hex');
  await run(`insert or ignore into app_settings (key, value) values ('auth_secret', ?)`, [s]);
  return (await one<{ value: string }>(`select value from app_settings where key = 'auth_secret'`))!.value;
}

async function sign(payload: object): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', await secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

async function verify(token: string): Promise<{ uid: string; exp: number } | null> {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', await secret()).update(body).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(res: NextResponse, uid: string) {
  const token = await sign({ uid, exp: Date.now() + MAX_AGE_DAYS * 86_400_000 });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Secure-only cookies need HTTPS. Vercel is always HTTPS; on a Mac served over plain http (Wi-Fi) they must be off.
    secure: !!process.env.VERCEL || process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: MAX_AGE_DAYS * 86_400,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const p = await verify(token);
  if (!p) return null;
  return one<SessionUser>(
    `select id, email, full_name, role, created_at, must_change_password from users where id = ?`,
    [p.uid]
  );
}

/* ------------------------------ guards ------------------------------- */

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, 'Please sign in again.');
  if (roles && !roles.includes(u.role)) throw new HttpError(403, 'You do not have access to this.');
  return u;
}

export async function teachesBatch(user: SessionUser, batchId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role !== 'teacher') return false;
  if (await one(`select 1 from batch_teachers where batch_id = ? and teacher_id = ?`, [batchId, user.id])) return true;
  // Institution owners/admins manage every batch of their institution.
  return !!(await one(
    `select 1 from batches b join org_members m on m.org_id = b.org_id
      where b.id = ? and m.user_id = ? and m.role in ('owner','admin')`,
    [batchId, user.id]
  ));
}

/** Student member of the batch, assigned teacher, or admin. */
export async function canViewBatch(user: SessionUser, batchId: string): Promise<boolean> {
  if (await teachesBatch(user, batchId)) return true;
  return !!(await one(`select 1 from batch_students where batch_id = ? and student_id = ?`, [batchId, user.id]));
}

/** Throws 403 unless the user may edit this batch's classroom (assigned teacher or admin). */
export async function requireTeacherOf(user: SessionUser, batchId: string) {
  if (!(await teachesBatch(user, batchId))) throw new HttpError(403, 'Only this batch’s teachers can change its classroom.');
}

export async function requireViewerOf(user: SessionUser, batchId: string) {
  if (!(await canViewBatch(user, batchId))) throw new HttpError(403, 'You are not part of this batch.');
}

/** Wraps a route handler: JSON errors with proper status codes. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: 'Something went wrong on the server.' }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid request.');
  }
}

/* ----------------------------- join codes ---------------------------- */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function newJoinCode(level: string): Promise<string> {
  for (;;) {
    const bytes = randomBytes(6);
    let code = `${(level || 'YL').toUpperCase()}-`;
    for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
    if (!(await one(`select 1 from batches where join_code = ?`, [code]))) return code;
  }
}

export const isEmail = (s: unknown): s is string => typeof s === 'string' && /^\S+@\S+\.\S+$/.test(s.trim());
