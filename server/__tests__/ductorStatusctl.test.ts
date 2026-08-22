import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const statusctl = path.join(repoRoot, 'scripts', 'ductor-statusctl.ts');
const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
const observedAt = '2026-08-22T05:30:00.000Z';

let tempRoot: string;

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-statusctl-'));
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

function runRawStatusctl(...args: string[]) {
  return spawnSync(tsx, [statusctl, ...args], {
    cwd: tempRoot,
    encoding: 'utf8',
  });
}

function runStatusctl(...args: string[]) {
  return runRawStatusctl('--file', 'status.json', ...args);
}

describe('ductor-statusctl', () => {
  it('atomically sets three independent reports, then shows the strict file shape', () => {
    expect(
      runStatusctl('set', 'Alec', 'working', '--task', 'Plan', '--timestamp', observedAt).status,
    ).toBe(0);
    expect(
      runStatusctl('set', 'Kevin', 'waiting', '--task', 'Build', '--timestamp', observedAt).status,
    ).toBe(0);
    expect(
      runStatusctl('set', 'Benjamin', 'review', '--task', 'QA', '--timestamp', observedAt).status,
    ).toBe(0);

    const shown = runStatusctl('status');
    const parsed = JSON.parse(shown.stdout) as {
      version: number;
      roles: Record<string, { state: string }>;
    };

    expect(shown.status).toBe(0);
    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.roles)).toEqual(['Alec', 'Kevin', 'Benjamin']);
    expect(Object.values(parsed.roles).map((role) => role.state)).toEqual([
      'working',
      'waiting',
      'review',
    ]);
    expect(fs.readdirSync(tempRoot)).toEqual(['status.json']);
  });

  it('clears one role and resets all reports to presence-derived fallback', () => {
    expect(runStatusctl('set', 'Alec', 'working', '--timestamp', observedAt).status).toBe(0);
    expect(runStatusctl('set', 'Kevin', 'waiting', '--timestamp', observedAt).status).toBe(0);
    expect(runStatusctl('clear', 'Alec').status).toBe(0);

    const cleared = JSON.parse(runStatusctl('status').stdout) as { roles: Record<string, unknown> };
    expect(Object.keys(cleared.roles)).toEqual(['Kevin']);

    expect(runStatusctl('reset').status).toBe(0);
    const reset = JSON.parse(runStatusctl('status').stdout) as { roles: Record<string, unknown> };
    expect(reset.roles).toEqual({});
  });

  it.each([
    ['unknown role', ['set', 'Mallory', 'working']],
    ['unknown state', ['set', 'Alec', 'shelling']],
  ])('rejects %s', (_name, args) => {
    const result = runStatusctl(...args);

    expect(result.status).not.toBe(0);
  });

  it('rejects a path escape before reading or writing', () => {
    const result = runRawStatusctl('--file', '../escaped.json', 'status');

    expect(result.status).not.toBe(0);
    expect(fs.existsSync(path.join(tempRoot, '..', 'escaped.json'))).toBe(false);
  });
});
