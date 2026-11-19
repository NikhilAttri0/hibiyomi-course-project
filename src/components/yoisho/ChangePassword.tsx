'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { updateMe } from '@/lib/api';

/** Small form to change your password; used after receiving a temporary one. */
export default function ChangePassword({ onDone }: { onDone?: () => void }) {
  const { refreshProfile } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await updateMe({ currentPassword: current, newPassword: next });
      setMsg({ ok: true, text: 'Password changed.' });
      setCurrent('');
      setNext('');
      await refreshProfile();
      onDone?.();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="flex-1 min-w-[150px]" htmlFor="pw-current">
        <span className="text-xs font-semibold">Current password</span>
        <input id="pw-current" type="password" autoComplete="current-password" className="input h-10 mt-1" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </label>
      <label className="flex-1 min-w-[150px]" htmlFor="pw-new">
        <span className="text-xs font-semibold">New password</span>
        <input id="pw-new" type="password" autoComplete="new-password" minLength={8} className="input h-10 mt-1" value={next} onChange={(e) => setNext(e.target.value)} required />
      </label>
      <button className="btn-primary btn-sm h-10" disabled={busy}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
      {msg && <p className={`w-full text-sm font-medium ${msg.ok ? 'text-matcha' : 'text-sakura'}`}>{msg.text}</p>}
    </form>
  );
}
