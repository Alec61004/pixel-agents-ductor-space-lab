import assert from 'node:assert/strict';

import { test } from 'vitest';

import { DUCTOR_ALEC_COLOR, DUCTOR_BENJAMIN_COLOR, DUCTOR_KEVIN_COLOR } from '../src/constants.js';
import {
  createDuctorRoleCards,
  ductorAssetUrl,
  type DuctorStatusSnapshot,
  isDuctorStatusSnapshot,
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
    cards.map(({ name, duty, station, color, portrait }) => ({
      name,
      duty,
      station,
      color,
      portrait,
    })),
    [
      {
        name: 'Alec',
        duty: 'Coordinator',
        station: 'left',
        color: DUCTOR_ALEC_COLOR,
        portrait: {
          id: 'purple-commander',
          asset: 'themes/ductor-space-lab/crew-sprites.webp',
          position: '53.333% 0%',
        },
      },
      {
        name: 'Kevin',
        duty: 'Implementer',
        station: 'center',
        color: DUCTOR_KEVIN_COLOR,
        portrait: {
          id: 'cyan-engineer',
          asset: 'themes/ductor-space-lab/crew-sprites.webp',
          position: '0% 28.571%',
        },
      },
      {
        name: 'Benjamin',
        duty: 'Reviewer',
        station: 'right',
        color: DUCTOR_BENJAMIN_COLOR,
        portrait: {
          id: 'red-sentinel',
          asset: 'themes/ductor-space-lab/crew-sprites.webp',
          position: '0% 0%',
        },
      },
    ],
  );
});

test('uses purple, cyan, and red role accents', () => {
  const rgb = (color: string) =>
    [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
  const [alecRed = 0, alecGreen = 0, alecBlue = 0] = rgb(DUCTOR_ALEC_COLOR);
  const [kevinRed = 0, kevinGreen = 0, kevinBlue = 0] = rgb(DUCTOR_KEVIN_COLOR);
  const [benjaminRed = 0, benjaminGreen = 0, benjaminBlue = 0] = rgb(DUCTOR_BENJAMIN_COLOR);

  assert.ok(alecRed > alecGreen && alecBlue > alecGreen);
  assert.ok(kevinGreen > kevinRed && kevinBlue > kevinRed);
  assert.ok(benjaminRed > benjaminGreen && benjaminRed > benjaminBlue);
});

test('preserves simultaneous working states instead of collapsing to one active role', () => {
  const cards = createDuctorRoleCards(status);

  assert.equal(cards.filter((card) => card.state === 'working').length, 2);
  assert.equal(cards.find((card) => card.name === 'Benjamin')?.state, 'review');
});

test('resolves theme assets from the app root instead of relative to the CSS bundle', () => {
  assert.equal(
    ductorAssetUrl('./', 'themes/ductor-space-lab/crew-sprites.webp'),
    '/assets/themes/ductor-space-lab/crew-sprites.webp',
  );
  assert.equal(
    ductorAssetUrl('/preview/', 'themes/ductor-space-lab/crew-sprites.webp'),
    '/preview/assets/themes/ductor-space-lab/crew-sprites.webp',
  );
});

test('accepts the exact cloud public shape while retaining the local shape', () => {
  const cloud = {
    ...status,
    publishedAt: '2026-08-22T05:30:00.000Z',
    stale: false,
    roles: status.roles.map((role) => ({
      ...role,
      provenance: 'operator-agent-reported',
    })),
  };

  assert.equal(isDuctorStatusSnapshot(status), true);
  assert.equal(isDuctorStatusSnapshot(cloud), true);
  assert.equal(isDuctorStatusSnapshot({ ...cloud, secret: 'never' }), false);
  assert.equal(
    isDuctorStatusSnapshot({
      ...cloud,
      roles: cloud.roles.map((role, index) =>
        index === 0 ? { ...role, arbitraryMetadata: 'never' } : role,
      ),
    }),
    false,
  );
  assert.equal(
    isDuctorStatusSnapshot({
      ...cloud,
      roles: cloud.roles.map((role, index) =>
        index === 0 ? { ...role, provenance: 'telegram-message' } : role,
      ),
    }),
    false,
  );
});
