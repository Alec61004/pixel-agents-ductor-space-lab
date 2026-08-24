import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import {
  applySnapshotToAgents,
  ASSIGNED_WORKSTATIONS,
  ATTENTION_POINTS,
  clampPointToPolygon,
  createInitialCrew,
  DEPTH_SCALE_MAX,
  DEPTH_SCALE_MIN,
  drawFloorMarkers,
  drawWorkstationLabels,
  FLOOR_Y_MAX,
  FLOOR_Y_MIN,
  getDepthScale,
  IDLE_POINTS,
  isPointInPolygon,
  OFFLINE_POINTS,
  pickStation,
  routeToPoint,
  STATIONS,
  StarshipLab,
  STATE,
  updateAgent,
  WALKABLE_POLYGON,
} from '../src/ductor/StarshipLab.js';
import type { DuctorStatusSnapshot } from '../src/ductor/ductorLabModel.js';

const snapshot: DuctorStatusSnapshot = {
  theme: 'ductor-space-lab',
  roles: [
    {
      name: 'Alec',
      presence: 'online',
      state: 'working',
      taskLabel: 'Coordinate MVP',
      updatedAt: '2026-08-22T05:30:00.000Z',
      derived: false,
    },
    {
      name: 'Kevin',
      presence: 'online',
      state: 'working',
      taskLabel: 'Implement bridge',
      updatedAt: '2026-08-22T05:30:00.000Z',
      derived: false,
    },
    {
      name: 'Benjamin',
      presence: 'online',
      state: 'review',
      taskLabel: 'Review contract',
      updatedAt: '2026-08-22T05:30:00.000Z',
      derived: false,
    },
  ],
};

test('renders StarshipLab without crashing with 2 canvases and 3 agents', () => {
  const markup = renderToStaticMarkup(createElement(StarshipLab, { snapshot }));

  assert.match(markup, /data-starship-lab="true"/);
  assert.match(markup, /id="stage"/);
  assert.match(markup, /id="stars"/);
  assert.match(markup, /STARSHIP AGENTS/);
  assert.match(markup, /Alec/);
  assert.match(markup, /Kevin/);
  assert.match(markup, /Benjamin/);
  assert.match(markup, /Nebula Sentinel/);
  assert.match(markup, /Void Recon Unit/);
  assert.match(markup, /Crimson Hunter-Class/);
});

test('spawns exactly 3 initial agents with distinct skins matching Alec, Kevin, Benjamin', () => {
  const crew = createInitialCrew(snapshot);
  assert.equal(crew.length, 3);

  const alec = crew.find((a) => a.name === 'Alec');
  const kevin = crew.find((a) => a.name === 'Kevin');
  const benjamin = crew.find((a) => a.name === 'Benjamin');

  assert.ok(alec);
  assert.ok(kevin);
  assert.ok(benjamin);

  assert.equal(alec.skin.row, 4); // Nebula Sentinel
  assert.equal(kevin.skin.row, 2); // Void Recon Unit
  assert.equal(benjamin.skin.row, 0); // Crimson Hunter-Class
});

test('has 8 design stations and supports least-occupied pickStation', () => {
  assert.equal(STATIONS.length, 8);
  const crew = createInitialCrew(snapshot);

  const { stationIndex, slot } = pickStation(crew, null);
  assert.ok(stationIndex >= 0 && stationIndex < STATIONS.length);
  assert.ok(slot);
});

test('state machine transitions MOVING -> WORKING on arrival and handles routeToPoint', () => {
  const crew = createInitialCrew(snapshot);
  const agent = crew[0];

  // Test manual reroute
  routeToPoint([agent], 500, 400);
  assert.equal(agent.state, STATE.MOVING);
  assert.equal(agent.targetX, 500);
  assert.equal(agent.targetY, 400);

  // Position close to target and step update
  agent.x = 499;
  agent.y = 400;
  updateAgent(agent, 0.016, 1, crew);
  assert.equal(agent.state, STATE.WORKING);
  assert.ok(agent.stateTimer > 0);
});

test('maps live status snapshot roles to respective states: working, idle, blocked, offline', () => {
  const mixedSnapshot: DuctorStatusSnapshot = {
    theme: 'ductor-space-lab',
    roles: [
      {
        name: 'Alec',
        presence: 'online',
        state: 'idle',
        taskLabel: 'Standby',
        updatedAt: '2026-08-22T05:30:00.000Z',
        derived: false,
      },
      {
        name: 'Kevin',
        presence: 'online',
        state: 'blocked',
        taskLabel: 'Need API key',
        updatedAt: '2026-08-22T05:30:00.000Z',
        derived: false,
      },
      {
        name: 'Benjamin',
        presence: 'offline',
        state: 'offline',
        taskLabel: null,
        updatedAt: '2026-08-22T05:30:00.000Z',
        derived: true,
      },
    ],
  };

  const crew = createInitialCrew(mixedSnapshot);
  const alec = crew.find((a) => a.name === 'Alec')!;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  const benjamin = crew.find((a) => a.name === 'Benjamin')!;

  assert.equal(alec.state, STATE.IDLE);
  assert.equal(alec.x, IDLE_POINTS.Alec.x);
  assert.equal(alec.y, IDLE_POINTS.Alec.y);

  assert.equal(kevin.state, STATE.BLOCKED);
  assert.equal(kevin.x, ATTENTION_POINTS.Kevin.x);
  assert.equal(kevin.y, ATTENTION_POINTS.Kevin.y);

  assert.equal(benjamin.state, STATE.OFFLINE);
  assert.equal(benjamin.x, OFFLINE_POINTS.Benjamin.x);
  assert.equal(benjamin.y, OFFLINE_POINTS.Benjamin.y);
});

test('applies live snapshot transitions dynamically to active crew', () => {
  const crew = createInitialCrew(snapshot);
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  assert.equal(kevin.state, STATE.WORKING);

  // Transition Kevin to blocked
  const blockedSnapshot: DuctorStatusSnapshot = {
    ...snapshot,
    roles: [
      snapshot.roles[0]!,
      {
        name: 'Kevin',
        presence: 'online',
        state: 'blocked',
        taskLabel: 'Waiting for permission',
        updatedAt: '2026-08-22T05:35:00.000Z',
        derived: false,
      },
      snapshot.roles[2]!,
    ],
  };

  applySnapshotToAgents(crew, blockedSnapshot);
  assert.equal(kevin.reportedState, 'blocked');
  assert.equal(kevin.targetX, ATTENTION_POINTS.Kevin.x);
  assert.equal(kevin.targetY, ATTENTION_POINTS.Kevin.y);
  assert.equal(kevin.state, STATE.MOVING);

  // Step Kevin to target
  kevin.x = ATTENTION_POINTS.Kevin.x - 1;
  kevin.y = ATTENTION_POINTS.Kevin.y;
  updateAgent(kevin, 0.016, 1, crew);
  assert.equal(kevin.state, STATE.BLOCKED);
});

test('falls back cleanly to random behavior when snapshot is missing or disconnected without crash', () => {
  const crew = createInitialCrew(undefined);
  assert.equal(crew.length, 3);
  for (const a of crew) {
    assert.equal(a.reportedState, undefined);
    assert.equal(a.state, STATE.WORKING);
  }

  // Disconnecting snapshot from active crew clears reportedState and restores random navigation
  const activeCrew = createInitialCrew(snapshot);
  applySnapshotToAgents(activeCrew, null);
  for (const a of activeCrew) {
    assert.equal(a.reportedState, undefined);
  }
});

test('renders live status badges in roster matching snapshot roles', () => {
  const markup = renderToStaticMarkup(createElement(StarshipLab, { snapshot }));

  assert.match(markup, /<div class="starship-badge badge working">\s*WORKING\s*<\/div>/);
  assert.match(markup, /<div class="starship-badge badge review">\s*REVIEW\s*<\/div>/);
});

test('defines 3 fixed workstations (Alec, Kevin, Benjamin) with correct labels and coordinates within walkable polygon', () => {
  assert.ok(ASSIGNED_WORKSTATIONS.Alec);
  assert.ok(ASSIGNED_WORKSTATIONS.Kevin);
  assert.ok(ASSIGNED_WORKSTATIONS.Benjamin);

  assert.equal(ASSIGNED_WORKSTATIONS.Alec.label, 'Alec — Strategy');
  assert.equal(ASSIGNED_WORKSTATIONS.Kevin.label, 'Kevin — Build');
  assert.equal(ASSIGNED_WORKSTATIONS.Benjamin.label, 'Benjamin — QA');

  assert.equal(typeof drawWorkstationLabels, 'function');
  assert.equal(typeof drawFloorMarkers, 'function');

  // Standing points must be inside walkable polygon
  assert.equal(
    isPointInPolygon(
      { x: ASSIGNED_WORKSTATIONS.Alec.standingX, y: ASSIGNED_WORKSTATIONS.Alec.standingY },
      WALKABLE_POLYGON,
    ),
    true,
  );
  assert.equal(
    isPointInPolygon(
      { x: ASSIGNED_WORKSTATIONS.Kevin.standingX, y: ASSIGNED_WORKSTATIONS.Kevin.standingY },
      WALKABLE_POLYGON,
    ),
    true,
  );
  assert.equal(
    isPointInPolygon(
      { x: ASSIGNED_WORKSTATIONS.Benjamin.standingX, y: ASSIGNED_WORKSTATIONS.Benjamin.standingY },
      WALKABLE_POLYGON,
    ),
    true,
  );
});

test('agent working state positions agent at their own assigned workstation and not others', () => {
  const crew = createInitialCrew(snapshot);
  const alec = crew.find((a) => a.name === 'Alec')!;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  const benjamin = crew.find((a) => a.name === 'Benjamin')!;

  // Alec must be at Alec's desk, not Kevin's or Benjamin's desk
  assert.equal(alec.x, ASSIGNED_WORKSTATIONS.Alec.standingX);
  assert.equal(alec.y, ASSIGNED_WORKSTATIONS.Alec.standingY);
  assert.equal(alec.currentStation, 'Alec — Strategy');
  assert.notEqual(alec.x, ASSIGNED_WORKSTATIONS.Kevin.standingX);
  assert.notEqual(alec.x, ASSIGNED_WORKSTATIONS.Benjamin.standingX);

  // Kevin must be at Kevin's desk, not Alec's or Benjamin's desk
  assert.equal(kevin.x, ASSIGNED_WORKSTATIONS.Kevin.standingX);
  assert.equal(kevin.y, ASSIGNED_WORKSTATIONS.Kevin.standingY);
  assert.equal(kevin.currentStation, 'Kevin — Build');
  assert.notEqual(kevin.x, ASSIGNED_WORKSTATIONS.Alec.standingX);
  assert.notEqual(kevin.x, ASSIGNED_WORKSTATIONS.Benjamin.standingX);

  // Benjamin must be at Benjamin's desk, not Alec's or Kevin's desk
  assert.equal(benjamin.x, ASSIGNED_WORKSTATIONS.Benjamin.standingX);
  assert.equal(benjamin.y, ASSIGNED_WORKSTATIONS.Benjamin.standingY);
  assert.equal(benjamin.currentStation, 'Benjamin — QA');
  assert.notEqual(benjamin.x, ASSIGNED_WORKSTATIONS.Alec.standingX);
  assert.notEqual(benjamin.x, ASSIGNED_WORKSTATIONS.Kevin.standingX);
});

test('simulation 10-second run: idle/demo crew changes position at least 2 times and changes state at least 1 time (fails if agents stand still)', () => {
  const demoCrew = createInitialCrew(undefined);
  const positionChangeCounts = new Map<string, number>();
  const stateChangeCounts = new Map<string, number>();
  const lastPositions = new Map<string, { x: number; y: number }>();
  const lastStates = new Map<string, string>();

  for (const a of demoCrew) {
    positionChangeCounts.set(a.id, 0);
    stateChangeCounts.set(a.id, 0);
    lastPositions.set(a.id, { x: a.x, y: a.y });
    lastStates.set(a.id, a.state);
  }

  const dt = 0.05;
  const totalSteps = 10 / dt; // 200 steps = 10 seconds

  for (let step = 0; step < totalSteps; step++) {
    for (const a of demoCrew) {
      updateAgent(a, dt, 1, demoCrew);

      const lastPos = lastPositions.get(a.id)!;
      if (Math.abs(a.x - lastPos.x) > 0.1 || Math.abs(a.y - lastPos.y) > 0.1) {
        positionChangeCounts.set(a.id, positionChangeCounts.get(a.id)! + 1);
        lastPositions.set(a.id, { x: a.x, y: a.y });
      }

      const lastState = lastStates.get(a.id)!;
      if (a.state !== lastState) {
        stateChangeCounts.set(a.id, stateChangeCounts.get(a.id)! + 1);
        lastStates.set(a.id, a.state);
      }
    }
  }

  for (const a of demoCrew) {
    const posChanges = positionChangeCounts.get(a.id)!;
    const stateChanges = stateChangeCounts.get(a.id)!;
    console.log(`[MOTION TEST] ${a.name}: ${posChanges} position changes, ${stateChanges} state changes`);
    assert.ok(
      posChanges >= 2,
      `Agent ${a.name} should have changed position at least 2 times, but only changed ${posChanges} times (agent was stationary)`,
    );
    assert.ok(
      stateChanges >= 1,
      `Agent ${a.name} should have changed state at least 1 time, but only changed ${stateChanges} times`,
    );
  }
});

test('point-in-polygon correctly distinguishes walkable floor points from out-of-bound areas', () => {
  // Points on the walkable floor
  assert.equal(isPointInPolygon({ x: 800, y: 560 }, WALKABLE_POLYGON), true);
  assert.equal(isPointInPolygon({ x: 430, y: 600 }, WALKABLE_POLYGON), true);
  assert.equal(isPointInPolygon({ x: 210, y: 560 }, WALKABLE_POLYGON), true);
  assert.equal(isPointInPolygon({ x: 1230, y: 600 }, WALKABLE_POLYGON), true);

  // Points outside walkable floor (ceiling, upper wall, bottom out-of-bounds, sides)
  assert.equal(isPointInPolygon({ x: 800, y: 100 }, WALKABLE_POLYGON), false); // ceiling
  assert.equal(isPointInPolygon({ x: 500, y: 300 }, WALKABLE_POLYGON), false); // upper wall
  assert.equal(isPointInPolygon({ x: 800, y: 800 }, WALKABLE_POLYGON), false); // bottom out-of-bounds
  assert.equal(isPointInPolygon({ x: -50, y: 560 }, WALKABLE_POLYGON), false); // left out-of-bounds
  assert.equal(isPointInPolygon({ x: 1800, y: 560 }, WALKABLE_POLYGON), false); // right out-of-bounds
});

test('clampPointToPolygon preserves interior points and projects outside points onto walkable polygon', () => {
  // Interior point remains unchanged
  const insidePt = { x: 700, y: 550 };
  const clampedInside = clampPointToPolygon(insidePt, WALKABLE_POLYGON);
  assert.equal(clampedInside.x, insidePt.x);
  assert.equal(clampedInside.y, insidePt.y);

  // Ceiling point clamped to top floor boundary
  const ceilingPt = { x: 800, y: 100 };
  const clampedCeiling = clampPointToPolygon(ceilingPt, WALKABLE_POLYGON);
  assert.equal(isPointInPolygon(clampedCeiling, WALKABLE_POLYGON), true);
  assert.ok(clampedCeiling.y >= 490 && clampedCeiling.y <= 500);

  // Below floor point clamped to bottom floor boundary
  const bottomPt = { x: 800, y: 900 };
  const clampedBottom = clampPointToPolygon(bottomPt, WALKABLE_POLYGON);
  assert.equal(isPointInPolygon(clampedBottom, WALKABLE_POLYGON), true);
  assert.ok(clampedBottom.y >= 658 && clampedBottom.y <= 660.1);

  // Far left point clamped to left floor boundary
  const leftPt = { x: -200, y: 560 };
  const clampedLeft = clampPointToPolygon(leftPt, WALKABLE_POLYGON);
  assert.equal(isPointInPolygon(clampedLeft, WALKABLE_POLYGON), true);
  assert.ok(clampedLeft.x >= 49.9 && clampedLeft.x <= 51);
});

test('getDepthScale calculates linear depth scaling between rear wall ~0.8 and front edge ~1.1', () => {
  // Min Y (rear wall) -> 0.8
  const rearScale = getDepthScale(FLOOR_Y_MIN);
  assert.equal(rearScale, DEPTH_SCALE_MIN);
  assert.equal(rearScale, 0.8);

  // Below min Y clamped to 0.8
  assert.equal(getDepthScale(FLOOR_Y_MIN - 100), DEPTH_SCALE_MIN);

  // Max Y (front edge) -> 1.1
  const frontScale = getDepthScale(FLOOR_Y_MAX);
  assert.equal(frontScale, DEPTH_SCALE_MAX);
  assert.equal(frontScale, 1.1);

  // Above max Y clamped to 1.1
  assert.equal(getDepthScale(FLOOR_Y_MAX + 100), DEPTH_SCALE_MAX);

  // Midpoint -> 0.95
  const midY = (FLOOR_Y_MIN + FLOOR_Y_MAX) / 2;
  const midScale = getDepthScale(midY);
  assert.ok(Math.abs(midScale - 0.95) < 1e-5);

  // Monotonic increase as y increases from rear to front
  assert.ok(getDepthScale(500) < getDepthScale(550));
  assert.ok(getDepthScale(550) < getDepthScale(600));
  assert.ok(getDepthScale(600) < getDepthScale(650));
});

test('agents stepping outside walkable floor are clamped to walkable polygon during movement', () => {
  const crew = createInitialCrew(snapshot);
  const agent = crew[0];

  // Set agent target far outside in the ceiling
  agent.x = 800;
  agent.y = 520;
  agent.targetX = 800;
  agent.targetY = 50; // far in ceiling
  agent.state = STATE.MOVING;

  // Step agent forward 30 steps
  for (let i = 0; i < 30; i++) {
    updateAgent(agent, 0.05, 1, crew);
    // Every step must stay inside the walkable floor
    assert.equal(
      isPointInPolygon({ x: agent.x, y: agent.y }, WALKABLE_POLYGON),
      true,
      `Agent ${agent.name} walked outside walkable floor at (${agent.x}, ${agent.y})`,
    );
  }
});


