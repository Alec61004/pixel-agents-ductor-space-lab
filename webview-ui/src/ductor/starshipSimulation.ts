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
  facing: number;
  state: StarshipAgentState;
  stateTimer: number;
  animFrame: number;
  animTimer: number;
  bob: number;
  stationIndex: number | null;
  currentStation: string;
  flash?: number;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

export function pickStation(
  agents: StarshipAgent[],
  excludeId: string | null,
): { stationIndex: number; slot: { dx: number; dy: number } } {
  const counts = new Array(STATIONS.length).fill(0);
  for (const a of agents) {
    if (a.id === excludeId) continue;
    if (a.stationIndex != null && a.state !== STATE.IDLE && a.state !== STATE.OFFLINE) {
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
  const { stationIndex, slot } = pickStation(agents, agent.id);
  const st = STATIONS[stationIndex] ?? STATIONS[0];
  agent.stationIndex = stationIndex;
  agent.targetX = st.x + slot.dx + (Math.random() * 10 - 5);
  agent.targetY = st.y + slot.dy + (Math.random() * 6 - 3);
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
      const pick = pickStation(agents, null);
      stationIndex = pick.stationIndex;
      const station = STATIONS[stationIndex] ?? STATIONS[0];
      x = station.x + pick.slot.dx;
      y = station.y + pick.slot.dy;
      currentStation = station.label;
      initialState = STATE.WORKING;
    }

    agents.push({
      id: spec.id,
      name: spec.name,
      role: spec.role,
      reportedState: roleSnapshot?.state,
      provenance: roleSnapshot?.provenance,
      skin: spec.skin,
      x,
      y,
      targetX: x,
      targetY: y,
      speed: 46 + Math.random() * 22,
      facing: Math.random() < 0.5 ? -1 : 1,
      state: initialState,
      stateTimer: 2 + Math.random() * 4,
      animFrame: 0,
      animTimer: 0,
      bob: Math.random() * Math.PI * 2,
      stationIndex,
      currentStation,
    });
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
      if (
        a.stationIndex === null ||
        (prevEffective !== 'working' && prevEffective !== 'review')
      ) {
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
      }
      a.animFrame = 0;
      if (pushLog) pushLog(`${a.name} arrived at ${a.currentStation}.`);
    } else {
      const step = a.speed * speedMult * dt;
      const nx = a.x + (dx / dist) * Math.min(step, dist);
      const ny = a.y + (dy / dist) * Math.min(step, dist);
      a.facing = dx >= 0 ? 1 : -1;
      a.x = nx;
      a.y = ny;
      a.animTimer += dt;
      if (a.animTimer > 0.12) {
        a.animTimer = 0;
        a.animFrame = (a.animFrame + 1) % 4; // 4-frame walk cycle
      }
    }
  } else if (a.state === STATE.WORKING) {
    a.stateTimer -= dt * speedMult;
    a.bob += dt * 4;
    a.animTimer += dt;
    if (a.animTimer > 0.5) {
      a.animTimer = 0;
      a.animFrame = (a.animFrame + 1) % 4; // idle turn cycle
    }
    if (a.stateTimer <= 0) {
      a.state = STATE.IDLE;
      a.stateTimer = 1.2 + Math.random() * 1.8;
      a.animFrame = 0;
    }
  } else if (a.state === STATE.IDLE) {
    a.stateTimer -= dt * speedMult;
    a.animTimer += dt;
    if (a.animTimer > 0.8) {
      a.animTimer = 0;
      a.animFrame = (a.animFrame + 1) % 4;
    }
    if (a.stateTimer <= 0) {
      pickNewTarget(a, agents);
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

  if (a.flash && a.flash > 0) {
    a.flash -= dt * 1.6;
    if (a.flash < 0) a.flash = 0;
  }
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
  const col = a.state === STATE.MOVING ? 4 + a.animFrame : 0 + a.animFrame;

  const sx = col * cw;
  const sy = row * ch;
  const drawH = 92;
  const drawW = drawH * (cw / ch);
  const bobY = a.state === STATE.WORKING ? Math.sin(a.bob) * 2 : 0;

  // shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(a.x, a.y + 6, drawW * 0.32, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = STARSHIP_AGENT_SHADOW;
  ctx.fill();
  ctx.restore();

  // sprite
  ctx.save();
  ctx.translate(a.x, a.y - drawH * 0.86 + bobY);
  if (a.facing === 1) {
    ctx.scale(-1, 1);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheetImg, sx, sy, cw, ch, -drawW / 2, 0, drawW, drawH);
  ctx.restore();

  // roster-selection flash ring
  if (a.flash && a.flash > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      a.x,
      a.y + 6,
      30 + (1 - a.flash) * 14,
      10 + (1 - a.flash) * 5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle = STARSHIP_AMBER;
    ctx.globalAlpha = (isOffline ? 0.35 : 1.0) * a.flash;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // status glow ring while working
  if (a.state === STATE.WORKING && !isOffline) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(a.x, a.y + 6, 20, 7, 0, 0, Math.PI * 2);
    ctx.strokeStyle = a.skin.tint;
    ctx.globalAlpha = 0.55 + Math.sin(a.bob * 1.3) * 0.2;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // attention glow ring when blocked
  if (
    (a.state === STATE.BLOCKED || a.reportedState === 'blocked') &&
    !isOffline
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(a.x, a.y + 6, 22, 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = STARSHIP_CRIMSON_TINT;
    ctx.globalAlpha = 0.7 + Math.sin(a.bob * 2) * 0.25;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // name tag
  ctx.save();
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = STARSHIP_NAME_TAG_FILL;
  ctx.fillText(a.name, a.x, a.y - drawH - 4 + bobY);
  ctx.restore();

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

  drawFloorMarkers(ctx, showStations);

  const sorted = [...agents].sort((a, b) => a.y - b.y);
  for (const a of sorted) {
    drawAgent(ctx, a, sheetImg);
  }

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
