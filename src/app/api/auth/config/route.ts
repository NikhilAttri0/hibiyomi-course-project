import { NextResponse } from 'next/server';
import { handler } from '@/server/auth';
import { getSettings, hasAnyUser } from '@/server/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public sign-up rules, so the sign-up form can show the right fields. */
export const GET = handler(async () => {
  const [settings, hasUsers] = await Promise.all([getSettings(), hasAnyUser()]);
  return NextResponse.json({ signupRequiresCode: hasUsers && settings.signupRequiresCode, firstAccount: !hasUsers });
});
