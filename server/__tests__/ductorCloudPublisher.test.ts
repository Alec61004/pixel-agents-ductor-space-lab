import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildCloudPublishSnapshot,
  loadCloudPublisherConfig,
  publisherBackoffMs,
  runCloudPublisherCycle,
  sendCloudSnapshot,
  shouldPublishCloudSnapshot,
  snapshotFingerprint,
} from '../src/providers/status/ductor/ductorCloudPublisher.js';

const now = new Date('2026-08-22T06:00:00.000Z');
const observedAt = '2026-08-22T05:59:50.000Z';

let tempRoot: string;

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-cloud-publisher-'));
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

function writeConfig(contents: string): string {
  const configFile = path.join(tempRoot, 'cloud.env');
  fs.writeFileSync(configFile, contents, { mode: 0o600 });
  return configFile;
}

function validConfigText(): string {
  return [
    'DUCTOR_CLOUD_ORIGIN=https://ductor-space-lab-example.vercel.app',
    `DUCTOR_CLOUD_WRITE_SECRET=${'w'.repeat(64)}`,
    `VERCEL_AUTOMATION_BYPASS_SECRET=${'b'.repeat(48)}`,
    '',
  ].join('\n');
}

describe('Ductor cloud publisher', () => {
  it('maps the strict local file to exact public roles and redacts arbitrary source fields', () => {
    const snapshot = buildCloudPublishSnapshot(
      {
        version: 1,
        roles: {
          Alec: { state: 'working', taskLabel: 'Plan launch', updatedAt: observedAt },
          Kevin: { state: 'waiting', taskLabel: 'Await auth', updatedAt: observedAt },
          Benjamin: { state: 'review', taskLabel: 'Review launch', updatedAt: observedAt },
        },
      },
      now,
    );

    expect(snapshot.roles.map((role) => role.name)).toEqual(['Alec', 'Kevin', 'Benjamin']);
    expect(snapshot.roles.map((role) => role.state)).toEqual(['working', 'waiting', 'review']);
    expect(snapshot.roles.every((role) => role.provenance === 'operator-agent-reported')).toBe(
      true,
    );
    expect(JSON.stringify(snapshot)).not.toMatch(/token|secret|prompt|message|result|path/i);
  });

  it('uses honest offline fallbacks for missing and stale local reports', () => {
    const snapshot = buildCloudPublishSnapshot(
      {
        version: 1,
        roles: {
          Alec: {
            state: 'working',
            taskLabel: 'Expired work',
            updatedAt: new Date(now.getTime() - 45 * 60_000 - 1).toISOString(),
          },
        },
      },
      now,
    );

    expect(snapshot.roles.every((role) => role.state === 'offline')).toBe(true);
    expect(snapshot.roles.every((role) => role.taskLabel === null)).toBe(true);
    expect(snapshot.roles[0]?.provenance).toBe('stale-local-report');
    expect(snapshot.roles[1]?.provenance).toBe('local-status-file-fallback');
  });

  it('loads only an explicit bounded non-symlink config with exact keys and safe values', () => {
    const configFile = writeConfig(validConfigText());

    expect(loadCloudPublisherConfig(tempRoot, configFile)).toEqual({
      origin: 'https://ductor-space-lab-example.vercel.app',
      writeSecret: 'w'.repeat(64),
      protectionBypassSecret: 'b'.repeat(48),
    });

    fs.chmodSync(configFile, 0o644);
    expect(() => loadCloudPublisherConfig(tempRoot, configFile)).toThrow();
  });

  it.each([
    ['path escape', () => path.join(tempRoot, '..', 'outside.env')],
    [
      'symlink',
      () => {
        const target = writeConfig(validConfigText());
        const link = path.join(tempRoot, 'link.env');
        fs.symlinkSync(target, link);
        return link;
      },
    ],
    ['oversized', () => writeConfig(`${validConfigText()}${'x'.repeat(4 * 1024)}`)],
    ['unknown property', () => writeConfig(`${validConfigText()}UNRELATED_SECRET=never\n`)],
    ['unsafe URL', () => writeConfig(validConfigText().replace('https://', 'http://'))],
  ])('rejects a %s before publishing', (_name, arrange) => {
    expect(() => loadCloudPublisherConfig(tempRoot, arrange())).toThrow();
  });

  it('sends signed allowlisted JSON with bounded timeout and no origin header', async () => {
    const config = loadCloudPublisherConfig(tempRoot, writeConfig(validConfigText()));
    const snapshot = buildCloudPublishSnapshot(null, now);
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(null, { status: 204 });
    });

    await sendCloudSnapshot(snapshot, config, {
      fetcher,
      issuedAt: now.getTime(),
      nonce: 'c'.repeat(32),
      timeoutMs: 2_000,
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('https://ductor-space-lab-example.vercel.app/api/ductor/heartbeat');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'content-type': 'application/json',
      'x-ductor-issued-at': now.getTime().toString(),
      'x-ductor-nonce': 'c'.repeat(32),
      'x-vercel-protection-bypass': 'b'.repeat(48),
    });
    expect(Object.keys(init?.headers ?? {})).not.toContain('origin');
    expect(JSON.parse(init?.body as string)).toEqual(snapshot);
  });

  it('publishes changes immediately, but bounds unchanged keepalives and retry backoff', () => {
    const initial = buildCloudPublishSnapshot(null, now);
    const fingerprint = snapshotFingerprint(initial);

    expect(shouldPublishCloudSnapshot(fingerprint, null, null, now)).toBe(true);
    expect(shouldPublishCloudSnapshot(fingerprint, fingerprint, now, now)).toBe(false);
    expect(
      shouldPublishCloudSnapshot(
        fingerprint,
        fingerprint,
        now,
        new Date(now.getTime() + 30 * 60_000),
      ),
    ).toBe(true);

    const changed = buildCloudPublishSnapshot(
      {
        version: 1,
        roles: { Alec: { state: 'working', updatedAt: observedAt } },
      },
      now,
    );
    expect(shouldPublishCloudSnapshot(snapshotFingerprint(changed), fingerprint, now, now)).toBe(
      true,
    );
    expect([0, 1, 2, 3, 10].map(publisherBackoffMs)).toEqual([1_000, 2_000, 4_000, 8_000, 30_000]);
  });

  it('re-reads live local changes without restart and skips an unchanged snapshot', async () => {
    const config = loadCloudPublisherConfig(tempRoot, writeConfig(validConfigText()));
    const statusFile = path.join(tempRoot, 'status.json');
    const fetcher = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    );
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        version: 1,
        roles: { Alec: { state: 'working', updatedAt: observedAt } },
      }),
    );

    const first = await runCloudPublisherCycle({
      config,
      fetcher,
      nonce: 'd'.repeat(32),
      now,
      repositoryRoot: tempRoot,
      state: { fingerprint: null, lastPublishedAt: null },
      statusFile,
    });
    await runCloudPublisherCycle({
      config,
      fetcher,
      nonce: 'e'.repeat(32),
      now: new Date(now.getTime() + 5_000),
      repositoryRoot: tempRoot,
      state: first,
      statusFile,
    });
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        version: 1,
        roles: {
          Alec: { state: 'review', updatedAt: new Date(now.getTime() + 6_000).toISOString() },
          Kevin: { state: 'working', updatedAt: new Date(now.getTime() + 6_000).toISOString() },
          Benjamin: { state: 'blocked', updatedAt: new Date(now.getTime() + 6_000).toISOString() },
        },
      }),
    );
    const third = await runCloudPublisherCycle({
      config,
      fetcher,
      nonce: 'f'.repeat(32),
      now: new Date(now.getTime() + 6_000),
      repositoryRoot: tempRoot,
      state: first,
      statusFile,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    const thirdInit = fetcher.mock.calls[1]?.[1];
    const thirdBody = JSON.parse(thirdInit?.body as string) as {
      roles: Array<{ state: string }>;
    };
    expect(thirdBody.roles.map((role) => role.state)).toEqual(['review', 'working', 'blocked']);
    expect(third.fingerprint).not.toBe(first.fingerprint);
  });

  it('does not make a network request for a malformed or symlinked local status file', async () => {
    const config = loadCloudPublisherConfig(tempRoot, writeConfig(validConfigText()));
    const fetcher = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    );
    const target = path.join(tempRoot, 'target.json');
    const statusFile = path.join(tempRoot, 'status.json');
    fs.writeFileSync(target, '{not-json');
    fs.symlinkSync(target, statusFile);

    await expect(
      runCloudPublisherCycle({
        config,
        fetcher,
        nonce: 'd'.repeat(32),
        now,
        repositoryRoot: tempRoot,
        state: { fingerprint: null, lastPublishedAt: null },
        statusFile,
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
