import { NextResponse } from 'next/server';
import { all, one, run } from '@/server/db';
import { HttpError, body, handler, newId, requireUser } from '@/server/auth';
import { assertVocabEditor, primaryOrg } from '@/server/orgs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const lessonOk = (track: string, l: number) => (track === 'N5' ? l >= 1 && l <= 12 : l >= 13 && l <= 23);
const trackOk = (t: unknown): t is 'N5' | 'N4' => t === 'N5' || t === 'N4';

/** Lesson word lists of the user's institution (Self-study learners see the platform's own lists). */
export const GET = handler(async (req: Request) => {
  const me = await requireUser();
  const sp = new URL(req.url).searchParams;
  const track = sp.get('track');
  if (!trackOk(track)) throw new HttpError(400, 'Choose N5 or N4.');
  const org = await primaryOrg(me, sp.get('orgId'));
  const rows = await all<{ id: string; lesson: number; term: string; kana: string; meaning: string; category: string; position: number }>(
    'select id, lesson, term, kana, meaning, category, position from vocab_custom where track = ? and org_id = ? order by lesson, position, created_at',
    [track, org]
  );
  return NextResponse.json({ words: rows.map((r) => ({ ...r, lesson: Number(r.lesson), position: Number(r.position) })) });
});

/**
 * Add words to a lesson. Body: { track, lesson, replace?, words: [{term, kana, meaning, category}] }.
 * `replace: true` clears the lesson first (re-import).
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser(['teacher', 'admin']);
  const { track, lesson, words, replace, orgId } = await body<{
    orgId?: string;
    track?: string;
    lesson?: number;
    replace?: boolean;
    words?: { term?: string; kana?: string; meaning?: string; category?: string }[];
  }>(req);
  if (!trackOk(track)) throw new HttpError(400, 'Choose N5 or N4.');
  const org = await primaryOrg(me, orgId);
  await assertVocabEditor(me, org);
  const l = Number(lesson);
  if (!lessonOk(track, l)) throw new HttpError(400, track === 'N5' ? 'Genki I lessons are 1–12.' : 'Genki II lessons are 13–23.');
  const clean = (words ?? [])
    .map((w) => ({
      term: (w.term ?? '').trim().slice(0, 40),
      kana: (w.kana ?? '').trim().slice(0, 60),
      meaning: (w.meaning ?? '').trim().slice(0, 160),
      category: (w.category ?? '').trim().slice(0, 60),
    }))
    .filter((w) => (w.term || w.kana) && w.meaning)
    .map((w) => ({ ...w, term: w.term || w.kana }));
  if (!clean.length) throw new HttpError(400, 'No words found. Use one word per line: reading, (kanji), meaning.');
  if (clean.length > 400) throw new HttpError(400, 'Add up to 400 words at a time.');
  if (replace) await run('delete from vocab_custom where track = ? and lesson = ? and org_id = ?', [track, l, org]);
  const max = await one<{ m: number | null }>('select max(position) as m from vocab_custom where track = ? and lesson = ? and org_id = ?', [track, l, org]);
  let pos = Number(max?.m ?? -1) + 1;
  for (const w of clean) {
    await run('insert into vocab_custom (id, track, lesson, term, kana, meaning, category, position, created_by, org_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      newId(), track, l, w.term, w.kana, w.meaning, w.category, pos++, me.id, org,
    ]);
  }
  return NextResponse.json({ added: clean.length });
});
