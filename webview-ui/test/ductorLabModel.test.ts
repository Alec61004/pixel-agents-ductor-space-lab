import assert from 'node:assert/strict';

import { test } from 'vitest';

import { DUCTOR_ALEC_COLOR, DUCTOR_BENJAMIN_COLOR, DUCTOR_KEVIN_COLOR } from '../src/constants.js';
import {
  createDuctorRoleCards,
  ductorAssetUrl,
  type DuctorStatusSnapshot,
  selectRuntimeSurface,
  selectScenePreset,
} from '../src/ductor/ductorLabModel.js';

const status: DuctorStatusSnapshot = {
  theme: 'ductor-space-lab',
  roles: [
    {
      name: 'Alec',
      presence: 'online',
      state: 'working',
      taskLabel: 'Coordinate MVP',
      updatedAt: '2026-08-22T05:30:00.000Z',
      derived: false,
    },
    {
      name: 'Kevin',
      presence: 'online',
      state: 'working',
      taskLabel: 'Implement bridge',
      updatedAt: '2026-08-22T05:30:00.000Z',
      derived: false,
    },
    {
      name: 'Benjamin',
      presence: 'online',
      state: 'review',
      taskLabel: 'Review contract',
      updatedAt: '2026-08-22T05:30:00.000Z',
      derived: false,
    },
  ],
};

test('selects the upstream office unless the Ductor preset is explicitly available', () => {
  assert.equal(selectScenePreset(null), 'office');
  assert.equal(selectScenePreset(status), 'ductor-space-lab');
});

test('keeps the upstream transport unloaded until the local preset check resolves', () => {
  assert.equal(selectRuntimeSurface(undefined), 'checking');
  assert.equal(selectRuntimeSurface(null), 'office');
  assert.equal(selectRuntimeSurface(status), 'ductor-space-lab');
});

test('creates exactly three stable left/center/right role cards', () => {
  const cards = createDuctorRoleCards(status);

  assert.deepEqual(
    cards.map(({ name, duty, station, color }) => ({ name, duty, station, color })),
    [
      { name: 'Alec', duty: 'Coordinator', station: 'left', color: DUCTOR_ALEC_COLOR },
      { name: 'Kevin', duty: 'Implementer', station: 'center', color: DUCTOR_KEVIN_COLOR },
      { name: 'Benjamin', duty: 'Reviewer', station: 'right', color: DUCTOR_BENJAMIN_COLOR },
    ],
  );
});

test('preserves simultaneous working states instead of collapsing to one active role', () => {
  const cards = createDuctorRoleCards(status);

  assert.equal(cards.filter((card) => card.state === 'working').length, 2);
  assert.equal(cards.find((card) => card.name === 'Benjamin')?.state, 'review');
});

test('resolves theme assets from the app root instead of relative to the CSS bundle', () => {
  assert.equal(ductorAssetUrl('./', 'characters/char_0.png'), '/assets/characters/char_0.png');
  assert.equal(
    ductorAssetUrl('/preview/', 'characters/char_0.png'),
    '/preview/assets/characters/char_0.png',
  );
});
