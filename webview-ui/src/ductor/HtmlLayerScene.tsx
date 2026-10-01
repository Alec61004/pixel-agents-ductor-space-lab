import { useEffect, useRef, type RefObject } from 'react';

import { ductorAssetUrl } from './ductorLabModel.js';
import {
  loadStarshipPixelScene,
  type StarshipPixelScene,
} from './starshipPixelScene.js';
import { drawV10RoomMotion } from './starshipV10Motion.js';

const V10_SCENE_MANIFEST = 'themes/ductor-space-lab/pixel-scene-v10/scene.json';

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
 * Render the authored V10 room from eight external, non-overlapping PNG layers.
 *
 * The PNGs remain the physical room. A same-canvas procedural pass paints only
 * live content inside authored device/window interiors: space motion, fluid,
 * radar, orbital maps and QA holograms. No workstation PNG is translated and
 * no extra image layer is stacked over the room.
 */
export function HtmlLayerScene({ sceneRef, activity, onReady, onError }: HtmlLayerSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeSceneRef = useRef<StarshipPixelScene | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activityRef = useRef(activity);
  activityRef.current = activity;

  useEffect(() => {
    let disposed = false;
    let lastDrawMs = -Infinity;
    const manifestUrl = ductorAssetUrl(
      import.meta.env?.BASE_URL ?? './',
      V10_SCENE_MANIFEST,
    );

    const drawFrame = (timeMs: number) => {
      if (disposed) return;

      // Keep the room alive continuously, but 30 fps is enough for the authored
      // pixel scene and avoids needlessly repainting a 1926×816 canvas at 60 fps.
      if (timeMs - lastDrawMs < 1000 / 30) {
        animationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }
      lastDrawMs = timeMs;

      const scene = runtimeSceneRef.current;
      const canvas = canvasRef.current;
      if (!scene || !canvas) {
        animationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('V10 compositor requires a 2D canvas');

      // V10 base remains pixel-identical to the authored PNG composition.
      scene.render(0, false);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, scene.width, scene.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scene.nativeArtwork, 0, 0);
      drawV10RoomMotion(ctx, scene.nativeArtwork, timeMs / 1000, activityRef.current);
      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    void loadStarshipPixelScene(manifestUrl)
      .then((scene) => {
        if (disposed) return;
        if (scene.width !== 1926 || scene.height !== 816 || scene.manifest.layers.length !== 8) {
          throw new Error('V10 scene geometry is invalid');
        }

        const canvas = canvasRef.current;
        if (!canvas) throw new Error('V10 compositor canvas is unavailable');
        canvas.width = scene.width;
        canvas.height = scene.height;
        runtimeSceneRef.current = scene;
        drawFrame(performance.now());
        onReady();
      })
      .catch((error: unknown) => {
        if (!disposed) onError(error);
      });

    return () => {
      disposed = true;
      runtimeSceneRef.current = null;
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
