import { useEffect, useState } from 'react';

import { type DuctorStatusSnapshot, isDuctorStatusSnapshot } from './ductorLabModel.js';

const VISIBLE_STATUS_POLL_MS = 5_000;
const HIDDEN_STATUS_POLL_MS = 60_000;
const MAX_CONSECUTIVE_FAILURES = 3;

export function useDuctorLabStatus(): DuctorStatusSnapshot | null | undefined {
  const [snapshot, setSnapshot] = useState<DuctorStatusSnapshot | null | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;
    let failureCount = 0;

    const schedule = (): void => {
      if (disposed) return;
      timer = window.setTimeout(
        () => void refresh(),
        document.visibilityState === 'visible' ? VISIBLE_STATUS_POLL_MS : HIDDEN_STATUS_POLL_MS,
      );
    };

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch('/api/ductor/status', { cache: 'no-store' });
        if (!response.ok) {
          failureCount++;
          if (!disposed) {
            if (failureCount >= MAX_CONSECUTIVE_FAILURES) {
              setSnapshot(null);
            } else {
              setSnapshot((current) => (current === undefined ? null : current));
            }
          }
          return;
        }
        const candidate: unknown = await response.json();
        if (!disposed) {
          if (isDuctorStatusSnapshot(candidate)) {
            failureCount = 0;
            setSnapshot(candidate);
          } else {
            failureCount++;
            if (failureCount >= MAX_CONSECUTIVE_FAILURES) {
              setSnapshot(null);
            } else {
              setSnapshot((current) => (current === undefined ? null : current));
            }
          }
        }
      } catch {
        // Upstream office and Vite mock modes intentionally have no Ductor endpoint.
        failureCount++;
        if (!disposed) {
          if (failureCount >= MAX_CONSECUTIVE_FAILURES) {
            setSnapshot(null);
          } else {
            setSnapshot((current) => (current === undefined ? null : current));
          }
        }
      } finally {
        schedule();
      }
    };

    const refreshWhenVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      if (timer !== null) window.clearTimeout(timer);
      void refresh();
    };

    void refresh();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  return snapshot;
}
