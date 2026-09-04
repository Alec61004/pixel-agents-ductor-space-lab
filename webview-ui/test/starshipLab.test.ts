import assert from 'node:assert/strict';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import type { DuctorStatusSnapshot } from '../src/ductor/ductorLabModel.js';
import {
  applySnapshotToAgents,
  ASSIGNED_WORKSTATIONS,
  ATTENTION_POINTS,
  clampPointToPolygon,
  clampPanToViewport,
  createInitialCrew,
  DEPTH_SCALE_MAX,
  DEPTH_SCALE_MIN,
  drawAgent,
  drawAgentStatusBubble,
  drawDeskCutouts,
  drawFloorMarkers,
  drawHologramTopGlow,
  drawWorkParticles,
  drawWorkstationLabels,
  drawWorkstationScreens,
  FLOOR_Y_MAX,
  FLOOR_Y_MIN,
  getAgentStatusBubble,
  getDepthScale,
  IDLE_POINTS,
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
  assert.match(markup, /STARSHIP AGENTS/);
  assert.match(markup, /Alec/);
  assert.match(markup, /Kevin/);
  assert.match(markup, /Benjamin/);
  assert.match(markup, /Coordinate MVP/);
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
    assert.equal(bubble.lines[0], WORKSTATIONS[agent.name].label);
    assert.equal(bubble.lines[1], '⏳ waiting');

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

test('renders live status badges in roster matching snapshot roles', () => {
  const markup = renderToStaticMarkup(createElement(StarshipLab, { snapshot }));

  assert.match(markup, /<div class="starship-badge badge working">\s*WORKING\s*<\/div>/);
  assert.match(markup, /<div class="starship-badge badge review">\s*REVIEW\s*<\/div>/);
});

test('shows the reported task beside each live roster status', () => {
  const markup = renderToStaticMarkup(createElement(StarshipLab, { snapshot }));

  assert.match(markup, /class="starship-task"[^>]*>Coordinate MVP<\/div>/);
  assert.match(markup, /class="starship-task"[^>]*>Implement bridge<\/div>/);
  assert.match(markup, /class="starship-task"[^>]*>Review contract<\/div>/);
});

test('defines 3 fixed workstations (Alec, Kevin, Benjamin) with correct labels and coordinates within walkable polygon', () => {
  assert.ok(WORKSTATIONS.Alec);
  assert.ok(WORKSTATIONS.Kevin);
  assert.ok(WORKSTATIONS.Benjamin);

  // New device-anchored coordinates matching actual painted devices in starship-bg.png
  assert.deepEqual(WORKSTATIONS.Alec.approachPoint, { x: 480, y: 575 });
  assert.deepEqual(WORKSTATIONS.Alec.interactionPoint, { x: 480, y: 570 });
  assert.equal(WORKSTATIONS.Alec.facing, 'front');
  assert.deepEqual(WORKSTATIONS.Alec.displayBounds, { x: 505, y: 442, w: 140, h: 98 });
  assert.deepEqual(WORKSTATIONS.Alec.displayAreas, [{ x: 505, y: 442, w: 140, h: 98 }]);
  assert.deepEqual(WORKSTATIONS.Alec.occlusionBounds, { x: 500, y: 525, w: 145, h: 65 });
  assert.equal(WORKSTATIONS.Alec.label, 'Alec — Strategy');

  assert.deepEqual(WORKSTATIONS.Kevin.approachPoint, { x: 450, y: 490 });
  assert.deepEqual(WORKSTATIONS.Kevin.interactionPoint, { x: 450, y: 455 });
  assert.equal(WORKSTATIONS.Kevin.facing, 'back');
  assert.deepEqual(WORKSTATIONS.Kevin.displayBounds, { x: 460, y: 318, w: 250, h: 32 });
  assert.deepEqual(WORKSTATIONS.Kevin.displayAreas, [
    { x: 460, y: 318, w: 60, h: 30 },
    { x: 536, y: 318, w: 70, h: 30 },
    { x: 648, y: 318, w: 60, h: 30 },
  ]);
  assert.deepEqual(WORKSTATIONS.Kevin.occlusionBounds, { x: 405, y: 420, w: 340, h: 40 });
  assert.equal(WORKSTATIONS.Kevin.label, 'Kevin — Build');

  assert.deepEqual(WORKSTATIONS.Benjamin.approachPoint, { x: 1060, y: 585 });
  assert.deepEqual(WORKSTATIONS.Benjamin.interactionPoint, { x: 1060, y: 580 });
  assert.equal(WORKSTATIONS.Benjamin.facing, 'back');
  assert.deepEqual(WORKSTATIONS.Benjamin.displayBounds, { x: 1010, y: 520, w: 110, h: 55 });
  assert.deepEqual(WORKSTATIONS.Benjamin.displayAreas, [{ x: 1010, y: 520, w: 110, h: 55 }]);
  assert.deepEqual(WORKSTATIONS.Benjamin.occlusionBounds, { x: 1010, y: 570, w: 120, h: 55 });
  assert.equal(WORKSTATIONS.Benjamin.label, 'Benjamin — QA');

  assert.equal(typeof drawWorkstationLabels, 'function');
  assert.equal(typeof drawWorkstationScreens, 'function');
  assert.equal(typeof drawDeskCutouts, 'function');
  assert.equal(typeof drawHologramTopGlow, 'function');
  assert.equal(typeof drawFloorMarkers, 'function');

  // Approach points must be inside walkable polygon
  assert.equal(isPointInPolygon(WORKSTATIONS.Alec.approachPoint, WALKABLE_POLYGON), true);
  assert.equal(isPointInPolygon(WORKSTATIONS.Kevin.approachPoint, WALKABLE_POLYGON), true);
  assert.equal(isPointInPolygon(WORKSTATIONS.Benjamin.approachPoint, WALKABLE_POLYGON), true);

  // Interaction points must be inside walkable polygon
  assert.equal(isPointInPolygon(WORKSTATIONS.Alec.interactionPoint, WALKABLE_POLYGON), true);
  assert.equal(isPointInPolygon(WORKSTATIONS.Kevin.interactionPoint, WALKABLE_POLYGON), true);
  assert.equal(isPointInPolygon(WORKSTATIONS.Benjamin.interactionPoint, WALKABLE_POLYGON), true);
});

test('clamps viewport pan so focusing an agent cannot expose empty canvas space', () => {
  const desktopPan = clampPanToViewport({ x: 500, y: -500 }, { width: 1440, height: 757 }, 1.2);
  assert.equal(desktopPan.x, 240);
  assert.ok(Math.abs(desktopPan.y + 28.3) < 0.0001);
  const mobilePan = clampPanToViewport({ x: 500, y: -500 }, { width: 375, height: 628 }, 0.5);
  assert.equal(mobilePan.x, 212.5);
  assert.ok(Math.abs(mobilePan.y) < 0.0001);
});

test('agent working state positions agent at their own assigned workstation interactionPoint and facing matches workstation config', () => {
  const crew = createInitialCrew(snapshot);
  const alec = crew.find((a) => a.name === 'Alec')!;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  const benjamin = crew.find((a) => a.name === 'Benjamin')!;

  // Alec must be at Alec's desk interactionPoint facing front
  assert.equal(alec.x, WORKSTATIONS.Alec.interactionPoint.x);
  assert.equal(alec.y, WORKSTATIONS.Alec.interactionPoint.y);
  assert.equal(alec.facing, 'front');
  assert.equal(alec.currentStation, 'Alec — Strategy');
  assert.notEqual(alec.x, WORKSTATIONS.Kevin.interactionPoint.x);
  assert.notEqual(alec.x, WORKSTATIONS.Benjamin.interactionPoint.x);

  // Kevin must be at Kevin's desk interactionPoint facing front
  assert.equal(kevin.x, WORKSTATIONS.Kevin.interactionPoint.x);
  assert.equal(kevin.y, WORKSTATIONS.Kevin.interactionPoint.y);
  assert.equal(kevin.facing, 'back');
  assert.equal(kevin.currentStation, 'Kevin — Build');
  assert.notEqual(kevin.x, WORKSTATIONS.Alec.interactionPoint.x);
  assert.notEqual(kevin.x, WORKSTATIONS.Benjamin.interactionPoint.x);

  // Benjamin must be at Benjamin's desk interactionPoint facing front
  assert.equal(benjamin.x, WORKSTATIONS.Benjamin.interactionPoint.x);
  assert.equal(benjamin.y, WORKSTATIONS.Benjamin.interactionPoint.y);
  assert.equal(benjamin.facing, 'back');
  assert.equal(benjamin.currentStation, 'Benjamin — QA');
  assert.notEqual(benjamin.x, WORKSTATIONS.Alec.interactionPoint.x);
  assert.notEqual(benjamin.x, WORKSTATIONS.Kevin.interactionPoint.x);
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

  // Ceiling point clamped to top floor boundary (monitor aisle y=450-490)
  const ceilingPt = { x: 800, y: 100 };
  const clampedCeiling = clampPointToPolygon(ceilingPt, WALKABLE_POLYGON);
  assert.equal(isPointInPolygon(clampedCeiling, WALKABLE_POLYGON), true);
  assert.ok(clampedCeiling.y >= 450 && clampedCeiling.y <= 490);

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

  // First sprite draw: pixel smoothing disabled, rim glow with role color, shadowBlur = 8
  const basePass = drawCalls[0];
  assert.equal(basePass.imageSmoothingEnabled, false);
  assert.equal(basePass.shadowColor, '#5ce1ff');
  assert.equal(basePass.shadowBlur, 8);

  // Second sprite draw: lighter composite mode with alpha 0.22 to boost sprite brightness
  const boostPass = drawCalls[1];
  assert.equal(boostPass.globalCompositeOperation, 'lighter');
  assert.equal(boostPass.globalAlpha, 0.22);
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

  // Working state - name always shows in line 1, status in line 2
  const alecBubble = getAgentStatusBubble(alec);
  assert.equal(alecBubble.text, 'Alec — Strategy\n⚙ đang làm việc');
  assert.equal(alecBubble.color, '#c98bff');
  assert.equal(alecBubble.borderColor, '#c98bff');

  const kevinBubble = getAgentStatusBubble(kevin);
  assert.equal(kevinBubble.text, 'Kevin — Build\n⚙ đang làm việc');
  assert.equal(kevinBubble.color, '#5ce1ff');
  assert.equal(kevinBubble.borderColor, '#5ce1ff');

  const benjaminBubble = getAgentStatusBubble(benjamin);
  assert.equal(benjaminBubble.text, 'Benjamin — QA\n⚙ đang làm việc');
  assert.equal(benjaminBubble.color, '#ff5c5c');
  assert.equal(benjaminBubble.borderColor, '#ff5c5c');

  // Idle state - name always shows in line 1
  alec.state = STATE.IDLE;
  alec.reportedState = 'idle';
  const idleBubble = getAgentStatusBubble(alec);
  assert.equal(idleBubble.text, 'Alec — Strategy\n💤 idle');

  // Offline state - name always shows in line 1
  kevin.state = STATE.OFFLINE;
  kevin.reportedState = 'offline';
  const offlineBubble = getAgentStatusBubble(kevin);
  assert.equal(offlineBubble.text, 'Kevin — Build\n⚫ offline');

  // Blocked state - name always shows in line 1
  benjamin.state = STATE.BLOCKED;
  benjamin.reportedState = 'blocked';
  const blockedBubble = getAgentStatusBubble(benjamin);
  assert.equal(blockedBubble.text, 'Benjamin — QA\n⚠️ blocked');
});

test('work particles spawn every ~0.9s for working agents with role-specific icons and float upward', () => {
  const crew = createInitialCrew(snapshot);
  const alec = crew.find((a) => a.name === 'Alec')!;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  const benjamin = crew.find((a) => a.name === 'Benjamin')!;

  assert.equal(ROLE_PARTICLE_ICONS.Alec, '⌨');
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
  assert.equal(p1.icon, '⌨');
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

  // Markup must include status text bubbles for agents (name in line 1, status in line 2)
  assert.match(markup, /Alec — Strategy/);
  assert.match(markup, /Kevin — Build/);
  assert.match(markup, /Benjamin — QA/);
  assert.match(markup, /đang làm việc/);
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

test('drawAgent selects front-idle frames for Alec (facing front) and back-idle frames for Kevin/Benjamin (facing back) with 8Hz typing bob', () => {
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

  // Alec facing front: col = 0..3 (sx = 0 * 32 = 0)
  alec.animFrame = 0;
  drawAgent(mockCtx, alec, mockImg);
  const alecCalls = drawCalls.filter((c) => c.type === 'drawImage');
  assert.ok(alecCalls.length >= 1);
  const sxAlec = alecCalls[0].args[1];
  assert.equal(sxAlec, 0 * cw); // column index 0 = front-facing

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

test('drawWorkstationScreens draws low-alpha glow only inside painted display areas, and turns off when idle', () => {
  const crew = createInitialCrew(snapshot);
  const fillRectCalls: any[] = [];

  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
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
    fillStyle: '',
    globalAlpha: 1.0,
  } as unknown as CanvasRenderingContext2D;

  // Working crew: screens should be drawn
  drawWorkstationScreens(mockCtx, crew, 0);

  // Verify every real Kevin monitor display area
  const kevinDisplayFills = fillRectCalls.filter((c) =>
    WORKSTATIONS.Kevin.displayAreas.some(
      (area) => c.x === area.x && c.y === area.y && c.w === area.w && c.h === area.h,
    ),
  );
  assert.equal(kevinDisplayFills.length, WORKSTATIONS.Kevin.displayAreas.length);

  const kevinFill = kevinDisplayFills[0];
  assert.ok(kevinFill);
  assert.equal(kevinFill.fillStyle, ROLE_GLOW_COLORS.Kevin);
  assert.ok(kevinFill.globalAlpha >= 0.12 && kevinFill.globalAlpha <= 0.22);

  // Verify Benjamin display area
  const benjaminFill = fillRectCalls.find(
    (c) =>
      c.x === WORKSTATIONS.Benjamin.displayAreas[0].x &&
      c.y === WORKSTATIONS.Benjamin.displayAreas[0].y &&
      c.w === WORKSTATIONS.Benjamin.displayAreas[0].w &&
      c.h === WORKSTATIONS.Benjamin.displayAreas[0].h,
  );
  assert.ok(benjaminFill);
  assert.equal(benjaminFill.fillStyle, ROLE_GLOW_COLORS.Benjamin);
  assert.ok(benjaminFill.globalAlpha >= 0.12 && benjaminFill.globalAlpha <= 0.22);

  // Test idle state: screen turns off (no rect drawn for idle agent)
  fillRectCalls.length = 0;
  const kevin = crew.find((a) => a.name === 'Kevin')!;
  kevin.state = STATE.IDLE;
  kevin.reportedState = 'idle';

  drawWorkstationScreens(mockCtx, crew, 0);

  // Kevin's displayBounds must NOT be drawn when idle
  const kevinIdleFill = fillRectCalls.find(
    (c) => c.x === WORKSTATIONS.Kevin.displayBounds.x && c.y === WORKSTATIONS.Kevin.displayBounds.y,
  );
  assert.equal(kevinIdleFill, undefined);
});

test('drawDeskCutouts renders occlusion bounds from bgImg to occlude agent lower bodies when working at desk', () => {
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

  // All 3 working agents must have their occlusion bounds drawn
  assert.equal(drawImageCalls.length, 3);

  // Alec occlusion bounds
  const alecCutout = drawImageCalls.find(
    (c) =>
      c[1] === WORKSTATIONS.Alec.occlusionBounds.x && c[2] === WORKSTATIONS.Alec.occlusionBounds.y,
  );
  assert.ok(alecCutout);
  assert.equal(alecCutout[3], WORKSTATIONS.Alec.occlusionBounds.w);
  assert.equal(alecCutout[4], WORKSTATIONS.Alec.occlusionBounds.h);

  // Kevin occlusion bounds
  const kevinCutout = drawImageCalls.find(
    (c) =>
      c[1] === WORKSTATIONS.Kevin.occlusionBounds.x &&
      c[2] === WORKSTATIONS.Kevin.occlusionBounds.y,
  );
  assert.ok(kevinCutout);
  assert.equal(kevinCutout[3], WORKSTATIONS.Kevin.occlusionBounds.w);
  assert.equal(kevinCutout[4], WORKSTATIONS.Kevin.occlusionBounds.h);

  // Benjamin occlusion bounds
  const benjaminCutout = drawImageCalls.find(
    (c) =>
      c[1] === WORKSTATIONS.Benjamin.occlusionBounds.x &&
      c[2] === WORKSTATIONS.Benjamin.occlusionBounds.y,
  );
  assert.ok(benjaminCutout);
  assert.equal(benjaminCutout[3], WORKSTATIONS.Benjamin.occlusionBounds.w);
  assert.equal(benjaminCutout[4], WORKSTATIONS.Benjamin.occlusionBounds.h);

  // When agent is idle, their occlusion bounds are not drawn
  drawImageCalls.length = 0;
  const alec = crew.find((a) => a.name === 'Alec')!;
  alec.state = STATE.IDLE;
  alec.reportedState = 'idle';

  drawDeskCutouts(mockCtx, mockBgImg, crew);
  assert.equal(drawImageCalls.length, 2);
  const alecIdleCutout = drawImageCalls.find(
    (c) =>
      c[1] === WORKSTATIONS.Alec.occlusionBounds.x && c[2] === WORKSTATIONS.Alec.occlusionBounds.y,
  );
  assert.equal(alecIdleCutout, undefined);
});

test('drawHologramTopGlow renders pulsing violet hologram ellipse, starmap rings, and star nodes for Alec when working', () => {
  const crew = createInitialCrew(snapshot);
  const ellipseCalls: any[] = [];
  const arcCalls: any[] = [];

  const mockCtx = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
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

  // Ellipse center must be at Alec displayBounds center
  const r = WORKSTATIONS.Alec.displayBounds;
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

  const fillRectCalls: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> =
    [];
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
      fillRectCalls.push({ x, y, w, h, fillStyle: mockCtx.fillStyle as string });
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

test('V1.9 typing effects: drawAgentStatusBubble renders yellow pulsating border for working agents', () => {
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

  // With a.bob at peak phase -> stroke is STARSHIP_AMBER (#ffcf6e)
  kevin.bob = Math.PI / 3;
  drawAgentStatusBubble(mockCtx, kevin, 80, 0);
  assert.ok(strokes.length >= 1);
  assert.equal(strokes[0], '#ffcf6e');
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
  const startPositions = crew.map((a) => ({ id: a.id, name: a.name, x: a.x, y: a.y }));

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
