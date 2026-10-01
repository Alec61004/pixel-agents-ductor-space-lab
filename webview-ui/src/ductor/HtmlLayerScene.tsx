import { useEffect, useRef, type RefObject } from 'react';

import { ductorAssetUrl } from './ductorLabModel.js';
import {
  loadStarshipPixelScene,
  type StarshipPixelScene,
} from './starshipPixelScene.js';

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

const V10_ACTIVITY_LAYER: Record<keyof WorkstationActivity, string> = {
  Alec: 'alec-station',
  Kevin: 'kevin-station',
  Benjamin: 'benjamin-station',
};

/**
 * Render the authored V10 room from eight external, non-overlapping PNG layers.
 *
 * The source editor stays at 1926 × 816. StarshipLab applies the existing
 * 1926×816 -> 1600×678 world transform to this DOM canvas, so the room remains
 * pixel-identical while agent routing/click targets stay in simulation space.
 *
 * Active workstation effects are generated inside the native compositor. Only
 * pixels covered by explicit detail masks are changed; workstation crops never
 * translate as whole layers and no extra DOM image is stacked above the room.
 */
export function HtmlLayerScene({ sceneRef, activity, onReady, onError }: HtmlLayerSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeSceneRef = useRef<StarshipPixelScene | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activityRef = useRef(activity);
  const restartAnimationRef = useRef<(() => void) | null>(null);
  activityRef.current = activity;

  useEffect(() => {
    let disposed = false;
    const manifestUrl = ductorAssetUrl(
      import.meta.env?.BASE_URL ?? './',
      V10_SCENE_MANIFEST,
    );

    const drawFrame = (timeMs: number) => {
      if (disposed) return;
      const scene = runtimeSceneRef.current;
      const canvas = canvasRef.current;
      if (!scene || !canvas) return;

      const active = activityRef.current;
      const workingByLayer = {
        [V10_ACTIVITY_LAYER.Alec]: active.Alec,
        [V10_ACTIVITY_LAYER.Kevin]: active.Kevin,
        [V10_ACTIVITY_LAYER.Benjamin]: active.Benjamin,
      };

      scene.render(timeMs / 1000, workingByLayer);

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('V10 compositor requires a 2D canvas');
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, scene.width, scene.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scene.nativeArtwork, 0, 0);
      ctx.restore();

      if (active.Alec || active.Kevin || active.Benjamin) {
        animationFrameRef.current = requestAnimationFrame(drawFrame);
      } else {
        animationFrameRef.current = null;
      }
    };

    const restartAnimation = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      drawFrame(performance.now());
    };
    restartAnimationRef.current = restartAnimation;

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
        restartAnimation();
        onReady();
      })
      .catch((error: unknown) => {
        if (!disposed) onError(error);
      });

    return () => {
      disposed = true;
      restartAnimationRef.current = null;
      runtimeSceneRef.current = null;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [onError, onReady]);

  useEffect(() => {
    restartAnimationRef.current?.();
  }, [activity]);

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
