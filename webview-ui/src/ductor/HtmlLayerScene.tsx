import { useEffect, useMemo, type RefObject } from 'react';

import { V7_SOURCE_PROJECT } from './v7Source.js';

interface HtmlLayerSceneProps {
  sceneRef: RefObject<HTMLDivElement | null>;
  onReady: () => void;
  onError: (error: unknown) => void;
}

/**
 * Native V7 scene sourced directly from the uploaded V7 HTML.
 * Every layer image uses the exact embedded dataURL from SPACE_LAB_PROJECT,
 * so runtime rendering cannot drift from the authored workstation pixels.
 */
export function HtmlLayerScene({ sceneRef, onReady, onError }: HtmlLayerSceneProps) {
  const manifest = V7_SOURCE_PROJECT;

  useEffect(() => {
    if (
      manifest.width !== 1926 ||
      manifest.height !== 816 ||
      !Array.isArray(manifest.layers) ||
      manifest.layers.length === 0
    ) {
      onError(new Error('Exact V7 source project is invalid'));
      return;
    }
    onReady();
  }, [manifest, onError, onReady]);

  const layers = useMemo(
    () =>
      [...manifest.layers]
        .filter((layer) => layer.visible && layer.opacity > 0 && layer.dataURL)
        .sort((a, b) => a.z - b.z),
    [manifest],
  );

  return (
    <div ref={sceneRef} className="starship-html-scene" aria-hidden="true">
      {layers.map((layer) => (
        <span
          key={layer.id}
          className="starship-html-layer"
          data-v7-layer={layer.id}
          style={{
            width: `${layer.source.w}px`,
            height: `${layer.source.h}px`,
            opacity: layer.opacity,
            zIndex: layer.z,
            transform: `translate3d(${layer.x}px, ${layer.y}px, 0) rotate(${layer.rotation}deg) scale(${layer.scaleX}, ${layer.scaleY})`,
          }}
        >
          <img
            className="starship-v7-layer-image"
            src={layer.dataURL}
            alt=""
            draggable={false}
          />
        </span>
      ))}
    </div>
  );
}
