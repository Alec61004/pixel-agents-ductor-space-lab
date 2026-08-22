import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { CloudStoredEnvelope } from '../../api/_lib/ductorCloud.js';
import {
  type CloudStatusStore,
  createCloudHeartbeatHandler,
  createCloudStatusHandler,
} from '../../api/_lib/ductorHandlers.js';

const now = new Date('2026-08-22T06:00:00.000Z');
const secret = 'w'.repeat(64);

function body(): string {
  return JSON.stringify({
    version: 1,
    publishedAt: now.toISOString(),
    roles: [
      ['Alec', 'working', 'Plan'],
      ['Kevin', 'waiting', 'Build'],
      ['Benjamin', 'review', 'QA'],
    ].map(([name, state, taskLabel]) => ({
      name,
      presence: 'online',
      state,
      taskLabel,
      updatedAt: now.toISOString(),
      derived: false,
      provenance: 'operator-agent-reported',
    })),
  });
}

function request(
  options: {
    body?: string;
    issuedAt?: number;
    nonce?: string;
    origin?: string;
    signature?: string;
  } = {},
): Request {
  const raw = options.body ?? body();
  const issuedAt = options.issuedAt ?? now.getTime();
  const nonce = options.nonce ?? 'a'.repeat(32);
  const signature =
    options.signature ??
    createHmac('sha256', secret).update(`${issuedAt.toString()}.${nonce}.${raw}`).digest('hex');
  return new Request('https://ductor-example.vercel.app/api/ductor/heartbeat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ductor-issued-at': issuedAt.toString(),
      'x-ductor-nonce': nonce,
      'x-ductor-signature': signature,
      ...(options.origin ? { origin: options.origin } : {}),
    },
    body: raw,
  });
}

function fakeStore(current: CloudStoredEnvelope | null = null): CloudStatusStore & {
  read: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
} {
  return {
    read: vi.fn(async () => current),
    write: vi.fn(async () => undefined),
  };
}

describe('Ductor cloud handlers', () => {
  it('accepts a valid signed write and persists only the strict envelope', async () => {
    const store = fakeStore();
    const response = await createCloudHeartbeatHandler({
      now: () => now,
      secret,
      store,
    })(request());

    expect(response.status).toBe(204);
    expect(store.write).toHaveBeenCalledOnce();
    const envelope = store.write.mock.calls[0]?.[0] as CloudStoredEnvelope;
    expect(envelope.snapshot.roles.map((role) => role.name)).toEqual(['Alec', 'Kevin', 'Benjamin']);
    expect(JSON.stringify(envelope)).not.toMatch(/token|secret|prompt|message|result|path/i);
  });

  it.each([
    ['wrong method', new Request('https://ductor-example.vercel.app/api/ductor/heartbeat')],
    ['cross-origin browser write', request({ origin: 'https://attacker.example' })],
    [
      'wrong content type',
      new Request('https://ductor-example.vercel.app/api/ductor/heartbeat', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: body(),
      }),
    ],
    ['bad signature', request({ signature: '0'.repeat(64) })],
    ['expired signature', request({ issuedAt: now.getTime() - 60_001 })],
  ])('fails closed for %s without writing', async (_name, candidate) => {
    const store = fakeStore();
    const response = await createCloudHeartbeatHandler({
      now: () => now,
      secret,
      store,
    })(candidate);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(store.write).not.toHaveBeenCalled();
    expect(await response.text()).not.toMatch(/stack|secret|signature|expected|invalid/i);
  });

  it('rejects an oversized declared request before reading or persisting it', async () => {
    const store = fakeStore();
    const oversized = new Request('https://ductor-example.vercel.app/api/ductor/heartbeat', {
      method: 'POST',
      headers: {
        'content-length': (16 * 1024 + 1).toString(),
        'content-type': 'application/json',
      },
      body: '{}',
    });
    const response = await createCloudHeartbeatHandler({ now: () => now, secret, store })(
      oversized,
    );

    expect(response.status).toBe(413);
    expect(store.read).not.toHaveBeenCalled();
    expect(store.write).not.toHaveBeenCalled();
  });

  it('returns stale offline data on missing/storage failure and never exposes write auth', async () => {
    const missingStore = fakeStore();
    const failedStore = fakeStore();
    failedStore.read.mockRejectedValueOnce(new Error('BLOB_READ_WRITE_TOKEN=never'));
    const handler = createCloudStatusHandler({ now: () => now, store: missingStore });
    const failedHandler = createCloudStatusHandler({ now: () => now, store: failedStore });

    for (const response of [
      await handler(new Request('https://ductor-example.vercel.app/api/ductor/status')),
      await failedHandler(new Request('https://ductor-example.vercel.app/api/ductor/status')),
    ]) {
      const snapshot = (await response.json()) as {
        roles: Array<{ state: string }>;
        stale: boolean;
      };
      expect(response.status).toBe(200);
      expect(snapshot.stale).toBe(true);
      expect(snapshot.roles).toHaveLength(3);
      expect(snapshot.roles.every((role) => role.state === 'offline')).toBe(true);
      expect(JSON.stringify(snapshot)).not.toMatch(/never|token|secret|error|stack/i);
    }
  });

  it('sets no-store security headers and enables no cross-origin reads', async () => {
    const response = await createCloudStatusHandler({ now: () => now, store: fakeStore() })(
      new Request('https://ductor-example.vercel.app/api/ductor/status'),
    );

    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
