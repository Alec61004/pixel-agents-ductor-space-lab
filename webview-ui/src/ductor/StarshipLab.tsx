import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import type { DuctorStatusSnapshot } from './ductorLabModel.js';
import { ductorAssetUrl } from './ductorLabModel.js';
import {
  type AgentStatusBubble,
  applyCloudStatus,
  applySnapshotToAgents,
  ASSIGNED_WORKSTATIONS,
  type AssignedWorkstation,
  ATTENTION_POINTS,
  clampPointToPolygon,
  createInitialCrew,
  DEPTH_SCALE_MAX,
  DEPTH_SCALE_MIN,
  drawAgent,
  drawAgentStatusBubble,
  drawDeskCutouts,
  drawFloorMarkers,
  drawHologramTopGlow,
  drawStage,
  drawStarsLayer,
  drawWorkParticles,
  drawWorkstationInteraction,
  drawWorkstationLabels,
  drawWorkstationScreens,
  FLOOR_Y_MAX,
  FLOOR_Y_MIN,
  getAgentStatusBubble,
  getDepthScale,
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
  type WorkstationCutout,
  WORKSTATIONS,
  type WorkstationScreenRect,
} from './starshipSimulation.js';

export {
  type AgentStatusBubble,
  applyCloudStatus,
  applySnapshotToAgents,
  ASSIGNED_WORKSTATIONS,
  type AssignedWorkstation,
  ATTENTION_POINTS,
  clampPointToPolygon,
  createInitialCrew,
  DEPTH_SCALE_MAX,
  DEPTH_SCALE_MIN,
  drawAgent,
  drawAgentStatusBubble,
  drawDeskCutouts,
  drawFloorMarkers,
  drawHologramTopGlow,
  drawStage,
  drawStarsLayer,
  drawWorkParticles,
  drawWorkstationInteraction,
  drawWorkstationLabels,
  drawWorkstationScreens,
  FLOOR_Y_MAX,
  FLOOR_Y_MIN,
  getAgentStatusBubble,
  getDepthScale,
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
  type WorkstationCutout,
  WORKSTATIONS,
  type WorkstationScreenRect,
};

export interface StarshipLabProps {
  snapshot?: DuctorStatusSnapshot;
  bgUrl?: string;
  sheetUrl?: string;
}

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
  const [activityText, setActivityText] = useState('Live agent telemetry connected.');

  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const touchStateRef = useRef<{
    dist: number;
    zoom: number;
    panX: number;
    panY: number;
  } | null>(null);
  const pushLog = useCallback((msg: string) => setActivityText(msg), []);

  useEffect(() => {
    applySnapshotToAgents(agentsRef.current, snapshot, pushLog);
    setAgentsList([...agentsRef.current]);
  }, [pushLog, snapshot]);

  const handleAgentClick = (agentId: string) => {
    const a = agentsRef.current.find((ag) => ag.id === agentId);
    if (a) {
      a.flash = 2.0;
    }
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
        panRef.current.x = e.touches[0].clientX - touchStateRef.current.panX;
        panRef.current.y = e.touches[0].clientY - touchStateRef.current.panY;
      } else if (e.touches.length === 2 && touchStateRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / touchStateRef.current.dist;
        zoomRef.current = Math.max(0.5, Math.min(3, touchStateRef.current.zoom * ratio));
        panRef.current.x = touchStateRef.current.panX;
        panRef.current.y = touchStateRef.current.panY;
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
        updateAgent(a, dt, 1, currentAgents, pushLog);
      }

      const wrap = stageWrapRef.current;
      const stage = stageCanvasRef.current;
      const starsCanvas = starsCanvasRef.current;

      if (wrap && stage && loadedCount >= 2) {
        const ctx = stage.getContext('2d');
        if (ctx) {
          const rect = wrap.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          drawStage(
            ctx,
            bgImg,
            sheetImg,
            currentAgents,
            false,
            rect,
            dpr,
            now / 1000,
            panRef.current.x,
            panRef.current.y,
            zoomRef.current,
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
  }, [pushLog, resolvedBgUrl, resolvedSheetUrl]);

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
        /* Ductor command strip: status stays readable without covering the deck. */
        .starship-header {
          min-height: 58px;
          display: grid;
          grid-template-columns: minmax(170px, 0.75fr) minmax(480px, 2fr) minmax(92px, 0.45fr);
          gap: 16px;
          padding: 8px 16px;
          background: linear-gradient(180deg, rgba(18,14,34,.97), rgba(10,8,22,.94));
          border-bottom-color: rgba(110,231,255,.18);
        }
        .starship-brand-lockup { min-width: 0; }
        .starship-header h1 { font-size: 11px; letter-spacing: .8px; }
        .starship-subtitle { margin-top: 3px; font-size: 8px; text-transform: uppercase; letter-spacing: 1.2px; }
        .starship-crew-strip {
          min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px;
        }
        .starship-crew-pill {
          --crew-color: var(--cyan);
          min-width: 0; height: 40px; display: grid; grid-template-columns: 8px minmax(0,1fr) auto;
          align-items: center; gap: 8px; padding: 5px 9px;
          color: var(--text); text-align: left; font: inherit;
          border: 1px solid rgba(255,255,255,.09); border-radius: 5px;
          background: rgba(255,255,255,.025); cursor: pointer;
          transition: border-color .18s ease, background .18s ease, transform .18s ease;
        }
        .starship-crew-pill:hover {
          transform: translateY(-1px); border-color: color-mix(in srgb, var(--crew-color) 58%, transparent);
          background: color-mix(in srgb, var(--crew-color) 8%, transparent);
        }
        .starship-crew-pill.offline { opacity: .48; }
        .starship-crew-pill.blocked { border-color: rgba(255,92,92,.55); }
        .starship-crew-signal {
          width: 6px; height: 6px; border-radius: 50%; background: var(--crew-color);
          box-shadow: 0 0 7px var(--crew-color);
        }
        .starship-crew-pill.offline .starship-crew-signal { background: #625d78; box-shadow: none; }
        .starship-crew-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .starship-crew-copy strong { color: #fff; font-size: 9px; line-height: 1; }
        .starship-crew-copy small {
          color: var(--dim); font-size: 7px; line-height: 1; text-transform: uppercase;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .starship-crew-state {
          color: var(--crew-color); font-size: 7px; line-height: 1; text-transform: uppercase;
          letter-spacing: .6px;
        }
        .starship-stat {
          display: flex; align-items: center; justify-content: flex-end; gap: 7px;
          font-size: 7px; letter-spacing: .7px; text-transform: uppercase;
        }
        .starship-stat > span:last-child { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .starship-stat b { font-size: 9px; }
        .starship-link-light {
          width: 6px; height: 6px; border-radius: 50%; background: #55efb0;
          box-shadow: 0 0 8px rgba(85,239,176,.85);
        }
        .starship-link-light.stale { background: var(--amber); box-shadow: 0 0 8px rgba(255,207,110,.75); }
        .starship-stage { cursor: default; }
        .starship-activity {
          position: absolute; left: 12px; bottom: 11px; z-index: 8;
          max-width: min(460px, 55%); display: flex; align-items: center; gap: 8px;
          padding: 5px 9px; border: 1px solid rgba(110,231,255,.16); border-radius: 4px;
          color: rgba(217,211,240,.72); background: rgba(8,7,18,.68);
          backdrop-filter: blur(8px); font-size: 8px; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; pointer-events: none;
        }
        .starship-activity-label { color: var(--cyan); font-weight: 700; letter-spacing: .9px; }
        @media (max-width: 760px) {
          .starship-header { grid-template-columns: auto 1fr auto; gap: 8px; padding: 7px 9px; }
          .starship-brand-lockup .starship-subtitle, .starship-crew-copy small { display: none; }
          .starship-crew-pill { height: 34px; grid-template-columns: 6px 1fr; padding: 4px 6px; gap: 5px; }
          .starship-crew-state { display: none; }
          .starship-stat > span:last-child { display: none; }
          .starship-header h1 { font-size: 8px; }
        }
      `}</style>

      <header className="starship-header">
        <div className="starship-brand-lockup">
          <div className="starship-brand">
            <div className="starship-dot" />
            <h1>DUCTOR SPACE LAB</h1>
          </div>
          <div className="starship-subtitle">live crew operations</div>
        </div>

        <div className="starship-crew-strip" role="list" aria-label="Ductor crew status">
          {agentsList.map((agent) => {
            const state = agent.reportedState ?? agent.state;
            const station = WORKSTATIONS[agent.name];
            return (
              <button
                key={agent.id}
                type="button"
                role="listitem"
                className={`starship-crew-pill ${state}`}
                style={{ '--crew-color': agent.skin.tint } as CSSProperties}
                onClick={() => handleAgentClick(agent.id)}
                title={agent.reportedTaskLabel ?? `${agent.name} · ${state}`}
                data-ductor-agent={agent.name}
                data-state={state}
              >
                <span className="starship-crew-signal" aria-hidden="true" />
                <span className="starship-crew-copy">
                  <strong>{agent.name}</strong>
                  <small>{station?.roleDescription ?? agent.role}</small>
                </span>
                <span className="starship-crew-state">{state}</span>
              </button>
            );
          })}
        </div>

        <div className="starship-stat" role="status">
          <span className={`starship-link-light ${snapshot?.stale ? 'stale' : ''}`} />
          <span>
            {isCloud ? 'REMOTE' : 'LOCAL'}
            <b>{snapshot?.stale ? 'STALE' : 'LIVE'}</b>
          </span>
        </div>
      </header>

      <main className="starship-main">
        <div id="stage-wrap" ref={stageWrapRef} className="starship-stage-wrap">
          <canvas id="stage" ref={stageCanvasRef} className="starship-stage" />
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
          <div className="starship-activity" role="status" aria-live="polite">
            <span className="starship-activity-label">LIVE</span>
            <span>{activityText}</span>
          </div>
          <div className={`starship-loading ${loaded ? 'hidden' : ''}`}>
            <div className="starship-spinner" />
            <div className="starship-ltext">LOADING DECK ASSETS…</div>
          </div>
        </div>
      </main>
    </div>
  );
}
