import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { test } from 'vitest';
import {
  drawLivingRoom,
  getAirlockResponse,
  getLivingRoomArtwork,
  getPodParticle,
  getSpecimenVitalState,
  SPECIMEN_TANK,
} from '../src/ductor/starshipLivingRoom.js';
import { drawStarshipExterior } from '../src/ductor/starshipExterior.js';

test('the full room decodes and normalises once into the original coordinate space', () => {
  const png = PNG.sync.read(readFileSync(new URL('../public/assets/themes/ductor-space-lab/photonic-room-v1.png', import.meta.url)), { checkCRC: true });
  assert.ok(Math.abs(png.width / png.height - 1600 / 678) < 0.01);
  const previous = globalThis.OffscreenCanvas;
  let copies = 0;
  class TestCanvas {
    readonly width: number;
    readonly height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }

    getContext() { return { drawImage() { copies++; } }; }
  }
  globalThis.OffscreenCanvas = TestCanvas as unknown as typeof OffscreenCanvas;
  try {
    const image = { width: png.width, height: png.height } as HTMLImageElement;
    const room = getLivingRoomArtwork(image)!;
    assert.equal(room.width, 1600); assert.equal(room.height, 678);
    assert.equal(getLivingRoomArtwork(image), room); assert.equal(copies, 1);
    assert.equal(getLivingRoomArtwork(), undefined);
  } finally { globalThis.OffscreenCanvas = previous; }
});

test('life-support particles stay inside the glass; the airlock reacts to proximity', () => {
  for (let t = 0; t < 40; t += 0.37) for (let pod = 0; pod < 6; pod++) for (let i = 0; i < 17; i++) {
    const p = getPodParticle(t, i, pod);
    assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1);
    assert.ok(p.opacity >= 0 && p.opacity <= 0.55);
  }
  assert.equal(getAirlockResponse([]), 0);
  assert.equal(getAirlockResponse([{ x: 900, y: 600 }]), 0);
  assert.equal(getAirlockResponse([{ x: 180, y: 592 }]), 1);
  assert.ok(getAirlockResponse([{ x: 280, y: 592 }]) > 0);
});

test('the preserved specimen tank has a calm idle pulse and a faster active scan', () => {
  assert.ok(SPECIMEN_TANK.w > 0 && SPECIMEN_TANK.h > 0);
  const idle = getSpecimenVitalState(2, false);
  const laterIdle = getSpecimenVitalState(5, false);
  const active = getSpecimenVitalState(2, true);
  assert.notEqual(idle.scan, laterIdle.scan);
  assert.notEqual(idle.pulse, active.pulse);
  assert.ok(idle.alert < active.alert);
  for (const value of [idle, laterIdle, active]) {
    assert.ok(value.pulse >= 0 && value.pulse <= 1);
    assert.ok(value.respiration >= 0 && value.respiration <= 1);
    assert.ok(value.scan >= 0 && value.scan < 1);
  }
});

test('environment motion persists at rest, reacts to work, and restores every local clip', () => {
  const calls: unknown[][] = [];
  const ctx = new Proxy({}, {
    get: (_, key) => {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...args: unknown[]) => calls.push([key, ...args]);
    }, set: () => true,
  }) as CanvasRenderingContext2D;
  const render = (time: number, active: boolean) => {
    calls.length = 0;
    drawLivingRoom(ctx, time, { crew: [], command: active, qa: active, navigation: active });
    assert.equal(calls.filter(c => c[0] === 'save').length, calls.filter(c => c[0] === 'restore').length);
    assert.ok(calls.filter(c => c[0] === 'clip').length >= 10);
    return JSON.stringify(calls);
  };
  assert.notEqual(render(0, false), render(2, false));
  assert.notEqual(render(2, false), render(2, true));
  calls.length = 0;
  drawStarshipExterior(ctx, { width: 1600, height: 678 } as HTMLImageElement, 3, true);
  const paint = calls.findIndex(c => ['fill', 'fillRect', 'stroke', 'drawImage'].includes(c[0] as string));
  assert.equal(calls.slice(0, paint).filter(c => c[0] === 'clip').length, 2);
  assert.equal(calls.filter(c => c[0] === 'save').length, calls.filter(c => c[0] === 'restore').length);
});
