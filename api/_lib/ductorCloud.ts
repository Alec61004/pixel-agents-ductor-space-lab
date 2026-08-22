import { createHmac, timingSafeEqual } from 'node:crypto';

export const CLOUD_ROLE_NAMES = ['Alec', 'Kevin', 'Benjamin'] as const;
export const CLOUD_ROLE_STATES = [
  'idle',
  'working',
  'waiting',
  'review',
  'blocked',
  'offline',
] as const;

export const CLOUD_STATUS_MAX_BYTES = 16 * 1024;
export const CLOUD_TASK_LABEL_MAX_CHARS = 120;
export const CLOUD_REQUEST_FRESH_MS = 60_000;
export const CLOUD_MIN_WRITE_INTERVAL_MS = 1_000;
export const CLOUD_STALE_MS = 45 * 60_000;

export type CloudRoleName = (typeof CLOUD_ROLE_NAMES)[number];
export type CloudRoleState = (typeof CLOUD_ROLE_STATES)[number];
export type CloudPublishProvenance =
  'operator-agent-reported' | 'local-status-file-fallback' | 'stale-local-report';
export type CloudPublicProvenance =
  CloudPublishProvenance | 'stale-cloud-heartbeat' | 'cloud-unavailable';

export interface CloudRoleStatus {
  name: CloudRoleName;
  presence: 'online' | 'offline';
  state: CloudRoleState;
  taskLabel: string | null;
  updatedAt: string;
  derived: boolean;
  provenance: CloudPublicProvenance;
}

export interface CloudPublishSnapshot {
  version: 1;
  publishedAt: string;
  roles: Array<CloudRoleStatus & { provenance: CloudPublishProvenance }>;
}

export interface CloudStatusSnapshot {
  theme: 'ductor-space-lab';
  publishedAt: string;
  stale: boolean;
  roles: CloudRoleStatus[];
}

export interface CloudStoredEnvelope {
  version: 1;
  issuedAt: number;
  nonce: string;
  receivedAt: string;
  snapshot: CloudPublishSnapshot;
}

const PUBLISH_KEYS = new Set(['version', 'publishedAt', 'roles']);
const ROLE_KEYS = new Set([
  'name',
  'presence',
  'state',
  'taskLabel',
  'updatedAt',
  'derived',
  'provenance',
]);
const PUBLISH_PROVENANCE = new Set<CloudPublishProvenance>([
  'operator-agent-reported',
  'local-status-file-fallback',
  'stale-local-report',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function canonicalTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  const canonical = new Date(parsed).toISOString();
  return value === canonical ? canonical : null;
}

function sanitizedTaskLabel(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, CLOUD_TASK_LABEL_MAX_CHARS);
  return sanitized === value && sanitized.length > 0 ? sanitized : undefined;
}

function parseCloudRole(
  value: unknown,
  expectedName: CloudRoleName,
): CloudPublishSnapshot['roles'][number] {
  if (!isRecord(value) || !hasOnlyKeys(value, ROLE_KEYS)) {
    throw new Error('invalid cloud status');
  }
  const state = value['state'];
  const presence = value['presence'];
  const provenance = value['provenance'];
  const updatedAt = canonicalTimestamp(value['updatedAt']);
  const taskLabel = sanitizedTaskLabel(value['taskLabel']);
  if (
    value['name'] !== expectedName ||
    typeof state !== 'string' ||
    !(CLOUD_ROLE_STATES as readonly string[]).includes(state) ||
    (presence !== 'online' && presence !== 'offline') ||
    typeof provenance !== 'string' ||
    !PUBLISH_PROVENANCE.has(provenance as CloudPublishProvenance) ||
    typeof value['derived'] !== 'boolean' ||
    !updatedAt ||
    taskLabel === undefined
  ) {
    throw new Error('invalid cloud status');
  }
  const derived = value['derived'];
  if (
    (state === 'offline') !== (presence === 'offline') ||
    (provenance === 'operator-agent-reported') === derived
  ) {
    throw new Error('invalid cloud status');
  }
  return {
    name: expectedName,
    presence,
    state: state as CloudRoleState,
    taskLabel,
    updatedAt,
    derived,
    provenance: provenance as CloudPublishProvenance,
  };
}

export function parseCloudSnapshotText(raw: string): CloudPublishSnapshot {
  if (Buffer.byteLength(raw) > CLOUD_STATUS_MAX_BYTES) throw new Error('invalid cloud status');
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid cloud status');
  }
  if (!isRecord(value) || !hasOnlyKeys(value, PUBLISH_KEYS)) {
    throw new Error('invalid cloud status');
  }
  const publishedAt = canonicalTimestamp(value['publishedAt']);
  const rawRoles = value['roles'];
  if (value['version'] !== 1 || !publishedAt || !Array.isArray(rawRoles)) {
    throw new Error('invalid cloud status');
  }
  if (rawRoles.length !== CLOUD_ROLE_NAMES.length) {
    throw new Error('invalid cloud status');
  }
  return {
    version: 1,
    publishedAt,
    roles: CLOUD_ROLE_NAMES.map((name, index) => parseCloudRole(rawRoles[index], name)),
  };
}

function unauthorized(): never {
  throw new Error('unauthorized');
}

function verifySignature(
  secret: string,
  issuedAt: number,
  nonce: string,
  body: string,
  signature: string,
): void {
  if (
    secret.length < 32 ||
    !Number.isSafeInteger(issuedAt) ||
    !/^[a-f0-9]{32,64}$/u.test(nonce) ||
    !/^[a-f0-9]{64}$/u.test(signature)
  ) {
    unauthorized();
  }
  const expected = createHmac('sha256', secret)
    .update(`${issuedAt.toString()}.${nonce}.${body}`)
    .digest();
  const provided = Buffer.from(signature, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) unauthorized();
}

export function acceptCloudWrite(input: {
  body: string;
  current: CloudStoredEnvelope | null;
  issuedAt: number;
  nonce: string;
  now: Date;
  secret: string;
  signature: string;
}): CloudStoredEnvelope {
  if (Buffer.byteLength(input.body) > CLOUD_STATUS_MAX_BYTES) {
    throw new Error('invalid cloud status');
  }
  verifySignature(input.secret, input.issuedAt, input.nonce, input.body, input.signature);
  if (Math.abs(input.now.getTime() - input.issuedAt) > CLOUD_REQUEST_FRESH_MS) unauthorized();

  const snapshot = parseCloudSnapshotText(input.body);
  if (Math.abs(Date.parse(snapshot.publishedAt) - input.issuedAt) > 1_000) {
    throw new Error('invalid cloud status');
  }
  if (
    input.current &&
    (input.nonce === input.current.nonce || input.issuedAt <= input.current.issuedAt)
  ) {
    throw new Error('conflict');
  }
  if (input.current && input.issuedAt - input.current.issuedAt < CLOUD_MIN_WRITE_INTERVAL_MS) {
    throw new Error('rate limited');
  }
  return {
    version: 1,
    issuedAt: input.issuedAt,
    nonce: input.nonce,
    receivedAt: input.now.toISOString(),
    snapshot,
  };
}

export function createOfflineCloudSnapshot(
  now: Date,
  provenance: Extract<CloudPublicProvenance, 'stale-cloud-heartbeat' | 'cloud-unavailable'>,
): CloudStatusSnapshot {
  const updatedAt = now.toISOString();
  return {
    theme: 'ductor-space-lab',
    publishedAt: updatedAt,
    stale: true,
    roles: CLOUD_ROLE_NAMES.map((name) => ({
      name,
      presence: 'offline',
      state: 'offline',
      taskLabel: null,
      updatedAt,
      derived: true,
      provenance,
    })),
  };
}

export function projectCloudStatus(
  envelope: CloudStoredEnvelope | null,
  now: Date,
): CloudStatusSnapshot {
  if (!envelope) return createOfflineCloudSnapshot(now, 'cloud-unavailable');
  if (now.getTime() - Date.parse(envelope.receivedAt) > CLOUD_STALE_MS) {
    return createOfflineCloudSnapshot(now, 'stale-cloud-heartbeat');
  }
  return {
    theme: 'ductor-space-lab',
    publishedAt: envelope.snapshot.publishedAt,
    stale: false,
    roles: envelope.snapshot.roles.map((role) => ({ ...role })),
  };
}
