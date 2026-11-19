import { one, run } from './db';
import { HttpError } from './auth';

/**
 * Database-backed limiter (works on serverless hosts, where memory is not shared between requests).
 * A key that records `max` failures within `windowMs` is locked for `lockMs`.
 */
export interface Limit {
  max: number;
  windowMs: number;
  lockMs: number;
}

export const LOGIN_PER_ACCOUNT: Limit = { max: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
export const LOGIN_PER_IP: Limit = { max: 30, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
export const SIGNUP_PER_IP: Limit = { max: 10, windowMs: 60 * 60_000, lockMs: 60 * 60_000 };

interface Row {
  count: number;
  window_start: number;
  locked_until: number;
}

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));

/** Throws 429 if the key is currently locked. */
export async function assertNotLocked(key: string, message: string) {
  const r = await one<Row>('select count, window_start, locked_until from rate_limits where key = ?', [key]);
  const now = Date.now();
  if (r && Number(r.locked_until) > now) {
    throw new HttpError(429, `${message} Try again in ${minutes(Number(r.locked_until) - now)} minute(s).`);
  }
}

/** Records one failure (or one use, for sign-up throttling) and locks the key when over the limit. */
export async function recordHit(key: string, limit: Limit) {
  const now = Date.now();
  const r = await one<Row>('select count, window_start, locked_until from rate_limits where key = ?', [key]);
  if (!r || now - Number(r.window_start) > limit.windowMs) {
    await run(
      `insert into rate_limits (key, count, window_start, locked_until) values (?, 1, ?, 0)
       on conflict (key) do update set count = 1, window_start = excluded.window_start, locked_until = 0`,
      [key, now]
    );
    return;
  }
  const count = Number(r.count) + 1;
  const lockedUntil = count >= limit.max ? now + limit.lockMs : 0;
  await run('update rate_limits set count = ?, locked_until = ? where key = ?', [count, lockedUntil, key]);
}

export async function clearHits(key: string) {
  await run('delete from rate_limits where key = ?', [key]);
}

/** Best-effort client IP (Vercel and most proxies set x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] || req.headers.get('x-real-ip') || 'local').trim();
}
