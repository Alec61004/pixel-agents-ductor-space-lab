import { DUCTOR_ALEC_COLOR, DUCTOR_BENJAMIN_COLOR, DUCTOR_KEVIN_COLOR } from '../constants.js';
import { OfficeState } from '../office/engine/officeState.js';
import type {
  Character,
  OfficeLayout,
  PlacedFurniture,
  TileType as TileTypeValue,
} from '../office/types.js';
import { CharacterState, TileType } from '../office/types.js';
import type { DuctorRoleName, DuctorRoleState, DuctorStatusSnapshot } from './ductorLabModel.js';

export const DUCTOR_AGENT_IDS: Readonly<Record<DuctorRoleName, number>> = {
  Alec: 61004,
  Kevin: 61005,
  Benjamin: 61006,
};

export const DUCTOR_ROLE_PRESENTATION = {
  Alec: {
    duty: 'Planner / Architect',
    color: DUCTOR_ALEC_COLOR,
    palette: 0,
    hueShift: 0,
  },
  Kevin: {
    duty: 'Builder / Implementer',
    color: DUCTOR_KEVIN_COLOR,
    palette: 1,
    hueShift: 0,
  },
  Benjamin: {
    duty: 'Independent QA / Reviewer',
    color: DUCTOR_BENJAMIN_COLOR,
    palette: 2,
    hueShift: 0,
  },
} as const;

export type DuctorAgentBehavior = 'idle' | 'typing' | 'reading' | 'waiting' | 'blocked' | 'offline';

export interface DuctorAgentObservation {
  id: number;
  name: DuctorRoleName;
  color: string;
  behavior: DuctorAgentBehavior;
  targetKey: string;
  targetCol: number | null;
  targetRow: number | null;
  x: number;
  y: number;
  state: Character['state'];
  pathLength: number;
  atTarget: boolean;
}

interface PointTarget {
  key: string;
  col: number;
  row: number;
}

interface RoleStations {
  spawnSeatId: string;
  workSeatId: string;
  reviewSeatId: string;
  waiting: PointTarget;
  blocked: PointTarget;
  offline: PointTarget;
}

interface AppliedRoleState {
  behavior: DuctorAgentBehavior;
  target: PointTarget | null;
  targetKey: string;
}

const ROLE_NAMES: readonly DuctorRoleName[] = ['Alec', 'Kevin', 'Benjamin'];
const LAB_COLS = 22;
const LAB_ROWS = 16;

function roleKey(name: DuctorRoleName): string {
  return name.toLowerCase();
}

function stationsFor(name: DuctorRoleName): RoleStations {
  const key = roleKey(name);
  if (name === 'Alec') {
    return {
      spawnSeatId: `${key}-arrival-dock`,
      workSeatId: `${key}-workstation`,
      reviewSeatId: `${key}-review-station`,
      waiting: { key: `${key}-waiting-point`, col: 3, row: 11 },
      blocked: { key: `${key}-attention-point`, col: 5, row: 11 },
      offline: { key: `${key}-offline-point`, col: 2, row: 14 },
    };
  }
  if (name === 'Kevin') {
    return {
      spawnSeatId: `${key}-arrival-dock`,
      workSeatId: `${key}-workstation`,
      reviewSeatId: `${key}-review-station`,
      waiting: { key: `${key}-waiting-point`, col: 9, row: 11 },
      blocked: { key: `${key}-attention-point`, col: 12, row: 11 },
      offline: { key: `${key}-offline-point`, col: 10, row: 14 },
    };
  }
  return {
    spawnSeatId: `${key}-arrival-dock`,
    workSeatId: `${key}-workstation`,
    reviewSeatId: `${key}-review-station`,
    waiting: { key: `${key}-waiting-point`, col: 16, row: 11 },
    blocked: { key: `${key}-attention-point`, col: 18, row: 11 },
    offline: { key: `${key}-offline-point`, col: 18, row: 14 },
  };
}

export function createDuctorSpaceLabLayout(): OfficeLayout {
  const tiles: TileTypeValue[] = [];
  const tileColors: NonNullable<OfficeLayout['tileColors']> = [];
  const areaTiles: NonNullable<OfficeLayout['areaTiles']> = [];

  for (let row = 0; row < LAB_ROWS; row++) {
    for (let col = 0; col < LAB_COLS; col++) {
      const wall = row === 0 || row === LAB_ROWS - 1 || col === 0 || col === LAB_COLS - 1;
      tiles.push(wall ? TileType.WALL : TileType.FLOOR_1);
      tileColors.push(null);
      areaTiles.push(null);
    }
  }

  const furniture: PlacedFurniture[] = [
    // Shared space observation windows and decor
    { uid: 'window-left', type: 'WINDOW_GALAXY', col: 2, row: 0 },
    { uid: 'window-right', type: 'WINDOW_GALAXY', col: 14, row: 0 },
    { uid: 'weapon-rack-left', type: 'WEAPON_RACK', col: 1, row: 0 },
    { uid: 'specimen-tank-main', type: 'SPECIMEN_TANK', col: 8, row: 1 },
    { uid: 'archive-main', type: 'DOUBLE_BOOKSHELF', col: 19, row: 0 },

    // Alec: Strategy Desk Station (Left)
    { uid: 'alec-console', type: 'CONSOLE_NEON', col: 3, row: 3 },
    { uid: 'alec-terminal', type: 'PC_FRONT_OFF', col: 4, row: 3 },
    { uid: 'alec-workstation', type: 'CUSHIONED_CHAIR_BACK', col: 4, row: 5 },
    { uid: 'alec-holo-table', type: 'HOLO_TABLE', col: 2, row: 7 },
    { uid: 'alec-review-station', type: 'CUSHIONED_CHAIR_BACK', col: 4, row: 8 },
    { uid: 'alec-arrival-dock', type: 'CUSHIONED_CHAIR_BACK', col: 2, row: 13 },

    // Kevin: Build Workbench Station (Center)
    { uid: 'kevin-console', type: 'CONSOLE_NEON', col: 10, row: 4 },
    { uid: 'kevin-terminal', type: 'PC_FRONT_OFF', col: 11, row: 4 },
    { uid: 'kevin-workstation', type: 'CUSHIONED_CHAIR_BACK', col: 11, row: 6 },
    { uid: 'kevin-review-station', type: 'CUSHIONED_CHAIR_BACK', col: 11, row: 9 },
    { uid: 'kevin-arrival-dock', type: 'CUSHIONED_CHAIR_BACK', col: 10, row: 13 },

    // Benjamin: QA & Verification Station (Right)
    { uid: 'benjamin-console', type: 'CONSOLE_NEON', col: 16, row: 3 },
    { uid: 'benjamin-terminal', type: 'PC_FRONT_OFF', col: 17, row: 3 },
    { uid: 'benjamin-workstation', type: 'CUSHIONED_CHAIR_BACK', col: 17, row: 5 },
    { uid: 'benjamin-review-station', type: 'CUSHIONED_CHAIR_BACK', col: 17, row: 8 },
    { uid: 'benjamin-arrival-dock', type: 'CUSHIONED_CHAIR_BACK', col: 18, row: 13 },
  ];

  return {
    version: 1,
    cols: LAB_COLS,
    rows: LAB_ROWS,
    tiles,
    tileColors,
    furniture,
    pets: [],
    areas: [],
    areaTiles,
  };
}

function effectiveState(snapshot: DuctorStatusSnapshot, name: DuctorRoleName): DuctorRoleState {
  const role = snapshot.roles.find((candidate) => candidate.name === name);
  if (snapshot.stale || !role || role.presence === 'offline' || role.state === 'offline') {
    return 'offline';
  }
  return role.state;
}

function behaviorForState(state: DuctorRoleState): DuctorAgentBehavior {
  if (state === 'working') return 'typing';
  if (state === 'review') return 'reading';
  return state;
}

function stopAtPoint(character: Character, target: PointTarget): void {
  if (character.tileCol !== target.col || character.tileRow !== target.row) return;
  character.path = [];
  character.moveProgress = 0;
  character.state = CharacterState.IDLE;
  character.wanderTimer = Number.POSITIVE_INFINITY;
}

export class DuctorOfficeRuntime {
  readonly officeState: OfficeState;
  private readonly applied = new Map<DuctorRoleName, AppliedRoleState>();

  constructor(snapshot: DuctorStatusSnapshot) {
    this.officeState = new OfficeState(createDuctorSpaceLabLayout());

    for (const name of ROLE_NAMES) {
      const presentation = DUCTOR_ROLE_PRESENTATION[name];
      this.officeState.addAgent(
        DUCTOR_AGENT_IDS[name],
        presentation.palette,
        presentation.hueShift,
        stationsFor(name).spawnSeatId,
        true,
      );
    }
    this.applySnapshot(snapshot);
  }

  applySnapshot(snapshot: DuctorStatusSnapshot): void {
    for (const name of ROLE_NAMES) {
      const state = effectiveState(snapshot, name);
      const previous = this.applied.get(name);
      if (previous?.behavior === behaviorForState(state)) {
        this.refreshPersistentCue(name, state);
        continue;
      }
      this.applyRoleState(name, state);
    }
  }

  tick(dt: number): void {
    this.officeState.update(dt);
    for (const name of ROLE_NAMES) {
      const applied = this.applied.get(name);
      if (!applied?.target) continue;
      const character = this.officeState.characters.get(DUCTOR_AGENT_IDS[name]);
      if (!character) continue;
      if (
        applied.behavior === 'waiting' ||
        applied.behavior === 'blocked' ||
        applied.behavior === 'offline'
      ) {
        stopAtPoint(character, applied.target);
      }
    }
  }

  observeAgents(): DuctorAgentObservation[] {
    return ROLE_NAMES.map((name) => {
      const id = DUCTOR_AGENT_IDS[name];
      const character = this.officeState.characters.get(id);
      if (!character) throw new Error(`Missing Ductor engine character: ${name}`);
      const applied = this.applied.get(name);
      if (!applied) throw new Error(`Missing Ductor engine state: ${name}`);
      const target = applied.target;
      return {
        id,
        name,
        color: DUCTOR_ROLE_PRESENTATION[name].color,
        behavior: applied.behavior,
        targetKey: applied.targetKey,
        targetCol: target?.col ?? null,
        targetRow: target?.row ?? null,
        x: character.x,
        y: character.y,
        state: character.state,
        pathLength: character.path.length,
        atTarget:
          target === null ||
          (character.tileCol === target.col &&
            character.tileRow === target.row &&
            character.path.length === 0),
      };
    });
  }

  private clearRoleCue(character: Character): void {
    character.bubbleType = null;
    character.bubbleTimer = 0;
    character.waitingAwaitingInput = false;
    this.officeState.setAgentTool(character.id, null);
  }

  private refreshPersistentCue(name: DuctorRoleName, state: DuctorRoleState): void {
    const character = this.officeState.characters.get(DUCTOR_AGENT_IDS[name]);
    if (!character) return;
    if (state === 'waiting') {
      character.bubbleType = 'waiting';
      character.waitingAwaitingInput = true;
      character.bubbleTimer = Number.POSITIVE_INFINITY;
    } else if (state === 'blocked') {
      this.officeState.showPermissionBubble(character.id);
    }
  }

  private applyRoleState(name: DuctorRoleName, state: DuctorRoleState): void {
    const id = DUCTOR_AGENT_IDS[name];
    const character = this.officeState.characters.get(id);
    if (!character) throw new Error(`Missing Ductor engine character: ${name}`);
    const stations = stationsFor(name);
    this.clearRoleCue(character);

    if (state === 'working' || state === 'review') {
      const seatId = state === 'working' ? stations.workSeatId : stations.reviewSeatId;
      const seat = this.officeState.seats.get(seatId);
      if (!seat) throw new Error(`Missing Ductor station: ${seatId}`);
      this.officeState.setAgentActive(id, true);
      this.officeState.setAgentTool(id, state === 'review' ? 'Read' : 'Write');
      this.officeState.reassignSeat(id, seatId);
      this.applied.set(name, {
        behavior: behaviorForState(state),
        target: { key: seatId, col: seat.seatCol, row: seat.seatRow },
        targetKey: seatId,
      });
      return;
    }

    if (state === 'idle') {
      this.officeState.setAgentActive(id, false);
      character.state = CharacterState.IDLE;
      character.wanderTimer = 0.2;
      this.applied.set(name, {
        behavior: 'idle',
        target: null,
        targetKey: `${roleKey(name)}-wander`,
      });
      return;
    }

    const target =
      state === 'waiting'
        ? stations.waiting
        : state === 'blocked'
          ? stations.blocked
          : stations.offline;
    this.officeState.setAgentActive(id, false);
    const walking = this.officeState.walkToTile(id, target.col, target.row);
    if (!walking) stopAtPoint(character, target);

    if (state === 'waiting') {
      this.officeState.showWaitingBubble(id, true);
      character.bubbleTimer = Number.POSITIVE_INFINITY;
    } else if (state === 'blocked') {
      this.officeState.showPermissionBubble(id);
    }
    this.applied.set(name, { behavior: state, target, targetKey: target.key });
  }
}

export function createDuctorOfficeRuntime(snapshot: DuctorStatusSnapshot): DuctorOfficeRuntime {
  return new DuctorOfficeRuntime(snapshot);
}
