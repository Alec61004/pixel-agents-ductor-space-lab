import { useCallback, useEffect, useRef, useState } from 'react';

import type { DuctorRoleName, DuctorStatusSnapshot } from './ductorLabModel.js';
import { ductorAssetUrl } from './ductorLabModel.js';
import { AgentObservationPanel } from './AgentObservationPanel.js';
import { HtmlLayerScene } from './HtmlLayerScene.js';
import { getObservationStationAt } from './agentObservation.js';
import { loadStarshipImage } from './starshipImageLoader.js';
import {
  ALEC_SEATED_ASSET,
  ALEC_SEATED_ATLAS,
  BENJAMIN_QA_ASSET,
  BENJAMIN_QA_ATLAS,
  KEVIN_STARMAP_ASSET,
  KEVIN_STARMAP_ATLAS,
} from './starshipComputerBay.js';
import { PHOTONIC_CSS_VARS } from './starshipPhotonicTheme.js';
import { LIVING_ROOM_ASSET } from './starshipLivingRoom.js';
import { getStarshipSceneHotspotAt } from './starshipSceneLayout.js';
import {
  loadStarshipPixelScene,
  PIXEL_SCENE_MANIFEST,
  type StarshipPixelScene,
} from './starshipPixelScene.js';
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
  isAgentWorkingAtAssignedStation,
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
  isAgentWorkingAtAssignedStation,
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

  const resolvedWalkUrl = ductorAssetUrl(
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : './',
    'themes/ductor-space-lab/crew-walk.png?v=2',
  );

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const starsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const htmlSceneRef = useRef<HTMLDivElement | null>(null);
  const rosterRef = useRef<HTMLElement | null>(null);

  const agentsRef = useRef<StarshipAgent[]>(createInitialCrew(snapshot));
  const [agentsList, setAgentsList] = useState<StarshipAgent[]>(agentsRef.current);
  const [loaded, setLoaded] = useState(false);
  const [htmlSceneReady, setHtmlSceneReady] = useState(false);
  const [speedMult, setSpeedMult] = useState(1);
  const [showStations, setShowStations] = useState(false);
  const [rosterCollapsed, setRosterCollapsed] = useState(true);
  const [observedRole, setObservedRole] = useState<DuctorRoleName | null>(null);
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

  const onHtmlSceneReady = useCallback(() => setHtmlSceneReady(true), []);
  const onHtmlSceneError = useCallback((error: unknown) => {
    console.error('[Space Lab] V7 HTML scene failed; retaining canvas fallback.', error);
    setHtmlSceneReady(false);
  }, []);


  const pushLog = (msg: string) => {
    logQueueRef.current.push(msg);
    if (logQueueRef.current.length > 20) logQueueRef.current.shift();
    setLogText(msg);
  };

  useEffect(() => {
    const closeRoster = (event: PointerEvent) => {
      if (!rosterRef.current?.contains(event.target as Node)) setRosterCollapsed(true);
    };
    const closeRosterWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRosterCollapsed(true);
    };
    document.addEventListener('pointerdown', closeRoster);
    document.addEventListener('keydown', closeRosterWithKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeRoster);
      document.removeEventListener('keydown', closeRosterWithKeyboard);
    };
  }, []);

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
      setObservedRole(a.name);
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
    const observationStation = getObservationStationAt({ x: px, y: py });
    if (observationStation) {
      setObservedRole(observationStation.role);
      setRosterCollapsed(true);
      pushLog(`Observation opened: ${observationStation.label}.`);
      return;
    }
    const hotspot = getStarshipSceneHotspotAt({ x: px, y: py });
    if (hotspot) {
      pushLog(hotspot.statusLabel);
      return;
    }
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
    const walkImg = new Image();
    const alecSeatedImg = new Image();
    const livingRoomImg = new Image();
    const kevinStarMapImg = new Image();
    const benjaminQAImg = new Image();
    let sceneReady = false;
    let walkReady = false;
    let alecSeatedReady = false;
    let livingRoomReady = false;
    let kevinStarMapReady = false;
    let benjaminQAReady = false;
    let pixelScene: StarshipPixelScene | undefined;
    let pixelSceneReady = false;
    setLoaded(false);
    void loadStarshipPixelScene(
      ductorAssetUrl(import.meta.env?.BASE_URL ?? './', PIXEL_SCENE_MANIFEST),
    ).then((scene) => {
      if (!disposed) {
        pixelScene = scene;
        pixelSceneReady = Boolean(scene);
      }
    }).catch((error: unknown) => {
      if (!disposed) {
        console.error('[Space Lab] Pixel scene failed; showing static fallback.', error);
        pushLog('Scene layers failed to load · static fallback active.');
      }
    });
    void loadStarshipImage(livingRoomImg, ductorAssetUrl(import.meta.env?.BASE_URL ?? './', LIVING_ROOM_ASSET)).then((ready) => {
      if (!disposed) livingRoomReady = ready;
    });
    void loadStarshipImage(alecSeatedImg, ductorAssetUrl(import.meta.env?.BASE_URL ?? './', ALEC_SEATED_ASSET), ALEC_SEATED_ATLAS).then((ready) => {
      if (!disposed) alecSeatedReady = ready;
    });
    void loadStarshipImage(
      kevinStarMapImg,
      ductorAssetUrl(import.meta.env?.BASE_URL ?? './', KEVIN_STARMAP_ASSET),
      KEVIN_STARMAP_ATLAS,
    ).then((ready) => {
      if (!disposed) kevinStarMapReady = ready;
    });
    void loadStarshipImage(
      benjaminQAImg,
      ductorAssetUrl(import.meta.env?.BASE_URL ?? './', BENJAMIN_QA_ASSET),
      BENJAMIN_QA_ATLAS,
    ).then((ready) => {
      if (!disposed) benjaminQAReady = ready;
    });

    // Only the background and original sheet are required. Optional sprite
    // failures must neither block the scene nor replace a complete character.
    void Promise.all([
      loadStarshipImage(bgImg, resolvedBgUrl),
      loadStarshipImage(sheetImg, resolvedSheetUrl),
    ]).then(([backgroundReady, sheetReady]) => {
      if (disposed) return;
      sceneReady = backgroundReady && sheetReady;
      setLoaded(sceneReady);
    });
    void loadStarshipImage(walkImg, resolvedWalkUrl, { width: 960, height: 336 }).then(
      (ready) => {
        if (!disposed) walkReady = ready;
      },
    );

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

    const wrap = stageWrapRef.current;
    resize();
    window.addEventListener('resize', resize);
    const stageResizeObserver =
      typeof ResizeObserver !== 'undefined' && wrap
        ? new ResizeObserver(() => resize())
        : null;
    if (stageResizeObserver && wrap) stageResizeObserver.observe(wrap);

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

      if (wrap && stage && sceneReady) {
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
            undefined,
            walkReady ? walkImg : undefined,
            alecSeatedReady ? alecSeatedImg : undefined,
            livingRoomReady ? livingRoomImg : undefined,
            kevinStarMapReady ? kevinStarMapImg : undefined,
            benjaminQAReady ? benjaminQAImg : undefined,
            pixelSceneReady ? pixelScene : undefined,
            htmlSceneReady,
          );
          if (htmlSceneReady && htmlSceneRef.current) {
            const { scale, offX, offY } = lastTransformRef.current;
            htmlSceneRef.current.style.transform = `matrix(${scale * CW / 1926}, 0, 0, ${scale * CH / 816}, ${offX}, ${offY})`;
          }
        }
      }

      if (wrap && starsCanvas) {
        const starsCtx = starsCanvas.getContext('2d');
        if (starsCtx) {
          const rect = wrap.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          if (livingRoomReady || pixelSceneReady) {
            // Room V3 and the exterior pass already contain window stars. The
            // old full-screen layer placed duplicate stars on hull and floor.
            starsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            starsCtx.clearRect(0, 0, rect.width, rect.height);
          } else {
            starTime += dt;
            drawStarsLayer(starsCtx, stars, starTime, rect, dpr);
          }
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
      stageResizeObserver?.disconnect();
      if (wrap) {
        wrap.removeEventListener('touchstart', onTouchStart);
        wrap.removeEventListener('touchmove', onTouchMove);
        wrap.removeEventListener('touchend', onTouchEnd);
        wrap.removeEventListener('wheel', onWheel);
      }
      cancelAnimationFrame(animId);
    };
  }, [htmlSceneReady, resolvedBgUrl, resolvedSheetUrl, resolvedWalkUrl]);

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

  const syncLabel = latestEvidence
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(latestEvidence))
    : 'STANDBY';

  return (
    <div
      className="starship-lab"
      data-ductor-engine-surface="true"
      data-starship-lab="true"
      aria-label="Ductor Space Lab agent monitor"
    >
      <style>{`
        .starship-lab {
          ${PHOTONIC_CSS_VARS}
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          box-sizing: border-box;
          background:
            radial-gradient(ellipse at 20% -10%, rgba(99,217,242,0.08), transparent 55%),
            radial-gradient(ellipse at 90% 0%, rgba(99,217,242,0.035), transparent 50%),
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
          min-height: 58px;
          padding: 9px 18px;
          border-bottom: 1px solid var(--line);
          background: linear-gradient(180deg, var(--panel), var(--void));
          box-shadow: inset 0 -1px rgba(119,245,229,.1);
        }
        .starship-brand { display: flex; align-items: center; gap: 10px; }
        .starship-dot {
          width: 9px; height: 9px; border-radius: 2px; transform: rotate(45deg); background: var(--cyan);
          box-shadow: 0 0 10px var(--cyan); animation: starship-pulse 2.2s ease-in-out infinite;
        }
        @keyframes starship-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .starship-header h1 {
          font-family: 'Press Start 2P', monospace; font-size: 13px; letter-spacing: 1px;
          margin: 0; color: #fff; text-shadow: 0 0 10px rgba(99,217,242,0.22);
        }
        .starship-subtitle { font-size: 10px; color: var(--dim); margin-top: 3px; letter-spacing: .5px; }
        .starship-stat { display: flex; align-items: stretch; gap: 6px; font-size: 9px; color: var(--dim); text-align: left; }
        .starship-stat-cell {
          min-width: 88px; padding: 5px 8px; border: 1px solid rgba(144,174,185,.2);
          border-radius: 5px; background: rgba(4,21,29,.55); line-height: 1.35;
        }
        .starship-stat-label { display: block; margin-bottom: 2px; font-size: 7.5px; letter-spacing: .8px; color: var(--dim); }
        .starship-stat b { color: var(--cyan); font-weight: 600; }
        .starship-main { flex: 1 1 auto; position: relative; display: flex; min-height: 0; width: 100%; height: 100%; overflow: hidden; }
        .starship-stage-wrap { flex: 1 1 auto; position: relative; width: 100%; height: 100%; min-width: 0; background: #000; touch-action: none; }
        .starship-html-scene {
          position: absolute; left: 0; top: 0; width: 1926px; height: 816px; overflow: visible;
          transform-origin: 0 0; pointer-events: none; z-index: 2; contain: layout paint style;
        }
        .starship-html-layer { position: absolute; top: 0; left: 0; display: block; transform-origin: 0 0; }
        .starship-html-layer img { display: block; width: 100%; height: 100%; image-rendering: auto; }
        .starship-main.observation-open .starship-stage-wrap { flex: 0 1 38%; }
        .starship-stage {
          position: absolute; inset: 0; z-index: 3; display: block; width: 100%; height: 100%;
          image-rendering: auto; cursor: crosshair;
        }
        .starship-scanline {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.045) 0px, rgba(0,0,0,0.045) 1px, transparent 1px, transparent 3px);
          mix-blend-mode: overlay; opacity: .05;
        }
        .starship-vignette {
          position: absolute; inset: 0; pointer-events: none;
          box-shadow: inset 0 0 96px 18px rgba(2,11,17,0.20);
        }
        .starship-starfield { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
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
          background: rgba(5,18,25,0.93); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          padding: 6px 12px; max-width: 60%; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          z-index: 8; pointer-events: auto;
        }
        .starship-log-tag { color: var(--amber); margin-right: 6px; }
        .starship-aside {
          position: absolute; top: 14px; right: 14px; width: 300px; max-height: calc(100% - 28px);
          background: linear-gradient(155deg, rgba(15,38,48,.96), rgba(5,18,25,.96)); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--line); border-radius: 22px 6px 22px 6px; box-shadow: 0 8px 32px rgba(0,0,0,0.55), inset 0 1px rgba(119,245,229,0.18);
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
        .starship-roster-body { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; }
        .starship-roster-body[hidden] { display: none; }
        .starship-roster { flex: 1 1 auto; overflow-y: auto; padding: 8px; }
        .starship-card {
          display: flex; gap: 10px; align-items: center; padding: 9px 10px; margin-bottom: 6px;
          border: 1px solid var(--line); border-radius: 6px; background: rgba(255,255,255,0.02);
          transition: border-color .3s, background .3s, opacity .3s; cursor: pointer;
          width: 100%; text-align: left; font-family: inherit; color: inherit;
        }
        .starship-card:hover { background: rgba(99,217,242,0.05); border-color: var(--cyan); }
        .starship-card.active { border-color: var(--cyan); background: rgba(119,245,229,.06); box-shadow: inset 3px 0 var(--cyan); }
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
        .starship-badge.review { background: rgba(99,217,242,0.10); color: var(--cyan); border: 1px solid rgba(119,245,229,0.4); }
        .starship-badge.moving { background: rgba(185,139,255,0.12); color: var(--violet); border: 1px solid rgba(185,139,255,0.4); }
        .starship-badge.idle { background: rgba(255,207,110,0.1); color: var(--amber); border: 1px solid rgba(255,207,110,0.35); }
        .starship-badge.waiting { background: rgba(255,207,110,0.1); color: var(--amber); border: 1px solid rgba(255,207,110,0.35); }
        .starship-badge.blocked { background: rgba(255,92,92,0.15); color: #ff5c5c; border: 1px solid rgba(255,92,92,0.4); }
        .starship-badge.offline { background: rgba(142,170,169,0.12); color: var(--dim); border: 1px solid rgba(142,170,169,0.3); }
        .starship-roster-foot {
          padding: 10px 14px; border-top: 1px solid var(--line); font-size: 9px; color: var(--dim); line-height: 1.6;
        }
        .starship-roster-foot b { color: var(--text); }
        .starship-footer {
          flex: 0 0 auto; display: flex; align-items: center; gap: 14px; padding: 10px 18px;
          border-top: 1px solid var(--line); background: var(--void); font-size: 10px; color: var(--dim);
        }
        .starship-btn {
          font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .5px;
          background: var(--panel); border: 1px solid var(--line); color: var(--text);
          padding: 6px 12px; border-radius: 10px 3px 10px 3px; cursor: pointer;
        }
        .starship-btn:hover { border-color: var(--cyan); color: #fff; }
        .starship-btn.active { border-color: var(--cyan); color: var(--cyan); box-shadow: inset 0 -2px rgba(119,245,229,.18); }
        @media (prefers-reduced-motion: reduce) {
          .starship-dot, .starship-spinner, .starship-html-layer img { animation: none; }
          .starship-card, .starship-aside { transition: none; }
        }
        .starship-btn:focus-visible {
          outline: 2px solid var(--cyan);
          outline-offset: 2px;
        }
        @media (max-width: 768px) {
          .starship-header { gap: 8px; padding: 8px 12px; }
          .starship-header h1 { font-size: 11px; }
          .starship-stat-cell { min-width: 72px; padding: 4px 6px; }
          .starship-stat-cell.sync { display: none; }
          .starship-aside { top: 8px; right: 8px; width: min(280px, calc(100vw - 16px)); max-width: calc(100vw - 16px); }
          .starship-main.observation-open { flex-direction: column; overflow: auto; }
          .starship-main.observation-open .starship-stage-wrap { flex: 0 0 auto; min-height: 240px; height: 38vh; }
          .starship-footer { padding: 8px 12px; font-size: 9px; flex-wrap: wrap; gap: 8px; }
        }
        @media (max-width: 480px) {
          .starship-header { min-height: 52px; padding: 7px 9px; }
          .starship-brand h1 { font-size: 10px; }
          .starship-subtitle { display: none; }
          .starship-stat { gap: 4px; }
          .starship-stat-cell { min-width: 57px; padding: 3px 5px; font-size: 8px; }
          .starship-stat-cell.heartbeat { display: none; }
          .starship-stat-label { font-size: 6.5px; }
          .starship-aside { top: 6px; right: 6px; width: min(280px, calc(100vw - 12px)); max-width: calc(100vw - 12px); }
          .starship-aside.collapsed { width: auto; min-width: 122px; }
          .starship-log-banner { max-width: calc(100vw - 24px); left: 12px; bottom: 8px; font-size: 9px; }
          .starship-footer { font-size: 8.5px; padding: 5px 8px; }
          .starship-footer-note { display: none; }
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
          <div className="starship-stat-cell heartbeat">
            <span className="starship-stat-label">HEARTBEAT</span>
            <b>{isCloud ? 'REMOTE' : snapshot ? 'LOCAL' : 'STANDBY'}</b>
          </div>
          <div className="starship-stat-cell">
            <span className="starship-stat-label">STATUS</span>
            <b>{isStale ? 'STALE' : snapshot ? 'LIVE' : 'STANDBY'}</b>
          </div>
          <div className="starship-stat-cell sync">
            <span className="starship-stat-label">LAST SYNC</span>
            <time dateTime={latestEvidence ?? undefined}><b>{syncLabel}</b></time>
          </div>
          <div className="starship-stat-cell">
            <span className="starship-stat-label">CREW ONLINE</span>
            <b>{onlineCount} / {CANONICAL_ROLES.length}</b>
          </div>
        </div>
      </header>

      <main className={`starship-main ${observedRole ? 'observation-open' : ''}`}>
        <div id="stage-wrap" ref={stageWrapRef} className="starship-stage-wrap">
          <HtmlLayerScene
            sceneRef={htmlSceneRef}
            activity={{
              Alec: agentsList.some((agent) => agent.name === 'Alec' && isAgentWorkingAtAssignedStation(agent)),
              Kevin: agentsList.some((agent) => agent.name === 'Kevin' && isAgentWorkingAtAssignedStation(agent)),
              Benjamin: agentsList.some((agent) => agent.name === 'Benjamin' && isAgentWorkingAtAssignedStation(agent)),
            }}
            onReady={onHtmlSceneReady}
            onError={onHtmlSceneError}
          />
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

        {observedRole ? (
          <AgentObservationPanel
            role={observedRole}
            snapshot={snapshot}
            onSelectRole={(role) => setObservedRole(role)}
            onClose={() => setObservedRole(null)}
          />
        ) : null}

        {!observedRole ? <aside ref={rosterRef} className={`starship-aside ${rosterCollapsed ? 'collapsed' : ''}`}>
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
          <div className="starship-roster-body" hidden={rosterCollapsed}>
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
          </div>
        </aside> : null}
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
        <span className="starship-footer-note" style={{ marginLeft: 'auto' }}>
          deck plan is illustrative — click anywhere to route the nearest agent there
        </span>
      </footer>
    </div>
  );
}
