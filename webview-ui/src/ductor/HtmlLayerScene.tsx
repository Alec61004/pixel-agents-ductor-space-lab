import { useEffect, useMemo, type RefObject } from 'react';

import type { StarshipPixelSceneManifest } from './starshipPixelScene.js';
import v7SceneManifestRaw from './v7SceneManifest.json?raw';

interface HtmlLayerSceneProps {
  manifestUrl: string;
  sceneRef: RefObject<HTMLDivElement | null>;
  onReady: () => void;
  onError: (error: unknown) => void;
}

function parseBundledManifest(): StarshipPixelSceneManifest | null {
  try {
    const next = JSON.parse(v7SceneManifestRaw) as StarshipPixelSceneManifest;
    if (next.width !== 1926 || next.height !== 816 || !Array.isArray(next.layers)) {
      return null;
    }
    return next;
  } catch {
    return null;
  }
}

/**
 * Native V7 scene.
 *
 * The manifest is bundled by Vite at build time so protected Vercel previews
 * never need to fetch scene.json at runtime. PNG assets remain addressable
 * DOM images using the exact V7 layer transforms.
 */
export function HtmlLayerScene({ manifestUrl, sceneRef, onReady, onError }: HtmlLayerSceneProps) {
  const manifest = useMemo(() => parseBundledManifest(), []);

  useEffect(() => {
    if (!manifest) {
      onError(new Error('Bundled V7 scene manifest is invalid'));
      return;
    }
    onReady();
  }, [manifest, onError, onReady]);

  const layers = useMemo(
    () =>
      manifest
        ? [...manifest.layers]
            .filter((layer) => layer.visible && layer.opacity > 0)
            .sort((a, b) => a.z - b.z)
        : [],
    [manifest],
  );

  if (!manifest) return null;

  const manifestHref = new URL(manifestUrl, window.location.href);

  return (
    <div ref={sceneRef} className="starship-html-scene" aria-hidden="true">
      {layers.map((layer) => (
        <span
          key={layer.id}
          className="starship-html-layer"
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
            src={new URL(layer.asset, manifestHref).href}
            alt=""
            draggable={false}
          />
        </span>
      ))}
    </div>
  );
}
