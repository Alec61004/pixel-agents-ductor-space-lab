import { describe, expect, it, vi } from 'vitest';

import type { CloudStoredEnvelope } from '../../api/_lib/ductorCloud.js';
import { createRedisCloudStatusStore, REDIS_STATUS_KEY } from '../../api/_lib/ductorRedisStore.js';

const now = new Date('2026-08-22T06:00:00.000Z');

function envelope(): CloudStoredEnvelope {
  return {
    version: 1,
    issuedAt: now.getTime(),
    nonce: 'a'.repeat(32),
    receivedAt: now.toISOString(),
    snapshot: {
      version: 1,
      publishedAt: now.toISOString(),
      roles: [
        ['Alec', 'working'],
        ['Kevin', 'waiting'],
        ['Benjamin', 'review'],
      ].map(([name, state]) => ({
        name,
        presence: 'online',
        state,
        taskLabel: `${name} task`,
        updatedAt: now.toISOString(),
        derived: false,
        provenance: 'operator-agent-reported',
      })) as CloudStoredEnvelope['snapshot']['roles'],
    },
  };
}

function etagFor(current: CloudStoredEnvelope): string {
  return `${current.issuedAt.toString()}:${current.nonce}`;
}

describe('Ductor private Redis store', () => {
  it('reads only the fixed key', async () => {
    const current = envelope();
    const get = vi.fn(async () => JSON.stringify(current));
    const store = createRedisCloudStatusStore({ get, set: vi.fn(), cas: vi.fn() });

    await expect(store.read()).resolves.toEqual(current);
    expect(get).toHaveBeenCalledWith(REDIS_STATUS_KEY);
  });

  it('returns null when the key is missing', async () => {
    const get = vi.fn(async () => null);
    const store = createRedisCloudStatusStore({ get, set: vi.fn(), cas: vi.fn() });

    await expect(store.read()).resolves.toBeNull();
  });

  it('writes only a strict envelope via overwrite SET', async () => {
    const set = vi.fn(async () => true);
    const store = createRedisCloudStatusStore({ get: vi.fn(), set, cas: vi.fn() });
    const current = envelope();

    await store.write(current);

    expect(set).toHaveBeenCalledOnce();
    const [key, raw] = set.mock.calls[0] as unknown as [string, string];
    expect(key).toBe(REDIS_STATUS_KEY);
    expect(JSON.parse(raw)).toEqual(current);
  });

  it('uses CAS with the read etag for heartbeat writes', async () => {
    const cas = vi.fn(async () => true);
    const store = createRedisCloudStatusStore({ get: vi.fn(), set: vi.fn(), cas });
    const current = envelope();

    await store.writeIfCurrent(current, etagFor(current));

    expect(cas).toHaveBeenCalledWith(REDIS_STATUS_KEY, etagFor(current), JSON.stringify(current));
  });

  it('uses create-only SET NX when no prior etag exists', async () => {
    const set = vi.fn(async () => true);
    const store = createRedisCloudStatusStore({ get: vi.fn(), set, cas: vi.fn() });

    await store.writeIfCurrent(envelope(), null);

    expect(set).toHaveBeenCalledWith(REDIS_STATUS_KEY, expect.any(String), { nx: true });
  });

  it('normalizes a losing CAS as a conflict', async () => {
    const cas = vi.fn(async () => false);
    const store = createRedisCloudStatusStore({ get: vi.fn(), set: vi.fn(), cas });

    await expect(store.writeIfCurrent(envelope(), '1:a'.repeat(16))).rejects.toThrow('conflict');
  });

  it('normalizes a losing create as a conflict', async () => {
    const set = vi.fn(async () => false);
    const store = createRedisCloudStatusStore({ get: vi.fn(), set, cas: vi.fn() });

    await expect(store.writeIfCurrent(envelope(), null)).rejects.toThrow('conflict');
  });

  it.each([
    ['malformed', '{'],
    ['arbitrary property', JSON.stringify({ ...envelope(), secret: 'never' })],
    [
      'invalid nested snapshot',
      JSON.stringify({
        ...envelope(),
        snapshot: { ...envelope().snapshot, roles: [] },
      }),
    ],
    ['oversized', 'x'.repeat(32 * 1024 + 1)],
  ])('fails closed on %s stored data', async (_name, raw) => {
    const get = vi.fn(async () => raw);
    const store = createRedisCloudStatusStore({ get, set: vi.fn(), cas: vi.fn() });

    await expect(store.read()).rejects.toThrow('invalid stored status');
  });

  it('maps Redis failures to storage unavailable', async () => {
    const get = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const store = createRedisCloudStatusStore({ get, set: vi.fn(), cas: vi.fn() });

    await expect(store.read()).rejects.toThrow('status storage unavailable');
  });
});
