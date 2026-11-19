import { NextResponse } from 'next/server';
import { handler, requireUser } from '@/server/auth';
import { visibleBatches } from '@/server/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Teachers: only batches assigned to them. Admins: every batch. */
export const GET = handler(async () => {
  const me = await requireUser(['teacher', 'admin']);
  return NextResponse.json({ batches: await visibleBatches(me) });
});
