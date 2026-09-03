import { createHash, createHmac } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  CLOUD_ROLE_NAMES,
  CLOUD_STALE_MS,
  type CloudPublishSnapshot,
} from '../../../../../api/_lib/ductorCloud.js';
import { type DuctorStatusFile, readDuctorStatusFile } from './ductorStatusFile.js';

const CONFIG_MAX_BYTES = 4 * 1024;
const CLOUD_KEEPALIVE_MS = 30 * 60_000;
const CONFIG_KEYS = new Set([
  'DUCTOR_CLOUD_ORIGIN',
  'DUCTOR_CLOUD_WRITE_SECRET',
  'VERCEL_AUTOMATION_BYPASS_SECRET',
]);

export interface CloudPublisherConfig {
  origin: string;
  writeSecret: string;
  protectionBypassSecret: string;
}

function resolveFileBelowRoot(rootPath: string, filePath: string): string {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(root, filePath);
  const relative = path.relative(root, candidate);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw new Error('publisher config must be below the repository root');
  }
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('publisher root must be a real directory');
  }
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error('publisher config cannot contain symlinks');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw error;
    }
  }
  return candidate;
}

function readBoundedPrivateFile(filePath: string): string {
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > CONFIG_MAX_BYTES || (stat.mode & 0o077) !== 0) {
      throw new Error('publisher config must be a bounded private file');
    }
    return fs.readFileSync(descriptor, 'utf8');
  } finally {
    fs.closeSync(descriptor);
  }
}

export function loadCloudPublisherConfig(
  repositoryRoot: string,
  configFile: string,
): CloudPublisherConfig {
  const raw = readBoundedPrivateFile(resolveFileBelowRoot(repositoryRoot, configFile));
  const parsed = new Map<string, string>();
  for (const line of raw.split(/\r?\n/u)) {
    if (!line) continue;
    const separator = line.indexOf('=');
    const key = separator < 0 ? '' : line.slice(0, separator);
    const value = separator < 0 ? '' : line.slice(separator + 1);
    if (!CONFIG_KEYS.has(key) || !value || parsed.has(key)) {
      throw new Error('invalid publisher config');
    }
    parsed.set(key, value);
  }
  if (parsed.size !== CONFIG_KEYS.size) throw new Error('invalid publisher config');

  const originValue = parsed.get('DUCTOR_CLOUD_ORIGIN') ?? '';
  let origin: URL;
  try {
    origin = new URL(originValue);
  } catch {
    throw new Error('invalid publisher config');
  }
  const writeSecret = parsed.get('DUCTOR_CLOUD_WRITE_SECRET') ?? '';
  const protectionBypassSecret = parsed.get('VERCEL_AUTOMATION_BYPASS_SECRET') ?? '';
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== originValue ||
    !origin.hostname.endsWith('.vercel.app') ||
    !/^[A-Za-z0-9_-]{48,128}$/u.test(writeSecret) ||
    !/^[A-Za-z0-9_-]{32,128}$/u.test(protectionBypassSecret)
  ) {
    throw new Error('invalid publisher config');
  }
  return { origin: origin.origin, writeSecret, protectionBypassSecret };
}

export function buildCloudPublishSnapshot(
  status: DuctorStatusFile | null,
  now: Date,
): CloudPublishSnapshot {
  const publishedAt = now.toISOString();
  return {
    version: 1,
    publishedAt,
    roles: CLOUD_ROLE_NAMES.map((name) => {
      const report = status?.roles[name];
      if (!report) {
        return {
          name,
          presence: 'offline' as const,
          state: 'offline' as const,
          taskLabel: null,
          updatedAt: publishedAt,
          derived: true,
          provenance: 'local-status-file-fallback' as const,
        };
      }
      const reportTime = Date.parse(report.updatedAt);
      if (now.getTime() - reportTime > CLOUD_STALE_MS || reportTime - now.getTime() > 60_000) {
        return {
          name,
          presence: 'offline' as const,
          state: 'offline' as const,
          taskLabel: null,
          updatedAt: report.updatedAt,
          derived: true,
          provenance: 'stale-local-report' as const,
        };
      }
      return {
        name,
        presence: report.state === 'offline' ? ('offline' as const) : ('online' as const),
        state: report.state,
        taskLabel: report.taskLabel ?? null,
        updatedAt: report.updatedAt,
        derived: false,
        provenance: 'operator-agent-reported' as const,
      };
    }),
  };
}

export function snapshotFingerprint(snapshot: CloudPublishSnapshot): string {
  const stableRoles = snapshot.roles.map((role) => ({
    ...role,
    ...(role.derived ? { updatedAt: null } : {}),
  }));
  return createHash('sha256').update(JSON.stringify(stableRoles)).digest('hex');
}

export function shouldPublishCloudSnapshot(
  fingerprint: string,
  previousFingerprint: string | null,
  lastPublishedAt: Date | null,
  now: Date,
): boolean {
  return (
    previousFingerprint === null ||
    fingerprint !== previousFingerprint ||
    lastPublishedAt === null ||
    now.getTime() - lastPublishedAt.getTime() >= CLOUD_KEEPALIVE_MS
  );
}

export function publisherBackoffMs(failureCount: number): number {
  return Math.min(1_000 * 2 ** Math.max(0, failureCount), 30_000);
}

export async function sendCloudSnapshot(
  snapshot: CloudPublishSnapshot,
  config: CloudPublisherConfig,
  options: {
    fetcher?: typeof fetch;
    issuedAt?: number;
    nonce: string;
    timeoutMs?: number;
  },
): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  const issuedAt = options.issuedAt ?? Date.now();
  const body = JSON.stringify(snapshot);
  const signature = createHmac('sha256', config.writeSecret)
    .update(`${issuedAt.toString()}.${options.nonce}.${body}`)
    .digest('hex');
  const response = await fetcher(`${config.origin}/api/ductor/heartbeat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ductor-issued-at': issuedAt.toString(),
      'x-ductor-nonce': options.nonce,
      'x-ductor-signature': signature,
      'x-vercel-protection-bypass': config.protectionBypassSecret,
    },
    body,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(options.timeoutMs ?? 5_000),
  });
  if (!response.ok) throw new Error(`cloud heartbeat rejected (${response.status.toString()})`);
}

export interface CloudPublisherState {
  fingerprint: string | null;
  lastPublishedAt: Date | null;
}

export async function runCloudPublisherCycle(input: {
  config: CloudPublisherConfig;
  fetcher?: typeof fetch;
  nonce: string;
  now: Date;
  repositoryRoot: string;
  state: CloudPublisherState;
  statusFile: string;
}): Promise<CloudPublisherState> {
  const status = readDuctorStatusFile(input.repositoryRoot, input.statusFile);
  const snapshot = buildCloudPublishSnapshot(status, input.now);
  const fingerprint = snapshotFingerprint(snapshot);
  if (
    !shouldPublishCloudSnapshot(
      fingerprint,
      input.state.fingerprint,
      input.state.lastPublishedAt,
      input.now,
    )
  ) {
    return input.state;
  }
  await sendCloudSnapshot(snapshot, input.config, {
    fetcher: input.fetcher,
    issuedAt: input.now.getTime(),
    nonce: input.nonce,
  });
  return { fingerprint, lastPublishedAt: input.now };
}
