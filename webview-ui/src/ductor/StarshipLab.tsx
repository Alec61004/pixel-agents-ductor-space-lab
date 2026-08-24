import { useEffect, useRef, useState } from 'react';

import type { DuctorStatusSnapshot } from './ductorLabModel.js';
import { ductorAssetUrl } from './ductorLabModel.js';

export const SHEET_COLS = 16;
export const SHEET_ROWS = 8;
export const CW = 1600;
export const CH = 678;

export const SKINS = [
  { row: 0, name: 'Crimson Hunter-Class', tint: '#ff5c5c' },
  { row: 1, name: 'Crimson Hunter-Class Mk2', tint: '#ff5c5c' },
  { row: 2, name: 'Void Recon Unit', tint: '#5ce1ff' },
  { row: 3, name: 'Void Recon Unit Mk2', tint: '#5ce1ff' },
  { row: 4, name: 'Nebula Sentinel', tint: '#c98bff' },
  { row: 5, name: 'Nebula Sentinel Mk2', tint: '#c98bff' },
  { row: 6, name: 'Shadow Deckhand', tint: '#6fae7a' },
  { row: 7, name: 'Shadow Deckhand Mk2', tint: '#6fae7a' },
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

export interface StarshipLabProps {
  snapshot?: DuctorStatusSnapshot;
  bgUrl?: string;
  sheetUrl?: string;
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
      pickNewTarget(a, agents);
    }
  }
  if (a.flash && a.flash > 0) {
    a.flash -= dt * 1.6;
    if (a.flash < 0) a.flash = 0;
  }
}

function drawFloorMarkers(ctx: CanvasRenderingContext2D, showStations: boolean): void {
  if (!showStations) return;
  ctx.save();
  for (const st of STATIONS) {
    ctx.beginPath();
    ctx.ellipse(st.x, st.y + 6, 26, 9, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(110,231,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(110,231,255,0.85)';
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(st.label, st.x, st.y - 14);
  }
  ctx.restore();
}

function drawAgent(
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
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
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
    ctx.strokeStyle = '#ffcf6e';
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
  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(217,211,240,0.9)';
  ctx.fillText(a.name, a.x, a.y - drawH - 4 + bobY);
  ctx.restore();
}

function drawStage(
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

function drawStarsLayer(
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
    starsCtx.fillStyle = `rgba(220,230,255,${0.15 + tw * 0.55})`;
    starsCtx.fill();
  }
}

function seedStars(rect: { width: number; height: number }): Star[] {
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

const LOG_MESSAGES = [
  'diagnostics nominal.',
  'scanning adjacent sector.',
  'recalibrating sensor array.',
  'compiling xenobiology report.',
  'holding position, awaiting orders.',
  'syncing with ops terminal.',
  'running reactor watch cycle.',
  'cataloguing specimen data.',
  'plotting nav vector.',
  'relaying comms burst.',
];

export function StarshipLab({ snapshot, bgUrl, sheetUrl }: StarshipLabProps) {
  const resolvedBgUrl =
    bgUrl ??
    ductorAssetUrl(
      typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
        ? import.meta.env.BASE_URL
        : './',
      'themes/ductor-space-lab/starship-bg.png',
    );
  const resolvedSheetUrl =
    sheetUrl ??
    ductorAssetUrl(
      typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
        ? import.meta.env.BASE_URL
        : './',
      'themes/ductor-space-lab/starship-sheet.png',
    );

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const starsCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const agentsRef = useRef<StarshipAgent[]>(createInitialCrew(snapshot));
  const [agentsList, setAgentsList] = useState<StarshipAgent[]>(agentsRef.current);
  const [loaded, setLoaded] = useState(false);
  const [speedMult, setSpeedMult] = useState(1);
  const [showStations, setShowStations] = useState(false);
  const [logText, setLogText] = useState('Bridge systems online. Crew dispersed to stations.');

  const speedMultRef = useRef(speedMult);
  speedMultRef.current = speedMult;

  const showStationsRef = useRef(showStations);
  showStationsRef.current = showStations;

  const lastTransformRef = useRef({ scale: 1, offX: 0, offY: 0 });
  const logQueueRef = useRef<string[]>(['Bridge systems online. Crew dispersed to stations.']);

  const pushLog = (msg: string) => {
    logQueueRef.current.push(msg);
    if (logQueueRef.current.length > 40) logQueueRef.current.shift();
    setLogText(msg);
  };

  const handleAgentClick = (agentId: string) => {
    const a = agentsRef.current.find((ag) => ag.id === agentId);
    if (a) {
      a.flash = 1.0;
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = stageCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { scale, offX, offY } = lastTransformRef.current;
    const px = (mx - offX) / (scale || 1);
    const py = (my - offY) / (scale || 1);
    routeToPoint(agentsRef.current, px, py, pushLog);
  };

  const handleSpeedToggle = () => {
    setSpeedMult((prev) => (prev === 1 ? 2.5 : prev === 2.5 ? 0.4 : 1));
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') return;

    let animId: number;
    let disposed = false;
    const bgImg = new Image();
    const sheetImg = new Image();
    let loadedCount = 0;

    const onAssetLoaded = () => {
      loadedCount++;
      if (loadedCount === 2 && !disposed) {
        setLoaded(true);
      }
    };

    bgImg.onload = onAssetLoaded;
    sheetImg.onload = onAssetLoaded;
    bgImg.src = resolvedBgUrl;
    sheetImg.src = resolvedSheetUrl;

    let stars: Star[] = [];
    let starTime = 0;
    let lastTime = performance.now();
    let lastRosterUpdate = 0;

    const resize = () => {
      const wrap = stageWrapRef.current;
      const stage = stageCanvasRef.current;
      const starsCanvas = starsCanvasRef.current;
      if (!wrap || !stage || !starsCanvas) return;
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      stage.width = rect.width * dpr;
      stage.height = rect.height * dpr;
      stage.style.width = `${rect.width}px`;
      stage.style.height = `${rect.height}px`;

      starsCanvas.width = rect.width * dpr;
      starsCanvas.height = rect.height * dpr;
      starsCanvas.style.width = `${rect.width}px`;
      starsCanvas.style.height = `${rect.height}px`;

      stars = seedStars(rect);
    };

    resize();
    window.addEventListener('resize', resize);

    const logInterval = setInterval(() => {
      if (disposed) return;
      if (logQueueRef.current.length <= 1) {
        const ags = agentsRef.current;
        const randomAgent = ags[Math.floor(Math.random() * ags.length)];
        const randomMsg = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
        if (randomAgent && randomMsg) {
          pushLog(`${randomAgent.name}: ${randomMsg}`);
        }
      } else {
        const nextMsg = logQueueRef.current[Math.floor(Math.random() * logQueueRef.current.length)];
        if (nextMsg) setLogText(nextMsg);
      }
    }, 2800);

    const loop = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const currentAgents = agentsRef.current;
      for (const a of currentAgents) {
        updateAgent(a, dt, speedMultRef.current, currentAgents, pushLog);
      }

      const wrap = stageWrapRef.current;
      const stage = stageCanvasRef.current;
      const starsCanvas = starsCanvasRef.current;

      if (wrap && stage && loadedCount >= 2) {
        const ctx = stage.getContext('2d');
        if (ctx) {
          const rect = wrap.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          lastTransformRef.current = drawStage(
            ctx,
            bgImg,
            sheetImg,
            currentAgents,
            showStationsRef.current,
            rect,
            dpr,
          );
        }
      }

      if (wrap && starsCanvas) {
        const starsCtx = starsCanvas.getContext('2d');
        if (starsCtx) {
          starTime += dt;
          const rect = wrap.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          drawStarsLayer(starsCtx, stars, starTime, rect, dpr);
        }
      }

      if (now - lastRosterUpdate > 150) {
        lastRosterUpdate = now;
        setAgentsList([...currentAgents]);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
      clearInterval(logInterval);
    };
  }, [resolvedBgUrl, resolvedSheetUrl]);

  const isCloud = Boolean(snapshot?.publishedAt);

  return (
    <div
      className="starship-lab"
      data-ductor-engine-surface="true"
      data-starship-lab="true"
      aria-label="Ductor Space Lab agent monitor"
    >
      <style>{`
        .starship-lab {
          --void: #0b0a17;
          --hull: #171226;
          --panel: #1c1533;
          --line: #332a52;
          --cyan: #6ee7ff;
          --violet: #b98bff;
          --magenta: #ff6ec7;
          --amber: #ffcf6e;
          --text: #d9d3f0;
          --dim: #7a72a3;
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          box-sizing: border-box;
          background:
            radial-gradient(ellipse at 20% -10%, rgba(185,139,255,0.18), transparent 55%),
            radial-gradient(ellipse at 90% 0%, rgba(110,231,255,0.12), transparent 50%),
            var(--void);
          color: var(--text);
          font-family: 'JetBrains Mono', monospace;
          overflow: hidden;
        }
        .starship-lab * { box-sizing: border-box; }
        .starship-header {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 22px;
          border-bottom: 1px solid var(--line);
          background: linear-gradient(180deg, rgba(28,21,51,0.9), rgba(11,10,23,0.6));
        }
        .starship-brand { display: flex; align-items: center; gap: 12px; }
        .starship-dot {
          width: 9px; height: 9px; border-radius: 50%; background: var(--cyan);
          box-shadow: 0 0 10px var(--cyan); animation: starship-pulse 2.2s ease-in-out infinite;
        }
        @keyframes starship-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .starship-header h1 {
          font-family: 'Press Start 2P', monospace; font-size: 13px; letter-spacing: 1px;
          margin: 0; color: #fff; text-shadow: 0 0 14px rgba(110,231,255,0.5);
        }
        .starship-subtitle { font-size: 11px; color: var(--dim); margin-top: 4px; letter-spacing: .5px; }
        .starship-stat { font-size: 10px; color: var(--dim); text-align: right; line-height: 1.6; }
        .starship-stat b { color: var(--cyan); font-weight: 600; }
        .starship-main { flex: 1 1 auto; display: flex; min-height: 0; }
        .starship-stage-wrap { flex: 1 1 auto; position: relative; min-width: 0; background: #000; }
        .starship-stage {
          display: block; width: 100%; height: 100%;
          image-rendering: pixelated; cursor: crosshair;
        }
        .starship-scanline {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px);
          mix-blend-mode: overlay; opacity: .35;
        }
        .starship-vignette {
          position: absolute; inset: 0; pointer-events: none;
          box-shadow: inset 0 0 140px 40px rgba(0,0,0,0.65);
        }
        .starship-starfield { position: absolute; inset: 0; pointer-events: none; }
        .starship-loading {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          flex-direction: column; gap: 10px; background: var(--void); z-index: 5;
          transition: opacity .5s ease;
        }
        .starship-loading.hidden { opacity: 0; pointer-events: none; }
        .starship-spinner {
          width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--line);
          border-top-color: var(--cyan); animation: starship-spin 0.9s linear infinite;
        }
        @keyframes starship-spin { to { transform: rotate(360deg); } }
        .starship-ltext { font-size: 10px; color: var(--dim); letter-spacing: 1px; }
        .starship-log-banner {
          position: absolute; left: 14px; bottom: 14px; font-size: 10.5px; color: var(--cyan);
          background: rgba(11,10,23,0.72); border: 1px solid var(--line); padding: 6px 10px;
          max-width: 60%; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .starship-log-tag { color: var(--amber); margin-right: 6px; }
        .starship-aside {
          flex: 0 0 300px; max-width: 300px; border-left: 1px solid var(--line);
          background: linear-gradient(180deg, rgba(28,21,51,0.85), rgba(11,10,23,0.9));
          display: flex; flex-direction: column; overflow: hidden;
        }
        .starship-roster-head {
          padding: 14px 16px 10px; border-bottom: 1px solid var(--line); font-size: 10px;
          letter-spacing: 1.5px; color: var(--dim); text-transform: uppercase;
        }
        .starship-roster { flex: 1 1 auto; overflow-y: auto; padding: 8px; }
        .starship-card {
          display: flex; gap: 10px; align-items: center; padding: 9px 10px; margin-bottom: 6px;
          border: 1px solid var(--line); border-radius: 6px; background: rgba(255,255,255,0.02);
          transition: border-color .3s, background .3s; cursor: pointer;
        }
        .starship-card:hover { background: rgba(255,255,255,0.05); border-color: var(--amber); }
        .starship-card.active { border-color: var(--cyan); }
        .starship-swatch {
          width: 34px; height: 34px; flex: 0 0 34px; border-radius: 6px;
          border: 1px solid var(--line); image-rendering: pixelated;
          background-color: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center;
        }
        .starship-meta { min-width: 0; flex: 1; }
        .starship-name { font-size: 11px; color: #fff; font-weight: 600; letter-spacing: .2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .starship-role { font-size: 9.5px; color: var(--dim); margin-top: 2px; }
        .starship-badge {
          font-size: 8.5px; padding: 2px 6px; border-radius: 10px; letter-spacing: .5px; white-space: nowrap; flex: 0 0 auto;
        }
        .starship-badge.working { background: rgba(110,231,255,0.12); color: var(--cyan); border: 1px solid rgba(110,231,255,0.4); }
        .starship-badge.moving { background: rgba(185,139,255,0.12); color: var(--violet); border: 1px solid rgba(185,139,255,0.4); }
        .starship-badge.idle { background: rgba(255,207,110,0.1); color: var(--amber); border: 1px solid rgba(255,207,110,0.35); }
        .starship-roster-foot {
          padding: 10px 14px; border-top: 1px solid var(--line); font-size: 9px; color: var(--dim); line-height: 1.6;
        }
        .starship-roster-foot b { color: var(--text); }
        .starship-footer {
          flex: 0 0 auto; display: flex; align-items: center; gap: 14px; padding: 10px 18px;
          border-top: 1px solid var(--line); background: rgba(11,10,23,0.85); font-size: 10px; color: var(--dim);
        }
        .starship-btn {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .5px;
          background: var(--panel); border: 1px solid var(--line); color: var(--text);
          padding: 6px 12px; border-radius: 5px; cursor: pointer;
        }
        .starship-btn:hover { border-color: var(--cyan); color: #fff; }
        .starship-btn.active { border-color: var(--magenta); color: var(--magenta); }
        @media (max-width: 760px) {
          .starship-aside { display: none; }
          .starship-header h1 { font-size: 10px; }
        }
      `}</style>

      <header className="starship-header">
        <div>
          <div className="starship-brand">
            <div className="starship-dot" />
            <h1>STARSHIP AGENTS</h1>
          </div>
          <div className="starship-subtitle">live crew deck · Ductor Space Lab</div>
        </div>
        <div className="starship-stat">
          {isCloud ? (
            <>
              HEARTBEAT: <b>REMOTE HEARTBEAT</b>
              <br />
              STATUS: <b>{snapshot?.stale ? 'Cloud heartbeat stale · agents inactive' : 'Live'}</b>
            </>
          ) : (
            <>
              SHIP: <b>ISV KESTREL-7</b>
              <br />
              SIGNAL: <b>127.0.0.1 · LIVE ENGINE</b>
            </>
          )}
          <br />
          CREW ONLINE: <b>{agentsList.length}</b>
        </div>
      </header>

      <main className="starship-main">
        <div id="stage-wrap" ref={stageWrapRef} className="starship-stage-wrap">
          <canvas
            id="stage"
            ref={stageCanvasRef}
            className="starship-stage"
            onClick={handleCanvasClick}
          />
          <canvas id="stars" ref={starsCanvasRef} className="starship-starfield" />
          <div className="starship-scanline" />
          <div className="starship-vignette" />
          <div id="log-banner" className="starship-log-banner">
            <span className="starship-log-tag">LOG</span>
            <span id="log-text">{logText}</span>
          </div>
          <div className={`starship-loading ${loaded ? 'hidden' : ''}`}>
            <div className="starship-spinner" />
            <div className="starship-ltext">LOADING DECK ASSETS…</div>
          </div>
        </div>

        <aside className="starship-aside">
          <div className="starship-roster-head">Crew Roster</div>
          <div id="roster" className="starship-roster" role="list" aria-label="Ductor crew roster">
            {agentsList.map((a) => {
              const displayState = a.reportedState ?? a.state;
              return (
                <article
                  key={a.id}
                  className={`starship-card card ${a.state === STATE.WORKING ? 'active' : ''}`}
                  data-id={a.id}
                  data-ductor-agent={a.name}
                  role="listitem"
                  aria-label={`${a.name}, ${a.role}, ${displayState}`}
                  onClick={() => handleAgentClick(a.id)}
                >
                  <div
                    className="starship-swatch swatch"
                    style={{
                      borderLeft: `3px solid ${a.skin.tint}`,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: a.skin.tint,
                        boxShadow: `0 0 6px ${a.skin.tint}`,
                      }}
                    />
                  </div>
                  <div className="starship-meta meta">
                    <div className="starship-name name">{a.name}</div>
                    <div className="starship-role role">
                      {a.role} · {a.skin.name}
                      {a.provenance ? ` · ${a.provenance.replaceAll('-', ' ')}` : ''}
                    </div>
                  </div>
                  <div className={`starship-badge badge ${a.state}`}>
                    {a.state === STATE.MOVING
                      ? 'MOVING'
                      : a.state === STATE.WORKING
                        ? 'WORKING'
                        : 'IDLE'}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="starship-roster-foot">
            Click a station on the deck to <b>summon</b> the nearest free agent.
            <br />
            Signals marked derived are presence-based; no message, prompt, or token is read.
          </div>
        </aside>
      </main>

      <footer className="starship-footer">
        <button
          type="button"
          id="btn-speed"
          className={`starship-btn ${speedMult !== 1 ? 'active' : ''}`}
          onClick={handleSpeedToggle}
        >
          Speed: <span id="speed-label">{speedMult}x</span>
        </button>
        <button
          type="button"
          id="btn-grid"
          className={`starship-btn ${showStations ? 'active' : ''}`}
          onClick={() => setShowStations((v) => !v)}
        >
          Toggle station markers
        </button>
        <span style={{ marginLeft: 'auto' }}>
          deck plan is illustrative — click anywhere to route the nearest agent there
        </span>
      </footer>
    </div>
  );
}
