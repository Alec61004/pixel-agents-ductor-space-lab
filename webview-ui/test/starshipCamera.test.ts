import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  createInitialCrew, drawHologramTopGlow, getHologramCamera,
  getHologramNavigation, getHologramPlanets, getHologramSurfacePoint,
  STATE, updateAgent, WORKSTATIONS,
} from '../src/ductor/starshipSimulation.js';

test('eight distinct planets have visible bodies, materials and axial rotation', () => {
  const planets = getHologramPlanets(0);
  assert.equal(planets.length, 8);
  assert.equal(new Set(planets.map(p => p.id)).size, 8);
  assert.equal(new Set(planets.map(p => p.material)).size, 6);
  assert.equal(planets.filter(p => p.ring).length, 2);
  for (const p of planets) {
    assert.ok(p.radius >= 3 && p.spin > 0);
    assert.equal(p.colors.length, 5);
  }
  assert.notDeepEqual(getHologramPlanets(0), getHologramPlanets(1));
});

test('surface features rotate around the sphere and disappear behind the limb', () => {
  const front = getHologramSurfacePoint(0, 0, 0);
  const side = getHologramSurfacePoint(0, 0, Math.PI / 2);
  const back = getHologramSurfacePoint(0, 0, Math.PI);
  assert.deepEqual(front, { x: 0, y: 0, depth: 1 });
  assert.ok(Math.abs(side.x - 1) < 1e-8 && Math.abs(side.depth) < 1e-8);
  assert.ok(back.depth < 0);
});

test('initial signal targets a real planet and arrives before approach', () => {
  for (const t of [0, 1.3, 2.8, 3.03, 3.2]) {
    assert.deepEqual(getHologramCamera(t, true), { x: 53, y: 35.5, zoom: 1 });
  }
  const sceneTime = 27;
  const planet = getHologramPlanets(sceneTime)[0]!;
  assert.deepEqual(getHologramNavigation(2.8, true, sceneTime).target,
    { x: planet.x, y: planet.y });
  assert.equal(getHologramNavigation(3.2, true).signal, 1);
  assert.ok(getHologramCamera(3.85, true).zoom > 1);
});

test('tour holds each moving planet then transfers directly including last to first', () => {
  for (let visit = 0; visit < 10; visit++) {
    const t = 4.5 + visit * 5 + 1.6;
    const sceneTime = 100 + t; // independent clock must be used for orbit tracking
    const planet = getHologramPlanets(sceneTime)[visit % 8]!;
    const camera = getHologramCamera(t, true, sceneTime);
    assert.ok(Math.abs(camera.x - planet.x) < 1e-9);
    assert.ok(Math.abs(camera.y - planet.y) < 1e-9);
    assert.ok(camera.zoom > 3);
    assert.equal(getHologramNavigation(t, true, sceneTime).opacity, 0);
  }
  for (let t = 4.5; t < 90; t += 0.05) {
    const camera = getHologramCamera(t, true);
    assert.ok(camera.zoom > 3 && camera.zoom <= 5.5, 'never return to overview');
    const next = getHologramCamera(t + 0.00001, true);
    assert.ok(Math.hypot(next.x - camera.x, next.y - camera.y) < 0.01);
    assert.ok(Math.abs(next.zoom - camera.zoom) < 0.001);
  }
});

test('inactive view stays wide and interruption eases home', () => {
  for (const t of [0, 5, 12.9, 45]) {
    assert.deepEqual(getHologramCamera(t, false), { x: 53, y: 35.5, zoom: 1 });
  }
  const crew = createInitialCrew();
  const kevin = crew.find(a => a.name === 'Kevin')!;
  Object.assign(kevin, WORKSTATIONS.Kevin.interactionPoint, {
    state: STATE.WORKING, reportedState: 'working', hologramTime: 5,
  });
  updateAgent(kevin, 0.1, 1, crew);
  const zoom = kevin.hologramCamera!.zoom;
  assert.ok(zoom > 3);
  Object.assign(kevin, { state: STATE.IDLE, reportedState: 'idle', stateTimer: 100 });
  updateAgent(kevin, 0.1, 1, crew);
  assert.ok(kevin.hologramCamera!.zoom > 1 && kevin.hologramCamera!.zoom < zoom);
  for (let i = 0; i < 30; i++) updateAgent(kevin, 0.1, 1, crew);
  assert.ok(Math.abs(kevin.hologramCamera!.zoom - 1) < 0.001);
});

test('frame and projector stay fixed while every planet is rendered in clipped map', () => {
  const crew = createInitialCrew();
  const kevin = crew.find(a => a.name === 'Kevin')!;
  Object.assign(kevin, WORKSTATIONS.Kevin.interactionPoint, {
    state: STATE.WORKING, reportedState: 'working', hologramExpansion: 1,
  });
  const record = (time: number) => {
    kevin.hologramTime = time;
    const calls: unknown[][] = [];
    const ctx = new Proxy({}, {
      get: (_, key) => String(key).includes('Gradient')
        ? () => ({ addColorStop() {} })
        : (...args: unknown[]) => calls.push([key, ...args]),
      set: () => true,
    }) as CanvasRenderingContext2D;
    drawHologramTopGlow(ctx, crew, time);
    return calls;
  };
  const overview = record(1);
  const closeup = record(5);
  assert.deepEqual(overview.filter(c => c[0] === 'drawImage'),
    closeup.filter(c => c[0] === 'drawImage'));
  const camera = getHologramCamera(5, true);
  const zoomIndex = closeup.findIndex(c => c[0] === 'scale' && c[1] === camera.zoom);
  assert.ok(zoomIndex > closeup.findIndex(c => c[0] === 'clip'));
  assert.deepEqual(closeup[zoomIndex - 1], ['translate', 53, 35.5]);
  assert.deepEqual(closeup[zoomIndex + 1], ['translate', -camera.x, -camera.y]);
  for (const p of getHologramPlanets(5)) {
    assert.ok(closeup.some(c => c[0] === 'arc' && c[1] === p.x &&
      c[2] === p.y && c[3] === p.radius), p.id + ' renders a sphere');
  }
  assert.equal(closeup.filter(c => c[0] === 'save').length,
    closeup.filter(c => c[0] === 'restore').length);
});
