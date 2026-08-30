import assert from 'node:assert/strict';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import type { DuctorStatusSnapshot } from '../src/ductor/ductorLabModel.js';
import {
  applySnapshotToAgents,
  ASSIGNED_WORKSTATIONS,
  BUILD_MONITOR_RECTS,
  ATTENTION_POINTS,
  clampPointToPolygon,
  createInitialCrew,
  DEPTH_SCALE_MAX,
  DEPTH_SCALE_MIN,
  drawAgent,
  drawAgentStatusBubble,
  drawDeskCutouts,
  drawFloorMarkers,
  drawHologramTopGlow,
  drawWorkParticles,
  drawWorkstationInteraction,
  drawWorkstationLabels,
  drawWorkstationScreens,
  FLOOR_Y_MAX,
  FLOOR_Y_MIN,
  getAgentStatusBubble,
  getDepthScale,
  hitTestDeckObject,
  IDLE_POINTS,
  INTERACTIVE_DECK_OBJECTS,
  isPointInPolygon,
  makeAgent,
  OFFLINE_POINTS,
  pickStation,
  ROLE_GLOW_COLORS,
  ROLE_PARTICLE_ICONS,
  routeToPoint,
  SKINS,
  StarshipLab,
  STATE,
  STATIONS,
  updateAgent,
  WAITING_POINTS,
  WALKABLE_POLYGON,
  WORKSTATIONS,
} from '../src/ductor/StarshipLab.js';

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
  assert.match(markup, /DUCTOR SPACE LAB/);
  assert.match(markup, /Alec/);
  assert.match(markup, /Kevin/);
  assert.match(markup, /Benjamin/);
  assert.match(markup, /Coordinate MVP/);
  assert.match(markup, /Strategy/);
  assert.match(markup, /Build/);
  assert.match(markup, /QA/);
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

test('keeps waiting agents at their hold points with a truthful waiting bubble', () => {
  const waitingSnapshot: DuctorStatusSnapshot = {
    ...snapshot,
    roles: snapshot.roles.map((role) => ({
      ...role,
      state: 'waiting',
      taskLabel: 'Awaiting next instruction',
    })),
  };

  const crew = createInitialCrew(waitingSnapshot);
  for (const agent of crew) {
    const point = WAITING_POINTS[agent.name];
    assert.equal(agent.state, STATE.WAITING);
    assert.deepEqual({ x: agent.x, y: agent.y }, point);

    const bubble = getAgentStatusBubble(agent);
    assert.deepEqual(bubble.lines, [`${agent.name.toUpperCase()}  ·  WAITING`]);

    const before = { x: agent.x, y: agent.y };
    updateAgent(agent, 5, 1, crew);
    assert.deepEqual({ x: agent.x, y: agent.y }, before);
    assert.equal(agent.state, STATE.WAITING);
  }
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

test('renders compact live crew pills matching snapshot roles', () => {
  const markup = renderToStaticMarkup(createElement(StarshipLab, { snapshot }));

  assert.match(markup, /class="starship-crew-pill working"/);
  assert.match(markup, /class="starship-crew-pill review"/);
  assert.match(markup, /class="starship-crew-state">working<\/span>/);
  assert.match(markup, /class="starship-crew-state">review<\/span>/);
});

test('shows the reported task beside each live roster status', () => {
  const markup = renderToStaticMarkup(createElement(StarshipLab, { snapshot }));

  assert.match(markup, /title="Coordinate MVP"/);
  assert.match(markup, /title="Implement bridge"/);
  assert.match(markup, /title="Review contract"/);
});

test('defines 3 fixed workstations (Alec, Kevin, Benjamin) with correct labels and coordinates within walkable polygon', () => {
  assert.ok(WORKSTATIONS.Alec);
  assert.ok(WORKSTATIONS.Kevin);
  assert.ok(WORKSTATIONS.Benjamin);

  // Calibrated against the painted furniture in the 1600×678 deck image.
  assert.deepEqual(WORKSTATIONS.Alec.walkPoint, { x: 558, y: 627 });
  assert.equal(WORKSTATIONS.Alec.facing, 'back');
  assert.deepEqual(WORKSTATIONS.Alec.screenRect, {
    x: 500,
    y: 515,
    w: 118,
    h: 78,
  });
  assert.deepEqual(WORKSTATIONS.Alec.deskCutout, {
    x: 500,
    y: 584,
    w: 118,
    h: 43,
  });
  assert.equal(WORKSTATIONS.Alec.label, 'Alec — Strategy');

  assert.deepEqual(WORKSTATIONS.Kevin.walkPoint, { x: 491, y: 436 });
  assert.equal(WORKSTATIONS.Kevin.facing, 'back');
  assert.deepEqual(WORKSTATIONS.Kevin.screenRect, {
    x: 466,
    y: 310,
    w: 246,
    h: 42,
  });
  assert.deepEqual(WORKSTATIONS.Kevin.deskCutout, {
    x: 474,
    y: 407,
    w: 38,
    h: 32,
  });
  assert.equal(WORKSTATIONS.Kevin.label, 'Kevin — Build');

  assert.deepEqual(WORKSTATIONS.Benjamin.walkPoint, { x: 1080, y: 595 });
  assert.equal(WORKSTATIONS.Benjamin.facing, 'back');
  assert.deepEqual(WORKSTATIONS.Benjamin.screenRect, {
    x: 1024,
    y: 548,
    w: 112,
    h: 42,
  });
  assert.deepEqual(WORKSTATIONS.Benjamin.deskCutout, {
    x: 998,
    y: 566,
    w: 176,
    h: 70,
  });
  assert.equal(WORKSTATIONS.Benjamin.label, 'Benjamin — QA');

  assert.equal(typeof drawWorkstationLabels, 'function');
  assert.equal(typeof drawWorkstationScreens, 'function');
  assert.equal(typeof drawDeskCutouts, 'function');
  assert.equal(typeof drawHologramTopGlow, 'function');
  assert.equal(typeof drawFloorMarkers, 'function');

  // Walk points must be inside deskCutout y range for desk occlusion
  assert.ok(
    WORKSTATIONS.Alec.walkPoint.y >= WORKSTATIONS.Alec.deskCutout.y &&
      WORKSTATIONS.Alec.walkPoint.y <=
        WORKSTATIONS.Alec.deskCutout.y + WORKSTATIONS.Alec.deskCutout.h,
  );
  assert.ok(
    WORKSTATIONS.Kevin.walkPoint.y >= WORKSTATIONS.Kevin.deskCutout.y &&
      WORKSTATIONS.Kevin.walkPoint.y <=
        WORKSTATIONS.Kevin.deskCutout.y + WORKSTATIONS.Kevin.deskCutout.h,
  );
  assert.ok(
    WORKSTATIONS.Benjamin.walkPoint.y >= WORKSTATIONS.Benjamin.deskCutout.y &&
      WORKSTATIONS.Benjamin.walkPoint.y <=
        WORKSTATIONS.Benjamin.deskCutout.y + WORKSTATIONS.Benjamin.deskCutout.h,
  );

  // Walk points must be inside walkable polygon
  assert.equal(isPointInPolygon(WORKSTATIONS.Alec.walkPoint, WALKABLE_POLYGON), true);
  assert.equal(isPointInPolygon(WORKSTATIONS.Kevin.walkPoint, WALKABLE_POLYGON), true);
  assert.equal(isPointInPolygon(WORKSTATIONS.Benjamin.walkPoint, WALKABLE_POLYGON), true);
});

test('game layer exposes six precise interactive systems and hit-tests their hotspots', () => {
  assert.equal(INTERACTIVE_DECK_OBJECTS.length, 6);
  for (const object of INTERACTIVE_DECK_OBJECTS) {
    const centerX = object.rect.x + object.rect.w / 2;
    const centerY = object.rect.y + object.rect.h / 2;
    assert.equal(hitTestDeckObject(centerX, centerY)?.id, object.id);
    assert.ok(object.actionLabel.length > 0);
    assert.ok(object.description.length > 20);
  }
  assert.equal(hitTestDeckObject(10, 10), null);
});

test('render exposes game controls without covering the deck before a system is selected', () => {
  const markup = renderToStaticMarkup(createElement(StarshipLab, { snapshot }));
  assert.match(markup, /Hover/);
  assert.match(markup, /Click/);
  assert.match(markup, /Wheel/);
  assert.doesNotMatch(markup, /<aside/);
});

test('agent working state positions agent at their own assigned workstation seatPoint and facing matches workstation config', () => {
  const crew = createInitialCrew(snapshot);
  const alec = crew.find((a) => a.name === 'Alec')!;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  const benjamin = crew.find((a) => a.name === 'Benjamin')!;

  // Alec must be at Alec's desk seatPoint facing front
  assert.equal(alec.x, WORKSTATIONS.Alec.seatPoint.x);
  assert.equal(alec.y, WORKSTATIONS.Alec.seatPoint.y);
  assert.equal(alec.facing, 'back');
  assert.equal(alec.currentStation, 'Alec — Strategy');
  assert.notEqual(alec.x, WORKSTATIONS.Kevin.seatPoint.x);
  assert.notEqual(alec.x, WORKSTATIONS.Benjamin.seatPoint.x);

  // Kevin must be at Kevin's desk seatPoint facing back
  assert.equal(kevin.x, WORKSTATIONS.Kevin.seatPoint.x);
  assert.equal(kevin.y, WORKSTATIONS.Kevin.seatPoint.y);
  assert.equal(kevin.facing, 'back');
  assert.equal(kevin.currentStation, 'Kevin — Build');
  assert.notEqual(kevin.x, WORKSTATIONS.Alec.seatPoint.x);
  assert.notEqual(kevin.x, WORKSTATIONS.Benjamin.seatPoint.x);

  // Benjamin must be at Benjamin's desk seatPoint facing back
  assert.equal(benjamin.x, WORKSTATIONS.Benjamin.seatPoint.x);
  assert.equal(benjamin.y, WORKSTATIONS.Benjamin.seatPoint.y);
  assert.equal(benjamin.facing, 'back');
  assert.equal(benjamin.currentStation, 'Benjamin — QA');
  assert.notEqual(benjamin.x, WORKSTATIONS.Alec.seatPoint.x);
  assert.notEqual(benjamin.x, WORKSTATIONS.Kevin.seatPoint.x);
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
    console.log(
      `[MOTION TEST] ${a.name}: ${posChanges} position changes, ${stateChanges} state changes`,
    );
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

test('defines role glow colors for Alec (#c98bff), Kevin (#5ce1ff), and Benjamin (#ff5c5c)', () => {
  assert.equal(ROLE_GLOW_COLORS.Alec, '#c98bff');
  assert.equal(ROLE_GLOW_COLORS.Kevin, '#5ce1ff');
  assert.equal(ROLE_GLOW_COLORS.Benjamin, '#ff5c5c');
});

test('makeAgent defaults flash to 1 when undefined and updateAgent never drops flash below 1', () => {
  const agent = makeAgent({
    id: 'Kevin',
    name: 'Kevin',
    role: 'Builder',
    skin: SKINS[2],
    x: 500,
    y: 500,
  });

  assert.equal(agent.flash, 1);

  // Update over multiple frames with dt=1.0: flash must not decay below 1
  updateAgent(agent, 1.0, 1, [agent]);
  assert.equal(agent.flash, 1);

  updateAgent(agent, 5.0, 1, [agent]);
  assert.equal(agent.flash, 1);

  // If flash was elevated (e.g. 2.0 on click), it decays to 1 and halts at 1
  agent.flash = 2.0;
  updateAgent(agent, 0.1, 1, [agent]);
  assert.ok(agent.flash < 2.0 && agent.flash >= 1.0);

  updateAgent(agent, 5.0, 1, [agent]);
  assert.equal(agent.flash, 1.0);
});

test('drawAgent disables imageSmoothingEnabled, sets role shadowColor rim glow, and executes lighter boost pass', () => {
  const crew = createInitialCrew(snapshot);
  const kevin = crew.find((a) => a.name === 'Kevin')!;

  const drawCalls: any[] = [];
  const operations: string[] = [];

  const mockCtx = {
    save: () => operations.push('save'),
    restore: () => operations.push('restore'),
    translate: () => operations.push('translate'),
    scale: () => operations.push('scale'),
    beginPath: () => operations.push('beginPath'),
    roundRect: () => operations.push('roundRect'),
    rect: () => operations.push('rect'),
    ellipse: () => operations.push('ellipse'),
    fill: () => operations.push('fill'),
    stroke: () => operations.push('stroke'),
    fillText: () => operations.push('fillText'),
    drawImage: (...args: any[]) => {
      drawCalls.push({
        args,
        imageSmoothingEnabled: mockCtx.imageSmoothingEnabled,
        shadowColor: mockCtx.shadowColor,
        shadowBlur: mockCtx.shadowBlur,
        globalCompositeOperation: mockCtx.globalCompositeOperation,
        globalAlpha: mockCtx.globalAlpha,
      });
      operations.push('drawImage');
    },
    imageSmoothingEnabled: true,
    shadowColor: '',
    shadowBlur: 0,
    globalCompositeOperation: 'source-over',
    globalAlpha: 1.0,
    font: '',
    textAlign: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;

  const mockImg = { width: 512, height: 256 } as HTMLImageElement;

  drawAgent(mockCtx, kevin, mockImg);

  // Must have executed at least 2 drawImage passes (base + lighter brightness boost)
  assert.ok(drawCalls.length >= 2);

  // First sprite draw: pixel smoothing disabled with a restrained role rim glow.
  const basePass = drawCalls[0];
  assert.equal(basePass.imageSmoothingEnabled, false);
  assert.equal(basePass.shadowColor, '#5ce1ff');
  assert.equal(basePass.shadowBlur, 3);

  // Second sprite draw: subtle lighter pass keeps the sprite integrated with the room.
  const boostPass = drawCalls[1];
  assert.equal(boostPass.globalCompositeOperation, 'lighter');
  assert.equal(boostPass.globalAlpha, 0.12);
});

test('getAgentStatusBubble generates correct text and role colors for working, idle, blocked, and offline states', () => {
  const alec = makeAgent({
    id: 'Alec',
    name: 'Alec',
    role: 'Planner',
    skin: SKINS[4],
    x: 480,
    y: 505,
    state: STATE.WORKING,
  });
  const kevin = makeAgent({
    id: 'Kevin',
    name: 'Kevin',
    role: 'Builder',
    skin: SKINS[2],
    x: 920,
    y: 535,
    state: STATE.WORKING,
  });
  const benjamin = makeAgent({
    id: 'Benjamin',
    name: 'Benjamin',
    role: 'QA',
    skin: SKINS[0],
    x: 1240,
    y: 520,
    state: STATE.WORKING,
  });

  // The in-world label is deliberately compact so it does not cover equipment.
  const alecBubble = getAgentStatusBubble(alec);
  assert.equal(alecBubble.text, 'ALEC  ·  WORKING');
  assert.equal(alecBubble.color, '#c98bff');
  assert.equal(alecBubble.borderColor, '#c98bff');

  const kevinBubble = getAgentStatusBubble(kevin);
  assert.equal(kevinBubble.text, 'KEVIN  ·  WORKING');
  assert.equal(kevinBubble.color, '#5ce1ff');
  assert.equal(kevinBubble.borderColor, '#5ce1ff');

  const benjaminBubble = getAgentStatusBubble(benjamin);
  assert.equal(benjaminBubble.text, 'BENJAMIN  ·  WORKING');
  assert.equal(benjaminBubble.color, '#ff5c5c');
  assert.equal(benjaminBubble.borderColor, '#ff5c5c');

  // Idle state - name always shows in line 1
  alec.state = STATE.IDLE;
  alec.reportedState = 'idle';
  const idleBubble = getAgentStatusBubble(alec);
  assert.equal(idleBubble.text, 'ALEC  ·  IDLE');

  // Offline state - name always shows in line 1
  kevin.state = STATE.OFFLINE;
  kevin.reportedState = 'offline';
  const offlineBubble = getAgentStatusBubble(kevin);
  assert.equal(offlineBubble.text, 'KEVIN  ·  OFFLINE');

  // Blocked state - name always shows in line 1
  benjamin.state = STATE.BLOCKED;
  benjamin.reportedState = 'blocked';
  const blockedBubble = getAgentStatusBubble(benjamin);
  assert.equal(blockedBubble.text, 'BENJAMIN  ·  BLOCKED');
});

test('work particles spawn every ~0.9s for working agents with role-specific icons and float upward', () => {
  const crew = createInitialCrew(snapshot);
  const alec = crew.find((a) => a.name === 'Alec')!;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  const benjamin = crew.find((a) => a.name === 'Benjamin')!;

  assert.equal(ROLE_PARTICLE_ICONS.Alec, '✦');
  assert.equal(ROLE_PARTICLE_ICONS.Kevin, '</>');
  assert.equal(ROLE_PARTICLE_ICONS.Benjamin, '✓');

  // Initial state: no particles
  assert.equal(alec.particles?.length ?? 0, 0);

  // Advance 0.5s: not yet spawned (timer < 0.9s)
  updateAgent(alec, 0.5, 1, crew);
  assert.equal(alec.particles?.length ?? 0, 0);

  // Advance another 0.5s (total 1.0s >= 0.9s): particle spawns
  updateAgent(alec, 0.5, 1, crew);
  assert.equal(alec.particles?.length, 1);
  const p1 = alec.particles![0]!;
  assert.equal(p1.icon, '✦');
  assert.equal(p1.color, '#c98bff');
  assert.ok(p1.vy < 0); // upward velocity

  // Test Kevin code particle
  updateAgent(kevin, 1.0, 1, crew);
  assert.equal(kevin.particles?.length, 1);
  const kp = kevin.particles![0]!;
  assert.equal(kp.icon, '</>');
  assert.equal(kp.color, '#5ce1ff');

  // Test Benjamin check particle
  updateAgent(benjamin, 1.0, 1, crew);
  assert.equal(benjamin.particles?.length, 1);
  const bp = benjamin.particles![0]!;
  assert.equal(bp.icon, '✓');
  assert.equal(bp.color, '#ff5c5c');

  // Particles float upward and decay over time
  const initialY = p1.y;
  updateAgent(alec, 0.3, 1, crew);
  assert.ok(p1.y < initialY, 'Particle must move upwards (y decreases)');
  assert.ok(p1.alpha < 1, 'Particle alpha must decay');
});

test('working agent faces into desk/station according to assigned workstation config', () => {
  const crew = createInitialCrew(snapshot);
  const alec = crew.find((a) => a.name === 'Alec')!;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  const benjamin = crew.find((a) => a.name === 'Benjamin')!;

  assert.equal(alec.facing, ASSIGNED_WORKSTATIONS.Alec.facing);
  assert.equal(kevin.facing, ASSIGNED_WORKSTATIONS.Kevin.facing);
  assert.equal(benjamin.facing, ASSIGNED_WORKSTATIONS.Benjamin.facing);

  // Even after simulation tick in working state, facing stays locked to workstation
  alec.facing = -1; // artificially flip
  updateAgent(alec, 0.1, 1, crew);
  assert.equal(alec.facing, ASSIGNED_WORKSTATIONS.Alec.facing);
});

test('drawAgentStatusBubble and drawWorkParticles execute without errors on 2D context', () => {
  const crew = createInitialCrew(snapshot);
  const kevin = crew.find((a) => a.name === 'Kevin')!;

  // Spawn a particle
  updateAgent(kevin, 1.0, 1, crew);

  const operations: string[] = [];
  const mockCtx = {
    save: () => operations.push('save'),
    restore: () => operations.push('restore'),
    beginPath: () => operations.push('beginPath'),
    roundRect: () => operations.push('roundRect'),
    rect: () => operations.push('rect'),
    fill: () => operations.push('fill'),
    stroke: () => operations.push('stroke'),
    fillText: () => operations.push('fillText'),
    measureText: (txt: string) => ({ width: txt.length * 6 }),
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;

  drawAgentStatusBubble(mockCtx, kevin, 80, 0);
  assert.ok(operations.includes('fillText'));
  assert.ok(operations.includes('stroke'));

  drawWorkParticles(mockCtx, kevin);
  assert.ok(operations.filter((op) => op === 'fillText').length >= 2);
});

test('render snapshot contains status text bubbles in markup', () => {
  const markup = renderToStaticMarkup(createElement(StarshipLab, { snapshot }));

  assert.match(markup, /ALEC  ·  WORKING/);
  assert.match(markup, /KEVIN  ·  WORKING/);
  assert.match(markup, /BENJAMIN  ·  REVIEWING/);
});

test('2 working agents do not share coordinates with distance > 20px', () => {
  const crew = createInitialCrew(snapshot);
  const workingAgents = crew.filter(
    (a) =>
      a.state === STATE.WORKING || a.reportedState === 'working' || a.reportedState === 'review',
  );

  assert.ok(workingAgents.length >= 2, 'Must have at least 2 working agents');

  for (let i = 0; i < workingAgents.length; i++) {
    for (let j = i + 1; j < workingAgents.length; j++) {
      const a1 = workingAgents[i]!;
      const a2 = workingAgents[j]!;
      const dist = Math.hypot(a1.x - a2.x, a1.y - a2.y);
      assert.ok(
        dist > 20,
        `Distance between ${a1.name} (${a1.x}, ${a1.y}) and ${a2.name} (${a2.x}, ${a2.y}) is ${dist.toFixed(1)}px, which must be > 20px`,
      );
    }
  }
});

test('drawAgent selects back-facing work frames for all three desk-oriented crew with 8Hz typing bob', () => {
  const crew = createInitialCrew(snapshot);
  const alec = crew.find((a) => a.name === 'Alec')!;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  assert.equal(alec.state, STATE.WORKING);
  assert.equal(kevin.state, STATE.WORKING);

  const drawCalls: any[] = [];
  const mockCtx = {
    save: () => {},
    restore: () => {},
    translate: (x: number, y: number) => {
      drawCalls.push({ type: 'translate', x, y });
    },
    scale: () => {},
    beginPath: () => {},
    roundRect: () => {},
    rect: () => {},
    ellipse: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
    drawImage: (...args: any[]) => {
      drawCalls.push({ type: 'drawImage', args });
    },
    measureText: () => ({ width: 50 }),
    imageSmoothingEnabled: true,
    shadowColor: '',
    shadowBlur: 0,
    globalCompositeOperation: 'source-over',
    globalAlpha: 1.0,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;

  const mockImg = { width: 512, height: 256 } as HTMLImageElement;
  const cw = 512 / 16; // 32

  // Alec faces the hologram table: col = 8..11 (sx = 8 * 32 = 256)
  alec.animFrame = 0;
  drawAgent(mockCtx, alec, mockImg);
  const alecCalls = drawCalls.filter((c) => c.type === 'drawImage');
  assert.ok(alecCalls.length >= 1);
  const sxAlec = alecCalls[0].args[1];
  assert.equal(sxAlec, 8 * cw); // column index 8 = back-facing

  // Kevin facing back: col = 8..11 (sx = 8 * 32 = 256)
  drawCalls.length = 0;
  kevin.animFrame = 0;
  drawAgent(mockCtx, kevin, mockImg);
  const kevinCalls = drawCalls.filter((c) => c.type === 'drawImage');
  assert.ok(kevinCalls.length >= 1);
  const sxKevin = kevinCalls[0].args[1];
  assert.equal(sxKevin, 8 * cw); // column index 8 = back-facing

  // Frame 3 of back-idle for Kevin: col = 11 (sx = 11 * 32 = 352)
  drawCalls.length = 0;
  kevin.animFrame = 3;
  drawAgent(mockCtx, kevin, mockImg);
  const imgCalls3 = drawCalls.filter((c) => c.type === 'drawImage');
  assert.equal(imgCalls3[0].args[1], 11 * cw);

  // Typing bob at 6Hz (bob amplitude in [-2, 2])
  kevin.bob = 0;
  updateAgent(kevin, 0.02, 1, crew);
  assert.ok(kevin.bob > 0);
  const bobY = Math.sin(kevin.bob) * 2;
  assert.ok(bobY >= -2.0 && bobY <= 2.0);
});

test('drawWorkstationScreens activates only the painted monitor panels and turns them off when idle', () => {
  const crew = createInitialCrew(snapshot);
  const fillRectCalls: any[] = [];
  const strokeRectCalls: any[] = [];

  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    ellipse: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: (x: number, y: number, w: number, h: number) => {
      fillRectCalls.push({
        x,
        y,
        w,
        h,
        fillStyle: mockCtx.fillStyle,
        globalAlpha: mockCtx.globalAlpha,
      });
    },
    strokeRect: (x: number, y: number, w: number, h: number) => {
      strokeRectCalls.push({
        x,
        y,
        w,
        h,
        strokeStyle: mockCtx.strokeStyle,
        globalAlpha: mockCtx.globalAlpha,
      });
    },
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1.0,
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;

  // Working crew: screens should be drawn
  drawWorkstationScreens(mockCtx, crew, 0);

  // Kevin uses three individual monitors instead of one debug rectangle over the desk.
  const kevinFill = fillRectCalls.find(
    (c) =>
      c.x === BUILD_MONITOR_RECTS[0]?.x &&
      c.y === BUILD_MONITOR_RECTS[0]?.y &&
      c.w === BUILD_MONITOR_RECTS[0]?.w &&
      c.h === BUILD_MONITOR_RECTS[0]?.h,
  );
  assert.ok(kevinFill);
  assert.equal(kevinFill.fillStyle, ROLE_GLOW_COLORS.Kevin);
  assert.ok(kevinFill.globalAlpha >= 0.08 && kevinFill.globalAlpha <= 0.16);

  // Benjamin uses the two QA console panels painted behind his chair.
  const benjaminFill = fillRectCalls.find(
    (c) => c.x === 1018 && c.y === 550 && c.w === 49 && c.h === 29,
  );
  assert.ok(benjaminFill);
  assert.equal(benjaminFill.fillStyle, ROLE_GLOW_COLORS.Benjamin);
  assert.ok(benjaminFill.globalAlpha >= 0.08 && benjaminFill.globalAlpha <= 0.16);

  // Test idle state: screen turns off (no rect drawn for idle agent)
  fillRectCalls.length = 0;
  strokeRectCalls.length = 0;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  kevin.state = STATE.IDLE;
  kevin.reportedState = 'idle';

  drawWorkstationScreens(mockCtx, crew, 0);

  // Kevin's three screen fills must not be drawn when idle.
  const kevinIdleFill = fillRectCalls.find((c) => c.x === 398 && c.y === 397);
  assert.equal(kevinIdleFill, undefined);
});

test('drawDeskCutouts renders desk cutout slices from bgImg to occlude agent lower bodies when working at desk', () => {
  const crew = createInitialCrew(snapshot);
  const drawImageCalls: any[] = [];

  const mockCtx = {
    save: () => {},
    restore: () => {},
    drawImage: (...args: any[]) => {
      drawImageCalls.push(args);
    },
    imageSmoothingEnabled: true,
  } as unknown as CanvasRenderingContext2D;

  const mockBgImg = { width: 1600, height: 678 } as HTMLImageElement;

  drawDeskCutouts(mockCtx, mockBgImg, crew);

  // All 3 working agents must have their desk cutouts drawn
  assert.equal(drawImageCalls.length, 3);

  // Alec desk cutout
  const alecCutout = drawImageCalls.find(
    (c) => c[1] === WORKSTATIONS.Alec.deskCutout.x && c[2] === WORKSTATIONS.Alec.deskCutout.y,
  );
  assert.ok(alecCutout);
  assert.equal(alecCutout[3], WORKSTATIONS.Alec.deskCutout.w);
  assert.equal(alecCutout[4], WORKSTATIONS.Alec.deskCutout.h);

  // Kevin desk cutout
  const kevinCutout = drawImageCalls.find(
    (c) => c[1] === WORKSTATIONS.Kevin.deskCutout.x && c[2] === WORKSTATIONS.Kevin.deskCutout.y,
  );
  assert.ok(kevinCutout);
  assert.equal(kevinCutout[3], WORKSTATIONS.Kevin.deskCutout.w);
  assert.equal(kevinCutout[4], WORKSTATIONS.Kevin.deskCutout.h);

  // Benjamin desk cutout
  const benjaminCutout = drawImageCalls.find(
    (c) =>
      c[1] === WORKSTATIONS.Benjamin.deskCutout.x && c[2] === WORKSTATIONS.Benjamin.deskCutout.y,
  );
  assert.ok(benjaminCutout);
  assert.equal(benjaminCutout[3], WORKSTATIONS.Benjamin.deskCutout.w);
  assert.equal(benjaminCutout[4], WORKSTATIONS.Benjamin.deskCutout.h);

  // When agent is idle, their desk cutout is not drawn
  drawImageCalls.length = 0;
  const alec = crew.find((a) => a.name === 'Alec')!;
  alec.state = STATE.IDLE;
  alec.reportedState = 'idle';

  drawDeskCutouts(mockCtx, mockBgImg, crew);
  assert.equal(drawImageCalls.length, 2);
  const alecIdleCutout = drawImageCalls.find(
    (c) => c[1] === WORKSTATIONS.Alec.deskCutout.x && c[2] === WORKSTATIONS.Alec.deskCutout.y,
  );
  assert.equal(alecIdleCutout, undefined);
});

test('drawWorkstationInteraction restores visible hands on top of each active workstation', () => {
  const crew = createInitialCrew(snapshot);
  const fillRectCalls: Array<{ x: number; y: number; w: number; h: number }> = [];
  const mockCtx = {
    save: () => {},
    restore: () => {},
    fillRect: (x: number, y: number, w: number, h: number) => fillRectCalls.push({ x, y, w, h }),
    fillStyle: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D;

  drawWorkstationInteraction(mockCtx, crew, 0);

  assert.ok(fillRectCalls.some((call) => call.x === 478 && call.y === 398));
  assert.ok(fillRectCalls.some((call) => call.x === 1064 && call.y === 573));
  assert.ok(fillRectCalls.some((call) => call.x === 540 && call.w === 8));
});

test('drawHologramTopGlow renders pulsing violet hologram ellipse, starmap rings, and star nodes for Alec when working', () => {
  const crew = createInitialCrew(snapshot);
  const ellipseCalls: any[] = [];
  const arcCalls: any[] = [];

  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    ellipse: (...args: any[]) => {
      ellipseCalls.push(args);
    },
    arc: (...args: any[]) => {
      arcCalls.push(args);
    },
    fill: () => {},
    stroke: () => {},
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1.0,
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;

  drawHologramTopGlow(mockCtx, crew, 0);

  // Must render at least 2 hologram ellipses (table surface + concentric ring) and multiple star nodes
  assert.ok(ellipseCalls.length >= 2);
  assert.ok(arcCalls.length >= 4);

  // Ellipse center must be at Alec table center
  const r = WORKSTATIONS.Alec.screenRect;
  const expectedCx = r.x + r.w / 2;
  const expectedCy = r.y + r.h / 2;
  assert.equal(ellipseCalls[0][0], expectedCx);
  assert.equal(ellipseCalls[0][1], expectedCy);

  // Turns off when Alec is idle
  ellipseCalls.length = 0;
  arcCalls.length = 0;
  const alec = crew.find((a) => a.name === 'Alec')!;
  alec.state = STATE.IDLE;
  alec.reportedState = 'idle';

  drawHologramTopGlow(mockCtx, crew, 0);
  assert.equal(ellipseCalls.length, 0);
  assert.equal(arcCalls.length, 0);
});

test('V1.9 typing effects: drawAgent renders 2 typing arms (3x2px) in role color oscillating in opposite phase with 6Hz', () => {
  const crew = createInitialCrew(snapshot);
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  assert.equal(kevin.state, STATE.WORKING);

  const fillRectCalls: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    fillStyle: string;
  }> = [];
  const mockCtx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    beginPath: () => {},
    rect: () => {},
    ellipse: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
    drawImage: () => {},
    fillRect: (x: number, y: number, w: number, h: number) => {
      fillRectCalls.push({
        x,
        y,
        w,
        h,
        fillStyle: mockCtx.fillStyle as string,
      });
    },
    imageSmoothingEnabled: true,
    shadowColor: '',
    shadowBlur: 0,
    globalCompositeOperation: 'source-over',
    globalAlpha: 1.0,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;

  const mockImg = { width: 512, height: 256 } as HTMLImageElement;

  // At time t = 0
  drawAgent(mockCtx, kevin, mockImg, 0);
  assert.equal(fillRectCalls.length, 2, 'Must render exactly 2 typing arm rects for working agent');
  const leftArm = fillRectCalls[0]!;
  const rightArm = fillRectCalls[1]!;

  assert.equal(leftArm.fillStyle, ROLE_GLOW_COLORS.Kevin);
  assert.equal(rightArm.fillStyle, ROLE_GLOW_COLORS.Kevin);
  // Dimensions roughly 3x2px (scaled with depthScale ~0.8-1.1)
  assert.ok(leftArm.w >= 2 && leftArm.w <= 4);
  assert.ok(leftArm.h >= 1.5 && leftArm.h <= 3);
  assert.ok(rightArm.w >= 2 && rightArm.w <= 4);
  assert.ok(rightArm.h >= 1.5 && rightArm.h <= 3);

  // At time t = 1 / (6 * 4) = 1/24 s (quarter cycle of sin(t * 12 * PI)): arms move in opposite directions
  fillRectCalls.length = 0;
  drawAgent(mockCtx, kevin, mockImg, 1 / 24);
  const leftArmQ = fillRectCalls[0]!;
  const rightArmQ = fillRectCalls[1]!;
  assert.ok(leftArmQ.y > leftArm.y, 'Left arm moves down at peak phase');
  assert.ok(rightArmQ.y < rightArm.y, 'Right arm moves up (opposite phase)');
});

test('compact status label keeps the working agent role color without a distracting pulse', () => {
  const crew = createInitialCrew(snapshot);
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  assert.equal(kevin.state, STATE.WORKING);

  const strokes: string[] = [];
  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    roundRect: () => {},
    rect: () => {},
    fill: () => {},
    stroke: () => {
      strokes.push(mockCtx.strokeStyle as string);
    },
    fillText: () => {},
    measureText: () => ({ width: 50 }),
    strokeStyle: '',
    fillStyle: '',
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D;

  kevin.bob = Math.PI / 3;
  drawAgentStatusBubble(mockCtx, kevin, 80, 0);
  assert.ok(strokes.length >= 1);
  assert.equal(strokes[0], ROLE_GLOW_COLORS.Kevin);
});

test('V1.9 idle wander: idle agent wanders between points every 2-4s and changes position within 5s', () => {
  const idleSnapshot: DuctorStatusSnapshot = {
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
        state: 'idle',
        taskLabel: 'Standby',
        updatedAt: '2026-08-22T05:30:00.000Z',
        derived: false,
      },
      {
        name: 'Benjamin',
        presence: 'online',
        state: 'idle',
        taskLabel: 'Standby',
        updatedAt: '2026-08-22T05:30:00.000Z',
        derived: false,
      },
    ],
  };

  const crew = createInitialCrew(idleSnapshot);
  const startPositions = crew.map((a) => ({
    id: a.id,
    name: a.name,
    x: a.x,
    y: a.y,
  }));

  // Simulate 5 seconds in steps of 0.05s (100 steps)
  const dt = 0.05;
  const totalSteps = 5 / dt;
  for (let step = 0; step < totalSteps; step++) {
    for (const a of crew) {
      updateAgent(a, dt, 1, crew);
    }
  }

  // At least one idle agent must have changed position within 5s (idle wander)
  for (const start of startPositions) {
    const agent = crew.find((a) => a.id === start.id)!;
    const distMoved = Math.hypot(agent.x - start.x, agent.y - start.y);
    console.log(`[IDLE WANDER TEST] ${agent.name} moved ${distMoved.toFixed(1)}px within 5s`);
    assert.ok(
      distMoved > 10,
      `Idle agent ${agent.name} should have wandered and changed position within 5s, but moved only ${distMoved.toFixed(1)}px`,
    );
  }
});
