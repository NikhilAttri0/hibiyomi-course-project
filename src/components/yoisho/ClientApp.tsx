'use client';

import { Component, type ReactNode } from 'react';
import { LearnStoreProvider } from '@/lib/learn-store';
import AppShell from './AppShell';

/** Shows a readable message instead of a blank or frozen screen if anything in the app throws. */
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="card card-pad max-w-md text-center">
          <h2 className="text-lg font-bold">Something went wrong</h2>
          <p className="text-sm text-ink-3 mt-2 break-words">{this.state.error.message}</p>
          <button
            className="btn-primary mt-5"
            onClick={() => {
              try {
                localStorage.removeItem('yoisho_learn_state_v3');
              } catch {
                /* ignore */
              }
              location.reload();
            }}
          >
            Reset and reload
          </button>
        </div>
      </div>
    );
  }
}

export default function ClientApp() {
  return (
    <AppErrorBoundary>
      <LearnStoreProvider>
        <AppShell />
      </LearnStoreProvider>
    </AppErrorBoundary>
  );
}
