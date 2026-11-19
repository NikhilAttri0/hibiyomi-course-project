'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { friendlyAuthError } from '@/lib/auth';
import { joinBatch, leaveBatch, myBatches, type Batch } from '@/lib/api';
import { Icon } from './icons';
import { useAccount } from './account';

export default function MyBatches({ userId }: { userId: string }) {
  const [batches, setBatches] = useState<(Batch & { teachers: string[] })[] | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const account = useAccount();

  const load = useCallback(() => {
    myBatches(userId)
      .then(setBatches)
      .catch(() => setBatches([]));
  }, [userId]);

  useEffect(load, [load]);

  async function join(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const name = await joinBatch(code);
      setMsg({ tone: 'ok', text: `Joined ${name}.` });
      setCode('');
      load();
      account?.refreshTracks?.();
    } catch (err) {
      setMsg({ tone: 'err', text: friendlyAuthError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="eyebrow mb-3">My batches</div>
      <div className="rounded-3xl bg-surface border border-line/70 divide-y divide-line/70">
        {batches === null && <div className="p-4 text-sm text-ink-3">Loading…</div>}
        {batches?.length === 0 && <div className="p-4 text-sm text-ink-3">You&apos;re not in a batch yet. Ask your teacher for a join code.</div>}
        {batches?.map((b) => (
          <div key={b.id} className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand text-xs font-extrabold">{b.level}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{b.name}</div>
              <div className="text-xs text-ink-3 truncate">
                {b.teachers.length ? `Teacher: ${b.teachers.join(', ')}` : 'Teacher not assigned yet'}
                {b.term ? ` · ${b.term}` : ''}
              </div>
            </div>
            {leaving === b.id ? (
              <span className="flex gap-1">
                <button className="text-xs font-semibold text-ink-3 px-2" onClick={() => setLeaving(null)}>
                  Cancel
                </button>
                <button
                  className="text-xs font-semibold text-sakura px-2"
                  onClick={async () => {
                    await leaveBatch(userId, b.id).catch(() => undefined);
                    setLeaving(null);
                    load();
                    account?.refreshTracks?.();
                  }}
                >
                  Leave
                </button>
              </span>
            ) : (
              <button className="text-xs font-semibold text-ink-3 hover:text-sakura" onClick={() => setLeaving(b.id)} aria-label={`Leave ${b.name}`}>
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        ))}
        <form onSubmit={join} className="p-4 flex gap-2">
          <input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Join code, e.g. N5-7KQ2XM"
            className="input h-10"
            aria-label="Batch join code"
          />
          <button className="btn-primary btn-sm h-10 shrink-0" disabled={busy || !code.trim()}>
            {busy ? 'Joining…' : 'Join'}
          </button>
        </form>
        {msg && <div className={`px-4 pb-4 text-sm font-medium ${msg.tone === 'ok' ? 'text-matcha' : 'text-sakura'}`}>{msg.text}</div>}
      </div>
    </section>
  );
}
