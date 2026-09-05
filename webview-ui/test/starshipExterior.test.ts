import assert from 'node:assert/strict';
import { test } from 'vitest';
import { drawStarshipExterior, getAccretionParticle, getExteriorShip } from '../src/ductor/starshipExterior.js';
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
    for (let i = 0; i < 4; i++) {
      const ship = getExteriorShip(time, i);
      assert.ok(ship.x >= 382 && ship.x < 1522 && Number.isFinite(ship.y));
      const p = getAccretionParticle(time, i);
      assert.ok(p.radius >= 29 && p.radius <= 194 && Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  }
});

test('window effects clip before drawing and restore canvas state; the star map has no ellipse rings', () => {
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
  const alec = crew.find(a => a.name === 'Alec')!;
  Object.assign(alec, WORKSTATIONS.Alec.interactionPoint, { state:STATE.WORKING, reportedState:'working', hologramTime:2, hologramSceneTime:8 });
  drawHologramTopGlow(ctx, crew, 2, bg);
  assert.equal(calls.some(c => c[0] === 'ellipse'), false, 'no orbit tracks or planetary ring outlines');
});
