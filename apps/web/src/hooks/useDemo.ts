import { useSyncExternalStore } from 'react';
import { getDemoRemaining, isDemo, subscribeAccess, subscribeDemoRemaining } from '../api/access';

/** True while the app runs on a public demo token. */
export function useIsDemo(): boolean {
  return useSyncExternalStore(subscribeAccess, isDemo);
}

export function useDemoRemaining(): number | null {
  return useSyncExternalStore(subscribeDemoRemaining, getDemoRemaining);
}
