import { useEffect, useRef, type RefObject } from 'react';

import { V7_SOURCE_PROJECT, type V7SourceLayer } from './v7Source.js';

interface WorkstationActivity {
  Alec: boolean;
  Kevin: boolean;
  Benjamin: boolean;
}

interface HtmlLayerSceneProps {
  sceneRef: RefObject<HTMLDivElement | null>;
  activity: WorkstationActivity;
  onReady: () => void;
  onError: (error: unknown) => void;
}

interface LayerMotion {
  dx: number;
  dy: number;
  rotation: number;
  opacity: number;
}

function loadLayerImage(layer: V7SourceLayer): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`V7 layer failed to decode: ${layer.id}`));
    image.src = layer.dataURL;
  });
}

function layerRole(id: string): keyof WorkstationActivity | null {
  if (id.startsWith('agent-alec-v7-')) return 'Alec';
  if (id.startsWith('agent-kevin-v7-')) return 'Kevin';
  if (id.startsWith('agent-benjamin-v7-')) return 'Benjamin';
  return null;
}

function still(): LayerMotion {
  return { dx: 0, dy: 0, rotation: 0, opacity: 1 };
}

/**
 * Ambient workstation motion follows the authored V7 visual language.
 * Structure, feet, nameplates and large opaque shells remain fixed; only
 * holograms, glow masks, micro-detail masks and signal lights move.
 * Working agents slightly increase the tempo/intensity, but the lab remains
 * alive even while the crew is idle or offline.
 */
function workstationMotion(layer: V7SourceLayer, timeSec: number, working: boolean): LayerMotion {
  const id = layer.id;
  const boost = working ? 1.35 : 1;
  const speed = working ? 1.22 : 1;
  const phase = timeSec * speed + layer.z * 0.037;

  // Alec: command-console signal traffic, cyan/amber practicals and cable glow.
  if (id.startsWith('agent-alec-v7-')) {
    if (id === 'agent-alec-v7-back-console-skyline-micro') {
      return {
        dx: Math.sin(phase * 0.9) * 1.1 * boost,
        dy: 0,
        rotation: 0,
        opacity: 0.58 + 0.34 * (0.5 + 0.5 * Math.sin(phase * 3.1)),
      };
    }
    if (id === 'agent-alec-v7-right-side-panels-micro') {
      return {
        dx: 0,
        dy: Math.sin(phase * 1.7) * 0.35 * boost,
        rotation: 0,
        opacity: 0.66 + 0.30 * (0.5 + 0.5 * Math.sin(phase * 4.2)),
      };
    }
    if (id === 'agent-alec-v7-desk-core-spine-micro') {
      return {
        dx: 0,
        dy: 0,
        rotation: 0,
        opacity: 0.72 + 0.22 * (0.5 + 0.5 * Math.sin(phase * 2.4)),
      };
    }
    if (id === 'agent-alec-v7-lower-cables-glow-micro') {
      return {
        dx: Math.sin(phase * 1.2) * 0.45 * boost,
        dy: Math.cos(phase * 1.6) * 0.35 * boost,
        rotation: 0,
        opacity: 0.62 + 0.34 * (0.5 + 0.5 * Math.sin(phase * 3.5)),
      };
    }
    if (id === 'agent-alec-v7-tiny-lights') {
      return {
        dx: 0,
        dy: 0,
        rotation: 0,
        opacity: 0.68 + 0.32 * (0.5 + 0.5 * Math.sin(phase * 7.8)),
      };
    }
    return still();
  }

  // Kevin: a continuously running orbital hologram. The physical table stays fixed.
  if (id.startsWith('agent-kevin-v7-')) {
    if (id === 'agent-kevin-v7-hologram-orbit') {
      return {
        dx: Math.sin(phase * 0.7) * 0.45 * boost,
        dy: Math.sin(phase * 1.35) * 0.75 * boost,
        rotation: Math.sin(phase * 0.72) * 0.55 * boost,
        opacity: 0.94 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 2.6)),
      };
    }
    if (id === 'agent-kevin-v7-hologram-orbit-micro') {
      return {
        dx: Math.sin(phase * 1.4) * 1.8 * boost,
        dy: Math.cos(phase * 1.9) * 0.55 * boost,
        rotation: Math.sin(phase * 0.95) * 0.9 * boost,
        opacity: 0.55 + 0.42 * (0.5 + 0.5 * Math.sin(phase * 4.4)),
      };
    }
    if (id === 'agent-kevin-v7-front-nameplate-micro') {
      return {
        dx: 0,
        dy: 0,
        rotation: 0,
        opacity: 0.72 + 0.25 * (0.5 + 0.5 * Math.sin(phase * 2.8)),
      };
    }
    return still();
  }

  // Benjamin: floating QA brain model, scanning HUDs and diagnostic indicators.
  if (id.startsWith('agent-benjamin-v7-')) {
    if (id === 'agent-benjamin-v7-brain-hologram') {
      return {
        dx: Math.sin(phase * 0.65) * 0.35 * boost,
        dy: Math.sin(phase * 1.55) * 1.15 * boost,
        rotation: Math.sin(phase * 0.82) * 0.65 * boost,
        opacity: 0.91 + 0.09 * (0.5 + 0.5 * Math.sin(phase * 2.9)),
      };
    }
    if (id === 'agent-benjamin-v7-brain-hologram-micro') {
      return {
        dx: Math.cos(phase * 1.25) * 0.8 * boost,
        dy: Math.sin(phase * 2.05) * 0.8 * boost,
        rotation: Math.sin(phase * 1.1) * 0.8 * boost,
        opacity: 0.56 + 0.40 * (0.5 + 0.5 * Math.sin(phase * 4.8)),
      };
    }
    if (
      id === 'agent-benjamin-v7-left-hud-panel-micro' ||
      id === 'agent-benjamin-v7-right-hud-panel-micro'
    ) {
      const direction = id.includes('left-hud') ? 1 : -1;
      return {
        dx: direction * Math.sin(phase * 1.75) * 0.75 * boost,
        dy: Math.sin(phase * 2.35) * 0.25 * boost,
        rotation: 0,
        opacity: 0.58 + 0.38 * (0.5 + 0.5 * Math.sin(phase * 5.0)),
      };
    }
    if (id === 'agent-benjamin-v7-round-platform-top-micro') {
      return {
        dx: Math.sin(phase * 0.9) * 0.6 * boost,
        dy: 0,
        rotation: 0,
        opacity: 0.60 + 0.34 * (0.5 + 0.5 * Math.sin(phase * 3.7)),
      };
    }
    if (id === 'agent-benjamin-v7-tiny-lights') {
      return {
        dx: 0,
        dy: 0,
        rotation: 0,
        opacity: 0.66 + 0.34 * (0.5 + 0.5 * Math.sin(phase * 7.2)),
      };
    }
    return still();
  }

  return still();
}

/**
 * Exact V7 compositor with ambient workstation motion.
 *
 * The room is still sourced directly from the uploaded V7 HTML. Animation is
 * restricted to authored workstation sublayers, preserving the base artwork.
 */
export function HtmlLayerScene({ sceneRef, activity, onReady, onError }: HtmlLayerSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activityRef = useRef(activity);
  activityRef.current = activity;

  useEffect(() => {
    let disposed = false;
    let animationId = 0;
    let lastFrame = -Infinity;
    const manifest = V7_SOURCE_PROJECT;

    if (
      manifest.width !== 1926 ||
      manifest.height !== 816 ||
      !Array.isArray(manifest.layers) ||
      manifest.layers.length === 0
    ) {
      onError(new Error('Exact V7 source project is invalid'));
      return;
    }

    const visible = [...manifest.layers]
      .filter((layer) => layer.visible && layer.opacity > 0 && layer.dataURL)
      .sort((a, b) => a.z - b.z);

    void Promise.all(visible.map(async (layer) => ({ layer, image: await loadLayerImage(layer) })))
      .then((prepared) => {
        if (disposed) return;
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('V7 compositor canvas is unavailable');
        canvas.width = manifest.width;
        canvas.height = manifest.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('V7 compositor requires a 2D canvas');

        const render = (nowMs: number) => {
          if (disposed) return;
          animationId = requestAnimationFrame(render);
          if (nowMs - lastFrame < 33) return;
          lastFrame = nowMs;
          const timeSec = nowMs / 1000;

          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, manifest.width, manifest.height);
          ctx.imageSmoothingEnabled = false;

          for (const { layer, image } of prepared) {
            const role = layerRole(layer.id);
            const working = role ? activityRef.current[role] : false;
            const motion = workstationMotion(layer, timeSec, working);

            ctx.save();
            ctx.translate(layer.x + motion.dx, layer.y + motion.dy);
            ctx.rotate((layer.rotation * Math.PI) / 180);

            if (motion.rotation !== 0) {
              ctx.translate(layer.source.w / 2, layer.source.h / 2);
              ctx.rotate((motion.rotation * Math.PI) / 180);
              ctx.translate(-layer.source.w / 2, -layer.source.h / 2);
            }

            ctx.scale(layer.scaleX, layer.scaleY);
            ctx.globalAlpha = layer.opacity * motion.opacity;
            ctx.drawImage(image, 0, 0);
            ctx.restore();
          }

          ctx.restore();
        };

        render(performance.now());
        onReady();
      })
      .catch((error: unknown) => {
        if (!disposed) onError(error);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
    };
  }, [onError, onReady]);

  return (
    <div ref={sceneRef} className="starship-html-scene" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="starship-v7-composite"
        width={1926}
        height={816}
      />
    </div>
  );
}
