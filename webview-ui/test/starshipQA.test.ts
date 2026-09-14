import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createInitialCrew, isBenjaminUsingScanner, STATE } from '../src/ductor/starshipSimulation.js';
import { drawQAContact, drawQAExperiment, getQAScanState } from '../src/ductor/starshipQA.js';

test('Benjamin scanner follows work at the station, including QA review, and stops on departure', () => {
  const crew = createInitialCrew();
  const benjamin = crew.find(a => a.name === 'Benjamin')!;
  assert.equal(isBenjaminUsingScanner(benjamin), true);
  assert.equal(isBenjaminUsingScanner({ ...benjamin, reportedState: 'review' }), true);
  assert.equal(isBenjaminUsingScanner({ ...benjamin, reportedState: 'offline' }), false);
  for (const state of [STATE.IDLE, STATE.MOVING, STATE.BLOCKED, STATE.WAITING, STATE.OFFLINE]) {
    assert.equal(isBenjaminUsingScanner({ ...benjamin, state, reportedState: 'working' }), false);
  }
  assert.equal(isBenjaminUsingScanner({ ...benjamin, x: benjamin.x + 100 }), false);
  assert.equal(isBenjaminUsingScanner({ ...benjamin, name: 'Kevin' }), false);
});

test('scan loops from acquisition through validation without stopping specimen rotation', () => {
  const start = getQAScanState(0), confirmed = getQAScanState(6), next = getQAScanState(7);
  assert.equal(start.validated, false); assert.equal(confirmed.validated, true);
  assert.equal(next.validated, false); assert.equal(next.scan, start.scan);
  assert.ok(next.rotation > confirmed.rotation);
  for (const time of [0, 3, 7, 1000, NaN, Infinity, -20]) {
    const state = getQAScanState(time);
    assert.ok(state.scan >= 0 && state.scan < 1);
    assert.ok(Number.isFinite(state.rotation));
    assert.ok(state.touch >= 0 && state.touch <= 1);
  }
});

test('the QA volume and hand controls animate and restore the caller canvas state', () => {
  const calls: unknown[][] = [];
  const ctx = new Proxy({}, {
    get: (_, key) => key === 'createLinearGradient' || key === 'createRadialGradient'
      ? () => ({ addColorStop() {} })
      : (...args: unknown[]) => calls.push([key, ...args]),
    set: () => true,
  }) as CanvasRenderingContext2D;
  const render = (time: number) => {
    calls.length = 0;
    drawQAExperiment(ctx, time); drawQAContact(ctx, time, 1060, 630, 1.1);
    assert.equal(calls.filter(c => c[0] === 'save').length, calls.filter(c => c[0] === 'restore').length);
    return JSON.stringify(calls);
  };
  assert.notEqual(render(1), render(3));
});
