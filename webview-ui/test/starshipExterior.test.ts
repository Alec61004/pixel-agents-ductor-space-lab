import assert from 'node:assert/strict';
import { test } from 'vitest';
import { drawStarshipExterior, EXTERIOR_SHIP_COUNT, getAccretionParticle, getExteriorShip } from '../src/ductor/starshipExterior.js';
import { createInitialCrew, drawHologramTopGlow, STATE, WORKSTATIONS } from '../src/ductor/starshipSimulation.js';

test('ships travel in a shared direction with different depth speeds; accretion flows inward', () => {
  const near = getExteriorShip(2, 2), nearLater = getExteriorShip(3, 2);
  const far = getExteriorShip(2, 0), farLater = getExteriorShip(3, 0);
  assert.ok(nearLater.x < near.x && farLater.x < far.x);
  assert.ok(near.x - nearLater.x > far.x - farLater.x);
  const start = getAccretionParticle(1, 0), later = getAccretionParticle(2, 0);
  assert.ok(later.radius < start.radius);
  assert.notEqual(later.x, start.x);
  for (let time = 0; time < 120; time += 0.25) {
    for (let i = 0; i < EXTERIOR_SHIP_COUNT; i++) {
      const ship = getExteriorShip(time, i);
      assert.ok(ship.x >= 382 && ship.x < 1522 && Number.isFinite(ship.y));
      const p = getAccretionParticle(time, i);
      assert.ok(p.radius >= 29 && p.radius <= 194 && Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  }
  assert.equal(EXTERIOR_SHIP_COUNT, 3);
});

test('window effects clip before drawing; the approved planet tour retains its blue frame and glass clip', () => {
  const calls: any[][] = [];
  const ctx = new Proxy({}, {
    get: (_, name) => {
      if (name === 'createRadialGradient' || name === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...args: any[]) => calls.push([name, ...args]);
    },
    set: () => true,
  }) as CanvasRenderingContext2D;
  const bg = { width:1600, height:678 } as HTMLImageElement;
  drawStarshipExterior(ctx, bg, 8);
  const firstPaint = calls.findIndex(c => ['fill', 'fillRect', 'stroke', 'drawImage'].includes(c[0]));
  assert.equal(calls.slice(0, firstPaint).filter(c => c[0] === 'clip').length, 2);
  assert.equal(calls.filter(c => c[0] === 'save').length, calls.filter(c => c[0] === 'restore').length);
  calls.length = 0;
  const crew = createInitialCrew();
  const kevin = crew.find(a => a.name === 'Kevin')!;
  Object.assign(kevin, WORKSTATIONS.Kevin.interactionPoint, { state:STATE.WORKING, reportedState:'working', hologramTime:2, hologramSceneTime:8 });
  drawHologramTopGlow(ctx, crew, 2, bg);
  // The restored #24 deployment includes physical planetary rings. Forbidding
  // every ellipse incorrectly rejects that approved renderer. Protect the
  // original frame and clipped glass independently of the planet's geometry.
  const frame = calls.find(c => c[0] === 'drawImage');
  assert.deepEqual(frame?.slice(2, 6), [516, 443, 106, 71]);
  const glassPaint = calls.findIndex(c => c[0] === 'fillRect');
  assert.ok(calls.slice(0, glassPaint).some(c => c[0] === 'clip'));
  assert.equal(calls.filter(c => c[0] === 'save').length, calls.filter(c => c[0] === 'restore').length);
});
