'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, type Profile } from '@/lib/auth';
import {
  addStudentToBatch,
  adminOverview,
  assignTeacher,
  batchStudents,
  createAccount,
  createBatch,
  deleteBatch,
  regenerateCode,
  removeStudent,
  resetPassword,
  getAdminSettings,
  setSignupRequiresCode,
  setOrgRole,
  setPlatformAdmin,
  removeFromOrg,
  createOrg,
  renameOrg,
  deleteOrg,
  unassignTeacher,
  type Batch,
  type Org,
  type OrgRole,
  type StudentRow,
} from '@/lib/api';
import { Icon } from '../icons';
import { Empty, SectionTitle, cx } from '../ui';
import StaffShell, { CopyButton, Toast } from './StaffShell';

const LEVELS = ['N5', 'N4']; // course content exists for N5 (Genki I) and N4 (Genki II)
const ROLE_TONE: Record<OrgRole, string> = { student: 'ai', teacher: 'kin', admin: 'brand', owner: 'matcha' };

const nameOf = (p: Pick<Profile, 'full_name' | 'email'>) => p.full_name || p.email;

/* ------------------------------ Batch card ------------------------------ */

function BatchCard({
  batch,
  teachers,
  assigned,
  students,
  count,
  onChanged,
  notify,
}: {
  batch: Batch;
  teachers: Profile[];
  assigned: Profile[];
  students: Profile[];
  count: number;
  onChanged: () => void;
  notify: (m: string, tone?: 'ok' | 'err') => void;
}) {
  const [roster, setRoster] = useState<StudentRow[] | null>(null);
  const [showRoster, setShowRoster] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickTeacher, setPickTeacher] = useState('');
  const [pickStudent, setPickStudent] = useState('');

  const loadRoster = useCallback(() => {
    batchStudents(batch.id)
      .then((r) => {
        setRoster(r);
        if (r.length !== count) onChanged(); // a student joined with the code since the page loaded → refresh counts
      })
      .catch((e) => notify(e.message, 'err'));
  }, [batch.id, notify, count, onChanged]);

  useEffect(() => {
    if (showRoster) loadRoster();
  }, [showRoster, loadRoster]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      notify(ok);
      onChanged();
      if (showRoster) loadRoster();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'err');
    }
  };

  const unassigned = teachers.filter((t) => !assigned.some((a) => a.id === t.id));
  const notInBatch = students.filter((s) => !roster?.some((r) => r.profile.id === s.id));

  return (
    <div className="card overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-wrap items-start gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-brand-ink font-extrabold">{batch.level}</span>
        <div className="flex-1 min-w-[180px]">
          <h3 className="text-lg font-extrabold leading-tight">{batch.name}</h3>
          <p className="text-sm text-ink-3">
            {batch.term ? `${batch.term} · ` : ''}
            {count} student{count === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold tracking-wider text-brand bg-brand-soft rounded-xl px-3 py-1.5 select-all">{batch.join_code}</span>
          <CopyButton text={batch.join_code} />
          <button className="btn-ghost btn-sm h-8 px-3 text-xs" onClick={() => run(() => regenerateCode(batch), 'New join code created')}>
            <Icon name="refresh" size={13} /> New code
          </button>
        </div>
      </div>

      <div className="px-5 sm:px-6 pb-5">
        <div className="eyebrow mb-2">Teachers with access</div>
        <div className="flex flex-wrap items-center gap-2">
          {assigned.length === 0 && <span className="text-sm text-sakura font-medium">No teacher assigned</span>}
          {assigned.map((t) => (
            <span key={t.id} className="chip bg-kin-soft text-ink pl-3 pr-1.5 py-1">
              {nameOf(t)}
              <button
                className="grid h-5 w-5 place-items-center rounded-full hover:bg-black/10"
                onClick={() => run(() => unassignTeacher(batch.id, t.id), `${nameOf(t)} removed from ${batch.name}`)}
                aria-label={`Remove ${nameOf(t)}`}
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          {unassigned.length > 0 && (
            <span className="flex items-center gap-1.5">
              <select
                id={`assign-${batch.id}`}
                value={pickTeacher}
                onChange={(e) => setPickTeacher(e.target.value)}
                className="h-8 rounded-full bg-sunken/70 border border-line px-3 text-xs font-semibold text-ink"
                aria-label="Choose a teacher to assign"
              >
                <option value="">Assign teacher…</option>
                {unassigned.map((t) => (
                  <option key={t.id} value={t.id}>
                    {nameOf(t)}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary btn-sm h-8 px-3 text-xs"
                disabled={!pickTeacher}
                onClick={() => {
                  const t = teachers.find((x) => x.id === pickTeacher);
                  setPickTeacher('');
                  void run(() => assignTeacher(batch.id, pickTeacher), `${t ? nameOf(t) : 'Teacher'} can now see ${batch.name}`);
                }}
              >
                Assign
              </button>
            </span>
          )}
          {teachers.length === 0 && <span className="text-xs text-ink-3">Create a teacher in People first.</span>}
        </div>
      </div>

      <div className="border-t border-line/70 px-5 sm:px-6 py-3 flex flex-wrap items-center gap-2 bg-paper/60">
        <button className="text-sm font-semibold text-ink-2 hover:text-ink flex items-center gap-1.5" onClick={() => setShowRoster((v) => !v)}>
          <Icon name="users" size={15} /> {showRoster ? 'Hide students' : 'Manage students'}
        </button>
        <span className="ml-auto" />
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-ink-2">Delete batch and its memberships?</span>
            <button className="font-semibold text-ink-3" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button className="font-semibold text-sakura" onClick={() => run(() => deleteBatch(batch.id), `${batch.name} deleted`)}>
              Delete
            </button>
          </span>
        ) : (
          <button className="text-sm font-semibold text-ink-3 hover:text-sakura flex items-center gap-1.5" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={14} /> Delete
          </button>
        )}
      </div>

      {showRoster && (
        <div className="border-t border-line/70 px-5 sm:px-6 py-4 space-y-3">
          {roster === null ? (
            <p className="text-sm text-ink-3">Loading…</p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-ink-3">No students yet. They join with code {batch.join_code}.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {roster.map((r) => (
                <li key={r.profile.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold">{r.profile.full_name || '—'}</span>{' '}
                    <span className="text-ink-3">{r.profile.email}</span>
                  </span>
                  <button
                    className="text-xs font-semibold text-ink-3 hover:text-sakura"
                    onClick={() => run(() => removeStudent(batch.id, r.profile.id), `${nameOf(r.profile)} removed`)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {notInBatch.length > 0 && (
            <div className="flex gap-2">
              <select
                id={`add-student-${batch.id}`}
                value={pickStudent}
                onChange={(e) => setPickStudent(e.target.value)}
                className="input h-9 text-xs"
                aria-label="Choose a student to add"
              >
                <option value="">Add an existing student…</option>
                {notInBatch.map((s) => (
                  <option key={s.id} value={s.id}>
                    {nameOf(s)} ({s.email})
                  </option>
                ))}
              </select>
              <button
                className="btn-primary btn-sm h-9 shrink-0"
                disabled={!pickStudent}
                onClick={() => {
                  const id = pickStudent;
                  setPickStudent('');
                  void run(() => addStudentToBatch(batch.id, id), 'Student added');
                }}
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Institutions tab ------------------------------ */

function InstitutionsTab({ orgs, onChanged, notify }: { orgs: Org[]; onChanged: () => void; notify: (m: string, tone?: 'ok' | 'err') => void }) {
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr] items-start">
      <div className="space-y-4 lg:sticky lg:top-24">
        <form
          className="card card-pad space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await createOrg({ name, ownerEmail: ownerEmail || undefined, ownerName: ownerName || undefined });
              notify(`${r.org.name} added`);
              if (r.owner?.tempPassword) setCreated({ email: ownerEmail, password: r.owner.tempPassword });
              setName('');
              setOwnerEmail('');
              setOwnerName('');
              onChanged();
            } catch (err) {
              notify(err instanceof Error ? err.message : String(err), 'err');
            } finally {
              setBusy(false);
            }
          }}
        >
          <SectionTitle jp="機関" title="Add an institution" sub="Each institution gets its own batches, teachers, students and word lists." />
          <label className="block" htmlFor="org-name">
            <span className="text-sm font-semibold">Institution name</span>
            <input id="org-name" className="input mt-1.5" placeholder="e.g. Sakura JLPT Academy" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block" htmlFor="org-owner-email">
            <span className="text-sm font-semibold">Owner email (optional)</span>
            <input id="org-owner-email" type="email" className="input mt-1.5" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
          </label>
          {ownerEmail && (
            <label className="block" htmlFor="org-owner-name">
              <span className="text-sm font-semibold">Owner name</span>
              <input id="org-owner-name" className="input mt-1.5" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </label>
          )}
          <p className="text-xs text-ink-3">The owner can manage only this institution. An existing account is reused; otherwise a login with a temporary password is created.</p>
          <button className="btn-primary w-full" disabled={busy || !name.trim()}>
            <Icon name="plus" size={16} /> Add institution
          </button>
        </form>
        {created && <TempPassword created={created} onDone={() => setCreated(null)} />}
      </div>

      <div className="card overflow-hidden min-w-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-3 text-xs border-b border-line/70">
              <th className="font-semibold px-5 py-3">Institution</th>
              <th className="font-semibold py-3 text-right">Batches</th>
              <th className="font-semibold py-3 text-right">Staff</th>
              <th className="font-semibold py-3 text-right">Students</th>
              <th className="font-semibold py-3 pr-5 text-right" />
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-b border-line/50 last:border-0">
                <td className="px-5 py-3">
                  {editing === o.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const v = (new FormData(e.currentTarget).get('n') as string).trim();
                        setEditing(null);
                        if (!v || v === o.name) return;
                        try {
                          await renameOrg(o.id, v);
                          onChanged();
                        } catch (err) {
                          notify(err instanceof Error ? err.message : String(err), 'err');
                        }
                      }}
                    >
                      <input name="n" className="input h-9" defaultValue={o.name} autoFocus />
                      <button className="btn-primary btn-sm h-9">Save</button>
                    </form>
                  ) : (
                    <>
                      <div className="font-semibold">{o.name}</div>
                      <div className="text-xs text-ink-3">{o.kind === 'self' ? 'Learners without an institution' : o.slug}</div>
                    </>
                  )}
                </td>
                <td className="py-3 text-right tabular">{o.batches}</td>
                <td className="py-3 text-right tabular">{o.staff}</td>
                <td className="py-3 text-right tabular">{o.students}</td>
                <td className="py-3 pr-5 text-right whitespace-nowrap">
                  <button className="text-xs font-semibold text-ink-3 hover:text-ink mr-3" onClick={() => setEditing(o.id)}>
                    Rename
                  </button>
                  {o.kind === 'institution' && o.id !== 'org-default' && (
                    <button
                      className="text-xs font-semibold text-ink-3 hover:text-sakura"
                      onClick={async () => {
                        if (!confirm(`Remove ${o.name}? Its batches must be deleted first.`)) return;
                        try {
                          await deleteOrg(o.id);
                          notify(`${o.name} removed`);
                          onChanged();
                        } catch (err) {
                          notify(err instanceof Error ? err.message : String(err), 'err');
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TempPassword({ created, onDone }: { created: { email: string; password: string }; onDone: () => void }) {
  return (
    <div className="card card-pad border-matcha/40 bg-matcha-soft space-y-2 animate-pop">
      <div className="font-bold text-matcha">Temporary password ready</div>
      <p className="text-sm text-ink-2">Send these to {created.email}. The password is shown only once — ask them to change it after signing in.</p>
      <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
        <code className="flex-1 font-mono text-sm select-all">{created.password}</code>
        <CopyButton text={created.password} />
      </div>
      <button className="text-xs font-semibold text-ink-3" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

/* ------------------------------ Admin panel ------------------------------ */

type Tab = 'batches' | 'people' | 'institutions';

export default function AdminPanel() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('batches');
  const [data, setData] = useState<Awaited<ReturnType<typeof adminOverview>> | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ m: string; tone: 'ok' | 'err' } | null>(null);
  const notify = useCallback((m: string, tone: 'ok' | 'err' = 'ok') => setToast({ m, tone }), []);

  const [bName, setBName] = useState('');
  const [bLevel, setBLevel] = useState('N5');
  const [bTerm, setBTerm] = useState('');
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<OrgRole | 'all'>('all');
  const [tName, setTName] = useState('');
  const [tEmail, setTEmail] = useState('');
  const [tRole, setTRole] = useState<Exclude<OrgRole, 'owner'>>('teacher');
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [requireCode, setRequireCode] = useState<boolean | null>(null);

  const platformAdmin = !!data?.me.platformAdmin;

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    getAdminSettings()
      .then((s) => setRequireCode(s.signupRequiresCode))
      .catch(() => setRequireCode(null));
  }, [profile?.role]);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const o = await adminOverview();
      setData(o);
      setOrgId((cur) => (cur && o.orgs.some((x) => x.id === cur) ? cur : (o.orgs.find((x) => x.kind === 'institution') ?? o.orgs[0])?.id ?? null));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'err');
    }
  }, [profile, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const org = data?.orgs.find((o) => o.id === orgId) ?? null;
  const roleIn = useMemo(() => {
    const m: Record<string, OrgRole> = {};
    for (const x of data?.members ?? []) if (x.org_id === orgId) m[x.user_id] = x.role;
    return m;
  }, [data, orgId]);
  const orgPeople = useMemo(() => (data?.people ?? []).filter((p) => roleIn[p.id]), [data, roleIn]);
  const batches = useMemo(() => (data?.batches ?? []).filter((b) => b.org_id === orgId), [data, orgId]);
  const teachers = useMemo(() => orgPeople.filter((p) => roleIn[p.id] !== 'student'), [orgPeople, roleIn]);
  const students = useMemo(() => orgPeople.filter((p) => roleIn[p.id] === 'student'), [orgPeople, roleIn]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orgPeople.filter(
      (p) => (roleFilter === 'all' || roleIn[p.id] === roleFilter) && (!q || p.email.toLowerCase().includes(q) || p.full_name.toLowerCase().includes(q))
    );
  }, [orgPeople, query, roleFilter, roleIn]);

  async function submitBatch(e: FormEvent) {
    e.preventDefault();
    if (!bName.trim() || !profile || !orgId) return;
    setBusy(true);
    try {
      const b = await createBatch({ name: bName, level: bLevel, term: bTerm, orgId }, profile.id);
      notify(`${b.name} created — join code ${b.join_code}`);
      setBName('');
      setBTerm('');
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function submitAccount(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    try {
      const r = await createAccount({ email: tEmail, fullName: tName, orgRole: tRole, orgId });
      if (r.tempPassword) setCreated({ email: tEmail, password: r.tempPassword });
      else notify(`${tEmail} already had an account — added to ${org?.name}`);
      setTName('');
      setTEmail('');
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      notify(ok);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'err');
    }
  };

  const tabs: Tab[] = platformAdmin ? ['batches', 'people', 'institutions'] : ['batches', 'people'];
  const counts = { student: students.length, staff: teachers.length };

  return (
    <StaffShell title="Admin panel" jp="管理">
      {/* Institution picker */}
      {data && data.orgs.length > 0 && tab !== 'institutions' && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 mb-4">
          {data.orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => setOrgId(o.id)}
              className={cx(
                'shrink-0 flex items-center gap-2 h-10 pl-3 pr-4 rounded-full border text-sm font-semibold transition',
                o.id === orgId ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-2 hover:border-ink/30'
              )}
            >
              <Icon name={o.kind === 'self' ? 'users' : 'layers'} size={14} />
              {o.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 rounded-full bg-sunken/70 p-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx('h-9 px-5 rounded-full text-sm font-semibold capitalize transition', tab === t ? 'bg-surface shadow-card text-ink' : 'text-ink-3')}
            >
              {t}{' '}
              <span className="opacity-60 tabular">{t === 'batches' ? batches.length : t === 'people' ? orgPeople.length : data?.orgs.length ?? ''}</span>
            </button>
          ))}
        </div>
        {org && tab !== 'institutions' && (
          <span className="text-sm text-ink-3">
            {org.name}: {counts.student} students · {counts.staff} staff
          </span>
        )}
      </div>

      {!data ? (
        <div className="card card-pad text-sm text-ink-3">Loading…</div>
      ) : tab === 'institutions' ? (
        <InstitutionsTab orgs={data.orgs} onChanged={load} notify={notify} />
      ) : tab === 'batches' ? (
        org?.kind === 'self' ? (
          <Empty
            icon="users"
            title="Self-study learners don’t use batches"
            body="People who sign up without a class code land here. They study on their own and can join an institution's batch later with its code, keeping their progress."
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr] items-start">
            <form onSubmit={submitBatch} className="card card-pad space-y-4 lg:sticky lg:top-24">
              <SectionTitle jp="新しいクラス" title="Create a batch" sub={`In ${org?.name ?? 'this institution'}. A join code is generated automatically.`} />
              <label className="block" htmlFor="batch-name">
                <span className="text-sm font-semibold">Batch name</span>
                <input id="batch-name" className="input mt-1.5" placeholder="e.g. N5 Morning — Jan 2027" value={bName} onChange={(e) => setBName(e.target.value)} required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block" htmlFor="batch-level">
                  <span className="text-sm font-semibold">JLPT level</span>
                  <select id="batch-level" className="input mt-1.5" value={bLevel} onChange={(e) => setBLevel(e.target.value)}>
                    {LEVELS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="block" htmlFor="batch-term">
                  <span className="text-sm font-semibold">Term</span>
                  <input id="batch-term" className="input mt-1.5" placeholder="Optional" value={bTerm} onChange={(e) => setBTerm(e.target.value)} />
                </label>
              </div>
              <button className="btn-primary w-full" disabled={busy || !bName.trim()}>
                <Icon name="plus" size={16} /> Create batch
              </button>
              {platformAdmin && requireCode !== null && (
                <div className="border-t border-line/70 pt-4 flex items-start gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Self-study sign-ups</div>
                    <p className="text-xs text-ink-3 mt-0.5">
                      {requireCode ? 'Off: only people with a class join code can create an account.' : 'On: anyone can sign up and learn on their own.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!requireCode}
                    aria-label="Allow self-study sign-ups"
                    onClick={async () => {
                      try {
                        const st = await setSignupRequiresCode(!requireCode);
                        setRequireCode(st.signupRequiresCode);
                        notify(st.signupRequiresCode ? 'Sign-up now needs a class code' : 'Anyone can sign up for self-study now');
                      } catch (err) {
                        notify(err instanceof Error ? err.message : String(err), 'err');
                      }
                    }}
                    className={cx('relative h-7 w-12 shrink-0 rounded-full transition', !requireCode ? 'bg-brand' : 'bg-sunken')}
                  >
                    <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', !requireCode ? 'left-6' : 'left-1')} />
                  </button>
                </div>
              )}
            </form>

            <div className="space-y-4 min-w-0">
              {batches.length === 0 ? (
                <Empty icon="layers" title="No batches yet" body="Create your first batch, assign a teacher, then share its join code with students." />
              ) : (
                batches.map((b) => (
                  <BatchCard
                    key={b.id}
                    batch={b}
                    teachers={teachers}
                    students={students}
                    assigned={(data.people ?? []).filter((t) => data.links.some((l) => l.batch_id === b.id && l.teacher_id === t.id))}
                    count={data.counts[b.id] ?? 0}
                    onChanged={load}
                    notify={notify}
                  />
                ))
              )}
            </div>
          </div>
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr] items-start">
          <div className="space-y-4 lg:sticky lg:top-24">
            {org?.kind === 'institution' && (
              <form onSubmit={submitAccount} className="card card-pad space-y-4">
                <SectionTitle jp="アカウント作成" title="Add a person" sub={`To ${org.name}. New accounts get a temporary password you pass on.`} />
                <label className="block" htmlFor="acct-name">
                  <span className="text-sm font-semibold">Full name</span>
                  <input id="acct-name" className="input mt-1.5" value={tName} onChange={(e) => setTName(e.target.value)} required />
                </label>
                <label className="block" htmlFor="acct-email">
                  <span className="text-sm font-semibold">Email</span>
                  <input id="acct-email" type="email" className="input mt-1.5" value={tEmail} onChange={(e) => setTEmail(e.target.value)} required />
                </label>
                <label className="block" htmlFor="acct-role">
                  <span className="text-sm font-semibold">Role in {org.name}</span>
                  <select id="acct-role" className="input mt-1.5" value={tRole} onChange={(e) => setTRole(e.target.value as Exclude<OrgRole, 'owner'>)}>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Institution admin</option>
                    <option value="student">Student</option>
                  </select>
                </label>
                <button className="btn-primary w-full" disabled={busy}>
                  <Icon name="plus" size={16} /> Add person
                </button>
              </form>
            )}
            {created && <TempPassword created={created} onDone={() => setCreated(null)} />}
          </div>

          <div className="card overflow-hidden min-w-0">
            <div className="p-4 sm:p-5 flex flex-wrap gap-3 border-b border-line/70">
              <div className="relative flex-1 min-w-[200px]">
                <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input id="people-search" className="input pl-10 h-10" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="flex gap-1 rounded-full bg-sunken/70 p-1">
                {(['all', 'student', 'teacher', 'admin', 'owner'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={cx('h-8 px-3 rounded-full text-xs font-semibold capitalize', roleFilter === r ? 'bg-surface shadow-card text-ink' : 'text-ink-3')}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="text-left text-ink-3 text-xs border-b border-line/70">
                    <th className="font-semibold px-5 py-3">Person</th>
                    <th className="font-semibold py-3">Teaches</th>
                    <th className="font-semibold py-3">Joined</th>
                    <th className="font-semibold py-3 pr-5 text-right">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const r = roleIn[p.id];
                    const teaches = data.links
                      .filter((l) => l.teacher_id === p.id)
                      .map((l) => batches.find((b) => b.id === l.batch_id)?.name)
                      .filter(Boolean);
                    const self = p.id === profile?.id;
                    return (
                      <tr key={p.id} className="border-b border-line/50 last:border-0">
                        <td className="px-5 py-3">
                          <div className="font-semibold">
                            {p.full_name || '—'} {self && <span className="text-xs text-ink-3">(you)</span>}
                            {p.role === 'admin' && <span className="ml-1.5 chip bg-brand-soft text-brand py-0.5">Platform admin</span>}
                          </div>
                          <div className="text-xs text-ink-3">{p.email}</div>
                        </td>
                        <td className="py-3 text-xs text-ink-2 max-w-[200px]">
                          {r === 'student' ? <span className="text-ink-3">—</span> : teaches.length ? teaches.join(', ') : <span className="text-ink-3">None</span>}
                        </td>
                        <td className="py-3 text-xs text-ink-3 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="py-3 pr-5 text-right whitespace-nowrap">
                          {!self && (
                            <>
                              <button
                                className="text-xs font-semibold text-ink-3 hover:text-ink mr-3"
                                onClick={async () => {
                                  try {
                                    const { tempPassword } = await resetPassword(p.id);
                                    setCreated({ email: p.email, password: tempPassword });
                                  } catch (err) {
                                    notify(err instanceof Error ? err.message : String(err), 'err');
                                  }
                                }}
                              >
                                Reset password
                              </button>
                              {org?.kind === 'institution' && r !== 'owner' && (
                                <button
                                  className="text-xs font-semibold text-ink-3 hover:text-sakura mr-3"
                                  onClick={() =>
                                    confirm(`Remove ${nameOf(p)} from ${org.name}? They keep their account and progress.`) &&
                                    act(() => removeFromOrg(p.id, org.id), `${nameOf(p)} removed from ${org.name}`)
                                  }
                                >
                                  Remove
                                </button>
                              )}
                              {platformAdmin && (
                                <button
                                  className="text-xs font-semibold text-ink-3 hover:text-ink mr-3"
                                  onClick={() =>
                                    act(
                                      () => setPlatformAdmin(p.id, p.role !== 'admin'),
                                      p.role === 'admin' ? `${nameOf(p)} is no longer a platform admin` : `${nameOf(p)} is now a platform admin`
                                    )
                                  }
                                >
                                  {p.role === 'admin' ? 'Unmake platform admin' : 'Make platform admin'}
                                </button>
                              )}
                            </>
                          )}
                          {r === 'owner' || org?.kind === 'self' ? (
                            <span
                              className="chip capitalize"
                              style={{ background: `rgb(var(--${ROLE_TONE[r]}-soft))`, color: `rgb(var(--${ROLE_TONE[r]}))` }}
                            >
                              {r}
                            </span>
                          ) : (
                            <select
                              id={`role-${p.id}`}
                              value={r}
                              disabled={self}
                              onChange={(e) =>
                                void act(() => setOrgRole(p.id, org!.id, e.target.value as Exclude<OrgRole, 'owner'>), `${nameOf(p)} is now ${e.target.value === 'admin' ? 'an institution admin' : `a ${e.target.value}`}`)
                              }
                              className="h-8 rounded-full border px-3 text-xs font-bold"
                              style={{ background: `rgb(var(--${ROLE_TONE[r]}-soft))`, color: `rgb(var(--${ROLE_TONE[r]}))`, borderColor: 'transparent' }}
                              aria-label={`Role for ${nameOf(p)}`}
                            >
                              <option value="student">Student</option>
                              <option value="teacher">Teacher</option>
                              <option value="admin">Institution admin</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-ink-3">
                        No one matches.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast?.m ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </StaffShell>
  );
}
