import { NextResponse } from 'next/server';
import { all } from '@/server/db';
import { HttpError, handler, requireTeacherOf, requireUser } from '@/server/auth';
import { fileMeta, itemRow, parseKanjiIds } from '@/server/classroom';
import { batchSrs, practiceProgress } from '@/server/progress';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Teacher view: who finished. Homework → submitted / missing; practice → reviewed kanji per student. */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const me = await requireUser(['teacher', 'admin']);
  const it = await itemRow(id);
  await requireTeacherOf(me, it.batch_id);
  const takes = it.kind === 'homework' || !!Number(it.accepts_submissions);
  if (!takes && it.kind !== 'practice') throw new HttpError(400, 'This item does not collect submissions.');

  const students = await batchSrs(it.batch_id);
  const due = it.due_at ? Date.parse(it.due_at as string) : null;

  if (takes) {
    const subs = await all<{ student_id: string; file_id: string | null; note: string | null; submitted_at: string }>(
      'select student_id, file_id, note, submitted_at from submissions where item_id = ?',
      [id]
    );
    const files = await fileMeta(subs.map((s) => s.file_id as string));
    const byStudent = new Map(subs.map((s) => [s.student_id, s]));
    return NextResponse.json({
      kind: 'homework',
      rows: students.map((s) => {
        const sub = byStudent.get(s.id);
        return {
          student: { id: s.id, name: s.name, email: s.email },
          done: !!sub,
          late: !!sub && due != null && Date.parse(sub.submitted_at) > due,
          submitted_at: sub?.submitted_at ?? null,
          note: sub?.note ?? null,
          file: sub?.file_id ? files[sub.file_id] ?? null : null,
        };
      }),
    });
  }

  const kanji = parseKanjiIds(it.kanji_ids);
  return NextResponse.json({
    kind: 'practice',
    rows: students.map((s) => {
      const p = practiceProgress(s.srs, kanji, it.created_at as string);
      return {
        student: { id: s.id, name: s.name, email: s.email },
        done: p.finished,
        progress: { done: p.done, total: p.total },
        late: p.finished && due != null && !!p.lastAt && Date.parse(p.lastAt) > due,
        submitted_at: p.lastAt,
      };
    }),
  });
});
