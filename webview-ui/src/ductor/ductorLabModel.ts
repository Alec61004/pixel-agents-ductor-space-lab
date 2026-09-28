import { DUCTOR_ALEC_COLOR, DUCTOR_BENJAMIN_COLOR, DUCTOR_KEVIN_COLOR } from '../constants.js';

export type DuctorRoleName = 'Alec' | 'Kevin' | 'Benjamin';
export type DuctorRoleState = 'idle' | 'working' | 'waiting' | 'review' | 'blocked' | 'offline';
export type DuctorStatusProvenance =
  | 'operator-agent-reported'
  | 'local-status-file-fallback'
  | 'stale-local-report'
  | 'stale-cloud-heartbeat'
  | 'cloud-unavailable';

export type DuctorObservationTab = 'code' | 'terminal' | 'browser';

export interface DuctorObservationFeed {
  title: string;
  content: string;
  updatedAt: string;
}

export interface DuctorRoleObservation {
  feeds: Partial<Record<DuctorObservationTab, DuctorObservationFeed>>;
}

export interface DuctorRoleStatus {
  name: DuctorRoleName;
  presence: 'online' | 'offline';
  state: DuctorRoleState;
  taskLabel: string | null;
  updatedAt: string;
  derived: boolean;
  provenance?: DuctorStatusProvenance;
  /** Explicitly shared live code, terminal, or browser evidence. */
  observation?: DuctorRoleObservation;
}

export interface DuctorStatusSnapshot {
  theme: 'ductor-space-lab';
  publishedAt?: string;
  stale?: boolean;
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  const isCloud = 'publishedAt' in snapshot || 'stale' in snapshot;
  const topKeys = isCloud
    ? new Set(['theme', 'publishedAt', 'stale', 'roles'])
    : new Set(['theme', 'roles']);
  if (
    Object.keys(snapshot).some((key) => !topKeys.has(key)) ||
    snapshot['theme'] !== 'ductor-space-lab' ||
    !Array.isArray(snapshot['roles']) ||
    snapshot['roles'].length !== 3
  ) {
    return false;
  }
  if (
    isCloud &&
    (typeof snapshot['stale'] !== 'boolean' || !isCanonicalTimestamp(snapshot['publishedAt']))
  ) {
    return false;
  }
  const expectedNames: DuctorRoleName[] = ['Alec', 'Kevin', 'Benjamin'];
  return snapshot['roles'].every((role, index) =>
    isDuctorRoleStatus(role, expectedNames[index], isCloud),
  );
}

const ROLE_STATES = new Set<DuctorRoleState>([
  'idle',
  'working',
  'waiting',
  'review',
  'blocked',
  'offline',
]);
const PROVENANCE = new Set<DuctorStatusProvenance>([
  'operator-agent-reported',
  'local-status-file-fallback',
  'stale-local-report',
  'stale-cloud-heartbeat',
  'cloud-unavailable',
]);

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
}

function isTaskLabel(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 120 &&
      value.trim() === value &&
      ![...value].some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 31 || codePoint === 127;
      }))
  );
}

function isDuctorRoleStatus(
  value: unknown,
  expectedName: DuctorRoleName | undefined,
  isCloud: boolean,
): value is DuctorRoleStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const role = value as Record<string, unknown>;
  const roleKeys = isCloud
    ? new Set(['name', 'presence', 'state', 'taskLabel', 'updatedAt', 'derived', 'provenance', 'observation'])
    : new Set(['name', 'presence', 'state', 'taskLabel', 'updatedAt', 'derived']);
  if (Object.keys(role).some((key) => !roleKeys.has(key))) return false;
  const state = role['state'];
  const presence = role['presence'];
  const derived = role['derived'];
  if (
    role['name'] !== expectedName ||
    typeof state !== 'string' ||
    !ROLE_STATES.has(state as DuctorRoleState) ||
    (presence !== 'online' && presence !== 'offline') ||
    (state === 'offline') !== (presence === 'offline') ||
    !isTaskLabel(role['taskLabel']) ||
    !isCanonicalTimestamp(role['updatedAt']) ||
    typeof derived !== 'boolean'
  ) {
    return false;
  }
  if (!isCloud) return true;
  const provenance = role['provenance'];
  return (
    typeof provenance === 'string' &&
    PROVENANCE.has(provenance as DuctorStatusProvenance) &&
    (provenance === 'operator-agent-reported') !== derived &&
    isDuctorObservation(role['observation'])
  );
}

function isDuctorObservation(value: unknown): value is DuctorRoleObservation | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const observation = value as Record<string, unknown>;
  if (Object.keys(observation).length !== 1 || !('feeds' in observation)) return false;
  const feeds = observation['feeds'];
  if (!feeds || typeof feeds !== 'object' || Array.isArray(feeds)) return false;
  const allowedTabs = new Set<DuctorObservationTab>(['code', 'terminal', 'browser']);
  const entries = Object.entries(feeds);
  if (entries.length === 0 || entries.some(([tab]) => !allowedTabs.has(tab as DuctorObservationTab))) {
    return false;
  }
  return entries.every(([, feed]) => {
    if (!feed || typeof feed !== 'object' || Array.isArray(feed)) return false;
    const candidate = feed as Record<string, unknown>;
    return (
      Object.keys(candidate).length === 3 &&
      typeof candidate['title'] === 'string' &&
      candidate['title'].length > 0 &&
      candidate['title'].length <= 96 &&
      candidate['title'].trim() === candidate['title'] &&
      typeof candidate['content'] === 'string' &&
      candidate['content'].length > 0 &&
      candidate['content'].length <= 1_536 &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(candidate['content']) &&
      isCanonicalTimestamp(candidate['updatedAt'])
    );
  });
}
