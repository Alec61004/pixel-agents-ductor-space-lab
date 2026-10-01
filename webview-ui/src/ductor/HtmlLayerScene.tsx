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
 * Pixel-QA integration boundary for the authored V10 room.
 *
 * During source-pixel extraction the room is intentionally rendered exactly
 * once from the eight authored PNG layers. No provisional animation may run
 * here until the checked-in masks pass reconstruction and clean-plate QA.
 */
export function HtmlLayerScene({ sceneRef, activity, onReady, onError }: HtmlLayerSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
