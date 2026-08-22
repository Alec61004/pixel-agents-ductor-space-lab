import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  acceptCloudWrite,
  CLOUD_ROLE_NAMES,
  type CloudStoredEnvelope,
  createOfflineCloudSnapshot,
  parseCloudSnapshotText,
  projectCloudStatus,
} from '../../api/_lib/ductorCloud.js';

const now = new Date('2026-08-22T06:00:00.000Z');
const secret = 's'.repeat(64);

function validSnapshot() {
  return {
    version: 1 as const,
    publishedAt: now.toISOString(),
    roles: [
      {
        name: 'Alec' as const,
        presence: 'online' as const,
        state: 'working' as const,
        taskLabel: 'Coordinate launch',
        updatedAt: now.toISOString(),
        derived: false,
        provenance: 'operator-agent-reported' as const,
      },
      {
        name: 'Kevin' as const,
        presence: 'online' as const,
        state: 'waiting' as const,
        taskLabel: 'Await deployment input',
        updatedAt: now.toISOString(),
        derived: false,
        provenance: 'operator-agent-reported' as const,
      },
      {
        name: 'Benjamin' as const,
        presence: 'online' as const,
        state: 'review' as const,
        taskLabel: 'Review security gate',
        updatedAt: now.toISOString(),
        derived: false,
        provenance: 'operator-agent-reported' as const,
      },
    ],
  };
}

function signedWrite(
  snapshot = validSnapshot(),
  issuedAt = now.getTime(),
  nonce = 'a'.repeat(32),
  current: CloudStoredEnvelope | null = null,
) {
  const body = JSON.stringify(snapshot);
  const signature = createHmac('sha256', secret)
    .update(`${issuedAt.toString()}.${nonce}.${body}`)
    .digest('hex');
  return acceptCloudWrite({ body, current, issuedAt, nonce, now, secret, signature });
}

describe('Ductor cloud public contract', () => {
  it('accepts only the exact three roles while preserving simultaneous distinct states', () => {
    const snapshot = parseCloudSnapshotText(JSON.stringify(validSnapshot()));

    expect(snapshot.roles.map((role) => role.name)).toEqual(CLOUD_ROLE_NAMES);
    expect(snapshot.roles.map((role) => role.state)).toEqual(['working', 'waiting', 'review']);
    expect(Object.keys(snapshot.roles[0] ?? {})).toEqual([
      'name',
      'presence',
      'state',
      'taskLabel',
      'updatedAt',
      'derived',
      'provenance',
    ]);
    expect(JSON.stringify(snapshot)).not.toMatch(/token|secret|prompt|message|result|path/i);
  });

  it.each([
    ['top-level property', () => ({ ...validSnapshot(), token: 'never' })],
    [
      'role property',
      () => ({
        ...validSnapshot(),
        roles: validSnapshot().roles.map((role, index) =>
          index === 0 ? { ...role, prompt: 'never' } : role,
        ),
      }),
    ],
    [
      'unknown role',
      () => ({
        ...validSnapshot(),
        roles: validSnapshot().roles.map((role, index) =>
          index === 0 ? { ...role, name: 'Mallory' } : role,
        ),
      }),
    ],
    [
      'unknown state',
      () => ({
        ...validSnapshot(),
        roles: validSnapshot().roles.map((role, index) =>
          index === 0 ? { ...role, state: 'shelling' } : role,
        ),
      }),
    ],
    [
      'unsanitized task label',
      () => ({
        ...validSnapshot(),
        roles: validSnapshot().roles.map((role, index) =>
          index === 0 ? { ...role, taskLabel: 'private\nbody' } : role,
        ),
      }),
    ],
    ['missing role', () => ({ ...validSnapshot(), roles: validSnapshot().roles.slice(0, 2) })],
  ])('rejects an arbitrary or invalid %s', (_name, makeValue) => {
    expect(() => parseCloudSnapshotText(JSON.stringify(makeValue()))).toThrow();
  });

  it('rejects malformed and oversized bodies before accepting data', () => {
    expect(() => parseCloudSnapshotText('{not-json')).toThrow();
    expect(() => parseCloudSnapshotText(' '.repeat(16 * 1024 + 1))).toThrow();
  });

  it('requires a fresh timing-safe HMAC and rejects future or expired requests', () => {
    expect(() => signedWrite()).not.toThrow();

    const body = JSON.stringify(validSnapshot());
    expect(() =>
      acceptCloudWrite({
        body,
        current: null,
        issuedAt: now.getTime(),
        nonce: 'a'.repeat(32),
        now,
        secret,
        signature: '0'.repeat(64),
      }),
    ).toThrow('unauthorized');
    expect(() => signedWrite(validSnapshot(), now.getTime() - 60_001)).toThrow('unauthorized');
    expect(() => signedWrite(validSnapshot(), now.getTime() + 60_001)).toThrow('unauthorized');
  });

  it('persists replay and bounded-write controls across function instances', () => {
    const current = signedWrite();

    expect(() => signedWrite(validSnapshot(), now.getTime(), 'a'.repeat(32), current)).toThrow(
      'conflict',
    );
    expect(() =>
      signedWrite(validSnapshot(), now.getTime() + 500, 'b'.repeat(32), current),
    ).toThrow('rate limited');
    expect(() =>
      signedWrite(validSnapshot(), now.getTime() + 1_000, 'b'.repeat(32), current),
    ).not.toThrow();
  });

  it('projects a missing or stale heartbeat as exactly three derived offline roles', () => {
    const missing = projectCloudStatus(null, now);
    const freshEnvelope = signedWrite();
    const stale = projectCloudStatus(freshEnvelope, new Date(now.getTime() + 45 * 60_000 + 1));

    for (const snapshot of [missing, stale]) {
      expect(snapshot.roles.map((role) => role.name)).toEqual(CLOUD_ROLE_NAMES);
      expect(snapshot.roles.every((role) => role.state === 'offline')).toBe(true);
      expect(snapshot.roles.every((role) => role.presence === 'offline')).toBe(true);
      expect(snapshot.roles.every((role) => role.derived)).toBe(true);
      expect(snapshot.stale).toBe(true);
    }
    expect(JSON.stringify(missing)).not.toMatch(/error|stack|token|secret/i);
  });

  it('creates an honest unavailable snapshot without inventing task activity', () => {
    const snapshot = createOfflineCloudSnapshot(now, 'cloud-unavailable');

    expect(snapshot.roles).toHaveLength(3);
    expect(snapshot.roles.every((role) => role.taskLabel === null)).toBe(true);
    expect(snapshot.roles.every((role) => role.provenance === 'cloud-unavailable')).toBe(true);
  });
});
