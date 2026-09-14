import { createHash } from 'node:crypto';

import {
  type CloudStoredEnvelope,
  parseCloudSnapshotText,
  CLOUD_STATUS_MAX_BYTES,
} from './ductorCloud.js';
import type { CloudStatusStore } from './ductorHandlers.js';

const KEY = 'ductor-space-lab:status';
const env = (name: string): string | undefined => process.env[name];
const url = (): string => env('KV_REST_API_URL') ?? env('UPSTASH_REDIS_REST_URL') ?? '';
const token = (): string => env('KV_REST_API_TOKEN') ?? env('UPSTASH_REDIS_REST_TOKEN') ?? '';

function tag(raw: string): string { return createHash('sha256').update(raw).digest('hex'); }
function valid(raw: unknown): CloudStoredEnvelope {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > CLOUD_STATUS_MAX_BYTES) throw new Error('invalid stored status');
  const value = JSON.parse(raw) as Record<string, unknown>;
  if (value.version !== 1 || typeof value.issuedAt !== 'number' || typeof value.nonce !== 'string' || typeof value.receivedAt !== 'string') throw new Error('invalid stored status');
  return { version: 1, issuedAt: value.issuedAt, nonce: value.nonce, receivedAt: value.receivedAt, snapshot: parseCloudSnapshotText(JSON.stringify(value.snapshot)) };
}
async function command<T>(name: string, ...args: string[]): Promise<T | null> {
  if (!url() || !token()) throw new Error('status storage unavailable');
  const response = await fetch(url(), { method: 'POST', headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' }, body: JSON.stringify([name, ...args]) });
  if (!response.ok) throw new Error('status storage unavailable');
  const body = await response.json() as { result?: T };
  return body.result ?? null;
}
export function createRedisCloudStatusStore(): CloudStatusStore {
  const readStored = async () => {
    const raw = await command<string>('GET', KEY);
    if (!raw) return { envelope: null, etag: null };
    const envelope = valid(raw);
    return { envelope, etag: tag(raw) };
  };
  return {
    async read() { return (await readStored()).envelope; },
    async readForWrite() { return readStored(); },
    async write(envelope) { await command('SET', KEY, JSON.stringify(envelope)); },
    async writeIfCurrent(envelope, etag) {
      const current = await readStored();
      if ((current.etag ?? null) !== (etag ?? null)) throw new Error('conflict');
      await command('SET', KEY, JSON.stringify(envelope));
    },
  };
}
