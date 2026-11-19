'use client';

import { createContext, useContext } from 'react';

export type Route = 'home' | 'classroom' | 'study' | 'quiz' | 'library' | 'vocab' | 'progress';

export interface NavCtx {
  route: Route;
  param: string | null;
  go: (route: Route, param?: string | null) => void;
}

export const NavContext = createContext<NavCtx>({ route: 'home', param: null, go: () => {} });
export const useNav = () => useContext(NavContext);
