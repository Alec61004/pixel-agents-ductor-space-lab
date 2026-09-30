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

function workstationMotion(layer: V7SourceLayer, timeSec: number, active: boolean) {
  if (!active) return { dx: 0, dy: 0, rotation: 0, opacity: 1 };

  const phase = timeSec + layer.z * 0.031;
  const id = layer.id;

  if (id.startsWith('agent-alec-v7-')) {
    if (id.includes('tiny-lights')) {
      return { dx: 0, dy: 0, rotation: 0, opacity: 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(phase * 8.2)) };
    }
    if (id.includes('lower-cables-glow')) {
      return { dx: 0, dy: Math.sin(phase * 2.8) * 0.45, rotation: 0, opacity: 0.84 + 0.16 * (0.5 + 0.5 * Math.sin(phase * 4.1)) };
    }
    if (id.includes('right-side-panels') || id.includes('desk-core-spine')) {
      return { dx: 0, dy: 0, rotation: 0, opacity: 0.94 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 3.6)) };
    }
  }

  if (id.startsWith('agent-kevin-v7-')) {
    if (id.includes('hologram-orbit')) {
      const direction = id.includes('micro') ? -1 : 1;
      return {
        dx: 0,
        dy: Math.sin(phase * 2.1) * 0.75,
        rotation: direction * ((timeSec * 12) % 360),
        opacity: 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(phase * 3.8)),
      };
    }
    if (id.includes('round-table-surface')) {
      return { dx: 0, dy: 0, rotation: 0, opacity: 0.92 + 0.08 * (0.5 + 0.5 * Math.sin(phase * 3.2)) };
    }
  }

  if (id.startsWith('agent-benjamin-v7-')) {
    if (id.includes('brain-hologram')) {
      return {
        dx: 0,
        dy: Math.sin(phase * 2.7) * 1.2,
        rotation: Math.sin(phase * 1.4) * 1.2,
        opacity: 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(phase * 4.6)),
      };
    }
    if (id.includes('hud-panel')) {
      return { dx: 0, dy: 0, rotation: 0, opacity: 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(phase * 5.1)) };
    }
    if (id.includes('tiny-lights')) {
      return { dx: 0, dy: 0, rotation: 0, opacity: 0.68 + 0.32 * (0.5 + 0.5 * Math.sin(phase * 7.4)) };
    }
  }

  return { dx: 0, dy: 0, rotation: 0, opacity: 1 };
}

/**
 * Exact V7 compositor with workstation-only motion.
 *
 * Static pixels are always sourced from the uploaded V7 HTML. Motion is
 * applied only to authored workstation sublayers while the matching agent is
 * actually working at that station.
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
            const active = role ? activityRef.current[role] : false;
            const motion = workstationMotion(layer, timeSec, active);

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
