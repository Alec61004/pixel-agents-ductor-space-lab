import assert from 'node:assert/strict';

import { beforeAll, test } from 'vitest';

import {
  DUCTOR_ALEC_COLOR,
  DUCTOR_BENJAMIN_COLOR,
  DUCTOR_KEVIN_COLOR,
  FALLBACK_FLOOR_COLOR,
} from '../src/constants.js';
import type { DuctorStatusSnapshot } from '../src/ductor/ductorLabModel.js';
import {
  createDuctorOfficeRuntime,
  DUCTOR_AGENT_IDS,
  DUCTOR_ROLE_PRESENTATION,
  type DuctorAgentObservation,
} from '../src/ductor/ductorOfficeRuntime.js';
import { getCharacterSprite } from '../src/office/engine/characters.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import { getCharacterSprites } from '../src/office/sprites/spriteData.js';
import {
  isReadingToolName,
  isSubagentToolName,
  setProviderCapabilities,
} from '../src/office/toolUtils.js';
import { CharacterState } from '../src/office/types.js';

const PIXEL = [[FALLBACK_FLOOR_COLOR]];

beforeAll(() => {
  buildDynamicCatalog({
    catalog: [
      {
        id: 'CUSHIONED_CHAIR_BACK',
        label: 'Lab chair',
        category: 'chairs',
        width: 16,
        height: 16,
        footprintW: 1,
        footprintH: 1,
        isDesk: false,
        orientation: 'back',
      },
      {
        id: 'DESK_FRONT',
        label: 'Console',
        category: 'desks',
        width: 48,
        height: 32,
        footprintW: 3,
        footprintH: 2,
        isDesk: true,
        orientation: 'front',
        backgroundTiles: 1,
      },
      {
        id: 'PC_FRONT_OFF',
        label: 'Terminal',
        category: 'electronics',
        width: 16,
        height: 32,
        footprintW: 1,
        footprintH: 2,
        isDesk: false,
        orientation: 'front',
        backgroundTiles: 1,
        canPlaceOnSurfaces: true,
      },
      {
        id: 'DOUBLE_BOOKSHELF',
        label: 'Review archive',
        category: 'wall',
        width: 32,
        height: 32,
        footprintW: 2,
        footprintH: 2,
        isDesk: false,
        canPlaceOnWalls: true,
      },
      {
        id: 'WINDOW_GALAXY',
        label: 'Observation Window Galaxy',
        category: 'wall',
        width: 96,
        height: 32,
        footprintW: 6,
        footprintH: 2,
        isDesk: false,
        backgroundTiles: 2,
        canPlaceOnWalls: true,
      },
    ],
    sprites: {
      CUSHIONED_CHAIR_BACK: PIXEL,
      DESK_FRONT: PIXEL,
      PC_FRONT_OFF: PIXEL,
      DOUBLE_BOOKSHELF: PIXEL,
      WINDOW_GALAXY: PIXEL,
    },
  });
});

function snapshot(
  states: [
    DuctorStatusSnapshot['roles'][number]['state'],
    DuctorStatusSnapshot['roles'][number]['state'],
    DuctorStatusSnapshot['roles'][number]['state'],
  ] = ['working', 'review', 'waiting'],
): DuctorStatusSnapshot {
  const names = ['Alec', 'Kevin', 'Benjamin'] as const;
  return {
    theme: 'ductor-space-lab',
    publishedAt: '2026-08-22T08:00:00.000Z',
    stale: false,
    roles: names.map((name, index) => {
      const state = states[index];
      return {
        name,
        presence: state === 'offline' ? 'offline' : 'online',
        state,
        taskLabel: state === 'offline' ? null : `${name} visible task`,
        updatedAt: '2026-08-22T08:00:00.000Z',
        derived: false,
        provenance: 'operator-agent-reported',
      };
    }),
  };
}

function byName(observations: DuctorAgentObservation[], name: string): DuctorAgentObservation {
  const observation = observations.find((candidate) => candidate.name === name);
  assert.ok(observation);
  return observation;
}

test('maps exactly Alec, Kevin, and Benjamin to stable engine agents with role identity', () => {
  const runtime = createDuctorOfficeRuntime(snapshot());
  const agents = runtime.observeAgents();

  assert.deepEqual(
    agents.map(({ id, name }) => ({ id, name })),
    [
      { id: DUCTOR_AGENT_IDS.Alec, name: 'Alec' },
      { id: DUCTOR_AGENT_IDS.Kevin, name: 'Kevin' },
      { id: DUCTOR_AGENT_IDS.Benjamin, name: 'Benjamin' },
    ],
  );
  assert.deepEqual(
    agents.map(({ color }) => color),
    [DUCTOR_ALEC_COLOR, DUCTOR_KEVIN_COLOR, DUCTOR_BENJAMIN_COLOR],
  );
  assert.deepEqual(
    Object.values(DUCTOR_ROLE_PRESENTATION).map(({ duty }) => duty),
    ['Planner / Architect', 'Builder / Implementer', 'Independent QA / Reviewer'],
  );
  assert.equal(runtime.officeState.characters.size, 3);
});

test('maps simultaneous working, review, and waiting states to distinct targets and truthful actions', () => {
  const runtime = createDuctorOfficeRuntime(snapshot());
  const agents = runtime.observeAgents();
  const alec = byName(agents, 'Alec');
  const kevin = byName(agents, 'Kevin');
  const benjamin = byName(agents, 'Benjamin');

  assert.deepEqual(
    [alec.behavior, kevin.behavior, benjamin.behavior],
    ['typing', 'reading', 'waiting'],
  );
  assert.equal(new Set(agents.map(({ targetKey }) => targetKey)).size, 3);
  assert.equal(runtime.officeState.characters.get(DUCTOR_AGENT_IDS.Alec)?.currentTool, 'Write');
  assert.equal(runtime.officeState.characters.get(DUCTOR_AGENT_IDS.Kevin)?.currentTool, 'Read');
  assert.equal(runtime.officeState.characters.get(DUCTOR_AGENT_IDS.Benjamin)?.currentTool, null);
  assert.equal(
    runtime.officeState.characters.get(DUCTOR_AGENT_IDS.Benjamin)?.waitingAwaitingInput,
    true,
  );
});

test('changes positions across engine ticks, reaches stations, and uses typing/reading frames', () => {
  const runtime = createDuctorOfficeRuntime(snapshot());
  const before = runtime.observeAgents();

  for (let index = 0; index < 80; index++) runtime.tick(0.1);

  const after = runtime.observeAgents();
  for (const name of ['Alec', 'Kevin', 'Benjamin']) {
    const start = byName(before, name);
    const end = byName(after, name);
    assert.notDeepEqual([end.x, end.y], [start.x, start.y], `${name} must visibly move`);
    assert.equal(end.atTarget, true, `${name} must reach its assigned target`);
  }
  const alec = runtime.officeState.characters.get(DUCTOR_AGENT_IDS.Alec);
  const kevin = runtime.officeState.characters.get(DUCTOR_AGENT_IDS.Kevin);
  const benjamin = runtime.officeState.characters.get(DUCTOR_AGENT_IDS.Benjamin);
  assert.ok(alec);
  assert.ok(kevin);
  assert.ok(benjamin);

  assert.equal(alec.state, CharacterState.TYPE);
  assert.equal(kevin.state, CharacterState.TYPE);
  assert.equal(benjamin.state, CharacterState.IDLE);

  const alecSprites = getCharacterSprites(alec.palette, alec.hueShift);
  const kevinSprites = getCharacterSprites(kevin.palette, kevin.hueShift);
  assert.deepEqual(
    getCharacterSprite(alec, alecSprites),
    alecSprites.typing[alec.dir][alec.frame % 2],
  );
  assert.deepEqual(
    getCharacterSprite(kevin, kevinSprites),
    kevinSprites.reading[kevin.dir][kevin.frame % 2],
  );
});

test('preserves generic upstream provider capabilities without global mutation during construction', () => {
  setProviderCapabilities({
    readingTools: ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'],
    subagentToolNames: ['Task', 'Agent'],
  });

  assert.equal(isReadingToolName('Grep'), true);
  assert.equal(isReadingToolName('Glob'), true);
  assert.equal(isSubagentToolName('Task'), true);
  assert.equal(isSubagentToolName('Agent'), true);

  const runtime = createDuctorOfficeRuntime(snapshot(['working', 'review', 'idle']));
  assert.equal(runtime.officeState.characters.size, 3);

  // Generic mode provider capabilities must remain untouched after Ductor construction
  assert.equal(isReadingToolName('Grep'), true);
  assert.equal(isReadingToolName('Glob'), true);
  assert.equal(isSubagentToolName('Task'), true);
  assert.equal(isSubagentToolName('Agent'), true);
  assert.equal(isReadingToolName('Read'), true);
});

test('applies a live snapshot to existing character objects and starts a new route without restart', () => {
  const runtime = createDuctorOfficeRuntime(snapshot(['idle', 'waiting', 'review']));
  const officeState = runtime.officeState;
  const kevin = officeState.characters.get(DUCTOR_AGENT_IDS.Kevin);
  assert.ok(kevin);

  runtime.applySnapshot(snapshot(['idle', 'working', 'review']));

  assert.equal(runtime.officeState, officeState);
  assert.equal(officeState.characters.get(DUCTOR_AGENT_IDS.Kevin), kevin);
  assert.equal(kevin.currentTool, 'Write');
  assert.equal(kevin.state, CharacterState.WALK);
  assert.equal(byName(runtime.observeAgents(), 'Kevin').behavior, 'typing');
});

test('stale or offline snapshots fail closed with no tool or invented task behavior', () => {
  const runtime = createDuctorOfficeRuntime(snapshot());
  const stale = { ...snapshot(), stale: true };

  runtime.applySnapshot(stale);
  for (let index = 0; index < 40; index++) runtime.tick(0.1);

  for (const agent of runtime.observeAgents()) {
    const character = runtime.officeState.characters.get(agent.id);
    assert.equal(agent.behavior, 'offline');
    assert.equal(character?.isActive, false);
    assert.equal(character?.currentTool, null);
    assert.notEqual(character?.state, CharacterState.TYPE);
  }
});

test('layout exposes disjoint reachable role lanes and meaningful work/review stations', () => {
  const runtime = createDuctorOfficeRuntime(snapshot());
  const layout = runtime.officeState.getLayout();
  const observations = runtime.observeAgents();

  assert.equal(layout.areas?.length, 3);
  assert.ok(layout.furniture.some(({ type }) => type === 'DESK_FRONT'));
  assert.ok(layout.furniture.some(({ type }) => type === 'DOUBLE_BOOKSHELF'));
  assert.equal(new Set(observations.map(({ targetCol }) => targetCol)).size, 3);
  assert.ok(observations.every(({ pathLength }) => pathLength > 0));
});
