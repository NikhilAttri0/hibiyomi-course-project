import { NextResponse } from 'next/server';
import { body, handler, requireUser } from '@/server/auth';
import { getSettings, setSignupRequiresCode } from '@/server/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Site-wide switches: platform admin only. */
export const GET = handler(async () => {
  await requireUser(['admin']);
  return NextResponse.json(await getSettings());
});

export const PATCH = handler(async (req: Request) => {
  await requireUser(['admin']);
  const { signupRequiresCode } = await body<{ signupRequiresCode?: boolean }>(req);
  if (typeof signupRequiresCode === 'boolean') await setSignupRequiresCode(signupRequiresCode);
  return NextResponse.json(await getSettings());
});
