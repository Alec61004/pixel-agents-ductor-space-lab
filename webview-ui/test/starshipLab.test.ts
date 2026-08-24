import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import {
  applySnapshotToAgents,
  ATTENTION_POINTS,
  createInitialCrew,
  IDLE_POINTS,
  OFFLINE_POINTS,
  pickStation,
  routeToPoint,
  STATIONS,
  StarshipLab,
  STATE,
  updateAgent,
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
