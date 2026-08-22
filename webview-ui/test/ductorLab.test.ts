import assert from 'node:assert/strict';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import { FALLBACK_FLOOR_COLOR } from '../src/constants.js';
import { DuctorLab } from '../src/ductor/DuctorLab.js';
import type { DuctorStatusSnapshot } from '../src/ductor/ductorLabModel.js';
import { createDuctorOfficeRuntime } from '../src/ductor/ductorOfficeRuntime.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';

const PIXEL = [[FALLBACK_FLOOR_COLOR]];
buildDynamicCatalog({
  catalog: [
    {
      id: 'CUSHIONED_CHAIR_BACK',
      label: 'Lab chair',
      category: 'chairs',
      width: 16,
      height: 16,
      footprintW: 1,
      footprintH: 1,
      isDesk: false,
      orientation: 'back',
    },
    {
      id: 'DESK_FRONT',
      label: 'Console',
      category: 'desks',
      width: 48,
      height: 32,
      footprintW: 3,
      footprintH: 2,
      isDesk: true,
      orientation: 'front',
      backgroundTiles: 1,
    },
    {
      id: 'PC_FRONT_OFF',
      label: 'Terminal',
      category: 'electronics',
      width: 16,
      height: 32,
      footprintW: 1,
      footprintH: 2,
      isDesk: false,
      orientation: 'front',
      backgroundTiles: 1,
      canPlaceOnSurfaces: true,
    },
    {
      id: 'DOUBLE_BOOKSHELF',
      label: 'Review archive',
      category: 'wall',
      width: 32,
      height: 32,
      footprintW: 2,
      footprintH: 2,
      isDesk: false,
      canPlaceOnWalls: true,
    },
  ],
  sprites: {
    CUSHIONED_CHAIR_BACK: PIXEL,
    DESK_FRONT: PIXEL,
    PC_FRONT_OFF: PIXEL,
    DOUBLE_BOOKSHELF: PIXEL,
  },
});

const snapshot: DuctorStatusSnapshot = {
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

test('does not retain the static three-card layout as the primary Ductor experience', () => {
  const markup = renderToStaticMarkup(
    createElement(DuctorLab, { snapshot, initialRuntime: createDuctorOfficeRuntime(snapshot) }),
  );

  assert.equal((markup.match(/data-role-card=/g) ?? []).length, 0);
  assert.match(markup, /data-ductor-engine-surface="true"/);
  assert.match(markup, /<canvas/);
  assert.equal((markup.match(/data-ductor-agent=/g) ?? []).length, 3);
  assert.match(markup, /aria-label="Alec, Planner \/ Architect, working"/);
  assert.match(markup, /aria-label="Kevin, Builder \/ Implementer, working"/);
  assert.match(markup, /aria-label="Benjamin, Independent QA \/ Reviewer, review"/);
  assert.match(markup, /Ductor Space Lab/);
  assert.match(markup, /Signals marked derived are presence-based/);
});

test('labels cloud provenance and stale offline status honestly', () => {
  const staleSnapshot: DuctorStatusSnapshot = {
    ...snapshot,
    publishedAt: '2026-08-22T05:30:00.000Z',
    stale: true,
    roles: snapshot.roles.map((role) => ({
      ...role,
      presence: 'offline',
      state: 'offline',
      taskLabel: null,
      derived: true,
      provenance: 'stale-cloud-heartbeat',
    })),
  };

  const markup = renderToStaticMarkup(
    createElement(DuctorLab, {
      snapshot: staleSnapshot,
      initialRuntime: createDuctorOfficeRuntime(staleSnapshot),
    }),
  );

  assert.match(markup, /REMOTE HEARTBEAT/);
  assert.match(markup, /Cloud heartbeat stale · agents inactive/);
  assert.equal((markup.match(/stale cloud heartbeat/g) ?? []).length, 3);
  assert.doesNotMatch(markup, /127\.0\.0\.1/);
});
