import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  getStarshipSceneHotspotAt,
  STARSHIP_SCENE_HOTSPOTS,
  STARSHIP_SCENE_OBJECTS,
  STARSHIP_SCENE_SIZE,
} from '../src/ductor/starshipSceneLayout.js';

test('scene manifest keeps production objects in one 1600×678 coordinate space', () => {
  assert.deepEqual(STARSHIP_SCENE_SIZE, { width: 1600, height: 678 });
  assert.deepEqual(STARSHIP_SCENE_OBJECTS.alecCommand.bounds, { x: 407, y: 299, w: 327, h: 130 });
  assert.deepEqual(STARSHIP_SCENE_OBJECTS.specimenTank.bounds, { x: 821, y: 235, w: 116, h: 195 });
  assert.deepEqual(STARSHIP_SCENE_OBJECTS.kevinStarMap.bounds, { x: 510, y: 409, w: 110, h: 70 });
});

test('converted HTML hotspots are normalised into the live canvas interaction map', () => {
  for (const hotspot of STARSHIP_SCENE_HOTSPOTS) {
    const hit = getStarshipSceneHotspotAt({
      x: hotspot.bounds.x + hotspot.bounds.w / 2,
      y: hotspot.bounds.y + hotspot.bounds.h / 2,
    });
    assert.equal(hit?.id, hotspot.id);
  }
  assert.equal(getStarshipSceneHotspotAt({ x: -1, y: -1 }), undefined);
});
