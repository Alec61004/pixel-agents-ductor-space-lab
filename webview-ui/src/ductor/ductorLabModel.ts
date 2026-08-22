import { DUCTOR_ALEC_COLOR, DUCTOR_BENJAMIN_COLOR, DUCTOR_KEVIN_COLOR } from '../constants.js';

export type DuctorRoleName = 'Alec' | 'Kevin' | 'Benjamin';
export type DuctorRoleState = 'idle' | 'working' | 'waiting' | 'review' | 'blocked' | 'offline';

export interface DuctorRoleStatus {
  name: DuctorRoleName;
  presence: 'online' | 'offline';
  state: DuctorRoleState;
  taskLabel: string | null;
  updatedAt: string;
  derived: boolean;
}

export interface DuctorStatusSnapshot {
  theme: 'ductor-space-lab';
  roles: DuctorRoleStatus[];
}

export interface DuctorRoleCard extends DuctorRoleStatus {
  duty: 'Coordinator' | 'Implementer' | 'Reviewer';
  station: 'left' | 'center' | 'right';
  color: string;
  palette: 0 | 3 | 5;
}

const ROLE_PRESENTATION: Record<
  DuctorRoleName,
  Pick<DuctorRoleCard, 'duty' | 'station' | 'color' | 'palette'>
> = {
  Alec: { duty: 'Coordinator', station: 'left', color: DUCTOR_ALEC_COLOR, palette: 0 },
  Kevin: { duty: 'Implementer', station: 'center', color: DUCTOR_KEVIN_COLOR, palette: 3 },
  Benjamin: {
    duty: 'Reviewer',
    station: 'right',
    color: DUCTOR_BENJAMIN_COLOR,
    palette: 5,
  },
};

export function selectScenePreset(
  snapshot: DuctorStatusSnapshot | null,
): 'office' | 'ductor-space-lab' {
  return snapshot?.theme === 'ductor-space-lab' ? 'ductor-space-lab' : 'office';
}

export function createDuctorRoleCards(snapshot: DuctorStatusSnapshot): DuctorRoleCard[] {
  return snapshot.roles.map((role) => ({ ...role, ...ROLE_PRESENTATION[role.name] }));
}

export function isDuctorStatusSnapshot(value: unknown): value is DuctorStatusSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<DuctorStatusSnapshot>;
  if (snapshot.theme !== 'ductor-space-lab' || !Array.isArray(snapshot.roles)) return false;
  const roleNames = snapshot.roles.map((role) => (role as DuctorRoleStatus | undefined)?.name);
  return (
    snapshot.roles.length === 3 &&
    new Set(roleNames).size === 3 &&
    snapshot.roles.every(
      (role) =>
        !!role &&
        typeof role === 'object' &&
        ['Alec', 'Kevin', 'Benjamin'].includes((role as DuctorRoleStatus).name),
    )
  );
}
