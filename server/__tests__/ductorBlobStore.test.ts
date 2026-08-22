import { BlobNotFoundError } from '@vercel/blob';
import { describe, expect, it, vi } from 'vitest';

import {
  BLOB_STATUS_PATHNAME,
  createBlobCloudStatusStore,
} from '../../api/_lib/ductorBlobStore.js';
import type { CloudStoredEnvelope } from '../../api/_lib/ductorCloud.js';

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

function stream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe('Ductor private Blob store', () => {
  it('reads only the fixed private pathname without CDN cache', async () => {
    const current = envelope();
    const get = vi.fn(async () => ({
      statusCode: 200 as const,
      stream: stream(JSON.stringify(current)),
      blob: { size: JSON.stringify(current).length },
    }));
    const store = createBlobCloudStatusStore({ get, put: vi.fn() });

    await expect(store.read()).resolves.toEqual(current);
    expect(get).toHaveBeenCalledWith(BLOB_STATUS_PATHNAME, {
      access: 'private',
      useCache: false,
    });
  });

  it('writes only a strict envelope to the fixed private pathname', async () => {
    const put = vi.fn(async () => undefined);
    const store = createBlobCloudStatusStore({ get: vi.fn(), put });
    const current = envelope();

    await store.write(current);

    expect(put).toHaveBeenCalledOnce();
    const [pathname, raw, options] = put.mock.calls[0] as unknown as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(pathname).toBe(BLOB_STATUS_PATHNAME);
    expect(JSON.parse(raw)).toEqual(current);
    expect(options).toEqual({
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: 'application/json',
    });
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
    const get = vi.fn(async () => ({
      statusCode: 200 as const,
      stream: stream(raw),
      blob: { size: raw.length },
    }));
    const store = createBlobCloudStatusStore({ get, put: vi.fn() });

    await expect(store.read()).rejects.toThrow('invalid stored status');
  });

  it('returns null only for an explicitly missing blob', async () => {
    const get = vi.fn(async () => {
      throw new BlobNotFoundError();
    });
    const store = createBlobCloudStatusStore({ get, put: vi.fn() });

    await expect(store.read()).resolves.toBeNull();
  });
});
