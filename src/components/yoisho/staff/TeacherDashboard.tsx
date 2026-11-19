'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar as RBar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useAuth } from '@/lib/auth';
import {
  batchDetail,
  teachingBatches,
  type Batch,
  type ReviewEventRow,
  type StudentRow,
} from '@/lib/api';
import { KANJI_BY_ID, TRACKS, timeAgo, trackForLevel, trackOf, type PersistedState, type Track } from '@/lib/learn-store';
import { Icon } from '../icons';
import { Bar, Empty, SectionTitle, StatTile, cx } from '../ui';
import StaffShell, { CopyButton } from './StaffShell';
import Classroom from '../classroom/Classroom';
import { studentReportCsvUrl, studentReportPage } from '@/lib/classroom-api';

const DAY = 86_400_000;
const tooltipStyle = {
  background: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--line))',
  borderRadius: 14,
  fontSize: 12,
  color: 'rgb(var(--ink))',
};

type Attention = 'inactive' | 'struggling' | 'new' | 'ok';

function attentionFor(s: StudentRow, now: number): Attention {
  const sum = s.summary;
  if (!sum || sum.reviews_total === 0) return 'new';
  const last = sum.last_active ? Date.parse(sum.last_active) : 0;
  if (now - last > 3 * DAY) return 'inactive';
  if ((sum.reviews_7d >= 5 && sum.accuracy_7d < 65) || sum.weak >= 4) return 'struggling';
  return 'ok';
}

const ATTENTION: Record<Attention, { label: string; tone: string; rank: number }> = {
  inactive: { label: 'Inactive 3+ days', tone: 'sakura', rank: 0 },
  struggling: { label: 'Struggling', tone: 'kin', rank: 1 },
  new: { label: 'Not started', tone: 'ai', rank: 2 },
  ok: { label: 'On track', tone: 'matcha', rank: 3 },
};

function Chip({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className="chip whitespace-nowrap" style={{ background: `rgb(var(--${tone}-soft))`, color: `rgb(var(--${tone}))` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(var(--${tone}))` }} />
      {children}
    </span>
  );
}

function StudentDrawer({
  student,
  state,
  events,
  track,
  batchId,
  onClose,
}: {
  batchId?: string;
  student: StudentRow;
  state: PersistedState | undefined;
  events: ReviewEventRow[];
  track: Track;
  onClose: () => void;
}) {
  const now = Date.now();
  const inTrack = state
    ? Object.entries(state.progress).filter(([id]) => KANJI_BY_ID[id] && trackOf(KANJI_BY_ID[id]) === track)
    : [];
  const notStarted = inTrack.filter(([, p]) => !p.total_attempts).length;
  const kanji = inTrack
    .filter(([, p]) => p.total_attempts > 0)
    .map(([id, p]) => ({ id, char: KANJI_BY_ID[id].character, meaning: KANJI_BY_ID[id].meanings[0] ?? '', p }))
    .sort((a, b) => a.p.overall_mastery - b.p.overall_mastery);
  const mine = events.filter((e) => e.student_id === student.profile.id).slice(0, 12);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-sumi/40 backdrop-blur-sm" onClick={onClose} />
      <aside role="dialog" aria-label={`Student ${student.profile.full_name}`} className="absolute right-0 top-0 h-full w-full max-w-lg bg-paper border-l border-line shadow-lift overflow-y-auto animate-rise">
        <div className="relative bg-brand text-white p-6 overflow-hidden">
          <div className="absolute inset-0 seigaiha opacity-60" />
          <button onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/15" aria-label="Close">
            <Icon name="x" size={16} />
          </button>
          <div className="relative flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#141414] text-xl font-extrabold">
              {(student.profile.full_name || student.profile.email)[0].toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="text-xl font-extrabold truncate">{student.profile.full_name || '—'}</div>
              <div className="text-sm text-white/80 truncate">{student.profile.email}</div>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {batchId && (
            <div className="flex flex-wrap gap-2">
              <a className="btn-ghost btn-sm" href={studentReportCsvUrl(batchId, student.profile.id)}>
                <Icon name="download" size={14} /> CSV report
              </a>
              <a className="btn-ghost btn-sm" href={studentReportPage(batchId, student.profile.id)} target="_blank" rel="noopener noreferrer">
                <Icon name="printer" size={14} /> PDF report
              </a>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Mastery', `${Math.round(Number(student.summary?.avg_mastery ?? 0))}%`],
              ['Accuracy 7d', `${student.summary?.accuracy_7d ?? 0}%`],
              ['Streak', `${student.summary?.streak ?? 0}d`],
              ['Reviews 7d', String(student.summary?.reviews_7d ?? 0)],
              ['Due now', String(student.summary?.due_count ?? 0)],
              ['Last active', student.summary?.last_active ? timeAgo(Date.parse(student.summary.last_active), now) : 'never'],
            ].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-surface border border-line/70 p-3">
                <div className="text-lg font-extrabold tabular">{v}</div>
                <div className="text-[11px] text-ink-3 font-semibold">{l}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="eyebrow mb-3">
              {track} kanji studied · weakest first <span className="normal-case tracking-normal font-medium">({kanji.length} started, {notStarted} not yet)</span>
            </div>
            {kanji.length === 0 ? (
              <p className="text-sm text-ink-3">No practice yet.</p>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                {kanji.map((k) => {
                  const m = k.p.overall_mastery;
                  const tone = k.p.total_attempts === 0 ? 'ai' : m >= 80 ? 'matcha' : m >= 60 ? 'kin' : 'sakura';
                  return (
                    <div
                      key={k.id}
                      title={`${k.char} ${k.meaning}: ${Math.round(m)}% (${k.p.correct_attempts}/${k.p.total_attempts} correct)`}
                      className="rounded-xl p-1.5 text-center"
                      style={{ background: `rgb(var(--${tone}-soft))` }}
                    >
                      <div className="font-mincho text-2xl font-bold leading-tight">{k.char}</div>
                      <div className="text-[10px] font-bold tabular" style={{ color: `rgb(var(--${tone}))` }}>
                        {k.p.total_attempts ? `${Math.round(m)}%` : 'new'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="eyebrow mb-3">Recent answers</div>
            {mine.length === 0 ? (
              <p className="text-sm text-ink-3">No activity in the last 14 days.</p>
            ) : (
              <ul className="space-y-2">
                {mine.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 text-sm">
                    <span
                      className="grid h-8 w-8 place-items-center rounded-lg font-mincho font-bold"
                      style={{ background: `rgb(var(--${e.correct ? 'matcha' : 'sakura'}-soft))`, color: `rgb(var(--${e.correct ? 'matcha' : 'sakura'}))` }}
                    >
                      {e.kanji}
                    </span>
                    <span className="flex-1 capitalize">{e.kind === 'card' ? `Review · ${e.grade}` : `Quiz · ${e.mode}`}</span>
                    <span className="text-xs text-ink-3">{timeAgo(Date.parse(e.created_at), now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [states, setStates] = useState<Record<string, PersistedState>>({});
  const [events, setEvents] = useState<ReviewEventRow[]>([]);
  const [open, setOpen] = useState<StudentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'classroom' | 'leaderboard' | 'reports'>('overview');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'classroom' || t === 'reports' || t === 'leaderboard') setTab(t);
  }, []);

  useEffect(() => {
    if (!profile) return;
    teachingBatches(profile.id, profile.role)
      .then((b) => {
        setBatches(b);
        setBatchId((cur) => cur ?? b[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, [profile]);

  const loadBatch = useCallback(async (id: string) => {
    setStudents(null);
    try {
      const d = await batchDetail(id);
      setStudents(d.students);
      setStates(d.states);
      setEvents(d.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (batchId) void loadBatch(batchId);
  }, [batchId, loadBatch]);

  const now = Date.now();
  const batch = batches?.find((b) => b.id === batchId) ?? null;
  const batchTrack: Track = trackForLevel(batch?.level);

  const ranked = useMemo(
    () =>
      (students ?? [])
        .map((s) => ({ s, a: attentionFor(s, now) }))
        .sort((x, y) => ATTENTION[x.a].rank - ATTENTION[y.a].rank),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students]
  );

  const stats = useMemo(() => {
    const list = students ?? [];
    const started = list.filter((s) => s.summary && s.summary.reviews_total > 0);
    const avg = (f: (s: StudentRow) => number) => (started.length ? Math.round(started.reduce((a, s) => a + f(s), 0) / started.length) : 0);
    return {
      total: list.length,
      active: list.filter((s) => (s.summary?.reviews_7d ?? 0) > 0).length,
      mastery: avg((s) => Number(s.summary!.avg_mastery)),
      accuracy: avg((s) => s.summary!.accuracy_7d),
    };
  }, [students]);

  const weakKanji = useMemo(() => {
    const agg: Record<string, { sum: number; n: number; weak: number }> = {};
    Object.values(states).forEach((st) =>
      Object.entries(st.progress ?? {}).forEach(([id, p]) => {
        if (!p.total_attempts) return;
        const a = (agg[id] ??= { sum: 0, n: 0, weak: 0 });
        a.sum += p.overall_mastery;
        a.n += 1;
        if (p.overall_mastery < 60) a.weak += 1;
      })
    );
    return Object.entries(agg)
      .map(([id, a]) => ({ id, k: KANJI_BY_ID[id], avg: a.sum / a.n, n: a.n, weak: a.weak }))
      .filter((x) => x.k && trackOf(x.k) === batchTrack)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 8);
  }, [states, batchTrack]);

  const activity = useMemo(() => {
    const out: { label: string; reviews: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      const key = d.toDateString();
      out.push({
        label: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        reviews: events.filter((e) => new Date(e.created_at).toDateString() === key).length,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const signupLink = batch && typeof window !== 'undefined' ? `${window.location.origin}/signup?code=${batch.join_code}` : '';

  return (
    <StaffShell title="Teacher dashboard" jp="先生">
      {error && <div className="mb-4 rounded-2xl bg-sakura-soft text-sakura text-sm font-medium px-4 py-3">{error}</div>}

      {batches === null ? (
        <div className="card card-pad text-sm text-ink-3">Loading your batches…</div>
      ) : batches.length === 0 ? (
        <Empty
          icon="users"
          title="No batches assigned yet"
          body="An admin assigns teachers to batches. Once you're assigned, the batch and its students appear here."
        />
      ) : (
        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {batches.map((b) => (
              <button
                key={b.id}
                onClick={() => setBatchId(b.id)}
                className={cx(
                  'shrink-0 flex items-center gap-2 h-10 pl-2 pr-4 rounded-full border text-sm font-semibold transition',
                  b.id === batchId ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-2 hover:border-ink/30'
                )}
              >
                <span className={cx('grid h-7 min-w-[28px] px-1 place-items-center rounded-full text-[11px] font-extrabold', b.id === batchId ? 'bg-brand text-brand-ink' : 'bg-brand-soft text-brand')}>
                  {b.level}
                </span>
                {b.name}
              </button>
            ))}
          </div>

          {batch && (
            <section className="relative overflow-hidden rounded-4xl bg-sumi text-white p-6 sm:p-8">
              <div className="absolute inset-0 seigaiha opacity-25" />
              <div className="relative flex flex-wrap items-end justify-between gap-6">
                <div>
                  <div className="font-jp text-brand text-sm">クラス</div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{batch.name}</h2>
                  <p className="text-white/60 text-sm mt-1">
                    JLPT {batch.level} · {TRACKS.find((t) => t.id === batchTrack)?.book} kanji
                    {batch.term ? ` · ${batch.term}` : ''} · {stats.total} student{stats.total === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="rounded-3xl bg-white/[.07] border border-white/10 p-4 min-w-0">
                  <div className="text-xs text-white/60 font-semibold">Join code for new students</div>
                  <div className="mt-1 flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-2xl font-bold tracking-wider text-brand select-all">{batch.join_code}</span>
                    <span className="[&_button]:bg-white/10 [&_button]:text-white [&_button]:border-white/15 flex gap-2">
                      <CopyButton text={batch.join_code} label="Copy code" />
                      <CopyButton text={signupLink} label="Copy sign-up link" />
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <div className="flex gap-1 rounded-full bg-sunken/70 p-1 w-fit">
            {(
              [
                ['overview', 'Overview', 'chart'],
                ['classroom', 'Classroom', 'folder'],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cx(
                  'flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold transition',
                  tab === id ? 'bg-surface shadow-card text-ink' : 'text-ink-3 hover:text-ink'
                )}
              >
                <Icon name={icon} size={15} /> {label}
              </button>
            ))}
          </div>

          {tab === 'classroom' && batch && <Classroom key={batch.id} batchId={batch.id} />}

          {tab === 'overview' && (
          <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatTile icon="users" label="Students" value={stats.total} tone="ai" />
            <StatTile icon="flame" label="Active this week" value={stats.active} unit={`/ ${stats.total}`} tone="brand" />
            <StatTile icon="layers" label="Avg. mastery" value={stats.mastery} unit="%" hint="Students who started" tone="matcha" />
            <StatTile icon="target" label="Accuracy 7d" value={stats.accuracy} unit="%" tone="kin" />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="card card-pad min-w-0">
              <SectionTitle jp="学習量" title="Batch activity" sub="Reviews and quiz answers per day, last 14 days" />
              <div className="h-48 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activity} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} tick={{ fontSize: 11, fill: 'rgb(var(--ink-3))' }} />
                    <Tooltip cursor={{ fill: 'rgb(var(--sunken) / .6)' }} contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Answers']} />
                    <RBar dataKey="reviews" fill="rgb(var(--brand))" radius={[8, 8, 8, 8]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card card-pad min-w-0">
              <SectionTitle jp="苦手" title="Kanji the batch is forgetting" sub="Lowest average mastery among students who studied it" />
              {weakKanji.length === 0 ? (
                <p className="text-sm text-ink-3">Appears once students start practising.</p>
              ) : (
                <ul className="space-y-3">
                  {weakKanji.map((w) => (
                    <li key={w.id} className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-paper border border-line/70 font-mincho text-xl font-bold">{w.k.character}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex justify-between text-sm">
                          <span className="font-semibold truncate">{w.k.meanings[0]}</span>
                          <span className="tabular font-bold">{Math.round(w.avg)}%</span>
                        </span>
                        <Bar value={w.avg} tone={w.avg >= 80 ? 'matcha' : w.avg >= 60 ? 'kin' : 'sakura'} className="mt-1.5" />
                        <span className="text-[11px] text-ink-3">
                          {w.weak} of {w.n} students below 60%
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="p-5 sm:p-6 pb-0">
              <SectionTitle jp="生徒" title="Students" sub="Who needs attention first. Click a student for details." />
            </div>
            {students === null ? (
              <div className="p-6 text-sm text-ink-3">Loading students…</div>
            ) : students.length === 0 ? (
              <div className="p-6 text-sm text-ink-3">
                No students yet. Share the join code <b className="text-ink">{batch?.join_code}</b> with your class.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-left text-ink-3 text-xs border-b border-line/70">
                      <th className="font-semibold px-6 py-3">Student</th>
                      <th className="font-semibold py-3">Status</th>
                      <th className="font-semibold py-3">Last active</th>
                      <th className="font-semibold py-3 text-right">Streak</th>
                      <th className="font-semibold py-3 text-right">Reviews 7d</th>
                      <th className="font-semibold py-3 text-right">Accuracy</th>
                      <th className="font-semibold py-3 pl-6">Mastery</th>
                      <th className="font-semibold py-3 pr-6 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map(({ s, a }) => (
                      <tr key={s.profile.id} onClick={() => setOpen(s)} className="border-b border-line/50 last:border-0 hover:bg-paper cursor-pointer">
                        <td className="px-6 py-3">
                          <div className="font-semibold">{s.profile.full_name || '—'}</div>
                          <div className="text-xs text-ink-3">{s.profile.email}</div>
                        </td>
                        <td className="py-3">
                          <Chip tone={ATTENTION[a].tone}>{ATTENTION[a].label}</Chip>
                        </td>
                        <td className="py-3 text-ink-2">{s.summary?.last_active ? timeAgo(Date.parse(s.summary.last_active), now) : '—'}</td>
                        <td className="py-3 text-right tabular">{s.summary?.streak ?? 0}d</td>
                        <td className="py-3 text-right tabular">{s.summary?.reviews_7d ?? 0}</td>
                        <td className="py-3 text-right tabular">{s.summary?.reviews_7d ? `${s.summary.accuracy_7d}%` : '—'}</td>
                        <td className="py-3 pl-6">
                          <div className="flex items-center gap-2 w-36">
                            <Bar value={Number(s.summary?.avg_mastery ?? 0)} className="flex-1" />
                            <span className="tabular text-xs font-bold w-9 text-right">{Math.round(Number(s.summary?.avg_mastery ?? 0))}%</span>
                          </div>
                        </td>
                        <td className="py-3 pr-6 text-right tabular">{s.summary?.due_count ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          </>
          )}
        </div>
      )}

      {open && <StudentDrawer student={open} state={states[open.profile.id]} events={events} track={batchTrack} batchId={batchId ?? undefined} onClose={() => setOpen(null)} />}
    </StaffShell>
  );
}
