'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { loadMyState, logReviewEvent, myBatches, saveMyState } from '@/lib/api';
import { LearnStoreProvider, parseState, trackForLevel, type PersistedState, type RemoteSync, type Track } from '@/lib/learn-store';
import AppShell from './AppShell';
import ClientApp from './ClientApp';
import Guard, { Splash } from './auth/Guard';
import { AccountContext } from './account';

function SignedInPractice() {
  const { profile, signOut } = useAuth();
  const [initial, setInitial] = useState<PersistedState | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const userId = profile!.id;
  const [tracks, setTracks] = useState<Track[] | null>(null);

  // Students in a class study their batch level(s); self-study learners, teachers and admins can open both levels.
  const loadTracks = useCallback(() => {
    if (profile!.role !== 'student') {
      setTracks(['N5', 'N4']);
      return;
    }
    myBatches(userId)
      .then((bs) => {
        const t = Array.from(new Set(bs.map((b) => trackForLevel(b.level)))).sort().reverse() as Track[]; // N5 before N4
        // Self-study learners (no class yet) choose their own level: both N5 and N4 are open.
        setTracks(t.length ? t : ['N5', 'N4']);
      })
      .catch(() => setTracks(['N5', 'N4']));
  }, [profile, userId]);

  useEffect(loadTracks, [loadTracks]);

  useEffect(() => {
    let alive = true;
    loadMyState(userId)
      .then((s) => alive && setInitial(parseState(s)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [userId]);

  const remote = useMemo<RemoteSync | undefined>(
    () =>
      initial === undefined
        ? undefined
        : {
            userId,
            name: profile!.full_name || profile!.email.split('@')[0],
            initial,
            save: (state, summary) => saveMyState(userId, state, summary),
            logEvent: (e) => logReviewEvent(userId, e),
          },
    [initial, userId, profile]
  );

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="card card-pad max-w-md text-center">
          <h2 className="font-bold text-lg">Couldn&apos;t load your progress</h2>
          <p className="text-sm text-ink-3 mt-2">{error}</p>
          <button className="btn-primary mt-5" onClick={() => location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!remote || !tracks) return <Splash label="Loading your progress…" />;

  return (
    <AccountContext.Provider
      value={{ userId, name: remote.name, email: profile!.email, role: profile!.role, signOut, refreshTracks: loadTracks }}
    >
      <LearnStoreProvider remote={remote} tracks={tracks}>
        <AppShell />
      </LearnStoreProvider>
    </AccountContext.Provider>
  );
}

export default function StudentApp() {
  const { configured } = useAuth();
  if (!configured) return <ClientApp />; // local demo without a backend
  return (
    <Guard>
      <SignedInPractice />
    </Guard>
  );
}
