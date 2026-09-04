import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  createInitialCrew, drawHologramTopGlow, getHologramCamera,
  getHologramNavigation, STATE, updateAgent, WORKSTATIONS,
} from '../src/ductor/starshipSimulation.js';

test('camera waits until signal arrival, then eases into the selected star', () => {
  for (const time of [0, 1.3, 2.8, 3.03, 3.2]) {
    assert.deepEqual(getHologramCamera(time, true), { x: 53, y: 35.5, zoom: 1 });
  }
  assert.equal(getHologramNavigation(3.2, true).signal, 1);
  assert.ok(getHologramCamera(3.85, true).zoom > 1);
  assert.ok(getHologramCamera(3.85, true).zoom < 4);
  for (const time of [4.5, 5.4, 6.3]) {
    assert.deepEqual(getHologramCamera(time, true), {
      ...getHologramNavigation(time, true).target, zoom: 4,
    });
    assert.equal(getHologramNavigation(time, true).opacity, 0);
  }
});

test('camera returns home before advancing targets with no cycle jump', () => {
  assert.ok(getHologramCamera(7, true).zoom > 1);
  assert.ok(getHologramCamera(7, true).zoom < 4);
  for (const time of [8, 8.399999, 8.4, 8.400001]) {
    assert.deepEqual(getHologramCamera(time, true), { x: 53, y: 35.5, zoom: 1 });
  }
  const targets = [4.5, 12.9, 21.3].map(t => getHologramCamera(t, true));
  assert.equal(new Set(targets.map(t => t.x + ',' + t.y)).size, 3);
});

test('camera remains bounded and continuous across all phase boundaries', () => {
  for (let t = 0; t < 25.2; t += 0.01) {
    const a = getHologramCamera(t, true);
    const b = getHologramCamera(t + 0.00001, true);
    assert.ok(a.zoom >= 1 && a.zoom <= 4);
    assert.ok(Math.abs(a.zoom - b.zoom) < 0.001);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.01);
  }
});

test('inactive camera uses the overview at every phase', () => {
  for (const t of [0, 3.8, 5.5, 7, 12.9]) {
    assert.deepEqual(getHologramCamera(t, false), { x: 53, y: 35.5, zoom: 1 });
  }
});

test('stopping work during a close-up eases home rather than snapping', () => {
  const crew = createInitialCrew();
  const alec = crew.find(a => a.name === 'Alec')!;
  Object.assign(alec, WORKSTATIONS.Alec.interactionPoint, {
    state: STATE.WORKING, reportedState: 'working', hologramTime: 5,
  });
  updateAgent(alec, 0.1, 1, crew);
  assert.equal(alec.hologramCamera!.zoom, 4);
  Object.assign(alec, { state: STATE.IDLE, reportedState: 'idle', stateTimer: 100 });
  updateAgent(alec, 0.1, 1, crew);
  assert.ok(alec.hologramCamera!.zoom > 1 && alec.hologramCamera!.zoom < 4);
  for (let i = 0; i < 30; i++) updateAgent(alec, 0.1, 1, crew);
  assert.ok(Math.abs(alec.hologramCamera!.zoom - 1) < 0.001);
});

test('zoom is clipped inside the map, leaving frame and projector unchanged', () => {
  const crew = createInitialCrew();
  const alec = crew.find(a => a.name === 'Alec')!;
  Object.assign(alec, WORKSTATIONS.Alec.interactionPoint, {
    state: STATE.WORKING, reportedState: 'working', hologramExpansion: 1,
  });
  const bg = {} as HTMLImageElement;
  const record = (time: number) => {
    alec.hologramTime = time;
    const calls: unknown[][] = [];
    const ctx = new Proxy({}, {
      get: (_, key) => String(key).includes('Gradient')
        ? () => ({ addColorStop() {} })
        : (...args: unknown[]) => calls.push([key, ...args]),
      set: () => true,
    }) as CanvasRenderingContext2D;
    drawHologramTopGlow(ctx, crew, time, bg);
    return calls;
  };
  const overview = record(1);
  const closeup = record(5);
  assert.deepEqual(
    overview.filter(c => c[0] === 'drawImage'),
    closeup.filter(c => c[0] === 'drawImage'),
  );
  const zoomIndex = closeup.findIndex(c => c[0] === 'scale' && c[1] === 4);
  assert.ok(zoomIndex > closeup.findIndex(c => c[0] === 'clip'));
  assert.deepEqual(closeup[zoomIndex - 1], ['translate', 53, 35.5]);
  assert.deepEqual(closeup[zoomIndex + 1], ['translate', -86, -20]);
  assert.equal(closeup.filter(c => c[0] === 'save').length,
    closeup.filter(c => c[0] === 'restore').length);
});
