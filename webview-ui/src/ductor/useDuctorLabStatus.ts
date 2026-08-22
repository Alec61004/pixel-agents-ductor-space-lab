import { useEffect, useState } from 'react';

import { type DuctorStatusSnapshot, isDuctorStatusSnapshot } from './ductorLabModel.js';

const STATUS_POLL_MS = 2_000;

export function useDuctorLabStatus(): DuctorStatusSnapshot | null {
  const [snapshot, setSnapshot] = useState<DuctorStatusSnapshot | null>(null);

  useEffect(() => {
    let disposed = false;
    let interval: number | null = null;

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch('/api/ductor/status', { cache: 'no-store' });
        if (!response.ok) return;
        const candidate: unknown = await response.json();
        if (!disposed && isDuctorStatusSnapshot(candidate)) {
          setSnapshot(candidate);
          interval ??= window.setInterval(() => void refresh(), STATUS_POLL_MS);
        }
      } catch {
        // Upstream office and Vite mock modes intentionally have no Ductor endpoint.
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
