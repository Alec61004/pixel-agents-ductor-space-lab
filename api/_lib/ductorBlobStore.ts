import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  get as getBlob,
  type GetCommandOptions,
  put as putBlob,
  type PutBlobResult,
  type PutCommandOptions,
} from '@vercel/blob';

import { type CloudStoredEnvelope, parseCloudSnapshotText } from './ductorCloud.js';
import type { CloudStatusStore } from './ductorHandlers.js';

export const BLOB_STATUS_PATHNAME = 'ductor-space-lab/status.json';
const STORED_STATUS_MAX_BYTES = 32 * 1024;
const STORED_KEYS = new Set(['version', 'issuedAt', 'nonce', 'receivedAt', 'snapshot']);

interface BlobClient {
  get(
    pathname: string,
    options: GetCommandOptions,
  ): Promise<{
    statusCode: 200 | 304;
    stream: ReadableStream<Uint8Array> | null;
    blob: { size: number | null; etag: string };
  } | null>;
  put(pathname: string, body: string, options: PutCommandOptions): Promise<PutBlobResult | void>;
}

const defaultClient: BlobClient = { get: getBlob, put: putBlob };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlobWriteConflict(error: unknown): boolean {
  return (
    error instanceof BlobPreconditionFailedError ||
    (error instanceof Error && error.name === 'BlobAlreadyExistsError')
  );
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

async function readBoundedStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > STORED_STATUS_MAX_BYTES) throw new Error('invalid stored status');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch {
    throw new Error('invalid stored status');
  } finally {
    reader.releaseLock();
  }
}

export function createBlobCloudStatusStore(client: BlobClient = defaultClient): CloudStatusStore {
  async function readStored(): Promise<{
    envelope: CloudStoredEnvelope | null;
    etag: string | null;
  }> {
    try {
      const result = await client.get(BLOB_STATUS_PATHNAME, {
        access: 'private',
        useCache: false,
      });
      if (result === null) return { envelope: null, etag: null };
      if (result.statusCode !== 200 || !result.stream) throw new Error('invalid stored status');
      if (result.blob.size === null || result.blob.size > STORED_STATUS_MAX_BYTES) {
        throw new Error('invalid stored status');
      }
      return {
        envelope: parseStoredEnvelope(await readBoundedStream(result.stream)),
        etag: result.blob.etag,
      };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return { envelope: null, etag: null };
      if (error instanceof Error && error.message === 'invalid stored status') throw error;
      throw new Error('status storage unavailable');
    }
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
      await client.put(BLOB_STATUS_PATHNAME, JSON.stringify(strictEnvelope), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: 'application/json',
      });
    },

    async writeIfCurrent(envelope: CloudStoredEnvelope, etag: string | null): Promise<void> {
      const strictEnvelope = parseStoredEnvelope(JSON.stringify(envelope));
      try {
        await client.put(BLOB_STATUS_PATHNAME, JSON.stringify(strictEnvelope), {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: etag !== null,
          cacheControlMaxAge: 60,
          contentType: 'application/json',
          ...(etag === null ? {} : { ifMatch: etag }),
        });
      } catch (error) {
        if (isBlobWriteConflict(error)) throw new Error('conflict');
        throw error;
      }
    },
  };
}
