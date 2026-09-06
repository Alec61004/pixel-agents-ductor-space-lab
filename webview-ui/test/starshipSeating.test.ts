import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { test } from 'vitest';
import { createInitialCrew, STATE, updateAgent, WORKSTATIONS } from '../src/ductor/starshipSimulation.js';
import { ALEC_SEATED_ATLAS, getCommandGesture } from '../src/ductor/starshipComputerBay.js';

test('command gestures only advance while Alec occupies his station; Kevin keeps his independent tour', () => {
  const crew = createInitialCrew();
  const alec = crew.find((a) => a.name === 'Alec')!;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  for (const a of [alec, kevin]) {
    Object.assign(a, WORKSTATIONS[a.name].interactionPoint, {
      state: STATE.WORKING, reportedState: 'working', stateTimer: 100,
    });
  }
  for (let i = 0; i < 32; i++) for (const a of [alec, kevin]) updateAgent(a, 0.05, 1, crew);
  assert.ok(alec.commandTime! > 1.5);
  assert.equal(getCommandGesture(alec.commandTime!).contact, -1);
  assert.ok(kevin.hologramTime! > 1.5);
  assert.ok(!alec.hologramExpansion);
  Object.assign(alec, { state: STATE.OFFLINE, reportedState: 'offline' });
  updateAgent(alec, 0.05, 1, crew);
  assert.equal(alec.commandTime, 0);
  Object.assign(alec, { state: STATE.MOVING, reportedState: 'working', x: 900, y: 600, targetX: 800, targetY: 600 });
  updateAgent(alec, 0.05, 1, crew);
  assert.equal(alec.commandTime, 0);
});

test('all authored seated frames decode, have transparent borders and retain head, hands and bent legs', () => {
  const png = PNG.sync.read(readFileSync(new URL('../public/assets/themes/ductor-space-lab/alec-seated.png', import.meta.url)), { checkCRC: true });
  assert.equal(png.width, ALEC_SEATED_ATLAS.width);
  assert.equal(png.height, ALEC_SEATED_ATLAS.height);
  const cell = png.width / ALEC_SEATED_ATLAS.columns;
  for (let frame = 0; frame < 4; frame++) {
    const regions = [0, 0, 0];
    for (let y = 0; y < png.height; y++) for (let x = 0; x < cell; x++) {
      const alpha = png.data[(y * png.width + frame * cell + x) * 4 + 3]!;
      if (x === 0 || x === cell - 1 || y === 0 || y === png.height - 1) assert.equal(alpha, 0);
      if (alpha > 128) regions[y < 310 ? 0 : y < 460 ? 1 : 2]!++;
    }
    assert.ok(regions.every((count) => count > 10000), `Incomplete seated pose ${frame}`);
  }
});
