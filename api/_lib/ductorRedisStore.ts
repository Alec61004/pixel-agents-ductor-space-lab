import { type CloudStoredEnvelope, parseCloudSnapshotText } from './ductorCloud.js';
import type { CloudStatusStore } from './ductorHandlers.js';

// Server-only Upstash Redis store for Ductor Space Lab live status.
// Env vars (Vercel Serverless only, never expose to webview):
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// Keeps the same CloudStatusStore contract as ductorBlobStore.ts so the
// heartbeat/status handlers stay unchanged. Blob file is kept for rollback.

export const REDIS_STATUS_KEY = 'ductor-space-lab:status.json';
const STORED_STATUS_MAX_BYTES = 32 * 1024;
const STORED_KEYS = new Set(['version', 'issuedAt', 'nonce', 'receivedAt', 'snapshot']);
const REDIS_TTL_SECONDS = 3600;

export interface RedisClient {
  get(key: string): Promise<string | null>;
  /** SET with NX (create-only) or plain overwrite. Returns true when stored. */
  set(key: string, value: string, opts?: { nx?: boolean }): Promise<boolean>;
  /**
   * Atomic compare-and-set: set newValue only when the stored envelope's
   * etag matches expectedEtag. Returns true when stored, false on conflict.
   */
  cas(key: string, expectedEtag: string, newValue: string): Promise<boolean>;
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

async function upstashCall<T>(command: unknown[]): Promise<T> {
  const baseUrl = env('UPSTASH_REDIS_REST_URL')?.replace(/\/+$/, '');
  const token = env('UPSTASH_REDIS_REST_TOKEN');
  if (!baseUrl || !token) throw new Error('status storage unavailable');
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('status storage unavailable');
  const payload = (await response.json()) as { result?: T; error?: string };
  if (payload.error) throw new Error('status storage unavailable');
  return payload.result as T;
}

const CAS_LUA = `local cur = redis.call('GET', KEYS[1])
if not cur then return 0 end
local ok, data = pcall(cjson.decode, cur)
if not ok then return 0 end
if ((data['issuedAt'] .. ':' .. data['nonce']) == ARGV[1]) then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  return 1
else
  return 0
end`;

export const defaultRedisClient: RedisClient = {
  async get(key) {
    const result = await upstashCall<string | null>(['GET', key]);
    return result ?? null;
  },
  async set(key, value, opts) {
    const args: unknown[] = ['SET', key, value, 'EX', REDIS_TTL_SECONDS];
    if (opts?.nx) args.push('NX');
    const result = await upstashCall<string | null>(args);
    return result === 'OK';
  },
  async cas(key, expectedEtag, newValue) {
    const result = await upstashCall<number>([
      'EVAL',
      CAS_LUA,
      '1',
      key,
      expectedEtag,
      newValue,
      String(REDIS_TTL_SECONDS),
    ]);
    return result === 1;
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString() === value ? value : null;
}

function parseStoredEnvelope(raw: string): CloudStoredEnvelope {
  if (Buffer.byteLength(raw) > STORED_STATUS_MAX_BYTES) throw new Error('invalid stored status');
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid stored status');
  }
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !STORED_KEYS.has(key)) ||
    value['version'] !== 1 ||
    !Number.isSafeInteger(value['issuedAt']) ||
    typeof value['nonce'] !== 'string' ||
    !/^[a-f0-9]{32,64}$/u.test(value['nonce']) ||
    !canonicalTimestamp(value['receivedAt'])
  ) {
    throw new Error('invalid stored status');
  }
  let snapshot;
  try {
    snapshot = parseCloudSnapshotText(JSON.stringify(value['snapshot']));
  } catch {
    throw new Error('invalid stored status');
  }
  return {
    version: 1,
    issuedAt: value['issuedAt'] as number,
    nonce: value['nonce'],
    receivedAt: value['receivedAt'] as string,
    snapshot,
  };
}

function etagFor(envelope: CloudStoredEnvelope): string {
  return `${envelope.issuedAt.toString()}:${envelope.nonce}`;
}

export function createRedisCloudStatusStore(
  client: RedisClient = defaultRedisClient,
): CloudStatusStore {
  async function readStored(): Promise<{
    envelope: CloudStoredEnvelope | null;
    etag: string | null;
  }> {
    let raw: string | null;
    try {
      raw = await client.get(REDIS_STATUS_KEY);
    } catch (error) {
      if (error instanceof Error && error.message === 'invalid stored status') throw error;
      throw new Error('status storage unavailable');
    }
    if (raw === null) return { envelope: null, etag: null };
    const envelope = parseStoredEnvelope(raw);
    return { envelope, etag: etagFor(envelope) };
  }

  return {
    async read(): Promise<CloudStoredEnvelope | null> {
      return (await readStored()).envelope;
    },

    async readForWrite(): Promise<{
      envelope: CloudStoredEnvelope | null;
      etag: string | null;
    }> {
      return readStored();
    },

    async write(envelope: CloudStoredEnvelope): Promise<void> {
      const strictEnvelope = parseStoredEnvelope(JSON.stringify(envelope));
      try {
        await client.set(REDIS_STATUS_KEY, JSON.stringify(strictEnvelope));
      } catch {
        throw new Error('status storage unavailable');
      }
    },

    async writeIfCurrent(envelope: CloudStoredEnvelope, etag: string | null): Promise<void> {
      const strictEnvelope = parseStoredEnvelope(JSON.stringify(envelope));
      const raw = JSON.stringify(strictEnvelope);
      try {
        const stored =
          etag === null
            ? await client.set(REDIS_STATUS_KEY, raw, { nx: true })
            : await client.cas(REDIS_STATUS_KEY, etag, raw);
        if (!stored) throw new Error('conflict');
      } catch (error) {
        if (error instanceof Error && error.message === 'conflict') throw error;
        throw new Error('status storage unavailable');
      }
    },
  };
}
