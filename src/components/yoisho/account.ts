'use client';

import { createContext, useContext } from 'react';
import type { Role } from '@/lib/auth';

export interface Account {
  userId: string;
  name: string;
  email: string;
  role: Role;
  signOut: () => Promise<void>;
  /** Re-reads the student's batches (e.g. after joining one) to update their N5/N4 access. */
  refreshTracks?: () => void;
}

/** Present when the practice app runs for a signed-in user; null in local demo mode. */
export const AccountContext = createContext<Account | null>(null);
export const useAccount = () => useContext(AccountContext);
