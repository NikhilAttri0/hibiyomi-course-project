import { NextResponse } from 'next/server';
import { clearSessionCookie, handler } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = handler(async () => {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
