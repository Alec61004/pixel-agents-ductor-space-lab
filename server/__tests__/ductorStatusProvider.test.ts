import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DuctorStatusProvider,
  mapDuctorState,
  normalizeDuctorRoles,
} from '../src/providers/status/ductor/ductorStatusProvider.js';

const observedAt = '2026-08-22T05:30:00.000Z';

let tempRoot: string;
let statusFile: string;

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-ductor-status-'));
  statusFile = path.join(tempRoot, 'status.json');
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

function writeStatus(value: unknown): void {
  fs.writeFileSync(statusFile, JSON.stringify(value));
}

describe('Ductor status normalization', () => {
  it('uses only documented workspace paths and whitelisted status variables', () => {
    const observedPaths: string[] = [];
    const provider = new DuctorStatusProvider({
      env: {
        DUCTOR_HOME: '/safe/ductor',
        PIXEL_AGENTS_DUCTOR_ALEC_STATE: 'working',
        PIXEL_AGENTS_DUCTOR_ALEC_TASK: 'Verify Space Lab',
        PIXEL_AGENTS_DUCTOR_ALEC_UPDATED_AT: observedAt,
      },
      exists: (filePath) => {
        observedPaths.push(filePath);
        return true;
      },
      now: () => new Date(observedAt),
    });

    const result = provider.snapshot();

    expect(observedPaths).toEqual([
      '/safe/ductor/workspace',
      '/safe/ductor/agents/kevin/workspace',
      '/safe/ductor/agents/benjamin/workspace',
    ]);
    expect(result.roles[0]).toMatchObject({
      name: 'Alec',
      state: 'working',
      taskLabel: 'Verify Space Lab',
      derived: false,
    });
  });

  it.each([
    ['idle', 'idle'],
    ['active', 'working'],
    ['running', 'working'],
    ['queued', 'waiting'],
    ['reviewing', 'review'],
    ['qa', 'review'],
    ['error', 'blocked'],
    ['blocked', 'blocked'],
    ['offline', 'offline'],
    ['unexpected', 'idle'],
  ] as const)('maps %s to %s', (input, expected) => {
    expect(mapDuctorState(input, true)).toBe(expected);
  });

  it('forces an absent role offline instead of presenting false live telemetry', () => {
    expect(mapDuctorState('working', false)).toBe('offline');
  });

  it('always returns Alec, Kevin, and Benjamin in stable order', () => {
    const result = normalizeDuctorRoles(
      {},
      { Alec: true, Kevin: true, Benjamin: true },
      observedAt,
    );

    expect(result.roles.map((role) => role.name)).toEqual(['Alec', 'Kevin', 'Benjamin']);
    expect(result.roles.map((role) => role.state)).toEqual(['offline', 'offline', 'offline']);
    expect(result.roles.every((role) => role.derived)).toBe(true);
  });

  it('keeps simultaneous working states and a review state distinct', () => {
    const result = normalizeDuctorRoles(
      {
        Alec: { state: 'working', taskLabel: 'Coordinate MVP', updatedAt: observedAt },
        Kevin: { state: 'active', taskLabel: 'Implement bridge', updatedAt: observedAt },
        Benjamin: { state: 'reviewing', taskLabel: 'Review contract', updatedAt: observedAt },
      },
      { Alec: true, Kevin: true, Benjamin: true },
      observedAt,
    );

    expect(result.roles.map((role) => role.state)).toEqual(['working', 'working', 'review']);
    expect(result.roles.every((role) => role.derived === false)).toBe(true);
  });

  it('projects only the public response shape and drops secret-like input fields', () => {
    const result = normalizeDuctorRoles(
      {
        Kevin: {
          state: 'working',
          taskLabel: 'Implement bridge',
          updatedAt: observedAt,
          telegram_token: 'never-return-this',
          prompt: 'private message body',
          result: 'private task result',
        },
      },
      { Alec: true, Kevin: true, Benjamin: true },
      observedAt,
    );
    const serialized = JSON.stringify(result);

    expect(Object.keys(result.roles[1])).toEqual([
      'name',
      'presence',
      'state',
      'taskLabel',
      'updatedAt',
      'derived',
    ]);
    expect(serialized).not.toContain('never-return-this');
    expect(serialized).not.toContain('private message body');
    expect(serialized).not.toContain('private task result');
    expect(serialized).not.toMatch(/token|prompt|result/i);
  });

  it('re-reads three simultaneous role reports on every snapshot without a restart', () => {
    const provider = new DuctorStatusProvider({
      statusFile,
      statusRoot: tempRoot,
      exists: () => true,
      now: () => new Date(observedAt),
    });

    expect(provider.snapshot().roles.map((role) => role.state)).toEqual([
      'offline',
      'offline',
      'offline',
    ]);

    writeStatus({
      version: 1,
      roles: {
        Alec: { state: 'working', taskLabel: 'Planning', updatedAt: observedAt },
        Kevin: { state: 'waiting', taskLabel: 'Awaiting input', updatedAt: observedAt },
        Benjamin: { state: 'review', taskLabel: 'Reviewing', updatedAt: observedAt },
      },
    });

    expect(provider.snapshot().roles.map((role) => role.state)).toEqual([
      'working',
      'waiting',
      'review',
    ]);

    writeStatus({
      version: 1,
      roles: {
        Alec: { state: 'review', taskLabel: 'Audit', updatedAt: observedAt },
        Kevin: { state: 'working', taskLabel: 'Implement', updatedAt: observedAt },
        Benjamin: { state: 'blocked', taskLabel: 'Gate blocked', updatedAt: observedAt },
      },
    });

    expect(provider.snapshot().roles.map((role) => role.state)).toEqual([
      'review',
      'working',
      'blocked',
    ]);
  });

  it('sanitizes a reported task label and exposes no file-only fields', () => {
    writeStatus({
      version: 1,
      roles: {
        Alec: {
          state: 'working',
          taskLabel: `Build\u0000  safe\nheartbeat ${'x'.repeat(160)}`,
          updatedAt: observedAt,
        },
      },
    });
    const provider = new DuctorStatusProvider({
      statusFile,
      statusRoot: tempRoot,
      exists: () => true,
      now: () => new Date(observedAt),
    });

    const alec = provider.snapshot().roles[0];

    expect(alec.taskLabel).toHaveLength(120);
    expect(alec.taskLabel).not.toMatch(/[\u0000-\u001f\u007f]/u);
    expect(Object.keys(alec)).toEqual([
      'name',
      'presence',
      'state',
      'taskLabel',
      'updatedAt',
      'derived',
    ]);
  });

  it.each([
    ['malformed JSON', () => fs.writeFileSync(statusFile, '{not-json')],
    ['oversized content', () => fs.writeFileSync(statusFile, ' '.repeat(17 * 1024))],
    [
      'unknown role',
      () =>
        writeStatus({
          version: 1,
          roles: { Mallory: { state: 'working', updatedAt: observedAt } },
        }),
    ],
    [
      'unknown state',
      () =>
        writeStatus({
          version: 1,
          roles: { Alec: { state: 'executing-shell', updatedAt: observedAt } },
        }),
    ],
    [
      'arbitrary secret-like properties',
      () =>
        writeStatus({
          version: 1,
          roles: {
            Alec: {
              state: 'working',
              updatedAt: observedAt,
              token: 'never-return-this',
              prompt: 'private message',
            },
          },
        }),
    ],
  ])('rejects %s and falls back to presence-derived idle', (_name, arrange) => {
    arrange();
    const provider = new DuctorStatusProvider({
      statusFile,
      statusRoot: tempRoot,
      exists: () => true,
      now: () => new Date(observedAt),
    });

    const snapshot = provider.snapshot();

    expect(snapshot.roles.map((role) => role.state)).toEqual(['offline', 'offline', 'offline']);
    expect(snapshot.roles.every((role) => role.derived)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(/never-return-this|private message|token|prompt/i);
  });

  it('rejects a symlinked status file', () => {
    const target = path.join(tempRoot, 'target.json');
    fs.writeFileSync(
      target,
      JSON.stringify({
        version: 1,
        roles: { Alec: { state: 'working', updatedAt: observedAt } },
      }),
    );
    fs.symlinkSync(target, statusFile);
    const provider = new DuctorStatusProvider({
      statusFile,
      statusRoot: tempRoot,
      exists: () => true,
      now: () => new Date(observedAt),
    });

    expect(provider.snapshot().roles.map((role) => role.state)).toEqual([
      'offline',
      'offline',
      'offline',
    ]);
  });

  it('rejects a configured status path that escapes its allowlisted root', () => {
    const allowedRoot = path.join(tempRoot, 'repo');
    fs.mkdirSync(allowedRoot);
    writeStatus({
      version: 1,
      roles: { Alec: { state: 'working', updatedAt: observedAt } },
    });
    const provider = new DuctorStatusProvider({
      statusFile,
      statusRoot: allowedRoot,
      exists: () => true,
      now: () => new Date(observedAt),
    });

    expect(provider.snapshot().roles.map((role) => role.state)).toEqual([
      'offline',
      'offline',
      'offline',
    ]);
  });

  it.each([
    ['missing report', undefined],
    ['invalid timestamp', 'not-a-timestamp'],
    ['expired report', new Date(Date.parse(observedAt) - 45 * 60_000 - 1).toISOString()],
  ])('fails closed for %s', (_name, updatedAt) => {
    const provider = new DuctorStatusProvider({
      statusFile,
      statusRoot: tempRoot,
      exists: () => true,
      now: () => new Date(observedAt),
    });
    if (updatedAt !== undefined) {
      writeStatus({
        version: 1,
        roles: { Alec: { state: 'working', taskLabel: 'must hide', updatedAt } },
      });
    }

    const alec = provider.snapshot().roles[0];
    expect(alec).toMatchObject({
      presence: 'offline',
      state: 'offline',
      taskLabel: null,
      derived: true,
    });
  });
});
