import {
  STARSHIP_AGENT_SHADOW,
  STARSHIP_AMBER,
  STARSHIP_CRIMSON_TINT,
  STARSHIP_FLOOR_MARKER_FILL,
  STARSHIP_FLOOR_MARKER_STROKE,
  STARSHIP_NAME_TAG_FILL,
  STARSHIP_NEBULA_TINT,
  STARSHIP_SHADOW_TINT,
  STARSHIP_VOID_TINT,
} from '../constants.js';
import type { DuctorRoleName, DuctorStatusSnapshot } from './ductorLabModel.js';

export const SHEET_COLS = 16;
export const SHEET_ROWS = 8;
export const CW = 1600;
export const CH = 678;

export const SKINS = [
  { row: 0, name: 'Crimson Hunter-Class', tint: STARSHIP_CRIMSON_TINT },
  { row: 1, name: 'Crimson Hunter-Class Mk2', tint: STARSHIP_CRIMSON_TINT },
  { row: 2, name: 'Void Recon Unit', tint: STARSHIP_VOID_TINT },
  { row: 3, name: 'Void Recon Unit Mk2', tint: STARSHIP_VOID_TINT },
  { row: 4, name: 'Nebula Sentinel', tint: STARSHIP_NEBULA_TINT },
  { row: 5, name: 'Nebula Sentinel Mk2', tint: STARSHIP_NEBULA_TINT },
  { row: 6, name: 'Shadow Deckhand', tint: STARSHIP_SHADOW_TINT },
  { row: 7, name: 'Shadow Deckhand Mk2', tint: STARSHIP_SHADOW_TINT },
] as const;

export const STATIONS = [
  { x: 210, y: 560, label: 'Bio Pods' },
  { x: 430, y: 600, label: 'Hologram Table' },
  { x: 640, y: 520, label: 'Nav Console' },
  { x: 830, y: 610, label: 'Specimen Bay' },
  { x: 1010, y: 560, label: 'Ops Terminal' },
  { x: 1230, y: 600, label: 'Sensor Array' },
  { x: 1430, y: 540, label: 'Aux Station' },
  { x: 1540, y: 610, label: 'Starboard Watch' },
] as const;

export const STATION_SLOTS = [
  { dx: 0, dy: 0 },
  { dx: -26, dy: 12 },
  { dx: 26, dy: 12 },
  { dx: -16, dy: -14 },
  { dx: 16, dy: -14 },
] as const;

export const ATTENTION_POINTS: Record<DuctorRoleName, { x: number; y: number }> = {
  Alec: { x: 360, y: 510 },
  Kevin: { x: 800, y: 510 },
  Benjamin: { x: 1240, y: 510 },
};

export interface WorkstationCutout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorkstationScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DeckObjectId =
  | 'strategy-map'
  | 'build-console'
  | 'qa-console'
  | 'specimen-bank'
  | 'xeno-vault'
  | 'armory';

export interface InteractiveDeckObject {
  id: DeckObjectId;
  label: string;
  system: string;
  description: string;
  owner?: DuctorRoleName;
  color: string;
  rect: { x: number; y: number; w: number; h: number };
  actionLabel: string;
}

export const INTERACTIVE_DECK_OBJECTS: InteractiveDeckObject[] = [
  {
    id: 'strategy-map',
    label: 'Stellar Strategy Table',
    system: 'TACTICAL HOLOGRAM',
    description: 'Explore route nodes, threat sectors, and live mission geometry.',
    owner: 'Alec',
    color: '#c98bff',
    rect: { x: 490, y: 500, w: 145, h: 132 },
    actionLabel: 'Run simulation',
  },
  {
    id: 'build-console',
    label: 'Build Engineering Console',
    system: 'COMPILER ARRAY',
    description: 'Inspect build lanes, terminal activity, and deployment health.',
    owner: 'Kevin',
    color: '#5ce1ff',
    rect: { x: 372, y: 382, w: 224, h: 150 },
    actionLabel: 'Boost compiler',
  },
  {
    id: 'qa-console',
    label: 'QA Verification Console',
    system: 'SCAN MATRIX',
    description: 'Review validation passes, anomalies, and release readiness.',
    owner: 'Benjamin',
    color: '#ff5c5c',
    rect: { x: 985, y: 526, w: 198, h: 132 },
    actionLabel: 'Run deep scan',
  },
  {
    id: 'specimen-bank',
    label: 'Specimen Bank',
    system: 'BIOLOGICAL ARCHIVE',
    description: 'Cycle preservation fields and analyze the contained samples.',
    color: '#76f7b2',
    rect: { x: 300, y: 520, w: 190, h: 145 },
    actionLabel: 'Analyze samples',
  },
  {
    id: 'xeno-vault',
    label: 'Xeno Containment Vault',
    system: 'STASIS CORE',
    description: 'Monitor containment integrity and life-sign harmonics.',
    color: '#70ffd2',
    rect: { x: 790, y: 250, w: 165, h: 245 },
    actionLabel: 'Pulse stasis field',
  },
  {
    id: 'armory',
    label: 'Energy Armory',
    system: 'POWER DIAGNOSTICS',
    description: 'Cycle weapon cells and inspect the energy distribution rail.',
    color: '#ffb65c',
    rect: { x: 385, y: 155, w: 165, h: 200 },
    actionLabel: 'Cycle power cells',
  },
];

export function hitTestDeckObject(x: number, y: number): InteractiveDeckObject | null {
  for (let index = INTERACTIVE_DECK_OBJECTS.length - 1; index >= 0; index--) {
    const object = INTERACTIVE_DECK_OBJECTS[index];
    if (!object) continue;
    const { rect } = object;
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
      return object;
    }
  }
  return null;
}

export interface WorkstationConfig {
  agentName: DuctorRoleName;
  label: string;
  roleDescription: string;
  walkPoint: { x: number; y: number };
  seatPoint: { x: number; y: number };
  tableX: number;
  tableY: number;
  standingX: number;
  standingY: number;
  facing: 'back' | 'front' | number;
  screenRect: WorkstationScreenRect;
  deskCutout: WorkstationCutout;
  stationIndex: number;
}

export type AssignedWorkstation = WorkstationConfig;

export const WORKSTATIONS: Record<DuctorRoleName, WorkstationConfig> = {
  Alec: {
    agentName: 'Alec',
    label: 'Alec — Strategy',
    roleDescription: 'Strategy',
    // The strategy station is the raised star-map table, not the specimen jars
    // immediately to its left. Alec approaches from the bridge floor and works
    // from behind the projection so the table can correctly occlude his legs.
    walkPoint: { x: 558, y: 627 },
    seatPoint: { x: 558, y: 620 },
    tableX: 558,
    tableY: 575,
    standingX: 558,
    standingY: 620,
    facing: 'back',
    screenRect: { x: 500, y: 515, w: 118, h: 78 },
    deskCutout: { x: 500, y: 584, w: 118, h: 43 },
    stationIndex: 1,
  },
  Kevin: {
    agentName: 'Kevin',
    label: 'Kevin — Build',
    roleDescription: 'Build',
    walkPoint: { x: 480, y: 495 },
    seatPoint: { x: 480, y: 489 },
    tableX: 480,
    tableY: 495,
    standingX: 480,
    standingY: 495,
    facing: 'back',
    screenRect: { x: 399, y: 405, w: 176, h: 54 },
    deskCutout: { x: 376, y: 454, w: 210, h: 72 },
    stationIndex: 4,
  },
  Benjamin: {
    agentName: 'Benjamin',
    label: 'Benjamin — QA',
    roleDescription: 'QA',
    walkPoint: { x: 1080, y: 595 },
    seatPoint: { x: 1080, y: 589 },
    tableX: 1080,
    tableY: 595,
    standingX: 1080,
    standingY: 595,
    facing: 'back',
    screenRect: { x: 1024, y: 548, w: 112, h: 42 },
    deskCutout: { x: 998, y: 566, w: 176, h: 70 },
    stationIndex: 5,
  },
};

export const ASSIGNED_WORKSTATIONS = WORKSTATIONS;

export const OFFLINE_POINTS: Record<DuctorRoleName, { x: number; y: number }> = {
  Alec: { x: 120, y: 620 },
  Kevin: { x: 740, y: 640 },
  Benjamin: { x: 1480, y: 640 },
};

export const IDLE_POINTS: Record<DuctorRoleName, { x: number; y: number }> = {
  Alec: { x: 500, y: 550 },
  Kevin: { x: 800, y: 560 },
  Benjamin: { x: 1120, y: 550 },
};

export const WAITING_POINTS: Record<DuctorRoleName, { x: number; y: number }> = {
  Alec: { x: 360, y: 620 },
  Kevin: { x: 800, y: 620 },
  Benjamin: { x: 1240, y: 620 },
};

export const STATE = {
  MOVING: 'moving',
  WORKING: 'working',
  IDLE: 'idle',
  WAITING: 'waiting',
  BLOCKED: 'blocked',
  OFFLINE: 'offline',
} as const;

export type StarshipAgentState = (typeof STATE)[keyof typeof STATE];

export interface Point2D {
  x: number;
  y: number;
}

export const FLOOR_Y_MIN = 490;
export const FLOOR_Y_MAX = 660;
export const DEPTH_SCALE_MIN = 0.8;
export const DEPTH_SCALE_MAX = 1.1;

export const WALKABLE_POLYGON: Point2D[] = [
  { x: 50, y: 510 },
  { x: 260, y: 510 },
  { x: 340, y: 490 },
  { x: 600, y: 490 },
  { x: 700, y: 490 },
  { x: 920, y: 490 },
  { x: 1040, y: 490 },
  { x: 1300, y: 490 },
  { x: 1420, y: 500 },
  { x: 1570, y: 510 },
  { x: 1570, y: 660 },
  { x: 50, y: 660 },
];

export function getDepthScale(
  y: number,
  minY = FLOOR_Y_MIN,
  maxY = FLOOR_Y_MAX,
  minScale = DEPTH_SCALE_MIN,
  maxScale = DEPTH_SCALE_MAX,
): number {
  if (maxY <= minY) return minScale;
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  return minScale + t * (maxScale - minScale);
}

export function isPointInPolygon(p: Point2D, polygon: Point2D[] = WALKABLE_POLYGON): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function clampPointToPolygon(p: Point2D, polygon: Point2D[] = WALKABLE_POLYGON): Point2D {
  if (isPointInPolygon(p, polygon)) {
    return { x: p.x, y: p.y };
  }

  let minSqDist = Infinity;
  let closestX = p.x;
  let closestY = p.y;

  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = a.x + t * dx;
    const projY = a.y + t * dy;

    const sqDist = (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
    if (sqDist < minSqDist) {
      minSqDist = sqDist;
      closestX = projX;
      closestY = projY;
    }
  }

  let cx = 0;
  let cy = 0;
  for (const pt of polygon) {
    cx += pt.x;
    cy += pt.y;
  }
  cx /= n;
  cy /= n;

  const clampedX = closestX + (cx - closestX) * 0.001;
  const clampedY = closestY + (cy - closestY) * 0.001;

  return { x: clampedX, y: clampedY };
}

export interface WorkParticle {
  x: number;
  y: number;
  vy: number;
  alpha: number;
  life: number;
  maxLife: number;
  icon: string;
  color: string;
}

export interface StarshipAgent {
  id: string;
  name: DuctorRoleName;
  role: string;
  reportedState?: string;
  reportedTaskLabel?: string | null;
  provenance?: string;
  skin: { row: number; name: string; tint: string };
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  facing: number | 'back' | 'front';
  state: StarshipAgentState;
  stateTimer: number;
  animFrame: number;
  animTimer: number;
  bob: number;
  stationIndex: number | null;
  currentStation: string;
  flash?: number;
  particleTimer?: number;
  particles?: WorkParticle[];
}

export interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

export const ROLE_IDLE_SLOT_OFFSETS: Record<DuctorRoleName, { dx: number; dy: number }> = {
  Alec: { dx: -28, dy: -10 },
  Kevin: { dx: 0, dy: 14 },
  Benjamin: { dx: 28, dy: -10 },
};

export function pickStation(
  agents: StarshipAgent[],
  excludeId: string | null,
): { stationIndex: number; slot: { dx: number; dy: number } } {
  const counts = new Array(STATIONS.length).fill(0);
  for (const a of agents) {
    if (a.id === excludeId) continue;
    if (a.stationIndex != null && a.state !== STATE.OFFLINE) {
      counts[a.stationIndex]++;
    }
  }
  const minCount = Math.min(...counts);
  const candidates: number[] = [];
  for (let i = 0; i < STATIONS.length; i++) {
    if (counts[i] === minCount) candidates.push(i);
  }
  // Prefer stations farther from current position for more natural movement
  const stationIndex = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
  const slot = STATION_SLOTS[Math.min(minCount, STATION_SLOTS.length - 1)] ?? STATION_SLOTS[0];
  return { stationIndex, slot };
}

export function pickNewTarget(agent: StarshipAgent, agents: StarshipAgent[]): void {
  if (agent.reportedState === 'working' || agent.reportedState === 'review') {
    const ws = ASSIGNED_WORKSTATIONS[agent.name];
    if (ws) {
      agent.stationIndex = ws.stationIndex;
      agent.targetX = ws.standingX;
      agent.targetY = ws.standingY;
      agent.facing = ws.facing;
      agent.currentStation = ws.label;
      agent.state = STATE.MOVING;
      return;
    }
  }

  if (agent.reportedState === 'waiting') {
    const point = WAITING_POINTS[agent.name];
    if (point) {
      agent.stationIndex = null;
      agent.targetX = point.x;
      agent.targetY = point.y;
      agent.currentStation = 'Awaiting instruction';
      agent.state = STATE.MOVING;
      return;
    }
  }

  // Idle wander mode or demo mode: pick among stations with distinct role slot offsets to prevent overlap
  const { stationIndex, slot } = pickStation(agents, agent.id);
  const roleOffset = ROLE_IDLE_SLOT_OFFSETS[agent.name] ?? { dx: 0, dy: 0 };
  const st = STATIONS[stationIndex] ?? STATIONS[0];
  agent.stationIndex = stationIndex;
  agent.targetX = st.x + slot.dx + roleOffset.dx;
  agent.targetY = st.y + slot.dy + roleOffset.dy;
  agent.currentStation = st.label;
  agent.state = STATE.MOVING;
}

export function routeToPoint(
  agents: StarshipAgent[],
  px: number,
  py: number,
  pushLog?: (msg: string) => void,
): void {
  let best: StarshipAgent | null = null;
  let bestD = Infinity;
  for (const a of agents) {
    const d = (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  if (best) {
    best.targetX = px;
    best.targetY = py;
    best.stationIndex = null;
    best.currentStation = 'Custom Waypoint';
    best.state = STATE.MOVING;
    if (pushLog) pushLog(`${best.name} rerouted on manual order.`);
  }
}

export const ROLE_GLOW_COLORS: Record<string, string> = {
  Alec: '#c98bff',
  Kevin: '#5ce1ff',
  Benjamin: '#ff5c5c',
};

export const ROLE_PARTICLE_ICONS: Record<string, string> = {
  Alec: '✦',
  Kevin: '</>',
  Benjamin: '✓',
};

export function makeAgent(spec: {
  id: string;
  name: DuctorRoleName;
  role: string;
  skin: (typeof SKINS)[number];
  reportedState?: string;
  reportedTaskLabel?: string | null;
  provenance?: string;
  x: number;
  y: number;
  facing?: number | 'back' | 'front';
  state?: StarshipAgentState;
  stationIndex?: number | null;
  currentStation?: string;
  flash?: number;
  particleTimer?: number;
  particles?: WorkParticle[];
}): StarshipAgent {
  return {
    id: spec.id,
    name: spec.name,
    role: spec.role,
    reportedState: spec.reportedState,
    reportedTaskLabel: spec.reportedTaskLabel,
    provenance: spec.provenance,
    skin: spec.skin,
    x: spec.x,
    y: spec.y,
    targetX: spec.x,
    targetY: spec.y,
    speed: 46 + Math.random() * 22,
    facing: spec.facing ?? 1,
    state: spec.state ?? STATE.WORKING,
    stateTimer: 2 + Math.random() * 2,
    animFrame: 0,
    animTimer: 0,
    bob: Math.random() * Math.PI * 2,
    stationIndex: spec.stationIndex ?? null,
    currentStation: spec.currentStation ?? '',
    flash: spec.flash !== undefined ? spec.flash : 1,
    particleTimer: spec.particleTimer ?? 0,
    particles: spec.particles ?? [],
  };
}

export function createInitialCrew(snapshot?: DuctorStatusSnapshot): StarshipAgent[] {
  const crewSpecs: Array<{
    id: string;
    name: DuctorRoleName;
    role: string;
    skin: (typeof SKINS)[number];
  }> = [
    {
      id: 'Alec',
      name: 'Alec',
      role: 'Planner / Architect',
      skin: SKINS[4], // Nebula Sentinel (row 4)
    },
    {
      id: 'Kevin',
      name: 'Kevin',
      role: 'Builder / Implementer',
      skin: SKINS[2], // Void Recon Unit (row 2)
    },
    {
      id: 'Benjamin',
      name: 'Benjamin',
      role: 'Independent QA / Reviewer',
      skin: SKINS[0], // Crimson Hunter-Class (row 0)
    },
  ];

  const agents: StarshipAgent[] = [];
  for (const spec of crewSpecs) {
    const roleSnapshot = snapshot?.roles?.find((r) => r.name === spec.name);
    const isOffline =
      Boolean(snapshot?.stale) ||
      roleSnapshot?.presence === 'offline' ||
      roleSnapshot?.state === 'offline';
    const effective = isOffline ? 'offline' : roleSnapshot?.state;

    let x!: number;
    let y!: number;
    let stationIndex!: number | null;
    let currentStation!: string;
    let initialState!: StarshipAgentState;

    if (effective === 'offline') {
      const pt = OFFLINE_POINTS[spec.name] ?? { x: 120, y: 620 };
      x = pt.x;
      y = pt.y;
      stationIndex = null;
      currentStation = 'Offline Berth';
      initialState = STATE.OFFLINE;
    } else if (effective === 'blocked') {
      const pt = ATTENTION_POINTS[spec.name] ?? { x: 800, y: 510 };
      x = pt.x;
      y = pt.y;
      stationIndex = null;
      currentStation = 'Attention Point';
      initialState = STATE.BLOCKED;
    } else if (effective === 'waiting') {
      const pt = WAITING_POINTS[spec.name] ?? { x: 800, y: 620 };
      x = pt.x;
      y = pt.y;
      stationIndex = null;
      currentStation = 'Awaiting instruction';
      initialState = STATE.WAITING;
    } else if (effective === 'idle') {
      const pt = IDLE_POINTS[spec.name] ?? { x: 800, y: 560 };
      x = pt.x;
      y = pt.y;
      stationIndex = null;
      currentStation = 'Bridge Floor';
      initialState = STATE.IDLE;
    } else {
      // working, review, or fallback without snapshot
      const ws = ASSIGNED_WORKSTATIONS[spec.name];
      if (ws) {
        x = ws.seatPoint.x;
        y = ws.seatPoint.y;
        stationIndex = ws.stationIndex;
        currentStation = ws.label;
      } else {
        const pick = pickStation(agents, null);
        stationIndex = pick.stationIndex;
        const station = STATIONS[stationIndex] ?? STATIONS[0];
        x = station.x + pick.slot.dx;
        y = station.y + pick.slot.dy;
        currentStation = station.label;
      }
      initialState = STATE.WORKING;
    }

    const initialFacing =
      ASSIGNED_WORKSTATIONS[spec.name]?.facing ?? (Math.random() < 0.5 ? -1 : 1);

    agents.push(
      makeAgent({
        id: spec.id,
        name: spec.name,
        role: spec.role,
        reportedState: roleSnapshot?.state,
        reportedTaskLabel: roleSnapshot?.taskLabel,
        provenance: roleSnapshot?.provenance,
        skin: spec.skin,
        x,
        y,
        facing: initialFacing,
        state: initialState,
        stationIndex,
        currentStation,
        flash: 1,
      }),
    );
  }
  return agents;
}

export function applySnapshotToAgents(
  agents: StarshipAgent[],
  snapshot?: DuctorStatusSnapshot | null,
  pushLog?: (msg: string) => void,
): void {
  if (!snapshot || !snapshot.roles || snapshot.roles.length === 0) {
    // Fallback mode: clear reportedState so agents resume random behavior
    for (const a of agents) {
      const wasControlled = Boolean(a.reportedState);
      a.reportedState = undefined;
      a.reportedTaskLabel = undefined;
      a.provenance = undefined;
      if (
        wasControlled &&
        (a.state === STATE.OFFLINE || a.state === STATE.BLOCKED || a.state === STATE.WAITING)
      ) {
        pickNewTarget(a, agents);
      }
    }
    return;
  }

  for (const a of agents) {
    const role = snapshot.roles.find((r) => r.name === a.name);
    if (!role) continue;
    const isOffline =
      Boolean(snapshot.stale) || role.presence === 'offline' || role.state === 'offline';
    const effective = isOffline ? 'offline' : role.state;
    const prevEffective =
      a.reportedState === 'offline' || (snapshot.stale && a.reportedState)
        ? 'offline'
        : a.reportedState;

    a.reportedState = role.state;
    a.reportedTaskLabel = role.taskLabel;
    a.provenance = role.provenance;

    if (effective === prevEffective && a.state !== STATE.MOVING) {
      continue;
    }

    if (effective === 'working' || effective === 'review') {
      const ws = ASSIGNED_WORKSTATIONS[a.name];
      if (ws) {
        a.stationIndex = ws.stationIndex;
        a.currentStation = ws.label;
        a.targetX = ws.standingX;
        a.targetY = ws.standingY;
        a.facing = ws.facing;
        a.state =
          Math.hypot(a.x - ws.standingX, a.y - ws.standingY) < 3 ? STATE.WORKING : STATE.MOVING;
        // Staggered dispatch: add role-based delay to avoid all agents moving simultaneously
        const roleDelay: Record<DuctorRoleName, number> = {
          Alec: 0,
          Kevin: 0.3,
          Benjamin: 0.6,
        };
        a.stateTimer = (roleDelay[a.name] ?? 0) + Math.random() * 0.2;
        if (pushLog) pushLog(`${a.name} dispatched to assigned desk [${ws.label}].`);
      } else {
        pickNewTarget(a, agents);
        if (pushLog) pushLog(`${a.name} dispatched to ${a.currentStation} [${effective}].`);
      }
    } else if (effective === 'blocked') {
      const pt = ATTENTION_POINTS[a.name] ?? ATTENTION_POINTS.Kevin;
      a.stationIndex = null;
      a.currentStation = 'Attention Point';
      a.targetX = pt.x;
      a.targetY = pt.y;
      a.state = Math.hypot(a.x - pt.x, a.y - pt.y) < 3 ? STATE.BLOCKED : STATE.MOVING;
      if (pushLog) pushLog(`${a.name} attention requested at bridge center.`);
    } else if (effective === 'offline') {
      const pt = OFFLINE_POINTS[a.name] ?? OFFLINE_POINTS.Kevin;
      a.stationIndex = null;
      a.currentStation = 'Offline Berth';
      a.targetX = pt.x;
      a.targetY = pt.y;
      a.state = Math.hypot(a.x - pt.x, a.y - pt.y) < 3 ? STATE.OFFLINE : STATE.MOVING;
      if (pushLog) pushLog(`${a.name} went offline, holding in berth.`);
    } else if (effective === 'idle') {
      const pt = IDLE_POINTS[a.name] ?? IDLE_POINTS.Kevin;
      a.stationIndex = null;
      a.currentStation = 'Bridge Floor';
      a.targetX = pt.x;
      a.targetY = pt.y;
      a.state = Math.hypot(a.x - pt.x, a.y - pt.y) < 3 ? STATE.IDLE : STATE.MOVING;
      if (pushLog) pushLog(`${a.name} on standby.`);
    } else if (effective === 'waiting') {
      const pt = WAITING_POINTS[a.name] ?? WAITING_POINTS.Kevin;
      a.stationIndex = null;
      a.currentStation = 'Awaiting instruction';
      a.targetX = pt.x;
      a.targetY = pt.y;
      a.state = Math.hypot(a.x - pt.x, a.y - pt.y) < 3 ? STATE.WAITING : STATE.MOVING;
      if (pushLog) pushLog(`${a.name} is waiting for the next instruction.`);
    }
  }
}

export function updateAgent(
  a: StarshipAgent,
  dt: number,
  speedMult: number,
  agents: StarshipAgent[],
  pushLog?: (msg: string) => void,
): void {
  if (a.state === STATE.MOVING) {
    const dx = a.targetX - a.x;
    const dy = a.targetY - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) {
      a.x = a.targetX;
      a.y = a.targetY;
      if (a.reportedState === 'offline') {
        a.state = STATE.OFFLINE;
      } else if (a.reportedState === 'blocked') {
        a.state = STATE.BLOCKED;
      } else if (a.reportedState === 'waiting') {
        a.state = STATE.WAITING;
      } else if (a.reportedState === 'idle') {
        a.state = STATE.IDLE;
        a.stateTimer = 2 + Math.random() * 2;
      } else {
        a.state = STATE.WORKING;
        a.stateTimer = 2.5 + Math.random() * 3.5;
        const ws = ASSIGNED_WORKSTATIONS[a.name];
        if (ws) {
          a.facing = ws.facing;
        } else if (a.stationIndex != null && STATIONS[a.stationIndex]) {
          const st = STATIONS[a.stationIndex];
          a.facing = st.x >= a.x ? 1 : -1;
        }
      }
      a.animFrame = 0;
      if (pushLog) pushLog(`${a.name} arrived at ${a.currentStation}.`);
    } else {
      const step = a.speed * speedMult * dt;
      const nx = a.x + (dx / dist) * Math.min(step, dist);
      const ny = a.y + (dy / dist) * Math.min(step, dist);
      const clamped = clampPointToPolygon({ x: nx, y: ny }, WALKABLE_POLYGON);
      a.facing = dx >= 0 ? 1 : -1;
      a.x = clamped.x;
      a.y = clamped.y;
      a.animTimer += dt;
      if (a.animTimer > 0.12) {
        a.animTimer = 0;
        a.animFrame = (a.animFrame + 1) % 4; // 4-frame walk cycle
      }
    }
  } else if (a.state === STATE.WORKING) {
    const ws = ASSIGNED_WORKSTATIONS[a.name];
    if (ws) {
      a.facing = ws.facing;
      // Move to sitting position if at station but not at seat yet
      const atStation = isAgentAtStation(a);
      const atSeat = Math.hypot(a.x - ws.seatPoint.x, a.y - ws.seatPoint.y) < 5;
      if (atStation && !atSeat) {
        a.targetX = ws.seatPoint.x;
        a.targetY = ws.seatPoint.y;
        a.state = STATE.MOVING;
        return;
      }
      if (atSeat) {
        a.x = ws.seatPoint.x;
        a.y = ws.seatPoint.y;
      }
    }
    a.stateTimer -= dt * speedMult;
    a.bob += dt * 12 * Math.PI; // 6Hz typing bob oscillation
    a.animTimer += dt;
    if (a.animTimer > 0.5) {
      a.animTimer = 0;
      a.animFrame = (a.animFrame + 1) % 4; // idle turn cycle
    }
    if (a.stateTimer <= 0) {
      if (a.reportedState === 'working' || a.reportedState === 'review') {
        // Working agent stays at their assigned desk
        a.stateTimer = 3 + Math.random() * 3;
        if (ws) {
          a.facing = ws.facing;
        }
      } else {
        a.state = STATE.IDLE;
        a.stateTimer = 2 + Math.random() * 2;
        a.animFrame = 0;
      }
    }
  } else if (a.state === STATE.WAITING) {
    a.animTimer += dt;
    if (a.animTimer > 0.8) {
      a.animTimer = 0;
      a.animFrame = (a.animFrame + 1) % 4;
    }
  } else if (a.state === STATE.IDLE) {
    a.stateTimer -= dt * speedMult;
    a.animTimer += dt;
    if (a.animTimer > 0.8) {
      a.animTimer = 0;
      a.animFrame = (a.animFrame + 1) % 4;
    }
    if (a.stateTimer <= 0) {
      if (a.reportedState === 'working' || a.reportedState === 'review') {
        const ws = ASSIGNED_WORKSTATIONS[a.name];
        if (ws) {
          a.targetX = ws.standingX;
          a.targetY = ws.standingY;
          a.stationIndex = ws.stationIndex;
          a.currentStation = ws.label;
          a.state = STATE.MOVING;
        } else {
          pickNewTarget(a, agents);
        }
      } else {
        // Idle agents wander between stations
        pickNewTarget(a, agents);
      }
    }
  } else if (a.state === STATE.BLOCKED) {
    a.bob += dt * 3;
    a.animTimer += dt;
    if (a.animTimer > 0.6) {
      a.animTimer = 0;
      a.animFrame = (a.animFrame + 1) % 4;
    }
  } else if (a.state === STATE.OFFLINE) {
    a.animFrame = 0;
  }

  const isOffline = a.reportedState === 'offline' || a.state === STATE.OFFLINE;

  // Work particles: spawn every ~0.9s when working
  if (a.state === STATE.WORKING && !isOffline) {
    a.particleTimer = (a.particleTimer ?? 0) + dt * speedMult;
    if (a.particleTimer >= 0.9) {
      a.particleTimer = 0;
      if (!a.particles) a.particles = [];
      const icon = ROLE_PARTICLE_ICONS[a.name] ?? '⚙';
      const color = ROLE_GLOW_COLORS[a.name] ?? a.skin.tint ?? '#5ce1ff';
      const scale = getDepthScale(a.y);
      const drawH = 92 * scale;
      a.particles.push({
        x: a.x + (Math.random() * 16 - 8),
        y: a.y - drawH * 0.7,
        vy: -26 * scale,
        alpha: 1,
        life: 0,
        maxLife: 1.2,
        icon,
        color,
      });
    }
  }

  if (a.particles && a.particles.length > 0) {
    for (const p of a.particles) {
      p.life += dt * speedMult;
      p.y += p.vy * dt * speedMult;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }
    a.particles = a.particles.filter((p) => p.life < p.maxLife);
  }

  if (a.flash === undefined || a.flash < 1) {
    a.flash = 1;
  } else if (a.flash > 1) {
    a.flash -= dt * 1.6;
    if (a.flash < 1) a.flash = 1;
  }
}

export interface AgentStatusBubble {
  text: string;
  lines: string[];
  color: string;
  borderColor: string;
}

export function isAgentAtStation(a: StarshipAgent): boolean {
  const ws = WORKSTATIONS[a.name];
  if (!ws) return false;

  if (
    a.stationIndex !== null &&
    (a.stationIndex === ws.stationIndex || a.currentStation === ws.label)
  ) {
    return true;
  }

  const distWalk = Math.hypot(a.x - ws.walkPoint.x, a.y - ws.walkPoint.y);
  const distStanding = Math.hypot(a.x - ws.standingX, a.y - ws.standingY);
  const distSeat = Math.hypot(a.x - ws.seatPoint.x, a.y - ws.seatPoint.y);
  if (distWalk < 35 || distStanding < 35 || distSeat < 35) {
    return true;
  }

  return false;
}

export function getAgentStatusBubble(agent: StarshipAgent): AgentStatusBubble {
  const roleColor = ROLE_GLOW_COLORS[agent.name] ?? agent.skin?.tint ?? '#5ce1ff';
  const isOffline = agent.reportedState === 'offline' || agent.state === STATE.OFFLINE;

  let statusText = 'IDLE';
  let color = '#a5b4fc';
  let borderColor = 'rgba(165, 180, 252, 0.5)';

  if (isOffline) {
    statusText = 'OFFLINE';
    color = '#8e92a4';
    borderColor = 'rgba(142, 146, 164, 0.4)';
  } else if (
    agent.state === STATE.WORKING ||
    agent.reportedState === 'working' ||
    agent.reportedState === 'review'
  ) {
    statusText = agent.reportedState === 'review' ? 'REVIEWING' : 'WORKING';
    color = roleColor;
    borderColor = roleColor;
  } else if (agent.state === STATE.BLOCKED || agent.reportedState === 'blocked') {
    statusText = 'BLOCKED';
    color = STARSHIP_CRIMSON_TINT;
    borderColor = STARSHIP_CRIMSON_TINT;
  } else if (agent.state === STATE.WAITING || agent.reportedState === 'waiting') {
    statusText = 'WAITING';
    color = STARSHIP_AMBER;
    borderColor = STARSHIP_AMBER;
  }

  const lines = [`${agent.name.toUpperCase()}  ·  ${statusText}`];

  return {
    text: lines.join('\n'),
    lines,
    color,
    borderColor,
  };
}

export const applyCloudStatus = applySnapshotToAgents;

export function drawAgentStatusBubble(
  ctx: CanvasRenderingContext2D,
  a: StarshipAgent,
  drawH: number,
  bobY: number,
  canvasW: number = CW,
): void {
  const bubble = getAgentStatusBubble(a);
  const isOffline = a.reportedState === 'offline' || a.state === STATE.OFFLINE;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = isOffline ? 0.6 : 1.0;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // Measure widest line
  ctx.font = "bold 8px 'JetBrains Mono', monospace";
  let maxTw = 0;
  for (const line of bubble.lines) {
    const tw = ctx.measureText ? ctx.measureText(line).width : line.length * 6.2;
    if (tw > maxTw) maxTw = tw;
  }

  const padX = 7;
  const boxW = maxTw + padX * 2;
  const boxH = 15;
  const bubbleY = a.y - drawH - 9 + bobY;

  let boxX = a.x - boxW / 2;
  // Always clamp in canvas boundaries: boxX = clamp(boxX, 8, canvasW - boxW - 8)
  boxX = Math.max(8, Math.min(canvasW - boxW - 8, boxX));
  const boxY = bubbleY - boxH / 2;
  const centerX = boxX + boxW / 2;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
  } else if (typeof ctx.rect === 'function') {
    ctx.rect(boxX, boxY, boxW, boxH);
  }
  ctx.fillStyle = 'rgba(9, 8, 20, 0.82)';
  ctx.fill();
  ctx.lineWidth = 1;

  ctx.strokeStyle = bubble.borderColor;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = "bold 8px 'JetBrains Mono', monospace";
  ctx.fillStyle = bubble.color;
  ctx.fillText(bubble.lines[0], centerX, bubbleY);

  ctx.restore();
}

export function drawWorkParticles(ctx: CanvasRenderingContext2D, a: StarshipAgent): void {
  if (!a.particles || a.particles.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = "bold 11px 'JetBrains Mono', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of a.particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 4;
    ctx.fillText(p.icon, p.x, p.y);
    ctx.restore();
  }
  ctx.restore();
}

export function drawFloorMarkers(ctx: CanvasRenderingContext2D, showStations: boolean): void {
  if (!showStations) return;
  ctx.save();
  for (const st of STATIONS) {
    ctx.beginPath();
    ctx.ellipse(st.x, st.y + 6, 26, 9, 0, 0, Math.PI * 2);
    ctx.strokeStyle = STARSHIP_FLOOR_MARKER_STROKE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = STARSHIP_FLOOR_MARKER_FILL;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(st.label, st.x, st.y - 14);
  }
  ctx.restore();
}

export function drawAgent(
  ctx: CanvasRenderingContext2D,
  a: StarshipAgent,
  sheetImg: HTMLImageElement,
  timeSec: number = Date.now() / 1000,
): void {
  const isOffline = a.reportedState === 'offline' || a.state === STATE.OFFLINE;
  const isWorking =
    !isOffline &&
    (a.state === STATE.WORKING || a.reportedState === 'working' || a.reportedState === 'review');

  ctx.save();
  if (isOffline) {
    ctx.globalAlpha = 0.35;
  }

  const cw = sheetImg.width / SHEET_COLS;
  const ch = sheetImg.height / SHEET_ROWS;
  const row = a.skin.row;
  const col =
    a.state === STATE.MOVING
      ? 4 + (a.animFrame % 4)
      : a.facing === 'back' || (a.state === STATE.WORKING && a.facing !== 'front')
        ? 8 + (a.animFrame % 4)
        : 0 + (a.animFrame % 4);

  const sx = col * cw;
  const sy = row * ch;

  // Depth scale based on foot position a.y
  const scale = getDepthScale(a.y);
  const BASE_DRAW_H = 92;
  const drawH = BASE_DRAW_H * scale;
  const drawW = drawH * (cw / ch);
  const bobY = isWorking ? Math.sin(a.bob) * 2 : 0;
  const leanY = isWorking ? -1 : 0;

  // Foot Anchor: Coordinates (a.x, a.y) = bottom center of character feet.

  // Shadow: Soft ellipse under feet
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, drawW * 0.28, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = STARSHIP_AGENT_SHADOW;
  ctx.fill();
  ctx.restore();

  // Sprite: Drawn with feet anchor at (a.x, a.y)
  ctx.save();
  ctx.translate(a.x, a.y + bobY + leanY);
  if (a.facing === 1) {
    ctx.scale(-1, 1);
  }
  // (1) Pixel art crispness
  ctx.imageSmoothingEnabled = false;

  // (2) Rim glow around agent matching role color
  const roleGlow = ROLE_GLOW_COLORS[a.name] ?? a.skin.tint ?? '#5ce1ff';
  ctx.shadowColor = roleGlow;
  ctx.shadowBlur = 3;
  ctx.drawImage(sheetImg, sx, sy, cw, ch, -drawW / 2, -drawH, drawW, drawH);

  // (3) Second pass with 'lighter' composite mode to boost sprite brightness
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = isOffline ? 0.35 * 0.12 : 0.12;
  ctx.drawImage(sheetImg, sx, sy, cw, ch, -drawW / 2, -drawH, drawW, drawH);

  // (4) 2 typing arms rects (3x2px) in bright role color in front of chest, oscillating in opposite phase with 6Hz
  if (isWorking && a.name !== 'Alec') {
    const armW = 3 * scale;
    const armH = 2 * scale;
    const chestY = -drawH * 0.38;
    const tArm = timeSec * (12 * Math.PI) || a.bob;
    const armOff1 = Math.sin(tArm) * 2 * scale;
    const armOff2 = -Math.sin(tArm) * 2 * scale;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = isOffline ? 0.35 : 1.0;
    ctx.fillStyle = roleGlow;
    ctx.shadowColor = roleGlow;
    ctx.shadowBlur = 4;
    // Left arm & Right arm
    if (typeof ctx.fillRect === 'function') {
      ctx.fillRect(-drawW * 0.14, chestY + armOff1, armW, armH);
      ctx.fillRect(drawW * 0.06, chestY + armOff2, armW, armH);
    } else if (typeof ctx.rect === 'function') {
      ctx.beginPath();
      ctx.rect(-drawW * 0.14, chestY + armOff1, armW, armH);
      ctx.rect(drawW * 0.06, chestY + armOff2, armW, armH);
      if (typeof ctx.fill === 'function') ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();

  // Roster-selection flash ring (scaled at feet)
  if (a.flash && a.flash > 1) {
    const flashProgress = a.flash - 1;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      a.x,
      a.y,
      (30 + (1 - flashProgress) * 14) * scale,
      (10 + (1 - flashProgress) * 5) * scale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle = STARSHIP_AMBER;
    ctx.globalAlpha = (isOffline ? 0.35 : 1.0) * flashProgress;
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();
    ctx.restore();
  }

  // A restrained status ring anchors the character without covering furniture.
  if (a.state === STATE.WORKING && !isOffline) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, 14 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.strokeStyle = a.skin.tint;
    ctx.globalAlpha = 0.28 + Math.sin(a.bob * 1.3) * 0.08;
    ctx.lineWidth = 1 * scale;
    ctx.stroke();
    ctx.restore();
  }

  // Attention glow ring when blocked (scaled at feet)
  if ((a.state === STATE.BLOCKED || a.reportedState === 'blocked') && !isOffline) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, 22 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.strokeStyle = STARSHIP_CRIMSON_TINT;
    ctx.globalAlpha = 0.7 + Math.sin(a.bob * 2) * 0.25;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.restore();
  }

  // Identity and status live in the command strip. Keeping text off the deck
  // lets the character, furniture, and active workstation read as one scene.
  // Work particles are the only lightweight in-world activity cue.
  drawWorkParticles(ctx, a);

  ctx.restore();
}

export function drawDeskCutouts(
  ctx: CanvasRenderingContext2D,
  bgImg: HTMLImageElement,
  agents: StarshipAgent[],
): void {
  for (const agent of agents) {
    const ws = WORKSTATIONS[agent.name];
    if (!ws || !ws.deskCutout) continue;

    const isOffline = agent.reportedState === 'offline' || agent.state === STATE.OFFLINE;
    const isWorking =
      !isOffline &&
      (agent.state === STATE.WORKING ||
        agent.reportedState === 'working' ||
        agent.reportedState === 'review');

    if (isWorking && isAgentAtStation(agent)) {
      const c = ws.deskCutout;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bgImg, c.x, c.y, c.w, c.h, c.x, c.y, c.w, c.h);
      ctx.restore();
    }
  }
}

/**
 * Draw the foreground part of each working pose after the desk cutout has
 * occluded the character's lower body. This is what turns a standing sprite
 * behind furniture into a readable seated/operating pose.
 */
export function drawWorkstationInteraction(
  ctx: CanvasRenderingContext2D,
  agents: StarshipAgent[],
  timeSec: number = Date.now() / 1000,
): void {
  for (const agent of agents) {
    if (!isAgentAtStation(agent)) continue;
    const isOffline = agent.reportedState === 'offline' || agent.state === STATE.OFFLINE;
    const isWorking =
      !isOffline &&
      (agent.state === STATE.WORKING ||
        agent.reportedState === 'working' ||
        agent.reportedState === 'review');
    if (!isWorking) continue;

    const roleColor = ROLE_GLOW_COLORS[agent.name] ?? agent.skin.tint;
    const phase = Math.sin(timeSec * 12);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    if (agent.name === 'Alec') {
      // Forearms and gloves rest on the near edge of the hologram table. The
      // alternating highlights make the gesture read as active manipulation.
      ctx.fillStyle = '#25253d';
      ctx.fillRect(agent.x - 15, agent.y - 39, 5, 15);
      ctx.fillRect(agent.x + 10, agent.y - 39, 5, 15);
      ctx.fillStyle = roleColor;
      ctx.globalAlpha = 0.72 + Math.abs(phase) * 0.2;
      ctx.fillRect(agent.x - 18, agent.y - 43 - Math.max(0, phase * 2), 8, 5);
      ctx.fillRect(agent.x + 10, agent.y - 43 + Math.min(0, phase * 2), 8, 5);

      ctx.globalAlpha = 0.28;
      ctx.fillRect(agent.x - 14, agent.y - 53, 2, 11);
      ctx.fillRect(agent.x + 13, agent.y - 53, 2, 11);
    } else {
      // Two pixel gloves sit visibly on the physical keyboard after the desk
      // foreground has been redrawn. They tap in opposite phase.
      const baseY = agent.name === 'Kevin' ? 463 : 573;
      const leftX = agent.name === 'Kevin' ? 466 : 1064;
      const rightX = agent.name === 'Kevin' ? 489 : 1089;
      const leftTap = phase > 0 ? 1 : 0;
      const rightTap = phase < 0 ? 1 : 0;

      ctx.fillStyle = '#202132';
      ctx.globalAlpha = 0.95;
      ctx.fillRect(leftX + 1, baseY - 7, 4, 8);
      ctx.fillRect(rightX + 1, baseY - 7, 4, 8);
      ctx.fillStyle = '#aab4c8';
      ctx.fillRect(leftX, baseY + leftTap, 7, 4);
      ctx.fillRect(rightX, baseY + rightTap, 7, 4);
      ctx.fillStyle = roleColor;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(leftX + 1, baseY + leftTap, 5, 1);
      ctx.fillRect(rightX + 1, baseY + rightTap, 5, 1);
    }
    ctx.restore();
  }
}

export function drawHologramTopGlow(
  ctx: CanvasRenderingContext2D,
  agents: StarshipAgent[],
  timeSec: number = Date.now() / 1000,
): void {
  const alec = agents.find((a) => a.name === 'Alec');
  if (!alec) return;
  const isOffline = alec.reportedState === 'offline' || alec.state === STATE.OFFLINE;
  const isWorking =
    !isOffline &&
    (alec.state === STATE.WORKING ||
      alec.reportedState === 'working' ||
      alec.reportedState === 'review');

  if (!isWorking || !isAgentAtStation(alec)) return;

  const ws = WORKSTATIONS.Alec;
  const r = ws.screenRect;
  const color = ROLE_GLOW_COLORS.Alec ?? '#c98bff';
  const pulse = 0.25 + 0.12 * Math.sin(timeSec * 3.5 + (alec.bob ?? 0));

  ctx.save();
  // Glowing hologram ellipse on table surface
  ctx.beginPath();
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.ellipse(cx, cy, r.w * 0.42, r.h * 0.38, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = Math.max(0.12, Math.min(0.4, pulse));
  ctx.fill();
  ctx.strokeStyle = '#e9d5ff';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = Math.max(0.25, Math.min(0.65, pulse * 1.5));
  ctx.stroke();

  // Starmap concentric rings
  ctx.beginPath();
  ctx.ellipse(cx, cy, r.w * 0.25, r.h * 0.22, 0, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = Math.max(0.2, Math.min(0.5, pulse));
  ctx.stroke();

  // Floating star points / starmap nodes
  const starOffsets = [
    { dx: -45, dy: -10, speed: 1.2, phase: 0 },
    { dx: 35, dy: -15, speed: 1.6, phase: 1.5 },
    { dx: -15, dy: 10, speed: 1.0, phase: 3.0 },
    { dx: 40, dy: 12, speed: 1.4, phase: 4.2 },
    { dx: 0, dy: -5, speed: 2.0, phase: 2.1 },
  ];
  const projected = starOffsets.map((star) => ({
    x: cx + star.dx,
    y: cy + star.dy + Math.sin(timeSec * star.speed + star.phase) * 6,
  }));

  ctx.beginPath();
  projected.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = '#d8b4fe';
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.35 + 0.12 * Math.sin(timeSec * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  for (let index = 0; index < starOffsets.length; index++) {
    const s = starOffsets[index];
    const point = projected[index];
    if (!s || !point) continue;
    const starAlpha = 0.4 + 0.5 * Math.sin(timeSec * 2 + s.phase);
    ctx.globalAlpha = Math.max(0.2, Math.min(0.9, starAlpha));
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawWorkstationScreens(
  ctx: CanvasRenderingContext2D,
  agents: StarshipAgent[],
  timeSec: number = Date.now() / 1000,
): void {
  ctx.save();
  for (const agent of agents) {
    const ws = WORKSTATIONS[agent.name];
    if (!ws) continue;

    const isOffline = agent.reportedState === 'offline' || agent.state === STATE.OFFLINE;
    const isWorking =
      !isOffline &&
      (agent.state === STATE.WORKING ||
        agent.reportedState === 'working' ||
        agent.reportedState === 'review');

    // Screen is OFF when idle / offline / blocked / not working
    if (!isWorking) continue;

    // Alec workstation is a hologram table rendered with drawHologramTopGlow
    if (agent.name === 'Alec') continue;

    const roleColor = ROLE_GLOW_COLORS[agent.name] ?? agent.skin?.tint ?? '#5ce1ff';
    // Match the actual illuminated displays painted into the background. The
    // previous implementation filled one large rectangle across the desk and
    // character, which made the crew look pasted on top of a debug overlay.
    const displays: WorkstationScreenRect[] =
      agent.name === 'Kevin'
        ? [
            { x: 398, y: 397, w: 45, h: 30 },
            { x: 459, y: 390, w: 51, h: 34 },
            { x: 526, y: 401, w: 46, h: 29 },
          ]
        : [
            { x: 1018, y: 550, w: 49, h: 29 },
            { x: 1091, y: 550, w: 49, h: 29 },
          ];

    for (const rect of displays) {
      const pulse = 0.12 + 0.04 * Math.sin(timeSec * 4 + rect.x * 0.01);
      ctx.save();
      ctx.fillStyle = roleColor;
      ctx.globalAlpha = pulse;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = roleColor;
      ctx.lineWidth = 0.75;
      ctx.globalAlpha = 0.45;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      const padX = 5;
      const lineFractions = [0.78, 0.52, 0.88, 0.64];
      ctx.fillStyle = '#d9fbff';
      for (let i = 0; i < lineFractions.length; i++) {
        ctx.globalAlpha = 0.42 + 0.18 * Math.sin(timeSec * 3 + i * 1.3);
        ctx.fillRect(rect.x + padX, rect.y + 6 + i * 5, (rect.w - padX * 2) * lineFractions[i], 1);
      }
      ctx.restore();
    }

    // Small role-specific interaction cues make it clear which hardware the
    // seated agent is operating without painting a translucent debug panel
    // over the desk.
    ctx.save();
    ctx.fillStyle = roleColor;
    if (agent.name === 'Kevin') {
      // Cursor response in the center build monitor; hands are rendered in the
      // foreground after the desk occlusion pass.
      ctx.globalAlpha = 0.9;
      ctx.fillRect(495, 414, 3, 5);
    } else {
      const scanY = 554 + ((timeSec * 18) % 19);
      ctx.globalAlpha = 0.78;
      ctx.fillRect(1027, scanY, 39, 1);
      ctx.fillRect(1094, scanY, 43, 1);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(1129, 556, 5, 5);
    }
    ctx.restore();
  }
  ctx.restore();
}

export function drawWorkstationLabels(
  ctx: CanvasRenderingContext2D,
  agents?: StarshipAgent[],
): void {
  ctx.save();
  for (const ws of Object.values(WORKSTATIONS)) {
    if (agents && agents.length > 0) {
      const agent = agents.find((a) => a.name === ws.agentName);
      if (agent && isAgentAtStation(agent)) {
        // Agent is currently at their workstation; label is shown in the agent's 2-line bubble
        continue;
      }
    }

    const lx = ws.screenRect ? ws.screenRect.x + ws.screenRect.w / 2 : ws.tableX;
    const ly = ws.screenRect ? ws.screenRect.y - 12 : ws.tableY - 75;

    const text = ws.label;
    ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
    const tw = ctx.measureText ? ctx.measureText(text).width : text.length * 6;
    const padX = 8;
    const boxW = tw + padX * 2;
    const boxH = 18;
    let boxX = lx - boxW / 2;
    boxX = Math.max(8, Math.min(CW - boxW - 8, boxX));
    const boxY = ly - boxH / 2;
    const centerX = boxX + boxW / 2;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fillStyle = 'rgba(15, 12, 28, 0.85)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(110, 231, 255, 0.4)';
    ctx.stroke();

    ctx.fillStyle = '#d9d3f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, centerX, ly);
  }
  ctx.restore();
}

function drawHotspotCorners(
  ctx: CanvasRenderingContext2D,
  object: InteractiveDeckObject,
  selected: boolean,
  timeSec: number,
): void {
  const { rect, color } = object;
  const corner = selected ? 15 : 10;
  const pulse = selected ? 0.75 + Math.sin(timeSec * 5) * 0.2 : 0.55;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 1.5 : 1;
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.moveTo(rect.x, rect.y + corner);
  ctx.lineTo(rect.x, rect.y);
  ctx.lineTo(rect.x + corner, rect.y);
  ctx.moveTo(rect.x + rect.w - corner, rect.y);
  ctx.lineTo(rect.x + rect.w, rect.y);
  ctx.lineTo(rect.x + rect.w, rect.y + corner);
  ctx.moveTo(rect.x + rect.w, rect.y + rect.h - corner);
  ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
  ctx.lineTo(rect.x + rect.w - corner, rect.y + rect.h);
  ctx.moveTo(rect.x + corner, rect.y + rect.h);
  ctx.lineTo(rect.x, rect.y + rect.h);
  ctx.lineTo(rect.x, rect.y + rect.h - corner);
  ctx.stroke();

  const label = selected ? `${object.system} · ENGAGED` : `INTERACT · ${object.label}`;
  ctx.font = "bold 7px 'JetBrains Mono', monospace";
  const textWidth = ctx.measureText(label).width;
  const labelX = rect.x + rect.w / 2 - textWidth / 2 - 6;
  const labelY = rect.y - 17;
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = 'rgba(7, 8, 18, 0.9)';
  ctx.fillRect(labelX, labelY, textWidth + 12, 13);
  ctx.strokeRect(labelX, labelY, textWidth + 12, 13);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, labelY + 7);
  ctx.restore();
}

/** Draws the always-on game layer that makes flattened background props live. */
export function drawLivingDeckObjects(
  ctx: CanvasRenderingContext2D,
  agents: StarshipAgent[],
  timeSec: number,
  hoveredId: DeckObjectId | null = null,
  selectedId: DeckObjectId | null = null,
  engagedObjects: ReadonlySet<DeckObjectId> = new Set<DeckObjectId>(),
): void {
  const intensity = (id: DeckObjectId) => {
    if (engagedObjects.has(id)) return 1;
    const object = INTERACTIVE_DECK_OBJECTS.find((candidate) => candidate.id === id);
    const operator = object?.owner
      ? agents.find((agent) => agent.name === object.owner)
      : undefined;
    const operatorWorking =
      operator &&
      (operator.state === STATE.WORKING ||
        operator.reportedState === 'working' ||
        operator.reportedState === 'review');
    return operatorWorking ? 0.82 : 0.45;
  };
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  // Build console: all three displays remain alive; active work adds scrolling
  // terminal rows and a cursor that crosses between monitors.
  const buildBoost = intensity('build-console');
  ctx.fillStyle = '#5ce1ff';
  for (let monitor = 0; monitor < 3; monitor++) {
    const x = 402 + monitor * 64;
    const width = monitor === 1 ? 47 : 41;
    for (let line = 0; line < 4; line++) {
      const y = 402 + ((line * 6 + timeSec * (8 + monitor)) % 25);
      ctx.globalAlpha = 0.12 + buildBoost * 0.18;
      ctx.fillRect(x + 4, y, width * (0.45 + ((line + monitor) % 3) * 0.17), 1);
    }
  }
  ctx.globalAlpha = 0.45 + buildBoost * 0.35;
  ctx.fillRect(399 + ((timeSec * 26) % 168), 435, 3, 2);

  // QA console: twin scanners sweep in opposite directions even when nobody
  // is seated. Engaged mode adds a confirmation pulse.
  const qaBoost = intensity('qa-console');
  const qaScan = (timeSec * 20) % 28;
  ctx.fillStyle = '#ff5c5c';
  ctx.globalAlpha = 0.2 + qaBoost * 0.35;
  ctx.fillRect(1027, 550 + qaScan, 39, 1);
  ctx.fillRect(1094, 578 - qaScan, 43, 1);
  if (engagedObjects.has('qa-console')) {
    ctx.globalAlpha = 0.6 + Math.sin(timeSec * 8) * 0.25;
    ctx.fillRect(1128, 554, 7, 7);
  }

  // Specimen cylinders: deterministic bubbles climb through the glass, with a
  // brighter analysis beam when the bank is engaged.
  const specimenBoost = intensity('specimen-bank');
  const specimenTanks = [337, 413, 735];
  ctx.fillStyle = '#a7ffe0';
  specimenTanks.forEach((tankX, tankIndex) => {
    for (let bubble = 0; bubble < 4; bubble++) {
      const travel = (timeSec * (12 + tankIndex * 2) + bubble * 23) % 76;
      const x = tankX + Math.sin(timeSec * 1.8 + bubble * 2.1) * 9;
      const y = 616 - travel;
      ctx.globalAlpha = 0.18 + specimenBoost * 0.28;
      ctx.beginPath();
      ctx.arc(x, y, bubble % 2 === 0 ? 1.5 : 1, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  if (engagedObjects.has('specimen-bank')) {
    ctx.fillStyle = '#76f7b2';
    ctx.globalAlpha = 0.22 + Math.sin(timeSec * 6) * 0.08;
    ctx.fillRect(315 + ((timeSec * 35) % 150), 535, 2, 91);
  }

  // Central containment vault: life-sign rings and rising stasis particles.
  const vaultBoost = intensity('xeno-vault');
  ctx.strokeStyle = '#70ffd2';
  ctx.lineWidth = 1;
  for (let ring = 0; ring < 3; ring++) {
    ctx.beginPath();
    ctx.globalAlpha = 0.08 + vaultBoost * 0.16;
    ctx.ellipse(872, 428 - ring * 43, 43 - ring * 4, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#d3fff3';
  for (let particle = 0; particle < 7; particle++) {
    const y = 438 - ((timeSec * (10 + particle) + particle * 31) % 160);
    const x = 872 + Math.sin(timeSec + particle * 1.7) * 31;
    ctx.globalAlpha = 0.12 + vaultBoost * 0.22;
    ctx.fillRect(x, y, 1.5, 3);
  }

  // Armory cells charge sequentially along the painted weapon rack.
  const armoryBoost = intensity('armory');
  const weaponCells = [225, 267, 310];
  weaponCells.forEach((y, index) => {
    const charge = (Math.sin(timeSec * 4 + index * 1.8) + 1) / 2;
    ctx.fillStyle = index === 2 ? '#ff9d4d' : '#5ce1ff';
    ctx.globalAlpha = 0.16 + charge * (0.18 + armoryBoost * 0.25);
    ctx.fillRect(478, y, 52 * charge, 4);
  });

  // A tiny shuttle crossing the left viewport adds parallax against the static
  // galaxy and keeps the room from feeling like a background image.
  const shuttleX = 520 + ((timeSec * 18) % 300);
  const shuttleY = 286 + Math.sin(timeSec * 0.8) * 12;
  ctx.fillStyle = '#c8eaff';
  ctx.globalAlpha = 0.38;
  ctx.fillRect(shuttleX, shuttleY, 7, 2);
  ctx.fillStyle = '#7b6cff';
  ctx.globalAlpha = 0.28;
  ctx.fillRect(shuttleX - 6, shuttleY, 5, 1);

  // Hover and selection affordances are rendered only on demand so the room
  // stays cinematic until the player points at a system.
  for (const object of INTERACTIVE_DECK_OBJECTS) {
    if (object.id === hoveredId || object.id === selectedId) {
      drawHotspotCorners(ctx, object, object.id === selectedId, timeSec);
    }
  }

  ctx.restore();
}

export function drawStage(
  ctx: CanvasRenderingContext2D,
  bgImg: HTMLImageElement,
  sheetImg: HTMLImageElement,
  agents: StarshipAgent[],
  showStations: boolean,
  rect: { width: number; height: number },
  dpr: number,
  timeSec: number = Date.now() / 1000,
  panX: number = 0,
  panY: number = 0,
  zoom: number = 1,
  hoveredObjectId: DeckObjectId | null = null,
  selectedObjectId: DeckObjectId | null = null,
  engagedObjects: ReadonlySet<DeckObjectId> = new Set<DeckObjectId>(),
): { scale: number; offX: number; offY: number } {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const baseScale = Math.max(rect.width / CW, rect.height / CH);
  const scale = baseScale * zoom;
  const drawW = CW * scale;
  const drawH = CH * scale;
  const offX = (rect.width - drawW) / 2 + panX;
  const offY = (rect.height - drawH) / 2 + panY;

  ctx.drawImage(bgImg, offX, offY, drawW, drawH);

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  drawLivingDeckObjects(ctx, agents, timeSec, hoveredObjectId, selectedObjectId, engagedObjects);
  drawWorkstationScreens(ctx, agents, timeSec);
  drawFloorMarkers(ctx, showStations);

  const sorted = [...agents].sort((a, b) => a.y - b.y);
  for (const a of sorted) {
    drawAgent(ctx, a, sheetImg, timeSec);
  }

  // Draw desk occlusion cutouts over sitting/standing agents' lower bodies
  drawDeskCutouts(ctx, bgImg, agents);

  // Restore hands and controls on top of the desk so the active pose reads as
  // operating the workstation instead of merely standing behind it.
  drawWorkstationInteraction(ctx, agents, timeSec);

  // Redraw hologram effect on top of desk cutout for Alec
  drawHologramTopGlow(ctx, agents, timeSec);

  // Workstation identity is already present in the command strip. Avoid
  // duplicating labels on top of the artwork.

  ctx.restore();

  return { scale, offX, offY };
}

export function drawStarsLayer(
  starsCtx: CanvasRenderingContext2D,
  stars: Star[],
  starTime: number,
  rect: { width: number; height: number },
  dpr: number,
): void {
  starsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  starsCtx.clearRect(0, 0, rect.width, rect.height);
  for (const s of stars) {
    const tw = 0.5 + 0.5 * Math.sin(starTime * s.speed + s.phase);
    starsCtx.beginPath();
    starsCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    starsCtx.fillStyle = STARSHIP_NAME_TAG_FILL;
    starsCtx.globalAlpha = 0.15 + tw * 0.55;
    starsCtx.fill();
  }
}

export function seedStars(rect: { width: number; height: number }): Star[] {
  const n = Math.floor((rect.width * rect.height) / 9000);
  const stars: Star[] = [];
  for (let i = 0; i < n; i++) {
    stars.push({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height * 0.55,
      r: Math.random() * 1.2 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.2,
    });
  }
  return stars;
}
