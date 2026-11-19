'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLearn } from '@/lib/learn-store';
import { myClasses, studentReportPage, type ClassLink } from '@/lib/classroom-api';
import { useAccount } from '../account';
import { Icon } from '../icons';
import Classroom from '../classroom/Classroom';
import { useNav } from '../nav';
import { Empty, cx } from '../ui';

/** Kanji-practice progress from the student's own review/quiz log. */
export function usePracticeAdapter() {
  const s = useLearn();
  const { go } = useNav();
  const status = useCallback(
    (ids: string[], since: string) => {
      const from = Date.parse(since) || 0;
      const touched = new Set(s.log.filter((e) => e.ts >= from).map((e) => e.kanjiId));
      return { done: ids.filter((id) => touched.has(id)).length, total: ids.length };
    },
    [s.log]
  );
  const start = useCallback((ids: string[]) => go('study', `k:${ids.join(',')}`), [go]);
  return useMemo(() => ({ status, start }), [status, start]);
}

export default function ClassroomView() {
  const [classes, setClasses] = useState<ClassLink[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const practice = usePracticeAdapter();
  const account = useAccount();

  useEffect(() => {
    myClasses()
      .then((c) => {
        setClasses(c);
        setBatchId((cur) => cur ?? c[0]?.id ?? null);
      })
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="card card-pad text-sm text-sakura">{err}</div>;
  if (!classes) return <div className="card card-pad text-sm text-ink-3">Loading your classes…</div>;
  if (!classes.length)
    return (
      <Empty
        icon="users"
        title="Join a batch to see your classroom"
        body="Ask your teacher for the batch join code, then add it under Settings → My batches."
      />
    );

  return (
    <div className="space-y-5">
      {classes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => setBatchId(c.id)}
              className={cx(
                'shrink-0 flex items-center gap-2 h-10 pl-2 pr-4 rounded-full border text-sm font-semibold transition',
                c.id === batchId ? 'bg-ink text-canvas border-ink' : 'bg-surface border-line text-ink-2'
              )}
            >
              <span className="grid h-7 min-w-[28px] px-1 place-items-center rounded-full bg-brand-soft text-brand text-[11px] font-extrabold">{c.level}</span>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {batchId && <Classroom batchId={batchId} practice={practice} />}
      {batchId && account?.role === 'student' && (
        <div className="flex justify-end">
          <a className="btn-ghost btn-sm" href={studentReportPage(batchId, account.userId)} target="_blank" rel="noopener noreferrer">
            <Icon name="printer" size={14} /> My progress report
          </a>
        </div>
      )}
    </div>
  );
}
