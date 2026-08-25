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
    walkPoint: { x: 560, y: 645 },
    seatPoint: { x: 560, y: 645 },
    tableX: 560,
    tableY: 645,
    standingX: 560,
    standingY: 645,
    facing: 'front',
    screenRect: { x: 312, y: 537, w: 225, h: 94 },
    deskCutout: { x: 312, y: 537, w: 225, h: 94 },
    stationIndex: 1,
  },
  Kevin: {
    agentName: 'Kevin',
    label: 'Kevin — Build',
    roleDescription: 'Build',
    walkPoint: { x: 480, y: 495 },
    seatPoint: { x: 480, y: 495 },
    tableX: 480,
    tableY: 495,
    standingX: 480,
    standingY: 495,
    facing: 'back',
    screenRect: { x: 412, y: 412, w: 140, h: 82 },
    deskCutout: { x: 250, y: 450, w: 450, h: 80 },
    stationIndex: 4,
  },
  Benjamin: {
    agentName: 'Benjamin',
    label: 'Benjamin — QA',
    roleDescription: 'QA',
    walkPoint: { x: 1000, y: 640 },
    seatPoint: { x: 1000, y: 640 },
    tableX: 1000,
    tableY: 640,
    standingX: 1000,
    standingY: 640,
    facing: 'back',
    screenRect: { x: 987, y: 556, w: 213, h: 63 },
    deskCutout: { x: 987, y: 556, w: 213, h: 80 },
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

export const STATE = {
  MOVING: 'moving',
  WORKING: 'working',
  IDLE: 'idle',
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

export function isPointInPolygon(
  p: Point2D,
  polygon: Point2D[] = WALKABLE_POLYGON,
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function clampPointToPolygon(
  p: Point2D,
  polygon: Point2D[] = WALKABLE_POLYGON,
): Point2D {
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
  Alec: '⌨',
  Kevin: '</>',
  Benjamin: '✓',
};

export function makeAgent(spec: {
  id: string;
  name: DuctorRoleName;
  role: string;
  skin: (typeof SKINS)[number];
  reportedState?: string;
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
    provenance: spec.provenance,
    skin: spec.skin,
    x: spec.x,
    y: spec.y,
    targetX: spec.x,
    targetY: spec.y,
    speed: 46 + Math.random() * 22,
    facing: spec.facing ?? 1,
    state: spec.state ?? STATE.WORKING,
    stateTimer: 2 + Math.random() * 4,
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

    let x = 0;
    let y = 0;
    let stationIndex: number | null = null;
    let currentStation = '';
    let initialState: StarshipAgentState = STATE.WORKING;

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
        x = ws.standingX;
        y = ws.standingY;
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
      a.provenance = undefined;
      if (wasControlled && (a.state === STATE.OFFLINE || a.state === STATE.BLOCKED)) {
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
          Math.hypot(a.x - ws.standingX, a.y - ws.standingY) < 3
            ? STATE.WORKING
            : STATE.MOVING;
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
      } else if (a.reportedState === 'idle' || a.reportedState === 'waiting') {
        a.state = STATE.IDLE;
        a.stateTimer = 2 + Math.random() * 3;
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
    }
    a.stateTimer -= dt * speedMult;
    a.bob += dt * 16 * Math.PI; // 8Hz typing bob oscillation
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
        a.stateTimer = 1.2 + Math.random() * 1.8;
        a.animFrame = 0;
      }
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
  if (distWalk < 35 || distStanding < 35) {
    return true;
  }

  return false;
}

export function getAgentStatusBubble(agent: StarshipAgent): AgentStatusBubble {
  const roleColor = ROLE_GLOW_COLORS[agent.name] ?? agent.skin?.tint ?? '#5ce1ff';
  const isOffline = agent.reportedState === 'offline' || agent.state === STATE.OFFLINE;

  let statusText = '💤 idle';
  let color = '#a5b4fc';
  let borderColor = 'rgba(165, 180, 252, 0.5)';

  if (isOffline) {
    statusText = '⚫ offline';
    color = '#8e92a4';
    borderColor = 'rgba(142, 146, 164, 0.4)';
  } else if (
    agent.state === STATE.WORKING ||
    agent.reportedState === 'working' ||
    agent.reportedState === 'review'
  ) {
    statusText = `⚙ ${agent.name} đang làm việc`;
    color = roleColor;
    borderColor = roleColor;
  } else if (agent.state === STATE.BLOCKED || agent.reportedState === 'blocked') {
    statusText = '⚠️ blocked';
    color = STARSHIP_CRIMSON_TINT;
    borderColor = STARSHIP_CRIMSON_TINT;
  }

  const atStation = isAgentAtStation(agent);
  const ws = WORKSTATIONS[agent.name];
  const lines = atStation && ws ? [ws.label, statusText] : [statusText];

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
  const isTwoLines = bubble.lines.length >= 2;
  const isOffline = a.reportedState === 'offline' || a.state === STATE.OFFLINE;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = isOffline ? 0.6 : 1.0;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // Measure widest line
  ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
  let maxTw = 0;
  for (const line of bubble.lines) {
    const tw = ctx.measureText ? ctx.measureText(line).width : line.length * 6.2;
    if (tw > maxTw) maxTw = tw;
  }

  const padX = 8;
  const boxW = maxTw + padX * 2;
  const boxH = isTwoLines ? 28 : 16;
  const bubbleY = a.y - drawH - (isTwoLines ? 16 : 12) + bobY;

  let boxX = a.x - boxW / 2;
  // Always clamp in canvas boundaries: boxX = clamp(boxX, 8, canvasW - boxW - 8)
  boxX = Math.max(8, Math.min(canvasW - boxW - 8, boxX));
  const boxY = bubbleY - boxH / 2;
  const centerX = boxX + boxW / 2;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(boxX, boxY, boxW, boxH, isTwoLines ? 6 : 8);
  } else if (typeof ctx.rect === 'function') {
    ctx.rect(boxX, boxY, boxW, boxH);
  }
  ctx.fillStyle = 'rgba(15, 12, 28, 0.88)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = bubble.borderColor;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isTwoLines) {
    // Line 1: Station / Role Label
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = '#d9d3f0';
    ctx.fillText(bubble.lines[0], centerX, boxY + 8);

    // Line 2: Status
    ctx.font = "9.5px 'JetBrains Mono', monospace";
    ctx.fillStyle = bubble.color;
    ctx.fillText(bubble.lines[1], centerX, boxY + 20);
  } else {
    // Single line
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = bubble.color;
    ctx.fillText(bubble.lines[0], centerX, bubbleY);
  }

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
): void {
  const isOffline = a.reportedState === 'offline' || a.state === STATE.OFFLINE;

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
      : a.facing === 'back'
        ? 8 + (a.animFrame % 4)
        : 0 + (a.animFrame % 4);

  const sx = col * cw;
  const sy = row * ch;

  // Depth scale based on foot position a.y
  const scale = getDepthScale(a.y);
  const BASE_DRAW_H = 92;
  const drawH = BASE_DRAW_H * scale;
  const drawW = drawH * (cw / ch);
  const bobY = a.state === STATE.WORKING ? Math.sin(a.bob) * 1 : 0;

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
  ctx.translate(a.x, a.y + bobY);
  if (a.facing === 1) {
    ctx.scale(-1, 1);
  }
  // (1) Pixel art crispness
  ctx.imageSmoothingEnabled = false;

  // (2) Rim glow around agent matching role color
  const roleGlow = ROLE_GLOW_COLORS[a.name] ?? a.skin.tint ?? '#5ce1ff';
  ctx.shadowColor = roleGlow;
  ctx.shadowBlur = 8;
  ctx.drawImage(sheetImg, sx, sy, cw, ch, -drawW / 2, -drawH, drawW, drawH);

  // (3) Second pass with 'lighter' composite mode to boost sprite brightness
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = isOffline ? 0.35 * 0.22 : 0.22;
  ctx.drawImage(sheetImg, sx, sy, cw, ch, -drawW / 2, -drawH, drawW, drawH);
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

  // Status glow ring while working (scaled at feet)
  if (a.state === STATE.WORKING && !isOffline) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, 20 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.strokeStyle = a.skin.tint;
    ctx.globalAlpha = 0.55 + Math.sin(a.bob * 1.3) * 0.2;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.restore();
  }

  // Attention glow ring when blocked (scaled at feet)
  if (
    (a.state === STATE.BLOCKED || a.reportedState === 'blocked') &&
    !isOffline
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, 22 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.strokeStyle = STARSHIP_CRIMSON_TINT;
    ctx.globalAlpha = 0.7 + Math.sin(a.bob * 2) * 0.25;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.restore();
  }

  // Status bubble above head (always visible)
  drawAgentStatusBubble(ctx, a, drawH, bobY);

  // Work particles floating above agent
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
  ctx.globalAlpha = Math.max(0.12, Math.min(0.40, pulse));
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
  ctx.fillStyle = '#ffffff';
  for (const s of starOffsets) {
    const floatY = Math.sin(timeSec * s.speed + s.phase) * 6;
    const starAlpha = 0.4 + 0.5 * Math.sin(timeSec * 2 + s.phase);
    ctx.globalAlpha = Math.max(0.2, Math.min(0.9, starAlpha));
    ctx.beginPath();
    ctx.arc(cx + s.dx, cy + s.dy + floatY, 2, 0, Math.PI * 2);
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

    const rect = ws.screenRect;
    const roleColor = ROLE_GLOW_COLORS[agent.name] ?? agent.skin?.tint ?? '#5ce1ff';

    // Pulse alpha between 0.15 and 0.35
    const pulseAlpha = 0.25 + 0.10 * Math.sin(timeSec * 3 + (agent.bob ?? 0));
    const clampedAlpha = Math.max(0.15, Math.min(0.35, pulseAlpha));

    ctx.save();
    // Screen glow fill
    ctx.fillStyle = roleColor;
    ctx.globalAlpha = clampedAlpha;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // Screen glow border
    ctx.strokeStyle = roleColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = Math.max(0.2, Math.min(0.5, clampedAlpha * 1.3));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    // 3-4 simulated text / code lines inside screen
    const lineCount = 4;
    const padX = rect.w * 0.08;
    const padY = rect.h * 0.18;
    const availH = rect.h - padY * 2;
    const lineStep = availH / (lineCount - 1);
    const lineFractions = [0.72, 0.48, 0.84, 0.58];

    ctx.fillStyle = roleColor;
    for (let i = 0; i < lineCount; i++) {
      const ly = rect.y + padY + i * lineStep;
      const lw = (rect.w - padX * 2) * lineFractions[i];
      const textAlpha = (0.35 + 0.12 * Math.sin(timeSec * 6 + i * 1.5)) * (clampedAlpha / 0.25);
      ctx.globalAlpha = Math.max(0.2, Math.min(0.65, textAlpha));
      ctx.fillRect(rect.x + padX, ly, lw, 3);
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

export function drawStage(
  ctx: CanvasRenderingContext2D,
  bgImg: HTMLImageElement,
  sheetImg: HTMLImageElement,
  agents: StarshipAgent[],
  showStations: boolean,
  rect: { width: number; height: number },
  dpr: number,
  timeSec: number = Date.now() / 1000,
): { scale: number; offX: number; offY: number } {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const scale = Math.max(rect.width / CW, rect.height / CH);
  const drawW = CW * scale;
  const drawH = CH * scale;
  const offX = (rect.width - drawW) / 2;
  const offY = (rect.height - drawH) / 2;

  ctx.drawImage(bgImg, offX, offY, drawW, drawH);

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  drawWorkstationScreens(ctx, agents, timeSec);
  drawFloorMarkers(ctx, showStations);

  const sorted = [...agents].sort((a, b) => a.y - b.y);
  for (const a of sorted) {
    drawAgent(ctx, a, sheetImg);
  }

  // Draw desk occlusion cutouts over sitting/standing agents' lower bodies
  drawDeskCutouts(ctx, bgImg, agents);

  // Redraw hologram effect on top of desk cutout for Alec
  drawHologramTopGlow(ctx, agents, timeSec);

  drawWorkstationLabels(ctx, agents);

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
