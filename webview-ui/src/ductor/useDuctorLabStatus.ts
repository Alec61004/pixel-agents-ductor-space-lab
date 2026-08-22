import { useEffect, useState } from 'react';

import { type DuctorStatusSnapshot, isDuctorStatusSnapshot } from './ductorLabModel.js';

const STATUS_POLL_MS = 2_000;

export function useDuctorLabStatus(): DuctorStatusSnapshot | null | undefined {
  const [snapshot, setSnapshot] = useState<DuctorStatusSnapshot | null | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    let interval: number | null = null;

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch('/api/ductor/status', { cache: 'no-store' });
        if (!response.ok) {
          if (!disposed) setSnapshot((current) => (current === undefined ? null : current));
          return;
        }
        const candidate: unknown = await response.json();
        if (!disposed && isDuctorStatusSnapshot(candidate)) {
          setSnapshot(candidate);
          interval ??= window.setInterval(() => void refresh(), STATUS_POLL_MS);
        }
      } catch {
        // Upstream office and Vite mock modes intentionally have no Ductor endpoint.
        if (!disposed) setSnapshot((current) => (current === undefined ? null : current));
      }
    };

    void refresh();
    return () => {
      disposed = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, []);

  return snapshot;
}
