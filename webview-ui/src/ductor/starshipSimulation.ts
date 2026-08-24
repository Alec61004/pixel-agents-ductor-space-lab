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
import type { DuctorStatusSnapshot } from './ductorLabModel.js';

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

export const STATE = {
  MOVING: 'moving',
  WORKING: 'working',
  IDLE: 'idle',
} as const;

export type StarshipAgentState = (typeof STATE)[keyof typeof STATE];

export interface StarshipAgent {
  id: string;
  name: string;
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
    if (a.stationIndex != null && a.state !== STATE.IDLE) {
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
  const crewSpecs = [
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
    const { stationIndex, slot } = pickStation(agents, null);
    const station = STATIONS[stationIndex] ?? STATIONS[0];
    const x = station.x + slot.dx;
    const y = station.y + slot.dy;
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
      state: STATE.WORKING,
      stateTimer: 2 + Math.random() * 4,
      animFrame: 0,
      animTimer: 0,
      bob: Math.random() * Math.PI * 2,
      stationIndex,
      currentStation: station.label,
    });
  }
  return agents;
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
      a.state = STATE.WORKING;
      a.stateTimer = 3 + Math.random() * 5;
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
        a.animFrame = (a.animFrame + 1) % 4;
      }
    }
  } else if (a.state === STATE.WORKING) {
    a.stateTimer -= dt * speedMult;
    a.bob += dt * 4;
    a.animTimer += dt;
    if (a.animTimer > 0.5) {
      a.animTimer = 0;
      a.animFrame = (a.animFrame + 1) % 4;
    }
    if (a.stateTimer <= 0) {
      pickNewTarget(a, agents);
    }
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
    ctx.ellipse(a.x, a.y + 6, 30 + (1 - a.flash) * 14, 10 + (1 - a.flash) * 5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = STARSHIP_AMBER;
    ctx.globalAlpha = a.flash;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // status glow ring while working
  if (a.state === STATE.WORKING) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(a.x, a.y + 6, 20, 7, 0, 0, Math.PI * 2);
    ctx.strokeStyle = a.skin.tint;
    ctx.globalAlpha = 0.55 + Math.sin(a.bob * 1.3) * 0.2;
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
