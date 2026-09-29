import { DuctorLab } from './ductor/DuctorLab.js';
import type { DuctorStatusSnapshot } from './ductor/ductorLabModel.js';
import { useDuctorLabStatus } from './ductor/useDuctorLabStatus.js';

const FALLBACK_DUCTOR_STATUS: DuctorStatusSnapshot = {
  theme: 'ductor-space-lab',
  roles: [
    {
      name: 'Alec',
      presence: 'offline',
      state: 'offline',
      taskLabel: null,
      updatedAt: new Date(0).toISOString(),
      derived: true,
    },
    {
      name: 'Kevin',
      presence: 'offline',
      state: 'offline',
      taskLabel: null,
      updatedAt: new Date(0).toISOString(),
      derived: true,
    },
    {
      name: 'Benjamin',
      presence: 'offline',
      state: 'offline',
      taskLabel: null,
      updatedAt: new Date(0).toISOString(),
      derived: true,
    },
  ],
};

/**
 * This Vercel branch is the dedicated Ductor Space Lab preview.
 * The room must render independently of the live-status endpoint; status
 * availability only changes agent presence/activity.
 */
export function RuntimeRoot() {
  const ductorStatus = useDuctorLabStatus();
  return <DuctorLab snapshot={ductorStatus ?? FALLBACK_DUCTOR_STATUS} />;
}
