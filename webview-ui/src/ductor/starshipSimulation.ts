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
import {
  ORIGINAL_COMPUTER_BAYS,
  STAR_MAP_WORKSTATION,
  STAR_MAP_PANEL,
  drawPhotonicComputerBay,
  drawPhotonicActivity,
  drawAlecSeatBack,
  drawCommandContact,
  getCommandGesture,
  ALEC_SEAT,
  ALEC_SEATED_ATLAS,
  KEVIN_STARMAP_ATLAS,
  BENJAMIN_QA_ATLAS,
} from './starshipComputerBay.js';
import { drawPhotonicRoom, PHOTONIC_THEME } from './starshipPhotonicTheme.js';
import { drawLivingRoom, getLivingRoomArtwork } from './starshipLivingRoom.js';
import { drawQAContact } from './starshipQA.js';
import { drawStarshipExterior } from './starshipExterior.js';
import { drawBridgeMaterialPass, drawBridgeLightPass } from './starshipSceneV2.js';

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

export interface DeviceBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorkstationConfig {
  agentName: DuctorRoleName;
  label: string;
  roleDescription: string;
  approachPoint: { x: number; y: number };
  interactionPoint: { x: number; y: number };
  facing: 'back' | 'front';
  displayBounds: DeviceBounds;
  displayAreas: readonly DeviceBounds[];
  occlusionBounds: DeviceBounds;
  stationIndex: number;
}

export type AssignedWorkstation = WorkstationConfig;

export const WORKSTATIONS: Record<DuctorRoleName, WorkstationConfig> = {
  Alec: {
    agentName: 'Alec',
    ...ORIGINAL_COMPUTER_BAYS.Alec,
  },
  Kevin: {
    agentName: 'Kevin',
    ...ORIGINAL_COMPUTER_BAYS.Kevin,
    ...STAR_MAP_WORKSTATION,
  },
  Benjamin: {
    agentName: 'Benjamin',
    label: 'Benjamin — QA',
    roleDescription: 'QA',
    approachPoint: { x: 1060, y: 650 },
    interactionPoint: { x: 1060, y: 630 },
    facing: 'back',
    displayBounds: { x: 1010, y: 520, w: 110, h: 55 },
    displayAreas: [{ x: 1010, y: 520, w: 110, h: 55 }],
    occlusionBounds: { x: 1010, y: 570, w: 120, h: 55 },
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
  Alec: { x: 350, y: 640 },
  Kevin: { x: 850, y: 640 },
  Benjamin: { x: 1250, y: 640 },
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

export function clampPanToViewport(
  pan: Point2D,
  rect: { width: number; height: number },
  scale: number,
): Point2D {
  const maxX = Math.max(0, (CW * scale - rect.width) / 2);
  const maxY = Math.max(0, (CH * scale - rect.height) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, pan.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.y)),
  };
}

export const FLOOR_Y_MIN = 490;
export const FLOOR_Y_MAX = 660;
export const DEPTH_SCALE_MIN = 0.8;
export const DEPTH_SCALE_MAX = 1.1;

export const WALKABLE_POLYGON: Point2D[] = [
  { x: 50, y: 510 },
  { x: 260, y: 510 },
  { x: 340, y: 490 },
  // Shallow access aisle in front of the three build monitors.
  { x: 420, y: 450 },
  { x: 750, y: 450 },
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

/**
 * Pick the stage scale for the available viewport.
 *
 * The room is deliberately wider than it is tall. A cover fit is useful in a
 * normal app window, but in the short, ultra-wide webview used by the preview
 * it scales from the width and crops the lower deck. That made crew sprites
 * look as if their bodies had disappeared. Keep cover behaviour for normal
 * proportions and contain the room when height is the limiting dimension.
 */
export function getStageBaseScale(rect: { width: number; height: number }): number {
  if (rect.width <= 0 || rect.height <= 0) return 1;
  const cover = Math.max(rect.width / CW, rect.height / CH);
  const contain = Math.min(rect.width / CW, rect.height / CH);
  return rect.width / rect.height > CW / CH ? contain : cover;
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
  idleAnimStep: number;
  moveVelocity: number;
  bob: number;
  stationIndex: number | null;
  currentStation: string;
  flash?: number;
  hologramTime?: number;
  commandTime?: number;
  qaTime?: number;
  hologramSceneTime?: number;
  hologramExpansion?: number;
  hologramCamera?: { x: number; y: number; zoom: number };
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

// Open foreground patrol lanes keep idle crew clear of consoles and specimen pods.
export const IDLE_PATROL_POINTS: Record<DuctorRoleName, readonly Point2D[]> = {
  Alec: [
    { x: 170, y: 642 },
    { x: 170, y: 570 },
    { x: 330, y: 646 },
    { x: 470, y: 646 },
    { x: 700, y: 646 },
    { x: 900, y: 610 },
    { x: 1240, y: 646 },
    { x: 1460, y: 570 },
  ],
  Kevin: [
    { x: 220, y: 646 },
    { x: 300, y: 570 },
    { x: 470, y: 646 },
    { x: 700, y: 470 },
    { x: 900, y: 646 },
    { x: 1240, y: 600 },
    { x: 1480, y: 640 },
  ],
  Benjamin: [
    { x: 190, y: 646 },
    { x: 190, y: 570 },
    { x: 470, y: 646 },
    { x: 700, y: 620 },
    { x: 930, y: 646 },
    { x: 1240, y: 646 },
    { x: 1480, y: 570 },
  ],
};

// Intact authored poses are sequenced into a brief look-around while stopped.
export const IDLE_GESTURE_FRAMES = [0, 0, 1, 1, 0, 2, 3, 2] as const;

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
      agent.targetX = ws.approachPoint.x;
      agent.targetY = ws.approachPoint.y;
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

  // Idle wander mode uses an open foreground patrol lane rather than crossing furniture.
  const { stationIndex, slot } = pickStation(agents, agent.id);
  const roleOffset = ROLE_IDLE_SLOT_OFFSETS[agent.name] ?? { dx: 0, dy: 0 };
  const patrol = IDLE_PATROL_POINTS[agent.name] ?? IDLE_PATROL_POINTS.Alec;
  const candidates = patrol.filter((p) => Math.hypot(p.x - agent.x, p.y - agent.y) > 70);
  const point =
    candidates[Math.floor(Math.random() * Math.max(1, candidates.length))] ?? patrol[0]!;
  const st = STATIONS[stationIndex] ?? STATIONS[0];
  agent.stationIndex = stationIndex;
  agent.targetX = point.x + roleOffset.dx * 0.35 + slot.dx * 0.15;
  agent.targetY = point.y + roleOffset.dy * 0.2 + slot.dy * 0.15;
  agent.currentStation = st.label;
  agent.state = STATE.MOVING;
  agent.moveVelocity = 0;
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
    idleAnimStep: 0,
    moveVelocity: 0,
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
        x = ws.interactionPoint.x;
        y = ws.interactionPoint.y;
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
        reportedState:
          effective === 'offline' ? (roleSnapshot ? 'offline' : undefined) : roleSnapshot?.state,
        reportedTaskLabel: effective === 'offline' ? null : roleSnapshot?.taskLabel,
        provenance:
          effective === 'offline' && snapshot?.stale
            ? 'stale-cloud-heartbeat'
            : roleSnapshot?.provenance,
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

    a.reportedState = isOffline ? 'offline' : role.state;
    a.reportedTaskLabel = isOffline ? null : role.taskLabel;
    a.provenance = isOffline && snapshot.stale ? 'stale-cloud-heartbeat' : role.provenance;

    if (effective === prevEffective && a.state !== STATE.MOVING) {
      continue;
    }

    if (effective === 'working' || effective === 'review') {
      const ws = ASSIGNED_WORKSTATIONS[a.name];
      if (ws) {
        a.stationIndex = ws.stationIndex;
        a.currentStation = ws.label;
        a.targetX = ws.approachPoint.x;
        a.targetY = ws.approachPoint.y;
        a.facing = ws.facing;
        a.state =
          Math.hypot(a.x - ws.approachPoint.x, a.y - ws.approachPoint.y) < 3
            ? STATE.WORKING
            : STATE.MOVING;
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
      a.moveVelocity = 0;
      a.idleAnimStep = 0;
      if (pushLog) pushLog(`${a.name} arrived at ${a.currentStation}.`);
    } else {
      // Ease into and out of each walk so direction changes read as footsteps,
      // rather than a sprite teleporting at a constant velocity.
      const cruise = a.speed * speedMult;
      const braking = Math.min(1, dist / 34);
      a.moveVelocity += (cruise * braking - a.moveVelocity) * Math.min(1, dt * 8);
      const step = Math.max(8, a.moveVelocity) * dt;
      const nx = a.x + (dx / dist) * Math.min(step, dist);
      const ny = a.y + (dy / dist) * Math.min(step, dist);
      const clamped = clampPointToPolygon({ x: nx, y: ny }, WALKABLE_POLYGON);
      // Use authored front/back cycles for mainly vertical routes; side poses
      // are reserved for true left/right travel.
      if (Math.abs(dy) > Math.abs(dx) * 1.15) {
        a.facing = dy >= 0 ? 'front' : 'back';
      } else {
        a.facing = dx >= 0 ? 1 : -1;
      }
      a.x = clamped.x;
      a.y = clamped.y;
      a.animTimer += dt;
      // Four authored walk frames advance at a steady 8.3 fps; movement speed
      // is expressed by the eased distance between steps, not frame skipping.
      const stridePeriod = 0.12;
      if (a.animTimer > stridePeriod) {
        a.animTimer -= stridePeriod;
        a.animFrame = (a.animFrame + 1) % 4; // 4-frame walk cycle
      }
    }
  } else if (a.state === STATE.WORKING) {
    const ws = ASSIGNED_WORKSTATIONS[a.name];
    if (ws) {
      a.facing = ws.facing;
      // Move to interaction point if at approach point but not yet at interaction
      const atApproach = Math.hypot(a.x - ws.approachPoint.x, a.y - ws.approachPoint.y) < 5;
      const atInteraction =
        Math.hypot(a.x - ws.interactionPoint.x, a.y - ws.interactionPoint.y) < 5;
      if (atApproach && !atInteraction) {
        a.targetX = ws.interactionPoint.x;
        a.targetY = ws.interactionPoint.y;
        a.state = STATE.MOVING;
        return;
      }
      if (atInteraction) {
        a.x = ws.interactionPoint.x;
        a.y = ws.interactionPoint.y;
      }
    }
    a.stateTimer -= dt * speedMult;
    a.bob += dt * 12 * Math.PI; // 6Hz oscillation for working status glow/pulse
    a.animTimer += dt;
    if (a.animTimer > 0.2) {
      a.animTimer = 0;
      a.animFrame = (a.animFrame + 1) % 4;
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
    if (a.animTimer > 0.42) {
      a.animTimer -= 0.42;
      a.idleAnimStep = (a.idleAnimStep + 1) % IDLE_GESTURE_FRAMES.length;
      a.animFrame = IDLE_GESTURE_FRAMES[a.idleAnimStep]!;
    }
    if (a.stateTimer <= 0) {
      if (a.reportedState === 'working' || a.reportedState === 'review') {
        const ws = ASSIGNED_WORKSTATIONS[a.name];
        if (ws) {
          a.targetX = ws.approachPoint.x;
          a.targetY = ws.approachPoint.y;
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

  if (a.name === 'Alec') {
    const atCommand = isAgentWorkingAtAssignedStation(a);
    a.commandTime = atCommand ? (a.commandTime ?? 0) + dt * speedMult : 0;
  }

  if (a.name === 'Benjamin') {
    const atScanner = isBenjaminUsingScanner(a);
    a.qaTime = atScanner ? (a.qaTime ?? 0) + dt * speedMult : 0;
  }

  // Ambient map motion persists while the control's gesture clock remains work-only.
  const usingStarMap = isKevinUsingStarMap(a);
  if (a.name === 'Kevin') {
    a.hologramSceneTime =
      (a.hologramSceneTime ?? 0) + dt * speedMult * (usingStarMap ? 1 : 0.22);
    const expansion = a.hologramExpansion ?? 0;
    const change = (dt * speedMult) / 0.6;
    a.hologramExpansion = Math.max(0, Math.min(1, expansion + (usingStarMap ? change : -change)));
  }
  a.hologramTime = usingStarMap ? (a.hologramTime ?? 0) + dt * speedMult : 0;
  if (a.name === 'Kevin') {
    const desired = getHologramCamera(a.hologramTime, usingStarMap, a.hologramSceneTime);
    const previous = a.hologramCamera ?? desired;
    const blend = usingStarMap ? 1 : 1 - Math.exp(-dt * speedMult * 5);
    a.hologramCamera = {
      x: previous.x + (desired.x - previous.x) * blend,
      y: previous.y + (desired.y - previous.y) * blend,
      zoom: previous.zoom + (desired.zoom - previous.zoom) * blend,
    };
  }

  // Work particles are not a proxy for a remote status. They start only after
  // the body has reached its exact interaction anchor, and clear immediately
  // when it leaves so a traveller never carries a ghost work effect.
  if (!isAgentWorkingAtAssignedStation(a)) {
    a.particles = [];
  } else if (a.name !== 'Kevin') {
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

  const distInteraction = Math.hypot(a.x - ws.interactionPoint.x, a.y - ws.interactionPoint.y);
  // Approach anchors are deliberately 18–50 px away from the actual control
  // point.  A generous tolerance made Kevin and Benjamin animate while still
  // walking to their stations, so this must stay close to the snapped target.
  return distInteraction <= 6;
}

export function isAgentWorkingAtAssignedStation(agent: StarshipAgent): boolean {
  const wantsWork =
    agent.reportedState === undefined ||
    agent.reportedState === 'working' ||
    agent.reportedState === 'review';
  return (
    wantsWork &&
    agent.state === STATE.WORKING &&
    agent.reportedState !== 'offline' &&
    isAgentAtStation(agent)
  );
}

export function isBenjaminUsingScanner(agent: StarshipAgent): boolean {
  return agent.name === 'Benjamin' && isAgentWorkingAtAssignedStation(agent);
}

export function getAgentStatusBubble(agent: StarshipAgent): AgentStatusBubble {
  const roleColor = ROLE_GLOW_COLORS[agent.name] ?? agent.skin?.tint ?? '#5ce1ff';
  const isOffline = agent.reportedState === 'offline' || agent.state === STATE.OFFLINE;
  const workingAtStation = isAgentWorkingAtAssignedStation(agent);
  const headingToWorkstation =
    !isOffline &&
    (agent.reportedState === 'working' || agent.reportedState === 'review') &&
    !workingAtStation;

  let statusText = '💤 idle';
  let color = '#a5b4fc';
  let borderColor = 'rgba(165, 180, 252, 0.5)';

  if (isOffline) {
    statusText = '⚫ offline';
    color = '#8e92a4';
    borderColor = 'rgba(142, 146, 164, 0.4)';
  } else if (workingAtStation) {
    statusText = `⚙ đang làm việc`;
    color = roleColor;
    borderColor = roleColor;
  } else if (headingToWorkstation) {
    statusText = '↗ đến trạm';
    color = roleColor;
    borderColor = roleColor;
  } else if (agent.state === STATE.BLOCKED || agent.reportedState === 'blocked') {
    statusText = '⚠️ blocked';
    color = STARSHIP_CRIMSON_TINT;
    borderColor = STARSHIP_CRIMSON_TINT;
  } else if (agent.state === STATE.WAITING || agent.reportedState === 'waiting') {
    statusText = '⏳ waiting';
    color = STARSHIP_AMBER;
    borderColor = STARSHIP_AMBER;
  }

  const ws = WORKSTATIONS[agent.name];
  const nameLabel = ws ? ws.label : agent.name;
  const lines = [nameLabel, statusText];

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
  anchor: Pick<StarshipAgent, 'x' | 'y'> = a,
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
  const bubbleY = anchor.y - drawH - (isTwoLines ? 16 : 12) + bobY;

  let boxX = anchor.x - boxW / 2;
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
  ctx.fillStyle = PHOTONIC_THEME.hull;
  ctx.fill();
  ctx.lineWidth = 1;

  const isWorking = isAgentWorkingAtAssignedStation(a);

  if (isWorking) {
    const pulse = 0.5 + 0.5 * Math.sin((a.bob ?? 0) * 1.5);
    ctx.strokeStyle = pulse > 0.45 ? STARSHIP_AMBER : bubble.borderColor;
  } else {
    ctx.strokeStyle = bubble.borderColor;
  }
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

export const WORK_HAND_PHASE_OFFSETS = [
  { leftYOffset: 0, rightYOffset: 1, bob: 0 },
  { leftYOffset: 2, rightYOffset: -1, bob: -0.5 },
  { leftYOffset: -1, rightYOffset: 2, bob: 0 },
  { leftYOffset: 1, rightYOffset: 0, bob: -0.5 },
] as const;

// Kevin drives the star-map table with a short, readable touch/response loop.
// This clock is separate from Alec's command-chair gesture clock.
const KEVIN_TOUCH_STARTS = [0.12, 0.6, 1.08] as const;
const KEVIN_TOUCH_DURATION = 0.22;
const KEVIN_STARMAP_CYCLE = 8.4;

export function getKevinStarMapCycle(timeSec: number) {
  const time = Math.max(0, timeSec);
  const cycle = Math.floor(time / KEVIN_STARMAP_CYCLE);
  const phase = time - cycle * KEVIN_STARMAP_CYCLE;
  const contact = KEVIN_TOUCH_STARTS.some(
    (start) => phase >= start && phase < start + KEVIN_TOUCH_DURATION,
  );
  const response = Math.max(0, Math.min(1, (phase - 1.38) / 1.1));
  const settled = response * response * (3 - 2 * response);
  return { phase, contact, responseTime: (cycle + settled) * KEVIN_STARMAP_CYCLE };
}

export function getKevinStarMapFrame(timeSec: number): number {
  const { phase, contact } = getKevinStarMapCycle(timeSec);
  if (contact) return phase < 0.4 ? 1 : 2;
  return phase > 3.8 ? 3 : 0;
}

/** @deprecated Compatibility name retained for existing host integrations. */
export function getAlecHologramFrame(timeSec: number): number {
  return getKevinStarMapCycle(timeSec).contact ? 0 : 1;
}

export function isKevinUsingStarMap(a: StarshipAgent): boolean {
  return a.name === 'Kevin' && isAgentWorkingAtAssignedStation(a);
}

export function drawAgent(
  ctx: CanvasRenderingContext2D,
  a: StarshipAgent,
  sheetImg: HTMLImageElement,
  _timeSec: number = Date.now() / 1000,
  alecHologramImg?: HTMLImageElement,
  walkImg?: HTMLImageElement,
): void {
  void _timeSec;
  // Dedicated workstation poses are composed by drawStage.  Retain this
  // parameter for the public renderer signature, but never recycle Alec's
  // old hologram sprite for another crew member.
  void alecHologramImg;
  const hologramControlActive = isKevinUsingStarMap(a);
  const isOffline = a.reportedState === 'offline' || a.state === STATE.OFFLINE;
  const isWorking = isAgentWorkingAtAssignedStation(a);
  const atDesk = isWorking;

  ctx.save();
  if (isOffline) {
    ctx.globalAlpha = 0.35;
  }

  const walkSprite = a.state === STATE.MOVING && walkImg ? walkImg : undefined;
  const sprite = walkSprite ?? sheetImg;
  const cw = walkSprite ? walkSprite.width / 12 : sheetImg.width / SHEET_COLS;
  const ch = walkSprite ? walkSprite.height / 3 : sheetImg.height / SHEET_ROWS;
  const walkRow = a.name === 'Benjamin' ? 0 : a.name === 'Kevin' ? 1 : 2;
  const row = walkSprite ? walkRow : a.skin.row;
  const idleFrame =
    a.state === STATE.IDLE
      ? a.idleAnimStep === 0 && a.animTimer === 0
        ? a.animFrame
        : IDLE_GESTURE_FRAMES[a.idleAnimStep % IDLE_GESTURE_FRAMES.length]!
      : a.animFrame;
  const col = walkSprite
    ? (a.facing === 'front' ? 4 : a.facing === 'back' ? 8 : 0) + (a.animFrame % 4)
    : hologramControlActive
      ? 8 + getAlecHologramFrame(a.hologramTime ?? 0)
      : a.state === STATE.MOVING
        ? 4 + (a.animFrame % 4)
        : a.facing === 'back' || (atDesk && a.facing !== 'front')
          ? 8 + (idleFrame % 4)
          : 0 + (idleFrame % 4);

  const sx = col * cw;
  const sy = row * ch;

  // Depth scale based on foot position a.y
  const scale = getDepthScale(a.y);
  const BASE_DRAW_H = 92;
  const drawH = BASE_DRAW_H * scale;
  const drawW = drawH * (cw / ch);

  const bobY = isWorking && !hologramControlActive
    ? WORK_HAND_PHASE_OFFSETS[((a.animFrame % 4) + 4) % 4]!.bob * scale
    : 0;
  const leanY = atDesk ? -1 : 0;

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
  ctx.shadowBlur = isOffline ? 0 : 4;
  ctx.drawImage(sprite, sx, sy, cw, ch, -drawW / 2, -drawH, drawW, drawH);

  // (3) Second pass with 'lighter' composite mode to boost sprite brightness
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = isOffline ? 0.025 : 0.10;
  ctx.drawImage(sprite, sx, sy, cw, ch, -drawW / 2, -drawH, drawW, drawH);

  // Failure-safe fallback only. In the live stage all three crew members use
  // their complete authored work pose, but an undecodable optional asset must
  // not leave a working operator completely inert.
  if (isWorking && !hologramControlActive) {
    const phase = ((a.animFrame % 4) + 4) % 4;
    const phaseOffsets = WORK_HAND_PHASE_OFFSETS[phase]!;
    const leftX = -drawW * 0.14;
    const rightX = drawW * 0.06;
    const baseY = -drawH * 0.38;
    const handW = 3 * scale;
    const handH = 2 * scale;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = isOffline ? 0.35 : 1.0;
    ctx.fillStyle = roleGlow;
    ctx.shadowColor = roleGlow;
    ctx.shadowBlur = 4;
    if (typeof ctx.fillRect === 'function') {
      ctx.fillRect(leftX, baseY + phaseOffsets.leftYOffset * scale, handW, handH);
      ctx.fillRect(rightX, baseY + phaseOffsets.rightYOffset * scale, handW, handH);
    } else if (typeof ctx.rect === 'function') {
      ctx.beginPath();
      ctx.rect(leftX, baseY + phaseOffsets.leftYOffset * scale, handW, handH);
      ctx.rect(rightX, baseY + phaseOffsets.rightYOffset * scale, handW, handH);
      ctx.fill();
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

  // Status glow ring while working (scaled at feet)
  if (isWorking && !hologramControlActive) {
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

  // Status bubble above head (always visible)
  // Keep Kevin's label beside his body, clear of the enlarged map.
  drawAgentStatusBubble(
    ctx,
    a,
    drawH,
    bobY,
    CW,
    hologramControlActive ? { x: a.x - 105, y: a.y + 40 } : a,
  );

  // Work particles floating above agent
  if (!hologramControlActive) drawWorkParticles(ctx, a);

  ctx.restore();
}

interface AuthoredWorkPoseAtlas {
  width: number;
  height: number;
  columns: number;
  bodyTop: number;
  bodyBottom: number;
}

/**
 * Draw one complete authored pose at a station-local anchor.
 *
 * The transparent padding in an atlas is intentionally retained: anchoring by
 * the opaque body's bounds keeps every pose locked to its chair/table while
 * allowing hands and antennae to animate outside the body rectangle.
 */
function drawAuthoredWorkPose(
  ctx: CanvasRenderingContext2D,
  a: StarshipAgent,
  image: HTMLImageElement,
  atlas: AuthoredWorkPoseAtlas,
  frame: number,
  anchorX: number,
  anchorY: number,
  bodyHeight: number,
  floorGlow = true,
): void {
  if (!image.width || !image.height || atlas.columns < 1) return;
  const sourceW = image.width / atlas.columns;
  const sourceH = image.height;
  const opaqueBodyH = Math.max(1, atlas.bodyBottom - atlas.bodyTop);
  const cellH = bodyHeight * atlas.height / opaqueBodyH;
  const cellW = cellH * sourceW / sourceH;
  const cellY = anchorY - cellH * atlas.bodyBottom / atlas.height;
  const safeFrame = ((Math.floor(frame) % atlas.columns) + atlas.columns) % atlas.columns;
  const roleGlow = ROLE_GLOW_COLORS[a.name] ?? a.skin.tint ?? '#5ce1ff';

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(anchorX, anchorY + 1, bodyHeight * 0.24, 4.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = STARSHIP_AGENT_SHADOW;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = roleGlow;
  ctx.shadowBlur = 3;
  ctx.drawImage(
    image,
    safeFrame * sourceW,
    0,
    sourceW,
    sourceH,
    anchorX - cellW / 2,
    cellY,
    cellW,
    cellH,
  );
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.08;
  ctx.drawImage(
    image,
    safeFrame * sourceW,
    0,
    sourceW,
    sourceH,
    anchorX - cellW / 2,
    cellY,
    cellW,
    cellH,
  );
  ctx.restore();

  if (floorGlow) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(anchorX, anchorY + 1, bodyHeight * 0.2, 4.2, 0, 0, Math.PI * 2);
    ctx.strokeStyle = roleGlow;
    ctx.globalAlpha = 0.45 + Math.sin(a.bob * 1.3) * 0.16;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }
}

export function drawDeskCutouts(
  ctx: CanvasRenderingContext2D,
  bgImg: HTMLImageElement,
  agents: StarshipAgent[],
): void {
  for (const agent of agents) {
    const ws = WORKSTATIONS[agent.name];
    // Kevin stands in front of the hologram table, not behind its front panel.
    if (!ws || !ws.occlusionBounds || agent.name === 'Kevin') continue;

    // A live snapshot can remain "working" for a few frames while the
    // simulation is routing the crew member away. Never cover a moving or
    // idle sprite with a desk cutout during that transition.
    if (isAgentWorkingAtAssignedStation(agent)) {
      const c = ws.occlusionBounds;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bgImg, c.x, c.y, c.w, c.h, c.x, c.y, c.w, c.h);
      ctx.restore();
    }
  }
}

// The single planetary map is rendered inside the v4 glass. Work changes the camera;
// leaving the station returns it to the compact survey view.
export function drawHologramTopGlow(
  ctx: CanvasRenderingContext2D,
  agents: StarshipAgent[],
  _timeSec: number = Date.now() / 1000,
): void {
  void _timeSec;
  const kevin = agents.find((a) => a.name === 'Kevin');
  const working = !!kevin && isKevinUsingStarMap(kevin);
  const controlTime = kevin?.hologramTime ?? 0;
  const time = kevin?.hologramSceneTime ?? controlTime;
  const open = 1;

  // Only the authored v4 panel is used. The legacy sampled-screen path is gone,
  // so the old room coordinates cannot be copied or drift over this glass.
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.translate(STAR_MAP_PANEL.x, STAR_MAP_PANEL.y);
  ctx.scale(STAR_MAP_PANEL.w / 106, STAR_MAP_PANEL.h / 71);
  ctx.beginPath();
  ctx.moveTo(3, 14);
  ctx.quadraticCurveTo(3, 5, 15, 5);
  ctx.quadraticCurveTo(53, -1, 92, 6);
  ctx.quadraticCurveTo(103, 7, 103, 17);
  ctx.lineTo(103, 61);
  ctx.quadraticCurveTo(103, 68, 95, 68);
  ctx.lineTo(10, 68);
  ctx.quadraticCurveTo(3, 68, 3, 60);
  ctx.closePath();
  ctx.clip();
  const glass = ctx.createLinearGradient(0, 0, 0, 71);
  glass.addColorStop(0, '#0a202c');
  glass.addColorStop(0.6, '#0b2635');
  glass.addColorStop(1, '#123b4b');
  ctx.fillStyle = glass;
  ctx.fillRect(0, 0, 106, 71);

  const navigation = getHologramNavigation(controlTime, working, time);
  const camera = kevin?.hologramCamera ?? getHologramCamera(controlTime, working, time);
  ctx.save();
  ctx.translate(STAR_MAP_PANEL.centerX, STAR_MAP_PANEL.centerY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // Broad wisps build depth around the star field without a solid nebula disc.
  ctx.globalCompositeOperation = 'lighter';
  for (let cloud = 0; cloud < 12; cloud++) {
    const u = cloud / 11;
    const x = 14 + u * 78;
    const y = 53 - u * 36 + Math.sin(u * 6 + time * 0.025) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.7, 0.6 + (cloud % 3) * 0.12);
    const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, 11);
    haze.addColorStop(0, '#56bdd624');
    haze.addColorStop(0.35, '#348da918');
    haze.addColorStop(1, '#16435b00');
    ctx.globalAlpha = open;
    ctx.fillStyle = haze;
    ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';

  // The fixed seed keeps fine dust stable between frames; depth controls parallax.
  for (const mote of HOLOGRAM_DUST) {
    const drift = Math.sin(time * 0.18 + mote.depth * 0.13);
    const x = mote.x + drift * mote.depth * 0.65;
    const y = mote.y + Math.cos(time * 0.13 + mote.depth * 0.2) * mote.depth * 0.3;
    ctx.globalAlpha = open * mote.alpha * (0.8 + Math.sin(time * 0.8 + mote.x) * 0.2);
    ctx.fillStyle = mote.depth > 0 ? '#beedf0' : '#5ba8c3';
    ctx.beginPath();
    ctx.arc(x, y, mote.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 38; i++) {
    const x = 7 + ((i * 37.73) % 91);
    const y = 7 + ((i * 19.31) % 57);
    ctx.globalAlpha = open * (0.16 + (i % 4) * 0.1);
    ctx.fillStyle = '#bedee8';
    ctx.beginPath();
    ctx.arc(x, y, i % 7 === 0 ? 0.25 : 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // A few subdued navigation branches preserve the original map's identity.
  // Most of the field is carried by star clusters rather than a polygon mesh.
  ctx.globalAlpha = open * 0.14;
  ctx.strokeStyle = '#70c4d8';
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(32, 15);
  ctx.bezierCurveTo(35, 28, 43, 35, 54, 38);
  ctx.bezierCurveTo(66, 32, 76, 23, 86, 20);
  ctx.moveTo(54, 38);
  ctx.bezierCurveTo(68, 44, 79, 46, 87, 51);
  ctx.stroke();
  drawMapStar(ctx, 32, 15, 0.42, '#ffae83', open * 0.65);
  drawMapStar(ctx, 86, 20, 0.68, '#c1f3ff', open * 0.85);
  drawMapStar(ctx, 87, 51, 0.5, '#bceeff', open * 0.65);
  drawMapStar(ctx, 69, 27, 0.28, '#bceeff', open * 0.8);
  drawMapStar(ctx, 18, 45, 0.3, '#bceeff', open * 0.55);

  // Sparse true orbital tracks preserve a readable overview.
  ctx.strokeStyle = '#70c4d8';
  ctx.lineWidth = 0.22;
  ctx.globalAlpha = 0.12;
  for (const world of [HOLOGRAM_WORLDS[0], HOLOGRAM_WORLDS[1], HOLOGRAM_WORLDS[7]]) {
    ctx.beginPath();
    ctx.ellipse(54, 35.5, world.orbitX, world.orbitY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // The orange hub stays fixed; a ringed world actually travels around it.
  const pulse = 0.5 + 0.5 * Math.sin(time * 1.1);
  const planets = getHologramPlanets(time);
  for (const planet of planets.filter(p => p.depth < 0).sort((a, b) => a.depth - b.depth)) {
    drawHologramPlanet(ctx, planet, time, open);
  }
  drawMapStar(ctx, 54, 38, 1.65 + pulse * 0.05, '#ffb468', open);
  for (const planet of planets.filter(p => p.depth >= 0).sort((a, b) => a.depth - b.depth)) {
    drawHologramPlanet(ctx, planet, time, open);
  }
  if (working) drawHologramNavigation(ctx, navigation);
  ctx.restore();

  // Restrained spill at the lower glass edge ties the projection to its cyan emitter.
  ctx.globalAlpha = open;
  const spill = ctx.createLinearGradient(0, 55, 0, 66);
  spill.addColorStop(0, '#6ce8f000');
  spill.addColorStop(1, '#6ce8f025');
  ctx.fillStyle = spill;
  ctx.fillRect(5, 55, 96, 11);
  ctx.restore();
}

export function getHologramOrbit(time: number, radiusX = 28, radiusY = 12) {
  const angle = 2.85 + time * 0.22;
  const x = Math.cos(angle) * radiusX;
  const y = Math.sin(angle) * radiusY;
  const tilt = -0.14;
  return {
    x: 54 + x * Math.cos(tilt) - y * Math.sin(tilt),
    y: 38 + x * Math.sin(tilt) + y * Math.cos(tilt),
    depth: Math.sin(angle),
  };
}

// Eight real worlds, not enlarged star dots. Their material and spin are stable
// identities shared by the overview, close-ups and camera targets.
const HOLOGRAM_WORLDS = [
  { id: 'aurelia', radius: 5.2, ring: true, orbitX: 28, orbitY: 12, phase: 2.85, speed: 0.025, spin: 0.9, material: 'gas',
    colors: ['#142f43', '#326778', '#6fadb4', '#b7dcd7', '#f0eed4'] },
  { id: 'pelagia', radius: 4.1, ring: false, orbitX: 39, orbitY: 22, phase: 4.15, speed: 0.018, spin: 1.05, material: 'ocean',
    colors: ['#10233d', '#175375', '#267eac', '#67c8d4', '#cef3e9'] },
  { id: 'cinder', radius: 3.7, ring: false, orbitX: 36, orbitY: 20, phase: 5.25, speed: 0.021, spin: 0.8, material: 'lava',
    colors: ['#301524', '#63312f', '#a45138', '#e89451', '#ffdc85'] },
  { id: 'borealis', radius: 4.3, ring: false, orbitX: 40, orbitY: 21, phase: 6.15, speed: 0.017, spin: 0.85, material: 'ice',
    colors: ['#26385c', '#486889', '#88b3ca', '#c7e5ee', '#f5fffe'] },
  { id: 'ochre', radius: 4.5, ring: false, orbitX: 35, orbitY: 19, phase: 0.92, speed: 0.024, spin: 1, material: 'desert',
    colors: ['#35233a', '#754747', '#b47d55', '#e4ba7c', '#ffe2ac'] },
  { id: 'viridia', radius: 3.8, ring: false, orbitX: 40, orbitY: 22, phase: 1.9, speed: 0.019, spin: 1.1, material: 'ocean',
    colors: ['#122d36', '#20535d', '#438d8a', '#8dc59c', '#dcf0c0'] },
  { id: 'amethyst', radius: 3.6, ring: true, orbitX: 42, orbitY: 23, phase: 3.25, speed: 0.016, spin: 0.75, material: 'gas',
    colors: ['#281b44', '#543c78', '#9274b3', '#c6a6da', '#f1dbea'] },
  { id: 'basalt', radius: 3.1, ring: false, orbitX: 15, orbitY: 8, phase: 4.65, speed: 0.035, spin: 0.95, material: 'rock',
    colors: ['#242737', '#505565', '#899095', '#bcc5c3', '#e4e5d7'] },
] as const;

export function getHologramPlanets(time: number) {
  return HOLOGRAM_WORLDS.map((world, index) => {
    const angle = world.phase + time * world.speed;
    return {
      ...world,
      x: 54 + Math.cos(angle) * world.orbitX,
      y: 35.5 + Math.sin(angle) * world.orbitY,
      depth: Math.sin(angle),
      seed: index + 1,
    };
  });
}

const TOUR_ARRIVAL = 4.5;
const TOUR_HOLD = 3.2;
const TOUR_TRANSFER = 1.8;
const TOUR_LEG = TOUR_HOLD + TOUR_TRANSFER;

function smoothHologram(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return Math.max(0, Math.min(1, t * t * t * (t * (t * 6 - 15) + 10)));
}

function hologramTour(time: number) {
  const elapsed = Math.max(0, time - TOUR_ARRIVAL);
  const leg = Math.floor(elapsed / TOUR_LEG);
  const phase = elapsed - leg * TOUR_LEG;
  return {
    index: leg % HOLOGRAM_WORLDS.length,
    next: (leg + 1) % HOLOGRAM_WORLDS.length,
    transfer: smoothHologram((phase - TOUR_HOLD) / TOUR_TRANSFER),
  };
}

export function getHologramCamera(time: number, working: boolean, sceneTime = time) {
  if (!working) return { x: 53, y: 35.5, zoom: 1 };
  const planets = getHologramPlanets(sceneTime);
  const tour = hologramTour(time);
  const current = planets[tour.index]!;
  const next = planets[tour.next]!;
  const approach = smoothHologram((time - 3.2) / 1.3);
  // Keep body diameter near 35 map units, leaving room for rings and moons.
  const zoomFor = (radius: number) => Math.min(5.5, 17.5 / radius);
  const targetX = current.x + (next.x - current.x) * tour.transfer;
  const targetY = current.y + (next.y - current.y) * tour.transfer;
  const targetZoom = zoomFor(current.radius) +
    (zoomFor(next.radius) - zoomFor(current.radius)) * tour.transfer;
  // Track orbital position while observing axial rotation. Transfers never
  // return to the overview, including the final planet -> first planet.
  return {
    x: 53 + (targetX - 53) * approach,
    y: 35.5 + (targetY - 35.5) * approach,
    zoom: 1 + (targetZoom - 1) * approach,
  };
}

export function getHologramNavigation(time: number, working: boolean, sceneTime = time) {
  const planets = getHologramPlanets(sceneTime);
  const tour = hologramTour(time);
  const target = planets[tour.transfer > 0 ? tour.next : tour.index]!;
  const { phase } = getKevinStarMapCycle(time);
  const progress = working ? Math.max(0, Math.min(1, (phase - 1.38) / 1.1)) : 0;
  return {
    target: { x: target.x, y: target.y },
    scan: Math.max(0, Math.min(1, (phase - 0.12) / 1.18)),
    route: progress * progress * (3 - 2 * progress),
    signal: Math.max(0, Math.min(1, (phase - 2.48) / 0.55)),
    // Fade the route after arrival so the close-up is an unobstructed star view.
    opacity: working && time < 3.5
      ? Math.max(0, Math.min(1, phase / 0.15, (3.5 - phase) / 0.47)) : 0,
  };
}

function drawHologramNavigation(
  ctx: CanvasRenderingContext2D,
  navigation: ReturnType<typeof getHologramNavigation>,
) {
  const { target, route, scan, signal, opacity } = navigation;
  const point = (t: number) => ({
    x: (1 - t) ** 2 * 54 + 2 * (1 - t) * t * (target.x - 9) + t * t * target.x,
    y: (1 - t) ** 2 * 38 + 2 * (1 - t) * t * (target.y - 5) + t * t * target.y,
  });
  ctx.save();
  // Lock onto one existing star while Alec touches the controls.
  ctx.strokeStyle = '#a1eff4';
  ctx.lineWidth = 0.4;
  ctx.globalAlpha = opacity * 0.8;
  const radius = 2.6 + (1 - scan) * 3;
  for (let corner = 0; corner < 4; corner++) {
    const angle = corner * Math.PI / 2 + scan * 0.4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, radius, angle, angle + 0.65);
    ctx.stroke();
  }
  // Survey sweep stays local to the selected system and fades after locking.
  ctx.globalAlpha = opacity * (1 - scan) * 0.24;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 7, scan * Math.PI * 2, scan * Math.PI * 2 + 0.7);
  ctx.stroke();
  if (route > 0) {
    ctx.globalAlpha = opacity * 0.65;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(54, 38);
    for (let step = 1; step <= 32; step++) {
      const p = point(route * step / 32);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    const head = point(route);
    drawMapStar(ctx, head.x, head.y, 0.38, '#7cddf1', opacity * 0.9);
  }
  if (signal > 0) {
    // A departing signal traverses the calculated route, followed by a
    // confirmation ripple at the destination before the map camera approaches.
    const ship = point(signal);
    drawMapStar(ctx, ship.x, ship.y, 0.5, '#a9f1fb', opacity);
    ctx.globalAlpha = opacity * signal * (1 - signal * 0.7);
    ctx.strokeStyle = '#a1eff4';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 2 + signal * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

const HOLOGRAM_DUST = Array.from({ length: 420 }, (_, index) => {
  const random = (salt: number) => {
    const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const u = random(1);
  const spread = (random(2) + random(3) + random(4) - 1.5) * (4 + Math.sin(u * Math.PI) * 7);
  return {
    x: 12 + u * 81 + spread * 0.3,
    y: 54 - u * 38 + Math.sin(u * 6) * 3 + spread,
    depth: random(5) * 12 - 6,
    radius: 0.075 + random(6) * 0.18,
    alpha: 0.12 + random(7) * 0.48,
  };
});

type HologramPlanet = ReturnType<typeof getHologramPlanets>[number];

// Orthographic projection of rotating longitudes: features compress at the limb
// and disappear on the far hemisphere, unlike sliding a flat texture sideways.
export function getHologramSurfacePoint(longitude: number, latitude: number, spin: number) {
  const angle = longitude + spin;
  return {
    x: Math.sin(angle) * Math.cos(latitude),
    y: Math.sin(latitude),
    depth: Math.cos(angle) * Math.cos(latitude),
  };
}

const PLANET_FEATURES = Array.from({ length: 48 }, (_, i) => ({
  longitude: i * 2.399963229728653,
  latitude: Math.asin(((i * 0.61803398875) % 1) * 1.7 - 0.85),
  size: 0.07 + (i % 5) * 0.025,
}));

function drawMapStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  opacity: number,
): void {
  ctx.globalAlpha = opacity;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4.5);
  glow.addColorStop(0, '#fff9eb');
  glow.addColorStop(0.14, '#fff0ce');
  glow.addColorStop(0.3, color);
  glow.addColorStop(0.55, color + '42');
  glow.addColorStop(1, color + '00');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff5dc';
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawHologramPlanet(
  ctx: CanvasRenderingContext2D,
  planet: HologramPlanet,
  time: number,
  open: number,
): void {
  const { x, y, radius, colors } = planet;
  const opacity = open * (planet.depth < 0 ? 0.85 : 1);
  const lightLength = Math.max(1, Math.hypot(54 - x, 38 - y));
  const lightX = (54 - x) / lightLength;
  const lightY = (38 - y) / lightLength;
  const moonAngle = time * 0.65 + 0.5;
  const moonX = x + Math.cos(moonAngle) * radius * 2.7;
  const moonY = y + Math.sin(moonAngle) * radius * 0.9;
  const drawMoon = () => {
    const shade = ctx.createRadialGradient(moonX - 0.25, moonY - 0.25, 0, moonX, moonY, 0.65);
    shade.addColorStop(0, '#d7e2df');
    shade.addColorStop(0.5, '#77959f');
    shade.addColorStop(1, '#1c394b');
    ctx.globalAlpha = opacity;
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 0.65, 0, Math.PI * 2);
    ctx.fill();
  };
  const drawRing = (front: boolean) => {
    // Multiple fine translucent bands form a dust ring, with the planet occluding its rear.
    for (let band = 0; band < 9; band++) {
      const ringRadius = radius * (1.55 + band * 0.065);
      ctx.globalAlpha = opacity * (front ? 0.42 : 0.2) * (band === 5 ? 0.25 : 1);
      ctx.strokeStyle = band % 3 === 0 ? '#cee2d9' : '#81acb7';
      ctx.lineWidth = 0.23;
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        ringRadius,
        ringRadius * 0.28,
        -0.3,
        front ? 0 : Math.PI,
        front ? Math.PI : Math.PI * 2,
      );
      ctx.stroke();
    }
  };
  if (planet.ring && Math.sin(moonAngle) < 0) drawMoon();
  if (planet.ring) drawRing(false);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = opacity;
  const body = ctx.createRadialGradient(
    x + lightX * radius * 0.45,
    y + lightY * radius * 0.45,
    radius * 0.05,
    x,
    y,
    radius * 1.15,
  );
  body.addColorStop(0, colors[4]!);
  body.addColorStop(0.35, colors[3]!);
  body.addColorStop(0.65, colors[2]!);
  body.addColorStop(0.85, colors[1]!);
  body.addColorStop(1, colors[0]!);
  ctx.fillStyle = body;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  // Subtle cloud belts, clipped to the sphere.
  for (let band = -3; band <= 3; band++) {
    const offset = band * radius * 0.26;
    ctx.globalAlpha = opacity * (band % 2 === 0 ? 0.13 : 0.08);
    ctx.strokeStyle = band % 2 === 0 ? '#e0f3ed' : '#19394b';
    ctx.lineWidth = radius * 0.15;
    ctx.beginPath();
    ctx.moveTo(x - radius, y + offset);
    ctx.bezierCurveTo(
      x - radius * 0.25,
      y + offset + radius * 0.4,
      x + radius * 0.4,
      y + offset - radius * 0.18 + Math.sin(time * 0.65 + band) * radius * 0.12,
      x + radius,
      y + offset - radius * 0.1,
    );
    ctx.stroke();
  }
  // Actual axial rotation. Surface landmarks turn across the lit hemisphere
  // while the terminator below remains aligned with the central light.
  for (let i = 0; i < PLANET_FEATURES.length; i++) {
    const feature = PLANET_FEATURES[i]!;
    const point = getHologramSurfacePoint(
      feature.longitude + planet.seed * 0.7,
      feature.latitude,
      time * planet.spin,
    );
    if (point.depth <= 0) continue;
    const px = x + point.x * radius;
    const py = y + point.y * radius;
    const size = radius * feature.size;
    const material = planet.material;
    ctx.globalAlpha = opacity * Math.min(1, point.depth * 5) *
      (material === 'gas' ? 0.45 : 0.8);
    ctx.fillStyle = material === 'ocean' ? (i % 3 ? '#70ac75' : '#bbdcc8')
      : material === 'lava' ? (i % 3 ? '#ffac53' : '#ffdc82')
      : material === 'ice' ? (i % 3 ? '#e0f9ff' : '#6191b7')
      : material === 'desert' ? (i % 3 ? '#976347' : '#f1cf8c')
      : material === 'rock' ? (i % 3 ? '#4a5365' : '#c8cec6')
      : planet.colors[i % 2 ? 3 : 1];
    ctx.beginPath();
    ctx.ellipse(px, py, Math.max(0.01, size * point.depth *
      (material === 'gas' ? 2.5 : 1.3)), size * (material === 'gas' ? 0.45 : 0.8),
      0, 0, Math.PI * 2);
    ctx.fill();
    if (material === 'rock') {
      ctx.strokeStyle = '#ced5d5';
      ctx.lineWidth = radius * 0.025;
      ctx.stroke();
    }
  }
  const night = ctx.createLinearGradient(
    x + lightX * radius,
    y + lightY * radius,
    x - lightX * radius,
    y - lightY * radius,
  );
  night.addColorStop(0, '#020d1800');
  night.addColorStop(0.4, '#020d1800');
  night.addColorStop(0.7, '#020d1880');
  night.addColorStop(1, '#020d18f0');
  ctx.globalAlpha = opacity;
  ctx.fillStyle = night;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();

  // A fine atmospheric limb catches the light from the central star.
  ctx.globalAlpha = opacity * 0.45;
  ctx.strokeStyle = '#b6dde7';
  ctx.lineWidth = 0.18;
  const lightAngle = Math.atan2(lightY, lightX);
  ctx.beginPath();
  ctx.arc(x, y, radius, lightAngle - 1, lightAngle + 1);
  ctx.stroke();
  if (planet.ring) drawRing(true);
  if (planet.ring && Math.sin(moonAngle) >= 0) drawMoon();
}

export function drawKevinStarMapControl(
  ctx: CanvasRenderingContext2D,
  a: StarshipAgent,
  foreground = false,
): void {
  if (!isKevinUsingStarMap(a)) return;
  const time = a.hologramTime ?? 0;
  const { contact, phase, responseTime } = getKevinStarMapCycle(time);
  const cx = a.x;
  const depth = getDepthScale(a.y);
  const poseFrame = getKevinStarMapFrame(time);
  // Measured against the four cyan rear-view frames at the 78px base body
  // height.  These anchors make fields follow the actual gloves instead of
  // floating around a generic standing sprite.
  const poseHands = [
    [{ x: -19, y: -47 }, { x: 19, y: -47 }],
    [{ x: -27, y: -52 }, { x: 19, y: -47 }],
    [{ x: -19, y: -47 }, { x: 28, y: -52 }],
    [{ x: -27, y: -52 }, { x: 27, y: -52 }],
  ] as const;
  const hands = poseHands[poseFrame]!.map((hand) => ({
    x: cx + hand.x * depth,
    y: a.y + hand.y * depth,
  }));
  const coreY = a.y - 108 * depth;
  const grip = contact ? 1 : 0;
  const breath = 0.5 + Math.sin(time * 1.8) * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 0.65;
  ctx.shadowBlur = 0;

  if (!foreground) {
    // Two filaments rise beside the intact rear-view character to the table's emitter.
    // The body occludes their middle sections naturally.
    for (let index = 0; index < hands.length; index++) {
      const side = index === 0 ? -1 : 1;
      const hand = hands[index]!;
      const hx = hand.x;
      const handY = hand.y;
      ctx.strokeStyle = '#6de1e6';
      ctx.globalAlpha = 0.18 + grip * 0.18;
      ctx.beginPath();
      ctx.moveTo(hx, handY);
      ctx.bezierCurveTo(
        cx + side * 37,
        handY - 26,
        cx + side * 33,
        coreY + 15,
        cx + side * 5,
        coreY + 3,
      );
      ctx.stroke();
      // An energy pulse travels toward the projector once the gesture is released.
      if (phase >= 1.38 && phase < 2.48) {
        const t = (phase - 1.38) / 1.1;
        const inv = 1 - t;
        const px =
          inv ** 3 * hx +
          3 * inv ** 2 * t * (cx + side * 37) +
          3 * inv * t ** 2 * (cx + side * 33) +
          t ** 3 * (cx + side * 5);
        const py =
          inv ** 3 * handY +
          3 * inv ** 2 * t * (handY - 26) +
          3 * inv * t ** 2 * (coreY + 15) +
          t ** 3 * (coreY + 3);
        drawMapStar(ctx, px, py, 0.38, '#9ef5ee', Math.sin(t * Math.PI) * 0.8);
      }
    }
    const glow = ctx.createRadialGradient(cx, coreY, 0, cx, coreY, 12);
    glow.addColorStop(0, '#b6fcf750');
    glow.addColorStop(0.5, '#62dfe428');
    glow.addColorStop(1, '#3dbad500');
    ctx.globalAlpha = 0.65 + breath * 0.15;
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 12, coreY - 12, 24, 24);
    // A small faceted control core, distinct from the planetary map above it.
    const spin = responseTime * 0.35;
    const r = 5.8 + grip * 0.5;
    for (let layer = 0; layer < 2; layer++) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const angle = spin + (i * Math.PI) / 3 + layer * 0.6;
        const px = cx + Math.cos(angle) * r;
        const py = coreY + Math.sin(angle) * r * (layer ? 0.55 : 1);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = layer ? '#baffef' : '#63bfdb';
      ctx.globalAlpha = layer ? 0.7 : 0.45;
      ctx.stroke();
    }
    drawMapStar(ctx, cx, coreY, 0.7, '#9dffe9', 0.85);
  }

  // The two floating control fields sit on Kevin's actual rear-view glove positions.
  // Render rear halves before the character and front halves after it.
  for (let index = 0; index < hands.length; index++) {
    const side = index === 0 ? -1 : 1;
    const hand = hands[index]!;
    const hx = hand.x;
    const handY = hand.y;
    const radius = 8.2 - grip * 1.2;
    if (!foreground) {
      const halo = ctx.createRadialGradient(hx, handY, 0, hx, handY, radius + 4);
      halo.addColorStop(0, '#a2ffed20');
      halo.addColorStop(0.55, '#5ccdd918');
      halo.addColorStop(1, '#3caad500');
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = halo;
      ctx.fillRect(hx - 13, handY - 13, 26, 26);
    }
    for (let ring = 0; ring < 2; ring++) {
      ctx.beginPath();
      ctx.ellipse(
        hx,
        handY,
        radius + ring * 2.5,
        4 + ring,
        side * 0.18,
        foreground ? 0 : Math.PI,
        foreground ? Math.PI : Math.PI * 2,
      );
      ctx.strokeStyle = ring === 0 ? '#aff8e8' : '#64b8d2';
      ctx.globalAlpha = (foreground ? 0.65 : 0.3) + grip * 0.18;
      ctx.lineWidth = ring === 0 ? 0.7 : 0.4;
      ctx.stroke();
    }
    if (foreground) {
      const angle = side * (time * 0.65 + 0.5);
      drawMapStar(
        ctx,
        hx + Math.cos(angle) * radius,
        handY + Math.sin(angle) * 4,
        0.32,
        '#befff1',
        0.75,
      );
    }
  }
  ctx.restore();
}

/** @deprecated Compatibility export for consumers of the earlier renderer. */
export const drawAlecHologramControl = drawKevinStarMapControl;

export function drawWorkstationScreens(
  ctx: CanvasRenderingContext2D,
  agents: StarshipAgent[],
  timeSec: number = Date.now() / 1000,
): void {
  ctx.save();
  for (const agent of agents) {
    const ws = WORKSTATIONS[agent.name];
    if (!ws) continue;

    if (!isAgentWorkingAtAssignedStation(agent)) continue;

    // Kevin's workstation is the hologram table rendered with drawHologramTopGlow.
    if (agent.name === 'Kevin') continue;

    const roleColor = ROLE_GLOW_COLORS[agent.name] ?? agent.skin?.tint ?? '#5ce1ff';

    // Low-alpha pulse: 0.12-0.22, clipped to actual display interior
    const pulseAlpha = 0.17 + 0.05 * Math.sin(timeSec * 8 * Math.PI + (agent.bob ?? 0));
    const clampedAlpha = Math.max(0.12, Math.min(0.22, pulseAlpha));

    for (const rect of ws.displayAreas) {
      ctx.save();

      // Clip every effect to an actual painted display interior; do not replace the device.
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();

      // Low-alpha fill preserves the background's monitor pixels and bezels.
      ctx.fillStyle = roleColor;
      ctx.globalAlpha = clampedAlpha;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

      // Subtle typing indicator inside this real display.
      const lineCount = 4;
      const padX = rect.w * 0.1;
      const padY = rect.h * 0.15;
      const availH = rect.h - padY * 2;
      const lineStep = availH / (lineCount - 1 || 1);
      const lineFractions = [0.75, 0.55, 0.85, 0.45];

      ctx.fillStyle = roleColor;
      for (let i = 0; i < lineCount; i++) {
        const ly = rect.y + padY + i * lineStep;
        const lw = (rect.w - padX * 2) * lineFractions[i];
        const textAlpha =
          (0.3 + 0.15 * Math.sin(timeSec * 12 * Math.PI + i * 1.6)) * (clampedAlpha / 0.17);
        ctx.globalAlpha = Math.max(0.15, Math.min(0.6, textAlpha));
        ctx.fillRect(rect.x + padX, ly, lw, 2);
      }

      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * Pixel-level interface accents for the two original bridge consoles.
 *
 * The room background already contains the authored hardware and bezels. The
 * renderer therefore paints only inside the existing glass/panel interiors;
 * it never draws a replacement desk or a second frame on top of the room.
 * The palette follows the original `consoleNeon` tile: cyan glass, mint
 * diagnostics, amber alerts and violet navigation data.
 */
export function drawAlienConsoleEffects(
  ctx: CanvasRenderingContext2D,
  agents: StarshipAgent[],
  timeSec: number = Date.now() / 1000,
): void {
  const isWorkingAt = (name: DuctorRoleName) => {
    const agent = agents.find((candidate) => candidate.name === name);
    return Boolean(agent && isAgentWorkingAtAssignedStation(agent));
  };

  const drawScreen = (
    rect: DeviceBounds,
    accent: string,
    variant: 'command' | 'build',
    active: boolean,
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    const pulse = active ? 0.72 + Math.sin(timeSec * 3.2 + rect.x * 0.01) * 0.18 : 0.22;
    ctx.globalAlpha = 0.12 + pulse * 0.1;
    ctx.fillStyle = accent;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // Pixel scanline shimmer remains local to the original screen glass.
    ctx.globalAlpha = active ? 0.22 : 0.08;
    ctx.fillStyle = '#b0f6ff';
    const scan = ((timeSec * 8 + rect.y) % Math.max(1, rect.h + 8)) - 4;
    ctx.fillRect(rect.x, rect.y + scan, rect.w, 1);

    ctx.globalAlpha = active ? 0.7 : 0.28;
    ctx.fillStyle = variant === 'command' ? '#b0f6ff' : '#00ff99';
    const pad = Math.max(3, Math.round(Math.min(rect.w, rect.h) * 0.12));
    const lineH = Math.max(1, Math.floor(rect.h / 16));
    const lines = variant === 'command' ? 5 : 6;
    for (let row = 0; row < lines; row++) {
      const y = rect.y + pad + row * lineH * 2;
      const width = Math.max(2, rect.w * (0.28 + ((row * 17) % 51) / 100));
      ctx.fillRect(rect.x + pad, y, width, 1);
      if (row % 2 === 0) ctx.fillRect(rect.x + pad, y + 2, width * 0.35, 1);
    }

    // Alien navigation glyphs are block pixels, not a second vector panel.
    ctx.globalAlpha = active ? 0.8 : 0.32;
    const gx = rect.x + rect.w - pad - 5;
    const gy = rect.y + pad + 1;
    ctx.fillRect(gx, gy, 2, 2);
    ctx.fillRect(gx + 3, gy + 2, 2, 2);
    ctx.fillRect(gx, gy + 4, 5, 1);
    ctx.restore();
  };

  const alecActive = isWorkingAt('Alec');
  // Three original central displays: a tactical readout, a command core and
  // a route/status display. Their shells remain entirely from the background.
  for (const rect of WORKSTATIONS.Alec.displayAreas) {
    drawScreen(rect, '#00f0ff', 'command', alecActive);
  }

  const kevinActive = isWorkingAt('Kevin');
  // Kevin's two angled panels use the same neon tile language at a lower
  // intensity so the original slanted glass and buttons stay readable.
  for (const rect of WORKSTATIONS.Kevin.displayAreas) {
    drawScreen(rect, '#00ff99', 'build', kevinActive);
  }
}

export function drawWorkstationLabels(
  ctx: CanvasRenderingContext2D,
  agents?: StarshipAgent[],
  useRoomPanel = false,
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

    const lx = ws.displayBounds ? ws.displayBounds.x + ws.displayBounds.w / 2 : ws.approachPoint.x;
    const ly = useRoomPanel && ws.agentName === 'Kevin' ? 397 : ws.displayBounds ? ws.displayBounds.y - 12 : ws.approachPoint.y - 75;

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
  panX: number = 0,
  panY: number = 0,
  zoom: number = 1,
  alecHologramImg?: HTMLImageElement,
  walkImg?: HTMLImageElement,
  computerBayImg?: HTMLImageElement,
  alecSeatedImg?: HTMLImageElement,
  livingRoomImg?: HTMLImageElement,
  kevinStarMapImg?: HTMLImageElement,
  benjaminQAImg?: HTMLImageElement,
): { scale: number; offX: number; offY: number } {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const baseScale = getStageBaseScale(rect);
  const scale = baseScale * zoom;
  const drawW = CW * scale;
  const drawH = CH * scale;
  const offX = (rect.width - drawW) / 2 + panX;
  const offY = (rect.height - drawH) / 2 + panY;

  const livingArtwork = getLivingRoomArtwork(livingRoomImg);
  const background = livingArtwork ?? bgImg;
  const chairArtwork = livingArtwork ?? computerBayImg;
  // V2 scene uses the existing authored room as geometry, but the final
  // presentation is rebuilt with a cleaner contrast curve and dedicated
  // material/light passes. This keeps character routing and device anchors
  // stable while we progressively replace the old baked look.
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // The production artwork is already graded; preserve its highlight rolloff.
  ctx.filter = 'none';
  ctx.drawImage(background, offX, offY, drawW, drawH);
  ctx.restore();

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  if (livingArtwork) drawBridgeMaterialPass(ctx, timeSec);
  drawStarshipExterior(ctx, background, timeSec, !!livingArtwork, bgImg);
  if (!livingArtwork) drawPhotonicComputerBay(ctx, computerBayImg);
  const commander = agents.find((agent) => agent.name === 'Alec');
  const seated = !!commander && isAgentWorkingAtAssignedStation(commander);
  if (chairArtwork) {
    drawPhotonicActivity(ctx, seated ? commander!.commandTime ?? 0 : timeSec, seated);
  }
  // Keep QA telemetry, then apply the shared glass accents below the crew.
  const qaOperator = agents.find(isBenjaminUsingScanner);
  const qaActive = !!qaOperator;
  if (livingArtwork) drawLivingRoom(ctx, timeSec, {
    crew: agents.filter(a => a.reportedState !== 'offline' && a.state !== STATE.OFFLINE),
    command: seated, qa: qaActive,
    qaTime: qaOperator?.qaTime,
    navigation: agents.some(a => a.name === 'Kevin' && isKevinUsingStarMap(a)),
  }, livingArtwork);
  else drawWorkstationScreens(
    ctx,
    agents.filter((agent) => agent.name === 'Benjamin'),
    timeSec,
  );
  if (!livingArtwork && computerBayImg) drawPhotonicRoom(ctx, timeSec, qaActive);
  if (livingArtwork) drawBridgeLightPass(ctx, timeSec, {
    command: seated,
    navigation: agents.some(a => a.name === 'Kevin' && isKevinUsingStarMap(a)),
    qa: qaActive,
  });
  drawFloorMarkers(ctx, showStations);
  if (livingArtwork) drawHologramTopGlow(ctx, agents, timeSec);
  const mapOperator = agents.find((agent) => agent.name === 'Kevin');
  if (livingArtwork && mapOperator) drawKevinStarMapControl(ctx, mapOperator);

  const sorted = [...agents].sort((a, b) => a.y - b.y);
  for (const a of sorted) {
    if (a.name === 'Alec' && seated && chairArtwork && alecSeatedImg) {
      // Alec's source position is the floor interaction anchor, but the pose
      // itself is anchored in the centre chair. The chair lip is composited
      // afterward so his folded legs cannot float in front of the shell.
      const { x, feetY, height } = ALEC_SEAT;
      const commandTime = a.commandTime ?? 0;
      drawAuthoredWorkPose(
        ctx,
        a,
        alecSeatedImg,
        ALEC_SEATED_ATLAS,
        getCommandGesture(commandTime).frame,
        x,
        feetY,
        height,
        false,
      );
      ctx.save();
      drawAlecSeatBack(ctx, chairArtwork);
      drawCommandContact(ctx, commandTime);
      ctx.restore();
      drawAgentStatusBubble(ctx, a, height, -10, CW, { x, y: feetY });
      continue;
    }
    if (a.name === 'Kevin' && isKevinUsingStarMap(a) && kevinStarMapImg) {
      const bodyHeight = 78 * getDepthScale(a.y);
      drawAuthoredWorkPose(
        ctx,
        a,
        kevinStarMapImg,
        KEVIN_STARMAP_ATLAS,
        getKevinStarMapFrame(a.hologramTime ?? 0),
        a.x,
        a.y,
        bodyHeight,
      );
      // Keep the roster label beside the enlarged map rather than over its
      // star field or Kevin's raised hands.
      drawAgentStatusBubble(ctx, a, bodyHeight, -4, CW, { x: a.x - 92, y: a.y + 26 });
      continue;
    }
    if (a.name === 'Benjamin' && qaActive && benjaminQAImg) {
      const bodyHeight = 80 * getDepthScale(a.y);
      drawAuthoredWorkPose(
        ctx,
        a,
        benjaminQAImg,
        BENJAMIN_QA_ATLAS,
        a.animFrame,
        a.x,
        a.y,
        bodyHeight,
      );
      drawQAContact(ctx, a.qaTime ?? 0, a.x, a.y, getDepthScale(a.y), a.animFrame);
      drawAgentStatusBubble(ctx, a, bodyHeight, -4);
      continue;
    }
    drawAgent(ctx, a, sheetImg, timeSec, alecHologramImg, walkImg);
    if (livingArtwork && qaActive && a.name === 'Benjamin') {
      drawQAContact(ctx, a.qaTime ?? 0, a.x, a.y, getDepthScale(a.y), a.animFrame);
    }
  }

  // Foreground arcs wrap around Kevin's hands while preserving his intact sprite.
  if (livingArtwork && mapOperator) drawKevinStarMapControl(ctx, mapOperator, true);

  // Crew members stand in front of the consoles in this top-down room. Do not
  // repaint the background over their lower bodies: that made walking sprites
  // appear to lose their torso and legs during station transitions.

  drawWorkstationLabels(ctx, agents, !!livingArtwork);

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
