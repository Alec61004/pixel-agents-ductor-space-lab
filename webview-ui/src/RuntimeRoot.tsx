import { DuctorLab } from './ductor/DuctorLab.js';
import type { DuctorStatusSnapshot } from './ductor/ductorLabModel.js';
import { useDuctorLabStatus } from './ductor/useDuctorLabStatus.js';

const OFFLINE_FALLBACK: DuctorStatusSnapshot = {
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

export function RuntimeRoot() {
  const ductorStatus = useDuctorLabStatus();
  return <DuctorLab snapshot={ductorStatus ?? OFFLINE_FALLBACK} />;
}
