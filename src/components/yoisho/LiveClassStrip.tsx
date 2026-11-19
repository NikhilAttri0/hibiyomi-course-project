'use client';

import { useEffect, useState } from 'react';
import { myClasses, type ClassLink } from '@/lib/classroom-api';
import { useAccount } from './account';
import { LiveClassCard } from './classroom/Classroom';

/** "Join live class" cards on the student home screen (one per batch with a link). */
export default function LiveClassStrip() {
  const account = useAccount();
  const [classes, setClasses] = useState<ClassLink[]>([]);
  useEffect(() => {
    if (!account || account.role !== 'student') return;
    myClasses()
      .then(setClasses)
      .catch(() => undefined);
  }, [account]);
  const live = classes.filter((c) => c.live_url);
  if (!live.length) return null;
  return (
    <div className="space-y-3">
      {live.map((c) => (
        <LiveClassCard key={c.id} compact batchName={c.name} url={c.live_url} note={c.live_note} updatedAt={c.live_updated_at} />
      ))}
    </div>
  );
}
