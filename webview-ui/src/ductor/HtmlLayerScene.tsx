import { useEffect, useRef, type RefObject } from 'react';

import { V7_SOURCE_PROJECT, type V7SourceLayer } from './v7Source.js';

interface HtmlLayerSceneProps {
  sceneRef: RefObject<HTMLDivElement | null>;
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

/**
 * Exact V7 compositor.
 *
 * This intentionally mirrors Engine.render() from the uploaded V7 HTML:
 * z-sort -> translate -> rotate -> scale -> opacity -> drawImage(0, 0).
 * The room becomes ready only after every embedded PNG has decoded and the
 * 1926x816 source canvas has been fully composited.
 */
export function HtmlLayerScene({ sceneRef, onReady, onError }: HtmlLayerSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let disposed = false;
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

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, manifest.width, manifest.height);
        ctx.imageSmoothingEnabled = false;

        for (const { layer, image } of prepared) {
          ctx.save();
          ctx.translate(layer.x, layer.y);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          ctx.scale(layer.scaleX, layer.scaleY);
          ctx.globalAlpha = layer.opacity;
          ctx.drawImage(image, 0, 0);
          ctx.restore();
        }
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
        className="starship-v7-composite"
        width={1926}
        height={816}
      />
    </div>
  );
}
