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
  portrait: {
    id: 'purple-commander' | 'cyan-engineer' | 'red-sentinel';
    asset: 'themes/ductor-space-lab/crew-sprites.webp';
    position: string;
  };
}

const ROLE_PRESENTATION: Record<
  DuctorRoleName,
  Pick<DuctorRoleCard, 'duty' | 'station' | 'color' | 'portrait'>
> = {
  Alec: {
    duty: 'Coordinator',
    station: 'left',
    color: DUCTOR_ALEC_COLOR,
    portrait: {
      id: 'purple-commander',
      asset: 'themes/ductor-space-lab/crew-sprites.webp',
      position: '53.333% 0%',
    },
  },
  Kevin: {
    duty: 'Implementer',
    station: 'center',
    color: DUCTOR_KEVIN_COLOR,
    portrait: {
      id: 'cyan-engineer',
      asset: 'themes/ductor-space-lab/crew-sprites.webp',
      position: '0% 28.571%',
    },
  },
  Benjamin: {
    duty: 'Reviewer',
    station: 'right',
    color: DUCTOR_BENJAMIN_COLOR,
    portrait: {
      id: 'red-sentinel',
      asset: 'themes/ductor-space-lab/crew-sprites.webp',
      position: '0% 0%',
    },
  },
};

export function selectScenePreset(
  snapshot: DuctorStatusSnapshot | null,
): 'office' | 'ductor-space-lab' {
  return snapshot?.theme === 'ductor-space-lab' ? 'ductor-space-lab' : 'office';
}

export function selectRuntimeSurface(
  snapshot: DuctorStatusSnapshot | null | undefined,
): 'checking' | 'office' | 'ductor-space-lab' {
  if (snapshot === undefined) return 'checking';
  return selectScenePreset(snapshot);
}

export function createDuctorRoleCards(snapshot: DuctorStatusSnapshot): DuctorRoleCard[] {
  return snapshot.roles.map((role) => ({ ...role, ...ROLE_PRESENTATION[role.name] }));
}

export function ductorAssetUrl(baseUrl: string, relativePath: string): string {
  const normalizedBase = baseUrl === './' ? '/' : `${baseUrl.replace(/\/?$/, '/')}`;
  return `${normalizedBase}assets/${relativePath.replace(/^\/+/, '')}`;
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
