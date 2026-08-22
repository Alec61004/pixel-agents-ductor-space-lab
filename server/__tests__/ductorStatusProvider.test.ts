import { describe, expect, it } from 'vitest';

import {
  mapDuctorState,
  normalizeDuctorRoles,
} from '../src/providers/status/ductor/ductorStatusProvider.js';

const observedAt = '2026-08-22T05:30:00.000Z';

describe('Ductor status normalization', () => {
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
    expect(result.roles.map((role) => role.state)).toEqual(['idle', 'idle', 'idle']);
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
});
