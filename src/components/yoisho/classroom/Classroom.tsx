'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KANJI, KANJI_BY_ID, LESSONS, trackForLevel, trackOfLesson, timeAgo } from '@/lib/learn-store';
import {
  addItem,
  addSection,
  deleteItem,
  deleteSection,
  dueState,
  fileUrl,
  fmtDue,
  fmtSize,
  itemSubmissions,
  loadClassroom,
  setLiveLink,
  submitHomework,
  updateItem,
  updateSection,
  uploadPdf,
  withdrawHomework,
  type ClassItem,
  type ClassSection,
  type Classroom as ClassroomData,
  type FileRef,
  type ItemKind,
  type SubmissionRow,
} from '@/lib/classroom-api';
import { Icon, type IconName } from '../icons';
import { cx } from '../ui';

/* ------------------------------------------------------------------ */
/* Small shared bits                                                   */
/* ------------------------------------------------------------------ */

export const KIND_META: Record<ItemKind, { label: string; icon: IconName; tone: string; hint: string }> = {
  file: { label: 'PDF', icon: 'file', tone: 'ai', hint: 'Question paper, answer key, notes' },
  link: { label: 'Link', icon: 'link', tone: 'kin', hint: 'Website, Google Drive, YouTube…' },
  recording: { label: 'Class recording', icon: 'video', tone: 'sakura', hint: 'Link to a recorded class' },
  homework: { label: 'Homework', icon: 'pen', tone: 'brand', hint: 'Students upload their answers as PDF' },
  practice: { label: 'Kanji practice', icon: 'cards', tone: 'matcha', hint: 'Pick a lesson or kanji — see who finished' },
  note: { label: 'Note', icon: 'note', tone: 'ai', hint: 'Announcement or instructions' },
};

function Tone({ tone, children, className }: { tone: string; children: ReactNode; className?: string }) {
  return (
    <span className={cx('chip whitespace-nowrap', className)} style={{ background: `rgb(var(--${tone}-soft))`, color: `rgb(var(--${tone}))` }}>
      {children}
    </span>
  );
}

function DueChip({ iso, done }: { iso: string | null | undefined; done?: boolean }) {
  if (!iso) return null;
  const st = dueState(iso);
  const tone = done ? 'matcha' : st === 'overdue' ? 'sakura' : st === 'soon' ? 'kin' : 'ai';
  return (
    <Tone tone={tone}>
      <Icon name="calendar" size={12} /> {st === 'overdue' && !done ? 'Was due' : 'Due'} {fmtDue(iso)}
    </Tone>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-sumi/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className={cx(
          'relative w-full bg-paper border border-line shadow-lift rounded-t-4xl sm:rounded-4xl max-h-[92vh] overflow-y-auto animate-rise',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 bg-paper/95 backdrop-blur border-b border-line/60">
          <h3 className="font-extrabold text-lg flex-1">{title}</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-sunken" aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-ink-2 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-3 mt-1">{hint}</span>}
    </label>
  );
}

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

/** PDF picker that uploads immediately and reports the stored file. */
function PdfPicker({ batchId, value, onChange, label = 'Choose PDF' }: { batchId: string; value: FileRef | null; onChange: (f: FileRef | null) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setErr(null);
          setBusy(true);
          try {
            onChange(await uploadPdf(batchId, f));
          } catch (x) {
            setErr(x instanceof Error ? x.message : String(x));
          } finally {
            setBusy(false);
          }
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface border border-line/70 p-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ai-soft text-ai">
            <Icon name="file" size={17} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold truncate">{value.name}</span>
            <span className="block text-[11px] text-ink-3">{fmtSize(value.size)} · uploaded</span>
          </span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => ref.current?.click()}>
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => ref.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line hover:border-brand/60 bg-surface/60 py-5 text-sm font-semibold text-ink-2 transition"
        >
          <Icon name="upload" size={17} /> {busy ? 'Uploading…' : label}
          <span className="text-ink-3 font-normal">· PDF up to 4 MB</span>
        </button>
      )}
      {err && <p className="mt-2 text-xs text-sakura font-medium">{err}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kanji picker (for practice assignments)                             */
/* ------------------------------------------------------------------ */

function KanjiPicker({ level, value, onChange }: { level: string; value: string[]; onChange: (ids: string[]) => void }) {
  const track = trackForLevel(level);
  const lessons = LESSONS.filter((l) => trackOfLesson(l.lesson) === track);
  const [lesson, setLesson] = useState(lessons[0]?.lesson ?? 3);
  const sel = new Set(value);
  const inLesson = KANJI.filter((k) => Number((k.metadata as { lesson?: number }).lesson) === lesson);
  const allOn = inLesson.every((k) => sel.has(k.id));
  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(sel);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    // keep textbook order
    onChange(KANJI.filter((k) => next.has(k.id)).map((k) => k.id));
  };
  return (
    <div className="rounded-3xl border border-line/70 bg-surface p-4">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {lessons.map((l) => {
          const n = KANJI.filter((k) => Number((k.metadata as { lesson?: number }).lesson) === l.lesson && sel.has(k.id)).length;
          return (
            <button
              type="button"
              key={l.lesson}
              onClick={() => setLesson(l.lesson)}
              className={cx(
                'shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition',
                l.lesson === lesson ? 'bg-ink text-canvas border-ink' : 'bg-paper border-line text-ink-2'
              )}
            >
              L{l.lesson}
              {n > 0 && <span className="ml-1 text-brand">· {n}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-3 truncate">{LESSONS.find((l) => l.lesson === lesson)?.title}</span>
        <button type="button" className="btn-ghost btn-sm" onClick={() => toggle(inLesson.map((k) => k.id), !allOn)}>
          {allOn ? 'Clear lesson' : `Select all ${inLesson.length}`}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-6 sm:grid-cols-8 gap-1.5">
        {inLesson.map((k) => (
          <button
            type="button"
            key={k.id}
            title={k.meanings.join(', ')}
            onClick={() => toggle([k.id], !sel.has(k.id))}
            className={cx(
              'aspect-square rounded-xl font-mincho text-xl font-bold border transition',
              sel.has(k.id) ? 'bg-brand text-brand-ink border-brand' : 'bg-paper border-line/70 hover:border-brand/50'
            )}
          >
            {k.character}
          </button>
        ))}
      </div>
      <div className="mt-3 text-xs text-ink-3">
        {value.length ? (
          <>
            <b className="text-ink">{value.length}</b> selected:{' '}
            <span className="font-jp">{value.slice(0, 30).map((id) => KANJI_BY_ID[id]?.character).join('')}</span>
            {value.length > 30 && '…'}
          </>
        ) : (
          'Pick a whole lesson or individual kanji.'
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add / edit item                                                     */
/* ------------------------------------------------------------------ */

function ItemEditor({
  data,
  section,
  item,
  onClose,
  onSaved,
}: {
  data: ClassroomData;
  section: ClassSection;
  item?: ClassItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<ItemKind | null>(item?.kind ?? null);
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [file, setFile] = useState<FileRef | null>(item?.file ?? null);
  const [due, setDue] = useState(toLocalInput(item?.due_at));
  const [kanji, setKanji] = useState<string[]>(item?.kanji_ids ?? []);
  const [locked, setLocked] = useState(item?.item_locked ?? false);
  const [collect, setCollect] = useState(item?.takes_submissions ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const editing = !!item;
  const canCollect = kind === 'file' || kind === 'link' || kind === 'note';
  const showsDue = kind === 'homework' || kind === 'practice' || (canCollect && collect);

  const save = async () => {
    if (!kind) return;
    setErr(null);
    setBusy(true);
    try {
      if (editing) {
        await updateItem(item!.id, {
          title,
          body,
          url: kind === 'link' || kind === 'recording' ? url : undefined,
          dueAt: showsDue ? fromLocalInput(due) ?? null : undefined,
          locked,
          acceptsSubmissions: canCollect ? collect : undefined,
        });
      } else {
        const autoTitle =
          title.trim() ||
          (kind === 'practice' && kanji.length
            ? `Practice: ${kanji.slice(0, 8).map((id) => KANJI_BY_ID[id]?.character).join('')}${kanji.length > 8 ? '…' : ''}`
            : kind === 'file' && file
              ? file.name.replace(/\.pdf$/i, '')
              : '');
        await addItem({
          sectionId: section.id,
          kind,
          title: autoTitle,
          body: body || undefined,
          url: url || undefined,
          fileId: file?.id,
          dueAt: fromLocalInput(due),
          kanjiIds: kind === 'practice' ? kanji : undefined,
          locked,
          acceptsSubmissions: canCollect ? collect : undefined,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit item' : `Add to “${section.title}”`} onClose={onClose} wide={kind === 'practice'}>
      {!kind ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {(Object.keys(KIND_META) as ItemKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="flex items-start gap-3 rounded-3xl border border-line/70 bg-surface p-4 text-left hover:border-brand/60 hover:shadow-card transition"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `rgb(var(--${KIND_META[k].tone}-soft))`, color: `rgb(var(--${KIND_META[k].tone}))` }}>
                <Icon name={KIND_META[k].icon} size={19} />
              </span>
              <span>
                <span className="block font-bold text-sm">{KIND_META[k].label}</span>
                <span className="block text-xs text-ink-3 mt-0.5">{KIND_META[k].hint}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {!editing && (
            <button type="button" onClick={() => setKind(null)} className="text-xs font-semibold text-ink-3 hover:text-ink flex items-center gap-1">
              <Icon name="arrowLeft" size={13} /> {KIND_META[kind].label}
            </button>
          )}

          {kind === 'file' && !editing && (
            <Field label="PDF file">
              <PdfPicker batchId={data.batch.id} value={file} onChange={setFile} />
            </Field>
          )}

          <Field label="Title" hint={kind === 'practice' || kind === 'file' ? 'Optional — filled in automatically if left empty.' : undefined}>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === 'recording' ? 'Class 5 — Lesson 7 grammar' : kind === 'homework' ? 'Worksheet: Lesson 8 kanji' : kind === 'note' ? 'Test on Friday' : 'Title'
              }
              maxLength={160}
            />
          </Field>

          {(kind === 'link' || kind === 'recording') && (
            <Field label={kind === 'recording' ? 'Recording link' : 'Link'} hint="Paste the full address, starting with https://">
              <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
            </Field>
          )}

          {kind === 'homework' && !editing && (
            <Field label="Question paper (optional)">
              <PdfPicker batchId={data.batch.id} value={file} onChange={setFile} label="Attach question PDF" />
            </Field>
          )}

          {kind === 'practice' && !editing && (
            <Field label={`Kanji to practise (${data.batch.level})`}>
              <KanjiPicker level={data.batch.level} value={kanji} onChange={setKanji} />
            </Field>
          )}

          <Field label={kind === 'note' ? 'Message' : 'Description (optional)'}>
            <textarea
              className="input h-auto min-h-[88px] py-3 resize-y"
              value={body ?? ''}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              placeholder={kind === 'homework' ? 'Answer all questions and upload your sheet as one PDF.' : ''}
            />
          </Field>

          {canCollect && (
            <label className="flex items-center gap-3 rounded-2xl bg-brand-soft/60 border border-brand/20 p-3 cursor-pointer">
              <input type="checkbox" checked={collect} onChange={(e) => setCollect(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
              <span className="text-sm">
                <b>Collect submissions</b>
                <span className="block text-xs text-ink-3">Students get an “Upload solution” button and you see who submitted.</span>
              </span>
            </label>
          )}

          {showsDue && (
            <Field label="Due date">
              <input type="datetime-local" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          )}

          <label className="flex items-center gap-3 rounded-2xl bg-surface border border-line/70 p-3 cursor-pointer">
            <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
            <span className="text-sm">
              <b>Lock for now</b>
              <span className="block text-xs text-ink-3">Students see the title with a lock until you unlock it.</span>
            </span>
          </label>

          {err && <div className="rounded-2xl bg-sakura-soft text-sakura text-sm font-medium px-4 py-3">{err}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Who finished                                                        */
/* ------------------------------------------------------------------ */

function SubmissionsModal({ item, onClose }: { item: ClassItem; onClose: () => void }) {
  const [rows, setRows] = useState<SubmissionRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    itemSubmissions(item.id)
      .then((r) => setRows(r.rows))
      .catch((e) => setErr(e.message));
  }, [item.id]);
  const done = rows?.filter((r) => r.done).length ?? 0;
  const pastDue = dueState(item.due_at) === 'overdue';
  return (
    <Modal title={`Who finished — ${item.title}`} onClose={onClose} wide>
      {err && <div className="rounded-2xl bg-sakura-soft text-sakura text-sm font-medium px-4 py-3">{err}</div>}
      {!rows ? (
        <p className="text-sm text-ink-3">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-3">No students in this batch yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Tone tone="matcha">
              <Icon name="check" size={12} /> {done} finished
            </Tone>
            <Tone tone={pastDue ? 'sakura' : 'kin'}>{rows.length - done} {pastDue ? 'missing' : 'not yet'}</Tone>
            {item.due_at && <DueChip iso={item.due_at} />}
          </div>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-ink-3 text-xs border-b border-line/70">
                  <th className="font-semibold px-6 py-2">Student</th>
                  <th className="font-semibold py-2">Status</th>
                  <th className="font-semibold py-2">When</th>
                  <th className="font-semibold py-2 pr-6">{item.takes_submissions ? 'Answer sheet' : 'Progress'}</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => Number(a.done) - Number(b.done))
                  .map((r) => (
                    <tr key={r.student.id} className="border-b border-line/50 last:border-0 align-top">
                      <td className="px-6 py-3">
                        <div className="font-semibold">{r.student.name}</div>
                        <div className="text-xs text-ink-3">{r.student.email}</div>
                      </td>
                      <td className="py-3">
                        {r.done ? (
                          <Tone tone={r.late ? 'kin' : 'matcha'}>{r.late ? 'Late' : item.takes_submissions ? 'Submitted' : 'Finished'}</Tone>
                        ) : (
                          <Tone tone={pastDue ? 'sakura' : 'ai'}>{pastDue ? 'Missing' : 'Not yet'}</Tone>
                        )}
                      </td>
                      <td className="py-3 text-ink-2 text-xs">{r.submitted_at ? timeAgo(Date.parse(r.submitted_at)) : '—'}</td>
                      <td className="py-3 pr-6">
                        {item.takes_submissions ? (
                          <div className="space-y-1">
                            {r.file && (
                              <a href={fileUrl(r.file.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand font-semibold text-xs hover:underline">
                                <Icon name="file" size={13} /> {r.file.name}
                              </a>
                            )}
                            {r.note && <div className="text-xs text-ink-2 whitespace-pre-wrap">{r.note}</div>}
                            {!r.file && !r.note && <span className="text-ink-3 text-xs">—</span>}
                          </div>
                        ) : (
                          <span className="text-xs font-bold tabular">
                            {r.progress?.done ?? 0}/{r.progress?.total ?? 0} kanji
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Student homework hand-in                                            */
/* ------------------------------------------------------------------ */

function HandIn({ data, item, onChanged }: { data: ClassroomData; item: ClassItem; onChanged: () => void }) {
  const mine = data.mySubmissions[item.id];
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<FileRef | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await submitHomework(item.id, file?.id, note);
      setOpen(false);
      setFile(null);
      setNote('');
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-paper border border-line/70 p-3">
      {mine ? (
        <div className="flex flex-wrap items-center gap-2">
          <Tone tone={item.due_at && Date.parse(mine.submitted_at) > Date.parse(item.due_at) ? 'kin' : 'matcha'}>
            <Icon name="check" size={12} /> Submitted {timeAgo(Date.parse(mine.submitted_at))}
          </Tone>
          {mine.file && (
            <a href={fileUrl(mine.file.id)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1">
              <Icon name="file" size={13} /> {mine.file.name}
            </a>
          )}
          <span className="ml-auto flex gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setOpen(true)}>
              Re-submit
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={async () => {
                await withdrawHomework(item.id).catch(() => undefined);
                onChanged();
              }}
            >
              Withdraw
            </button>
          </span>
          {mine.note && <p className="basis-full text-xs text-ink-2 whitespace-pre-wrap">{mine.note}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Tone tone={dueState(item.due_at) === 'overdue' ? 'sakura' : 'ai'}>{dueState(item.due_at) === 'overdue' ? 'Missing' : 'Not submitted yet'}</Tone>
          <button className="btn-primary btn-sm ml-auto" onClick={() => setOpen(true)}>
            <Icon name="upload" size={14} /> Upload solution
          </button>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-3">
          <PdfPicker batchId={data.batch.id} value={file} onChange={setFile} label="Choose your answer PDF" />
          <textarea className="input h-auto min-h-[64px] py-3" placeholder="Note to your teacher (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          {err && <p className="text-xs text-sakura font-medium">{err}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary btn-sm" disabled={busy || (!file && !note.trim())} onClick={submit}>
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live class card                                                     */
/* ------------------------------------------------------------------ */

export function LiveClassCard({
  batchName,
  url,
  note,
  updatedAt,
  canEdit,
  onSave,
  compact,
}: {
  batchName: string;
  url: string | null | undefined;
  note: string | null | undefined;
  updatedAt?: string | null;
  canEdit?: boolean;
  onSave?: (url: string, note: string) => Promise<void>;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [u, setU] = useState(url ?? '');
  const [n, setN] = useState(note ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setU(url ?? '');
    setN(note ?? '');
  }, [url, note]);

  let host = '';
  try {
    host = url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    /* ignore */
  }

  return (
    <section className={cx('relative overflow-hidden rounded-4xl bg-sumi text-white', compact ? 'p-5' : 'p-6 sm:p-7')}>
      <div className="absolute inset-0 seigaiha opacity-25" />
      <div className="relative flex flex-wrap items-center gap-5">
        <span className={cx('relative grid shrink-0 place-items-center rounded-3xl', url ? 'bg-brand text-brand-ink' : 'bg-white/10 text-white/60', compact ? 'h-12 w-12' : 'h-14 w-14')}>
          <Icon name="live" size={compact ? 22 : 26} />
          {url && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-matcha ring-4 ring-sumi animate-pulse" />}
        </span>
        <div className="flex-1 min-w-[180px]">
          <div className="font-jp text-brand text-xs">ライブ授業</div>
          <div className={cx('font-extrabold tracking-tight', compact ? 'text-lg' : 'text-xl sm:text-2xl')}>Live class · {batchName}</div>
          <div className="text-sm text-white/65 mt-0.5">
            {url ? (
              <>
                {note || `Class link on ${host}`}
                {updatedAt && <span className="text-white/40"> · updated {timeAgo(Date.parse(updatedAt))}</span>}
              </>
            ) : canEdit ? (
              'Paste your Zoom / Google Meet / Teams link once — students join from here.'
            ) : (
              'Your teacher hasn’t shared a class link yet.'
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary">
              <Icon name="play" size={14} /> Join class
            </a>
          )}
          {canEdit && (
            <button onClick={() => setEditing((x) => !x)} className="btn btn-sm bg-white/10 hover:bg-white/20 text-white border border-white/15 h-11">
              <Icon name="edit" size={14} /> {url ? 'Change' : 'Add link'}
            </button>
          )}
        </div>
      </div>
      {editing && canEdit && (
        <form
          className="relative mt-5 grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            setBusy(true);
            try {
              await onSave?.(u, n);
              setEditing(false);
            } catch (x) {
              setErr(x instanceof Error ? x.message : String(x));
            } finally {
              setBusy(false);
            }
          }}
        >
          <input className="input bg-white/10 text-white placeholder:text-white/40 focus:bg-white/15" placeholder="https://zoom.us/j/…" value={u} onChange={(e) => setU(e.target.value)} />
          <input className="input bg-white/10 text-white placeholder:text-white/40 focus:bg-white/15" placeholder="Note, e.g. Mon & Thu 7 pm IST" value={n} onChange={(e) => setN(e.target.value)} maxLength={300} />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            {url && (
              <button
                type="button"
                className="btn btn-sm h-11 bg-white/10 text-white border border-white/15"
                onClick={async () => {
                  setBusy(true);
                  await onSave?.('', '').catch(() => undefined);
                  setBusy(false);
                  setEditing(false);
                }}
              >
                Remove
              </button>
            )}
          </div>
          {err && <p className="sm:col-span-3 text-sm text-sakura font-medium">{err}</p>}
        </form>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Item card                                                           */
/* ------------------------------------------------------------------ */

function ItemCard({
  data,
  item,
  first,
  last,
  onChanged,
  onEdit,
  onWho,
  practice,
}: {
  data: ClassroomData;
  item: ClassItem;
  first: boolean;
  last: boolean;
  onChanged: () => void;
  onEdit: () => void;
  onWho: () => void;
  practice?: { status: (ids: string[], since: string) => { done: number; total: number }; start: (ids: string[]) => void };
}) {
  const meta = KIND_META[item.kind];
  const teacher = data.canEdit;
  const hidden = item.locked && !teacher; // students only get the title
  const prog = !hidden && item.kind === 'practice' && practice && item.kanji_ids ? practice.status(item.kanji_ids, item.created_at) : null;
  const doneForMe = item.takes_submissions ? !!data.mySubmissions[item.id] : prog ? prog.total > 0 && prog.done >= prog.total : false;

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <article className={cx('card p-4 sm:p-5 transition', hidden && 'opacity-70')}>
      <div className="flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `rgb(var(--${meta.tone}-soft))`, color: `rgb(var(--${meta.tone}))` }}>
          <Icon name={hidden ? 'lock' : meta.icon} size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="font-bold leading-snug">{item.title}</h4>
            {item.locked && (
              <Tone tone="ai">
                <Icon name="lock" size={11} /> Locked
              </Tone>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span className="font-semibold">{meta.label}</span>
            {item.takes_submissions && item.kind !== 'homework' && (
              <Tone tone="brand">
                <Icon name="upload" size={11} /> Submission
              </Tone>
            )}
            {item.due_at && <DueChip iso={item.due_at} done={!teacher && doneForMe} />}
            {teacher && (item.takes_submissions || item.kind === 'practice') && (
              <button onClick={onWho} className="chip bg-brand-soft text-brand hover:opacity-80">
                <Icon name="users" size={12} /> {item.takes_submissions ? `${item.submissions ?? 0}/${data.studentCount} submitted` : 'Who finished'}
              </button>
            )}
          </div>

          {hidden ? (
            <p className="mt-2 text-sm text-ink-3">Your teacher will unlock this soon.</p>
          ) : (
            <>
              {item.body && <p className="mt-2 text-sm text-ink-2 whitespace-pre-wrap">{item.body}</p>}

              {item.kind === 'practice' && item.kanji_ids && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.kanji_ids.slice(0, 40).map((id) => (
                    <span key={id} className="grid h-8 w-8 place-items-center rounded-lg bg-paper border border-line/70 font-mincho font-bold">
                      {KANJI_BY_ID[id]?.character ?? '?'}
                    </span>
                  ))}
                  {item.kanji_ids.length > 40 && <span className="text-xs text-ink-3 self-center">+{item.kanji_ids.length - 40}</span>}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {item.file && (
                  <>
                    <a href={fileUrl(item.file.id)} target="_blank" rel="noopener noreferrer" className="btn-dark btn-sm">
                      <Icon name="eye" size={14} /> {item.kind === 'homework' ? 'Question paper' : 'Open PDF'}
                    </a>
                    <a href={fileUrl(item.file.id, true)} className="btn-ghost btn-sm">
                      <Icon name="download" size={14} /> {fmtSize(item.file.size)}
                    </a>
                  </>
                )}
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-dark btn-sm">
                    <Icon name={item.kind === 'recording' ? 'play' : 'link'} size={14} /> {item.kind === 'recording' ? 'Watch recording' : 'Open link'}
                  </a>
                )}
                {teacher && (item.kind === 'file' || item.kind === 'link' || item.kind === 'note') && (
                  <button
                    className={item.takes_submissions ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}
                    onClick={() => act(() => updateItem(item.id, { acceptsSubmissions: !item.takes_submissions }))}
                  >
                    <Icon name="upload" size={14} /> {item.takes_submissions ? 'Stop collecting' : 'Collect student submissions'}
                  </button>
                )}
                {prog && practice && item.kanji_ids && (
                  <>
                    <button className="btn-primary btn-sm" onClick={() => practice.start(item.kanji_ids!)}>
                      <Icon name="play" size={14} /> {doneForMe ? 'Practise again' : 'Start practice'}
                    </button>
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <span className="w-24 h-1.5 rounded-full bg-sunken overflow-hidden">
                        <span className="block h-full bg-matcha rounded-full" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} />
                      </span>
                      <span className={doneForMe ? 'text-matcha' : 'text-ink-3'}>
                        {prog.done}/{prog.total} {doneForMe ? '· done' : ''}
                      </span>
                    </span>
                  </>
                )}
              </div>

              {!teacher && item.takes_submissions && <HandIn data={data} item={item} onChanged={onChanged} />}
            </>
          )}
        </div>

        {teacher && (
          <div className="flex flex-col sm:flex-row gap-1 shrink-0">
            <button title="Move up" disabled={first} onClick={() => act(() => updateItem(item.id, { move: 'up' }))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-sunken disabled:opacity-30">
              <Icon name="up" size={15} />
            </button>
            <button title="Move down" disabled={last} onClick={() => act(() => updateItem(item.id, { move: 'down' }))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-sunken disabled:opacity-30">
              <Icon name="down" size={15} />
            </button>
            <button
              title={item.item_locked ? 'Unlock' : 'Lock'}
              onClick={() => act(() => updateItem(item.id, { locked: !item.item_locked }))}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-sunken"
            >
              <Icon name={item.item_locked ? 'unlock' : 'lock'} size={15} />
            </button>
            <button title="Edit" onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-full hover:bg-sunken">
              <Icon name="edit" size={15} />
            </button>
            <button
              title="Delete"
              onClick={() => confirm(`Delete “${item.title}”? Student submissions for it are deleted too.`) && act(() => deleteItem(item.id))}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-sakura-soft hover:text-sakura"
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* The classroom                                                       */
/* ------------------------------------------------------------------ */

export default function Classroom({
  batchId,
  practice,
  showLive = true,
}: {
  batchId: string;
  practice?: { status: (ids: string[], since: string) => { done: number; total: number }; start: (ids: string[]) => void };
  showLive?: boolean;
}) {
  const [data, setData] = useState<ClassroomData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [who, setWho] = useState<ClassItem | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await loadClassroom(batchId);
      setData(d);
      setErr(null);
      setActive((cur) => (cur && d.sections.some((s) => s.id === cur) ? cur : d.sections[0]?.id ?? null));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [batchId]);

  useEffect(() => {
    setData(null);
    setActive(null);
    void load();
  }, [load]);

  const itemsBySection = useMemo(() => {
    const m: Record<string, ClassItem[]> = {};
    for (const it of data?.items ?? []) (m[it.section_id] ??= []).push(it);
    return m;
  }, [data]);

  const pending = useMemo(() => {
    if (!data || data.canEdit) return [];
    return data.items
      .filter((i) => !i.locked && (i.takes_submissions || i.kind === 'practice'))
      .filter((i) => {
        if (i.takes_submissions) return !data.mySubmissions[i.id];
        const p = practice && i.kanji_ids ? practice.status(i.kanji_ids, i.created_at) : null;
        return !p || p.done < p.total;
      })
      .sort((a, b) => (Date.parse(a.due_at ?? '9999') || 0) - (Date.parse(b.due_at ?? '9999') || 0));
  }, [data, practice]);

  if (err && !data) return <div className="card card-pad text-sm text-sakura">{err}</div>;
  if (!data) return <div className="card card-pad text-sm text-ink-3">Loading classroom…</div>;

  const teacher = data.canEdit;
  const section = data.sections.find((s) => s.id === active) ?? null;
  const items = section ? itemsBySection[section.id] ?? [] : [];

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-6">
      {showLive && (
        <LiveClassCard
          batchName={data.batch.name}
          url={data.live?.live_url}
          note={data.live?.live_note}
          updatedAt={data.live?.updated_at}
          canEdit={teacher}
          onSave={async (u, n) => {
            await setLiveLink(batchId, u, n);
            await load();
          }}
        />
      )}

      {!teacher && pending.length > 0 && (
        <section className="card card-pad">
          <div className="eyebrow mb-3">To do · {pending.length}</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {pending.slice(0, 6).map((i) => (
              <li key={i.id}>
                <button onClick={() => setActive(i.section_id)} className="w-full flex items-center gap-3 rounded-2xl bg-paper border border-line/70 p-3 text-left hover:border-brand/50">
                  <Icon name={KIND_META[i.kind].icon} size={17} className="text-brand shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{i.title}</span>
                    <span className="block text-[11px] text-ink-3">{i.due_at ? `Due ${fmtDue(i.due_at)}` : 'No due date'}</span>
                  </span>
                  {dueState(i.due_at) === 'overdue' && <Tone tone="sakura">Late</Tone>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ---------- Section sidebar (LMS style) ---------- */}
        <aside className="card p-3 self-start min-w-0 lg:sticky lg:top-20">
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <div className="eyebrow">Course sections</div>
            <span className="text-[11px] text-ink-3 font-semibold">{data.sections.length}</span>
          </div>
          {data.sections.length === 0 ? (
            <p className="px-2 pb-3 text-sm text-ink-3">{teacher ? 'Create your first section — e.g. “Course plan”, “Lesson 3”, “Class test 1”.' : 'Nothing here yet.'}</p>
          ) : (
            <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
              {data.sections.map((s) => {
                const on = s.id === active;
                const n = (itemsBySection[s.id] ?? []).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id)}
                    className={cx(
                      'shrink-0 flex items-center gap-2.5 rounded-2xl px-3 h-11 text-sm font-semibold text-left transition',
                      on ? 'bg-ink text-canvas shadow-lift' : 'text-ink-2 hover:bg-sunken/70'
                    )}
                  >
                    <Icon name={s.locked ? 'lock' : 'folder'} size={16} className={on ? 'text-brand' : 'text-ink-3'} />
                    <span className="flex-1 truncate max-w-[160px] lg:max-w-none">{s.title}</span>
                    <span className={cx('text-[11px] tabular', on ? 'text-canvas/50' : 'text-ink-3')}>{n}</span>
                  </button>
                );
              })}
            </nav>
          )}
          {teacher && (
            <form
              className="mt-2 flex gap-2 px-1 pb-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTitle.trim()) return;
                void act(async () => {
                  const { id } = await addSection(batchId, newTitle.trim());
                  setNewTitle('');
                  setActive(id);
                });
              }}
            >
              <input className="input h-10" placeholder="New section…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={80} />
              <button className="btn-primary btn-sm h-10 px-3" aria-label="Add section" disabled={!newTitle.trim()}>
                <Icon name="plus" size={16} />
              </button>
            </form>
          )}
        </aside>

        {/* ---------- Section content ---------- */}
        <div className="space-y-4 min-w-0">
          {!section ? (
            <div className="card card-pad text-center py-14">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-brand-soft text-brand">
                <Icon name="folder" size={26} />
              </div>
              <h3 className="mt-4 text-lg font-bold">{teacher ? 'Build your classroom' : 'Your classroom is empty'}</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">
                {teacher
                  ? 'Add sections on the left, then put PDFs, links, class recordings, homework and kanji practice inside them.'
                  : 'Your teacher hasn’t posted anything yet. Check back after class.'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                {renaming === section.id ? (
                  <form
                    className="flex gap-2 flex-1 min-w-[220px]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const t = (new FormData(e.currentTarget).get('t') as string).trim();
                      setRenaming(null);
                      if (t && t !== section.title) void act(() => updateSection(section.id, { title: t }));
                    }}
                  >
                    <input name="t" className="input" defaultValue={section.title} autoFocus maxLength={80} />
                    <button className="btn-primary btn-sm h-11">Save</button>
                  </form>
                ) : (
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight flex-1 min-w-0 flex items-center gap-2">
                    {section.locked && <Icon name="lock" size={18} className="text-ink-3" />}
                    <span className="truncate">{section.title}</span>
                  </h2>
                )}
                {teacher && renaming !== section.id && (
                  <div className="flex flex-wrap gap-1.5">
                    <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>
                      <Icon name="plus" size={14} /> Add item
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => act(() => updateSection(section.id, { locked: !section.locked }))}>
                      <Icon name={section.locked ? 'unlock' : 'lock'} size={14} /> {section.locked ? 'Unlock' : 'Lock'}
                    </button>
                    <button className="btn-ghost btn-sm px-3" title="Rename" onClick={() => setRenaming(section.id)}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="btn-ghost btn-sm px-3" title="Move up" onClick={() => act(() => updateSection(section.id, { move: 'up' }))}>
                      <Icon name="up" size={14} />
                    </button>
                    <button className="btn-ghost btn-sm px-3" title="Move down" onClick={() => act(() => updateSection(section.id, { move: 'down' }))}>
                      <Icon name="down" size={14} />
                    </button>
                    <button
                      className="btn-ghost btn-sm px-3 hover:text-sakura"
                      title="Delete section"
                      onClick={() =>
                        confirm(`Delete the section “${section.title}” and everything in it (files and student submissions)?`) &&
                        act(() => deleteSection(section.id))
                      }
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                )}
              </div>
              {section.locked && (
                <div className="rounded-2xl bg-ai-soft text-ai text-sm font-medium px-4 py-3 flex items-center gap-2">
                  <Icon name="lock" size={15} />
                  {teacher ? 'Locked — students see item titles only.' : 'This section is locked. Your teacher will open it soon.'}
                </div>
              )}

              {items.length === 0 ? (
                <div className="card card-pad text-sm text-ink-3 text-center py-10">
                  {teacher ? (
                    <>
                      Nothing in this section yet.{' '}
                      <button className="text-brand font-semibold hover:underline" onClick={() => setAdding(true)}>
                        Add a PDF, link, recording, homework or practice
                      </button>
                    </>
                  ) : (
                    'Nothing in this section yet.'
                  )}
                </div>
              ) : (
                items.map((it, i) => (
                  <ItemCard
                    key={it.id}
                    data={data}
                    item={it}
                    first={i === 0}
                    last={i === items.length - 1}
                    onChanged={load}
                    onEdit={() => setEditing(it)}
                    onWho={() => setWho(it)}
                    practice={practice}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {adding && section && <ItemEditor data={data} section={section} onClose={() => setAdding(false)} onSaved={load} />}
      {editing && section && <ItemEditor data={data} section={section} item={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {who && <SubmissionsModal item={who} onClose={() => setWho(null)} />}
    </div>
  );
}
