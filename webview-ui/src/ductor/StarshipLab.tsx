import { useEffect, useRef, useState } from 'react';

import type { DuctorRoleName, DuctorStatusSnapshot } from './ductorLabModel.js';
import { ductorAssetUrl } from './ductorLabModel.js';
import {
  type AgentStatusBubble,
  applyCloudStatus,
  applySnapshotToAgents,
  ASSIGNED_WORKSTATIONS,
  type AssignedWorkstation,
  ATTENTION_POINTS,
  CH,
  clampPointToPolygon,
  clampPanToViewport,
  createInitialCrew,
  CW,
  DEPTH_SCALE_MAX,
  DEPTH_SCALE_MIN,
  type DeviceBounds,
  drawAgent,
  drawAgentStatusBubble,
  drawDeskCutouts,
  drawFloorMarkers,
  drawHologramTopGlow,
  drawStage,
  drawStarsLayer,
  drawWorkParticles,
  drawWorkstationLabels,
  drawWorkstationScreens,
  FLOOR_Y_MAX,
  FLOOR_Y_MIN,
  getAgentStatusBubble,
  getDepthScale,
  getStageBaseScale,
  IDLE_POINTS,
  isAgentAtStation,
  isPointInPolygon,
  makeAgent,
  OFFLINE_POINTS,
  pickNewTarget,
  pickStation,
  type Point2D,
  ROLE_GLOW_COLORS,
  ROLE_IDLE_SLOT_OFFSETS,
  ROLE_PARTICLE_ICONS,
  routeToPoint,
  seedStars,
  SHEET_COLS,
  SHEET_ROWS,
  SKINS,
  type Star,
  type StarshipAgent,
  type StarshipAgentState,
  STATE,
  STATION_SLOTS,
  STATIONS,
  updateAgent,
  WAITING_POINTS,
  WALKABLE_POLYGON,
  type WorkParticle,
  type WorkstationConfig,
  WORKSTATIONS,
} from './starshipSimulation.js';

export {
  type AgentStatusBubble,
  applyCloudStatus,
  applySnapshotToAgents,
  ASSIGNED_WORKSTATIONS,
  type AssignedWorkstation,
  ATTENTION_POINTS,
  clampPointToPolygon,
  clampPanToViewport,
  createInitialCrew,
  DEPTH_SCALE_MAX,
  DEPTH_SCALE_MIN,
  type DeviceBounds,
  drawAgent,
  drawAgentStatusBubble,
  drawDeskCutouts,
  drawFloorMarkers,
  drawHologramTopGlow,
  drawStage,
  drawStarsLayer,
  drawWorkParticles,
  drawWorkstationLabels,
  drawWorkstationScreens,
  FLOOR_Y_MAX,
  FLOOR_Y_MIN,
  getAgentStatusBubble,
  getDepthScale,
  getStageBaseScale,
  IDLE_POINTS,
  isAgentAtStation,
  isPointInPolygon,
  makeAgent,
  OFFLINE_POINTS,
  pickNewTarget,
  pickStation,
  type Point2D,
  ROLE_GLOW_COLORS,
  ROLE_IDLE_SLOT_OFFSETS,
  ROLE_PARTICLE_ICONS,
  routeToPoint,
  seedStars,
  SHEET_COLS,
  SHEET_ROWS,
  SKINS,
  type Star,
  type StarshipAgent,
  type StarshipAgentState,
  STATE,
  STATION_SLOTS,
  STATIONS,
  updateAgent,
  WAITING_POINTS,
  WALKABLE_POLYGON,
  type WorkParticle,
  type WorkstationConfig,
  WORKSTATIONS,
};

export interface StarshipLabProps {
  snapshot?: DuctorStatusSnapshot;
  bgUrl?: string;
  sheetUrl?: string;
}

const CANONICAL_ROLES: DuctorRoleName[] = ['Alec', 'Kevin', 'Benjamin'];

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

  const resolvedHologramUrl = ductorAssetUrl(
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : './',
    'themes/ductor-space-lab/alec-hologram.png',
  );
  const resolvedWalkUrl = ductorAssetUrl(
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : './',
    'themes/ductor-space-lab/crew-walk.png',
  );

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const starsCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const agentsRef = useRef<StarshipAgent[]>(createInitialCrew(snapshot));
  const [agentsList, setAgentsList] = useState<StarshipAgent[]>(agentsRef.current);
  const [loaded, setLoaded] = useState(false);
  const [speedMult, setSpeedMult] = useState(1);
  const [showStations, setShowStations] = useState(false);
  const [rosterCollapsed, setRosterCollapsed] = useState(false);
  const [logText, setLogText] = useState('Bridge systems online. Crew assigned to stations.');

  const speedMultRef = useRef(speedMult);
  speedMultRef.current = speedMult;

  const showStationsRef = useRef(showStations);
  showStationsRef.current = showStations;

  const lastTransformRef = useRef({ scale: 1, offX: 0, offY: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const touchStateRef = useRef<{ dist: number; zoom: number; panX: number; panY: number } | null>(
    null,
  );
  const logQueueRef = useRef<string[]>(['Bridge systems online. Crew assigned to stations.']);

  const pushLog = (msg: string) => {
    logQueueRef.current.push(msg);
    if (logQueueRef.current.length > 20) logQueueRef.current.shift();
    setLogText(msg);
  };

  useEffect(() => {
    applySnapshotToAgents(agentsRef.current, snapshot, pushLog);
    setAgentsList([...agentsRef.current]);
    if (snapshot) {
      if (snapshot.stale) {
        pushLog('Cloud heartbeat stale · holding in berth.');
      } else if (snapshot.publishedAt) {
        pushLog('Cloud telemetry synchronized.');
      } else {
        pushLog('Local bridge telemetry synchronized.');
      }
    }
  }, [snapshot]);

  const handleAgentClick = (agentId: string) => {
    const a = agentsRef.current.find((ag) => ag.id === agentId || ag.name === agentId);
    if (a) {
      a.flash = 2.5;
      const wrap = stageWrapRef.current;
      if (wrap) {
        const rect = wrap.getBoundingClientRect();
        const baseScale = getStageBaseScale(rect);
        const scale = baseScale * zoomRef.current;
        panRef.current = clampPanToViewport(
          {
            x: (CW / 2 - a.x) * scale,
            y: (CH / 2 - a.y) * scale,
          },
          rect,
          scale,
        );
      }
      pushLog(`Focus lock: ${a.name} [${a.currentStation || a.role}].`);
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
    const clamped = clampPointToPolygon({ x: px, y: py }, WALKABLE_POLYGON);
    routeToPoint(agentsRef.current, clamped.x, clamped.y, pushLog);
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
    const hologramImg = new Image();
    const walkImg = new Image();
    let loadedCount = 0;

    const onAssetLoaded = () => {
      loadedCount++;
      if (loadedCount === 3 && !disposed) {
        setLoaded(true);
      }
    };

    bgImg.onload = onAssetLoaded;
    sheetImg.onload = onAssetLoaded;
    bgImg.src = resolvedBgUrl;
    sheetImg.src = resolvedSheetUrl;
    // Optional: keep the original sheet fallback if this asset is unavailable.
    hologramImg.src = resolvedHologramUrl;
    walkImg.onload = onAssetLoaded;
    walkImg.src = resolvedWalkUrl;

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

    const wrap = stageWrapRef.current;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStateRef.current = {
          dist: 0,
          zoom: zoomRef.current,
          panX: e.touches[0].clientX - panRef.current.x,
          panY: e.touches[0].clientY - panRef.current.y,
        };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStateRef.current = {
          dist: Math.hypot(dx, dy),
          zoom: zoomRef.current,
          panX: panRef.current.x,
          panY: panRef.current.y,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && touchStateRef.current) {
        const nextPan = {
          x: e.touches[0].clientX - touchStateRef.current.panX,
          y: e.touches[0].clientY - touchStateRef.current.panY,
        };
        const rect = wrap?.getBoundingClientRect();
        if (rect) {
          const baseScale = getStageBaseScale(rect);
          panRef.current = clampPanToViewport(nextPan, rect, baseScale * zoomRef.current);
        }
      } else if (e.touches.length === 2 && touchStateRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / touchStateRef.current.dist;
        zoomRef.current = Math.max(0.5, Math.min(3, touchStateRef.current.zoom * ratio));
        const rect = wrap?.getBoundingClientRect();
        if (rect) {
          const baseScale = getStageBaseScale(rect);
          panRef.current = clampPanToViewport(
            { x: touchStateRef.current.panX, y: touchStateRef.current.panY },
            rect,
            baseScale * zoomRef.current,
          );
        }
      }
    };
    const onTouchEnd = () => {
      touchStateRef.current = null;
    };

    if (wrap) {
      wrap.addEventListener('touchstart', onTouchStart, { passive: false });
      wrap.addEventListener('touchmove', onTouchMove, { passive: false });
      wrap.addEventListener('touchend', onTouchEnd);
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      zoomRef.current = Math.max(0.5, Math.min(3, zoomRef.current + delta));
      const rect = wrap?.getBoundingClientRect();
      if (rect) {
        const baseScale = getStageBaseScale(rect);
        panRef.current = clampPanToViewport(panRef.current, rect, baseScale * zoomRef.current);
      }
    };
    if (wrap) {
      wrap.addEventListener('wheel', onWheel, { passive: false });
    }

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
            now / 1000,
            panRef.current.x,
            panRef.current.y,
            zoomRef.current,
            hologramImg.complete && hologramImg.naturalWidth > 0 ? hologramImg : undefined,
            walkImg.complete && walkImg.naturalWidth > 0 ? walkImg : undefined,
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
      if (wrap) {
        wrap.removeEventListener('touchstart', onTouchStart);
        wrap.removeEventListener('touchmove', onTouchMove);
        wrap.removeEventListener('touchend', onTouchEnd);
        wrap.removeEventListener('wheel', onWheel);
      }
      cancelAnimationFrame(animId);
    };
  }, [resolvedBgUrl, resolvedSheetUrl, resolvedHologramUrl, resolvedWalkUrl]);

  const isCloud = Boolean(snapshot?.publishedAt);
  const isStale = Boolean(snapshot?.stale);

  const onlineCount =
    snapshot && !snapshot.stale && snapshot.roles
      ? snapshot.roles.filter((r) => r.presence === 'online' && r.state !== 'offline').length
      : 0;

  const latestEvidence =
    snapshot?.publishedAt ??
    snapshot?.roles?.reduce<string | null>((acc, r) => {
      if (!r.updatedAt) return acc;
      if (!acc) return r.updatedAt;
      return new Date(r.updatedAt) > new Date(acc) ? r.updatedAt : acc;
    }, null);

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
        .starship-main { flex: 1 1 auto; position: relative; display: flex; min-height: 0; width: 100%; height: 100%; overflow: hidden; }
        .starship-stage-wrap { flex: 1 1 auto; position: relative; width: 100%; height: 100%; min-width: 0; background: #000; touch-action: none; }
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
          background: rgba(11,10,23,0.78); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          padding: 6px 12px; max-width: 60%; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          z-index: 8; pointer-events: auto;
        }
        .starship-log-tag { color: var(--amber); margin-right: 6px; }
        .starship-aside {
          position: absolute; top: 14px; right: 14px; width: 300px; max-height: calc(100% - 28px);
          background: rgba(20,15,38,0.82); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(110,231,255,0.08);
          display: flex; flex-direction: column; overflow: hidden; z-index: 10;
          transition: max-height .25s ease, width .25s ease, opacity .2s ease;
        }
        .starship-aside.collapsed {
          width: auto; min-width: 140px; max-height: 42px;
        }
        .starship-roster-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px; border: none; border-bottom: 1px solid var(--line); font-size: 10px;
          letter-spacing: 1.5px; color: var(--dim); text-transform: uppercase;
          cursor: pointer; user-select: none; background: transparent; width: 100%;
          font-family: inherit; text-align: left;
        }
        .starship-roster-head:focus-visible {
          outline: 2px solid var(--cyan);
          outline-offset: -2px;
        }
        .starship-aside.collapsed .starship-roster-head { border-bottom: none; }
        .starship-roster-toggle {
          background: rgba(255,255,255,0.04); border: 1px solid var(--line); color: var(--cyan);
          border-radius: 4px; font-size: 10px; padding: 2px 6px; pointer-events: none;
          display: inline-flex; align-items: center; justify-content: center; line-height: 1;
        }
        .starship-roster { flex: 1 1 auto; overflow-y: auto; padding: 8px; }
        .starship-card {
          display: flex; gap: 10px; align-items: center; padding: 9px 10px; margin-bottom: 6px;
          border: 1px solid var(--line); border-radius: 6px; background: rgba(255,255,255,0.02);
          transition: border-color .3s, background .3s, opacity .3s; cursor: pointer;
          width: 100%; text-align: left; font-family: inherit; color: inherit;
        }
        .starship-card:hover { background: rgba(255,255,255,0.05); border-color: var(--amber); }
        .starship-card.active { border-color: var(--cyan); }
        .starship-card.blocked { border-color: #ff5c5c; }
        .starship-card.offline { opacity: 0.55; }
        .starship-card:focus-visible {
          outline: 2px solid var(--cyan);
          outline-offset: 2px;
        }
        .starship-swatch {
          width: 34px; height: 34px; flex: 0 0 34px; border-radius: 6px;
          border: 1px solid var(--line); image-rendering: pixelated;
          background-color: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center;
        }
        .starship-meta { min-width: 0; flex: 1; }
        .starship-name { font-size: 11px; color: #fff; font-weight: 600; letter-spacing: .2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .starship-role { font-size: 9.5px; color: var(--dim); margin-top: 2px; }
        .starship-task { font-size: 9px; color: var(--text); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .starship-badge {
          font-size: 8.5px; padding: 2px 6px; border-radius: 10px; letter-spacing: .5px; white-space: nowrap; flex: 0 0 auto; text-transform: uppercase;
        }
        .starship-badge.working,
        .starship-badge.review { background: rgba(110,231,255,0.12); color: var(--cyan); border: 1px solid rgba(110,231,255,0.4); }
        .starship-badge.moving { background: rgba(185,139,255,0.12); color: var(--violet); border: 1px solid rgba(185,139,255,0.4); }
        .starship-badge.idle { background: rgba(255,207,110,0.1); color: var(--amber); border: 1px solid rgba(255,207,110,0.35); }
        .starship-badge.waiting { background: rgba(255,207,110,0.1); color: var(--amber); border: 1px solid rgba(255,207,110,0.35); }
        .starship-badge.blocked { background: rgba(255,92,92,0.15); color: #ff5c5c; border: 1px solid rgba(255,92,92,0.4); }
        .starship-badge.offline { background: rgba(122,114,163,0.12); color: var(--dim); border: 1px solid rgba(122,114,163,0.3); }
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
        .starship-btn:focus-visible {
          outline: 2px solid var(--cyan);
          outline-offset: 2px;
        }
        @media (max-width: 768px) {
          .starship-header {
            flex-wrap: wrap;
            gap: 8px;
            padding: 10px 14px;
          }
          .starship-header h1 { font-size: 11px; }
          .starship-stat { font-size: 9.5px; text-align: left; }
          .starship-aside { top: 8px; right: 8px; width: min(280px, calc(100vw - 16px)); max-width: calc(100vw - 16px); }
          .starship-footer { padding: 8px 12px; font-size: 9px; flex-wrap: wrap; gap: 8px; }
        }
        @media (max-width: 480px) {
          .starship-header {
            flex-direction: column;
            align-items: flex-start;
            padding: 8px 12px;
          }
          .starship-brand h1 { font-size: 10px; }
          .starship-aside { top: 6px; right: 6px; width: calc(100vw - 12px); max-width: calc(100vw - 12px); }
          .starship-log-banner { max-width: calc(100vw - 24px); left: 12px; bottom: 8px; font-size: 9px; }
          .starship-footer { font-size: 8.5px; padding: 6px 10px; }
        }
      `}</style>

      <header className="starship-header">
        <div>
          <div className="starship-brand">
            <div className="starship-dot" />
            <h1>STARSHIP AGENTS — v1.9</h1>
          </div>
          <div className="starship-subtitle">live crew deck · Ductor Space Lab</div>
        </div>
        <div className="starship-stat" role="status" aria-live="polite">
          {isCloud ? (
            <>
              HEARTBEAT: <b>REMOTE HEARTBEAT</b>
              <br />
              STATUS: <b>{isStale ? 'Cloud heartbeat stale · agents inactive' : 'Live'}</b>
              <br />
              SYNC:{' '}
              <time dateTime={snapshot?.publishedAt}>
                <b>{snapshot?.publishedAt ?? 'STANDBY'}</b>
              </time>
            </>
          ) : (
            <>
              SHIP: <b>ISV KESTREL-7</b>
              <br />
              SIGNAL: <b>{snapshot ? '127.0.0.1 · LIVE ENGINE' : 'LOCAL STANDBY'}</b>
              <br />
              {latestEvidence ? (
                <>
                  LAST EVIDENCE:{' '}
                  <time dateTime={latestEvidence}>
                    <b>{latestEvidence}</b>
                  </time>
                </>
              ) : (
                <>
                  STATUS: <b>{snapshot ? 'Live' : 'Standby'}</b>
                </>
              )}
            </>
          )}
          <br />
          CREW ONLINE: <b>{onlineCount}</b>
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
          <div className="starship-bubbles-layer" aria-hidden="true" style={{ display: 'none' }}>
            {agentsList.map((a) => {
              const bubble = getAgentStatusBubble(a);
              return (
                <div
                  key={a.id}
                  className="starship-agent-bubble"
                  data-agent-bubble={a.name}
                  style={{
                    borderColor: bubble.borderColor,
                    color: bubble.color,
                  }}
                >
                  {bubble.text}
                </div>
              );
            })}
          </div>
          <div id="log-banner" className="starship-log-banner">
            <span className="starship-log-tag">LOG</span>
            <span id="log-text">{logText}</span>
          </div>
          <div className={`starship-loading ${loaded ? 'hidden' : ''}`}>
            <div className="starship-spinner" />
            <div className="starship-ltext">LOADING DECK ASSETS…</div>
          </div>
        </div>

        <aside className={`starship-aside ${rosterCollapsed ? 'collapsed' : ''}`}>
          <button
            type="button"
            className="starship-roster-head"
            onClick={() => setRosterCollapsed((c) => !c)}
            aria-expanded={!rosterCollapsed}
            aria-controls="roster"
          >
            <span>Crew Roster</span>
            <span className="starship-roster-toggle" aria-hidden="true">
              {rosterCollapsed ? '▼' : '▲'}
            </span>
          </button>
          {!rosterCollapsed && (
            <>
              <div
                id="roster"
                className="starship-roster"
                role="list"
                aria-label="Ductor crew roster"
              >
                {CANONICAL_ROLES.map((roleName) => {
                  const a =
                    agentsList.find((ag) => ag.name === roleName) ??
                    agentsRef.current.find((ag) => ag.name === roleName);
                  const roleStatus = snapshot?.roles?.find((r) => r.name === roleName);

                  const isRoleOffline =
                    isStale ||
                    roleStatus?.presence === 'offline' ||
                    roleStatus?.state === 'offline' ||
                    (roleStatus === undefined && a?.state === STATE.OFFLINE);

                  const displayState = isRoleOffline
                    ? 'offline'
                    : (roleStatus?.state ??
                      a?.reportedState ??
                      (a?.state === STATE.MOVING
                        ? 'moving'
                        : a?.state === STATE.WORKING
                          ? 'working'
                          : a?.state === STATE.BLOCKED
                            ? 'blocked'
                            : 'idle'));

                  const badgeState = displayState;
                  const isWorking = badgeState === 'working' || badgeState === 'review';
                  const isBlocked = badgeState === 'blocked';
                  const isOffline = badgeState === 'offline';
                  const badgeText = badgeState.toUpperCase();

                  const provenance = isStale
                    ? 'stale-cloud-heartbeat'
                    : (roleStatus?.provenance ??
                      a?.provenance ??
                      (roleStatus?.derived
                        ? 'derived'
                        : roleStatus
                          ? 'operator-agent-reported'
                          : undefined));

                  const taskLabel = isRoleOffline
                    ? (roleStatus?.taskLabel ?? 'No active task')
                    : (roleStatus?.taskLabel ??
                      a?.reportedTaskLabel ??
                      (provenance
                        ? 'Presence detected · activity unobserved'
                        : 'No task reported'));

                  const duty =
                    roleName === 'Alec'
                      ? 'Planner / Architect'
                      : roleName === 'Kevin'
                        ? 'Builder / Implementer'
                        : 'Independent QA / Reviewer';

                  const skinName =
                    a?.skin?.name ??
                    (roleName === 'Alec'
                      ? 'Nebula Sentinel'
                      : roleName === 'Kevin'
                        ? 'Void Recon Unit'
                        : 'Crimson Hunter-Class');

                  const skinTint =
                    a?.skin?.tint ??
                    (roleName === 'Alec'
                      ? '#b98bff'
                      : roleName === 'Kevin'
                        ? '#6ee7ff'
                        : '#ff5c5c');

                  return (
                    <button
                      type="button"
                      key={a?.id ?? roleName}
                      className={`starship-card card ${isWorking ? 'active' : ''} ${isBlocked ? 'blocked' : ''} ${isOffline ? 'offline' : ''}`}
                      data-id={a?.id ?? roleName}
                      data-ductor-agent={roleName}
                      data-state={displayState}
                      role="listitem"
                      aria-label={`${roleName}, ${duty}, ${displayState}`}
                      onClick={() => {
                        handleAgentClick(a?.id ?? roleName);
                      }}
                    >
                      <div
                        className="starship-swatch swatch"
                        style={{
                          borderLeft: `3px solid ${skinTint}`,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: skinTint,
                            boxShadow: `0 0 6px ${skinTint}`,
                          }}
                        />
                      </div>
                      <div className="starship-meta meta">
                        <div className="starship-name name">{roleName}</div>
                        <div className="starship-role role">
                          {duty} · {skinName}
                          {provenance ? ` · ${provenance.replaceAll('-', ' ')}` : ''}
                        </div>
                        <div className="starship-task">{taskLabel}</div>
                      </div>
                      <div className={`starship-badge badge ${badgeState.toLowerCase()}`}>
                        {badgeText}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="starship-roster-foot">
                Click a station on the deck to <b>summon</b> the nearest free agent.
                <br />
                Signals marked derived are presence-based; no message, prompt, or token is read.
              </div>
            </>
          )}
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
