import { useEffect, useState } from 'react';

import {
  type DuctorStatusSnapshot,
  expireStaleDuctorActivity,
  isDuctorStatusSnapshot,
} from './ductorLabModel.js';

const VISIBLE_STATUS_POLL_MS = 5_000;
const HIDDEN_STATUS_POLL_MS = 60_000;

export function useDuctorLabStatus(): DuctorStatusSnapshot | null | undefined {
  const [snapshot, setSnapshot] = useState<DuctorStatusSnapshot | null | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;

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
          if (!disposed) setSnapshot((current) => (current === undefined ? null : current));
          return;
        }
        const candidate: unknown = await response.json();
        if (!disposed && isDuctorStatusSnapshot(candidate)) {
          setSnapshot(expireStaleDuctorActivity(candidate));
        }
      } catch {
        // Upstream office and Vite mock modes intentionally have no Ductor endpoint.
        if (!disposed) setSnapshot((current) => (current === undefined ? null : current));
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
