import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { test } from 'vitest';
import {
  createInitialCrew,
  drawAgentStatusBubble,
  getAgentStatusBubble,
  isAgentAtStation,
  isAgentWorkingAtAssignedStation,
  isBenjaminUsingScanner,
  isKevinUsingStarMap,
  STATE,
  updateAgent,
  WORKSTATIONS,
} from '../src/ductor/starshipSimulation.js';
import {
  ALEC_SEATED_ATLAS,
  ALEC_SEAT,
  ALEC_COMMAND_STATION,
  BENJAMIN_QA_ATLAS,
  drawAlecSeatBack,
  getCommandGesture,
  KEVIN_STARMAP_ATLAS,
} from '../src/ductor/starshipComputerBay.js';

test('visual bubble anchors never change the agent working state', () => {
  const alec = createInitialCrew().find((agent) => agent.name === 'Alec')!;
  Object.assign(alec, WORKSTATIONS.Alec.interactionPoint, {
    state: STATE.WORKING, reportedState: 'working',
  });
  const labels: string[] = [];
  const ctx = new Proxy({}, {
    get: (_, key) => key === 'measureText'
      ? (value: string) => ({ width: value.length * 6 })
      : key === 'fillText'
        ? (value: string) => labels.push(value)
        : () => {},
    set: () => true,
  }) as CanvasRenderingContext2D;
  drawAgentStatusBubble(ctx, alec, ALEC_SEAT.height, -10, 1600, {
    x: ALEC_SEAT.x,
    y: ALEC_SEAT.feetY,
  });
  assert.ok(labels.includes('⚙ đang làm việc'));
  assert.ok(!labels.includes('💤 idle'));
});

test('Alec uses the measured production-room chair geometry for every overlay', () => {
  assert.equal(
    ALEC_COMMAND_STATION.sourceAsset,
    'themes/ductor-space-lab/photonic-room-v3.webp',
  );
  assert.deepEqual(ALEC_COMMAND_STATION.chair, {
    centerX: 552,
    backTopY: 310,
    backCoreY: 349,
    poseBottomY: 355,
    seatBaseY: 399,
    shellBottomY: 406,
  });
  assert.deepEqual(ALEC_SEAT, { x: 552, feetY: 355, height: 74 });
  assert.ok(
    ALEC_SEAT.feetY - ALEC_SEAT.height < ALEC_COMMAND_STATION.chair.backTopY,
    'the head and shoulders must remain visible above the rear-facing chair shell',
  );
  assert.equal(
    WORKSTATIONS.Alec.approachPoint.x,
    ALEC_COMMAND_STATION.chair.centerX,
  );
  assert.equal(
    WORKSTATIONS.Alec.interactionPoint.x,
    ALEC_COMMAND_STATION.chair.centerX,
  );
  const calls: unknown[][] = [];
  const ctx = new Proxy({}, {
    get: (_, key) => (...args: unknown[]) => calls.push([key, ...args]),
    set: () => true,
  }) as CanvasRenderingContext2D;
  drawAlecSeatBack(ctx, { width: 1600, height: 678 } as HTMLImageElement);
  assert.equal(
    calls.filter((call) => call[0] === 'drawImage').length,
    1,
    'restore the production-room chair in one pass',
  );
  assert.equal(
    calls.filter((call) => call[0] === 'bezierCurveTo').length,
    2,
    'the clip must include both curved sides of the chair back',
  );
  assert.ok(
    calls.filter((call) => call[0] === 'quadraticCurveTo').length >= 3,
    'the clip must include the arm wings and lower shell',
  );
  assert.equal(
    calls.some((call) => call[0] === 'fill'),
    false,
    'never paint a synthetic chair over Alec',
  );
  assert.equal(
    calls.filter((call) => call[0] === 'save').length,
    calls.filter((call) => call[0] === 'restore').length,
  );


});

test('production V3 never loads or composites the obsolete photonic bay', () => {
  const labSource = readFileSync(
    new URL('../src/ductor/StarshipLab.tsx', import.meta.url),
    'utf8',
  );
  const simulationSource = readFileSync(
    new URL('../src/ductor/starshipSimulation.ts', import.meta.url),
    'utf8',
  );
  assert.equal(labSource.includes('PHOTONIC_BAY_ASSET'), false);
  assert.equal(labSource.includes('computerBayImg'), false);
  assert.equal(simulationSource.includes('drawPhotonicComputerBay'), false);
  assert.equal(simulationSource.includes('drawCommandContact'), false);
});

test('command gestures only advance while Alec occupies his station; Kevin keeps his independent tour', () => {
  const crew = createInitialCrew();
  const alec = crew.find((a) => a.name === 'Alec')!;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  for (const a of [alec, kevin]) {
    Object.assign(a, WORKSTATIONS[a.name].interactionPoint, {
      state: STATE.WORKING, reportedState: 'working', stateTimer: 100,
    });
  }
  const benjamin = crew.find((a) => a.name === 'Benjamin')!;
  Object.assign(benjamin, WORKSTATIONS.Benjamin.interactionPoint, {
    state: STATE.WORKING, reportedState: 'working', stateTimer: 100,
  });
  for (let i = 0; i < 32; i++) for (const a of [alec, kevin, benjamin]) updateAgent(a, 0.05, 1, crew);
  assert.ok(alec.commandTime! > 1.5);
  assert.equal(getCommandGesture(alec.commandTime!).frame, 1);
  assert.ok(kevin.hologramTime! > 1.5);
  assert.ok(benjamin.qaTime! > 1.5);
  assert.ok(!alec.hologramExpansion);
  Object.assign(alec, { state: STATE.OFFLINE, reportedState: 'offline' });
  updateAgent(alec, 0.05, 1, crew);
  assert.equal(alec.commandTime, 0);
  Object.assign(benjamin, { state: STATE.MOVING, reportedState: 'working', x: 900, y: 600, targetX: 800, targetY: 600 });
  updateAgent(benjamin, 0.05, 1, crew);
  assert.equal(benjamin.qaTime, 0);
  Object.assign(alec, { state: STATE.MOVING, reportedState: 'working', x: 900, y: 600, targetX: 800, targetY: 600 });
  updateAgent(alec, 0.05, 1, crew);
  assert.equal(alec.commandTime, 0);
});

test('working state and effects begin only at the exact interaction anchors', () => {
  const crew = createInitialCrew();
  for (const agent of crew) {
    const ws = WORKSTATIONS[agent.name];
    Object.assign(agent, ws.approachPoint, { state: STATE.WORKING, reportedState: 'working' });
    assert.equal(isAgentAtStation(agent), false, `${agent.name} approach is not an interaction anchor`);
    assert.equal(isAgentWorkingAtAssignedStation(agent), false);
    assert.equal(getAgentStatusBubble(agent).lines[1], '↗ đến trạm');

    Object.assign(agent, ws.interactionPoint);
    assert.equal(isAgentAtStation(agent), true, `${agent.name} snaps at its interaction anchor`);
    assert.equal(isAgentWorkingAtAssignedStation(agent), true);
    assert.equal(getAgentStatusBubble(agent).lines[1], '⚙ đang làm việc');
  }
  const kevin = crew.find((agent) => agent.name === 'Kevin')!;
  const benjamin = crew.find((agent) => agent.name === 'Benjamin')!;
  assert.equal(isKevinUsingStarMap(kevin), true);
  assert.equal(isBenjaminUsingScanner(benjamin), true);
});

test('all four-frame authored work-pose atlases decode with transparent borders', () => {
  const assets = [
    ['alec-command-seated-v2.png', ALEC_SEATED_ATLAS],
    ['kevin-starmap-control-v2.png', KEVIN_STARMAP_ATLAS],
    ['benjamin-qa-control-v1.png', BENJAMIN_QA_ATLAS],
  ] as const;
  for (const [asset, atlas] of assets) {
    const png = PNG.sync.read(
      readFileSync(new URL(`../public/assets/themes/ductor-space-lab/${asset}`, import.meta.url)),
      { checkCRC: true },
    );
    assert.equal(png.width, atlas.width, asset);
    assert.equal(png.height, atlas.height, asset);
    const cell = png.width / atlas.columns;
    for (let frame = 0; frame < atlas.columns; frame++) {
      let opaque = 0;
      for (let y = 0; y < png.height; y++) for (let x = 0; x < cell; x++) {
        const alpha = png.data[(y * png.width + frame * cell + x) * 4 + 3]!;
        // Image encoders can leave a one-alpha antialias sample on an outer
        // pixel; it remains visually transparent and must not affect atlas
        // placement.
        if (x === 0 || x === cell - 1 || y === 0 || y === png.height - 1) assert.ok(alpha <= 1, asset);
        if (alpha > 128) opaque++;
      }
      assert.ok(opaque > 50000, `Incomplete ${asset} frame ${frame}`);
    }
  }
});
