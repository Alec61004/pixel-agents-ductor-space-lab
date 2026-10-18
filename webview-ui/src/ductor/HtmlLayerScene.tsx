import { useEffect, useRef, type RefObject } from 'react';

import { ductorAssetUrl } from './ductorLabModel.js';
import { loadStarshipPixelScene } from './starshipPixelScene.js';
import { loadKevinPixelMotion } from './starshipV10KevinMotion.js';

const V10_SCENE_MANIFEST = 'themes/ductor-space-lab/pixel-scene-v10/scene.json';
const V10_KEVIN_ASSET =
  'themes/ductor-space-lab/pixel-scene-v10/layers/kevin-station.png';
const V10_KEVIN_POSITION = { x: 340, y: 510 } as const;

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

/**
 * Authored V10 room with one source-pixel animation pilot: Kevin.
 *
 * The base room is still the exact eight-PNG composition. Kevin's 540x230
 * station is then replaced in-place by a frame built from that same PNG's
 * original pixels: exact object masks + same-table clean plate + orbital
 * translation. There is no second HUD design and no translucent effect layer.
 */
export function HtmlLayerScene({ sceneRef, activity, onReady, onError }: HtmlLayerSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activityRef = useRef(activity);
  activityRef.current = activity;

  useEffect(() => {
    let disposed = false;
    let startedAtMs = 0;
    let lastDrawMs = -Infinity;
    const baseUrl = import.meta.env?.BASE_URL ?? './';
    const manifestUrl = ductorAssetUrl(baseUrl, V10_SCENE_MANIFEST);
    const kevinAssetUrl = ductorAssetUrl(baseUrl, V10_KEVIN_ASSET);

    Promise.all([
      loadStarshipPixelScene(manifestUrl),
      loadKevinPixelMotion(kevinAssetUrl),
    ])
      .then(([scene, kevinMotion]) => {
        if (disposed) return;
        if (scene.width !== 1926 || scene.height !== 816 || scene.manifest.layers.length !== 8) {
          throw new Error('V10 scene geometry is invalid');
        }
        if (kevinMotion.restDiffPixels !== 0) {
          throw new Error('Kevin pixel motion did not reconstruct the authored PNG exactly at rest');
        }

        const canvas = canvasRef.current;
        if (!canvas) throw new Error('V10 compositor canvas is unavailable');
        canvas.width = scene.width;
        canvas.height = scene.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('V10 compositor requires a 2D canvas');

        scene.render(0, false);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, scene.width, scene.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(scene.nativeArtwork, 0, 0);
        // t=0 is pixel-identical to the authored Kevin PNG.
        ctx.drawImage(
          kevinMotion.render(0, false),
          V10_KEVIN_POSITION.x,
          V10_KEVIN_POSITION.y,
        );
        ctx.restore();

        startedAtMs = performance.now();
        onReady();

        const drawFrame = (timeMs: number) => {
          if (disposed) return;
          animationFrameRef.current = requestAnimationFrame(drawFrame);
          if (timeMs - lastDrawMs < 1000 / 30) return;
          lastDrawMs = timeMs;

          const elapsedSec = Math.max(0, (timeMs - startedAtMs) / 1000);
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            scene.nativeArtwork,
            V10_KEVIN_POSITION.x,
            V10_KEVIN_POSITION.y,
            kevinMotion.width,
            kevinMotion.height,
            V10_KEVIN_POSITION.x,
            V10_KEVIN_POSITION.y,
            kevinMotion.width,
            kevinMotion.height,
          );
          ctx.drawImage(
            kevinMotion.render(elapsedSec, activityRef.current.Kevin),
            V10_KEVIN_POSITION.x,
            V10_KEVIN_POSITION.y,
          );
          ctx.restore();
        };

        animationFrameRef.current = requestAnimationFrame(drawFrame);
      })
      .catch((error: unknown) => {
        if (!disposed) onError(error);
      });

    return () => {
      disposed = true;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [onError, onReady]);

  return (
    <div ref={sceneRef} className="starship-html-scene" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="starship-v7-composite starship-v10-composite"
        width={1926}
        height={816}
      />
    </div>
  );
}
