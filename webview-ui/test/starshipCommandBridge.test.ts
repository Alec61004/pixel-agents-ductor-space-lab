import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  drawAlienCommandBridge,
  getAlienCommandState,
} from '../src/ductor/starshipCommandBridge.js';

test('alien command membrane wakes and advances its own navigation state', () => {
  const idle = getAlienCommandState(2, false);
  const working = getAlienCommandState(2, true);
  const later = getAlienCommandState(3, true);
  assert.equal(idle.active, false);
  assert.equal(working.active, true);
  assert.ok(working.wake > idle.wake);
  assert.notEqual(working.sweep, later.sweep);
  assert.notEqual(working.node, later.node);
  for (let time = 0; time < 60; time += 0.2) {
    const state = getAlienCommandState(time, true);
    assert.ok(state.pulse >= 0 && state.pulse <= 1);
    assert.ok(state.sweep >= 0 && state.sweep < 1);
    assert.ok(state.node >= 0 && state.node < 7);
  }
});

test('alien command bridge balances canvas state and avoids human text UI', () => {
  const calls: any[][] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, name) =>
        name === 'createRadialGradient' || name === 'createLinearGradient'
          ? (...args: any[]) => {
              calls.push([name, ...args]);
              return { addColorStop: (...stops: any[]) => calls.push(['addColorStop', ...stops]) };
            }
          : (...args: any[]) => calls.push([name, ...args]),
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  drawAlienCommandBridge(ctx, 4.2, true);
  assert.equal(
    calls.filter((call) => call[0] === 'save').length,
    calls.filter((call) => call[0] === 'restore').length,
  );
  assert.equal(calls.some((call) => call[0] === 'fillText'), false);
  assert.ok(calls.some((call) => call[0] === 'quadraticCurveTo'));
  assert.ok(calls.some((call) => call[0] === 'arc'));
});
