import { useEffect, useRef, type RefObject } from 'react';

import { ductorAssetUrl } from './ductorLabModel.js';
import { loadStarshipPixelScene } from './starshipPixelScene.js';

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
 * The source editor stays at 1926 × 816. StarshipLab applies the existing
 * 1926×816 -> 1600×678 world transform to this DOM canvas, so the room remains
 * pixel-identical while agent routing/click targets stay in simulation space.
 */
export function HtmlLayerScene({ sceneRef, activity, onReady, onError }: HtmlLayerSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // V10 is intentionally static at this integration boundary. Agent activity
  // remains on the simulation canvas; no whole workstation image is moved.
  void activity;

  useEffect(() => {
    let disposed = false;
    const manifestUrl = ductorAssetUrl(
      import.meta.env?.BASE_URL ?? './',
      V10_SCENE_MANIFEST,
    );

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

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('V10 compositor requires a 2D canvas');

        scene.render(0, false);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, scene.width, scene.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(scene.nativeArtwork, 0, 0);
        ctx.restore();

        onReady();
      })
      .catch((error: unknown) => {
        if (!disposed) onError(error);
      });

    return () => {
      disposed = true;
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
