import { useEffect, useMemo, useState, type RefObject } from 'react';

import type { StarshipPixelSceneManifest } from './starshipPixelScene.js';

export type HtmlSceneActivity = Readonly<{
  alec: boolean;
  kevin: boolean;
  benjamin: boolean;
}>;

interface HtmlLayerSceneProps {
  manifestUrl: string;
  sceneRef: RefObject<HTMLDivElement | null>;
  activity: HtmlSceneActivity;
  onReady: () => void;
  onError: (error: unknown) => void;
}

function effectClass(id: string, activity: HtmlSceneActivity): string {
  if (activity.alec && /^agent-alec-v7-.*(skyline|tiny-lights)/.test(id)) return 'alec-working';
  if (activity.kevin && /^agent-kevin-v7-hologram-orbit/.test(id)) return 'kevin-working';
  if (activity.benjamin && /^agent-benjamin-v7-.*(brain-hologram|hud-panel|tiny-lights)/.test(id)) return 'benjamin-working';
  return '';
}

/** Native V7 scene: each author-controlled PNG remains an addressable DOM element. */
export function HtmlLayerScene({ manifestUrl, sceneRef, activity, onReady, onError }: HtmlLayerSceneProps) {
  const [manifest, setManifest] = useState<StarshipPixelSceneManifest | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(manifestUrl, { signal: controller.signal, cache: 'force-cache' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`V7 scene manifest failed: ${response.status}`);
        return response.json() as Promise<StarshipPixelSceneManifest>;
      })
      .then((next) => {
        if (next.width !== 1926 || next.height !== 816 || !Array.isArray(next.layers)) {
          throw new Error('Invalid V7 HTML scene');
        }
        setManifest(next);
        onReady();
      })
      .catch((error: unknown) => {
        if ((error as DOMException).name !== 'AbortError') onError(error);
      });
    return () => controller.abort();
  }, [manifestUrl, onError, onReady]);

  const layers = useMemo(
    () => manifest ? [...manifest.layers].filter((layer) => layer.visible && layer.opacity > 0).sort((a, b) => a.z - b.z) : [],
    [manifest],
  );
  if (!manifest) return null;

  return (
    <div ref={sceneRef} className="starship-html-scene" aria-hidden="true">
      {layers.map((layer) => (
        <span
          key={layer.id}
          className="starship-html-layer"
          style={{
            width: `${layer.source.w}px`, height: `${layer.source.h}px`, opacity: layer.opacity, zIndex: layer.z,
            transform: `translate3d(${layer.x}px, ${layer.y}px, 0) rotate(${layer.rotation}deg) scale(${layer.scaleX}, ${layer.scaleY})`,
          }}
        >
          <img
            className={effectClass(layer.id, activity)}
            src={new URL(layer.asset, manifestUrl).href}
            alt=""
            draggable={false}
          />
        </span>
      ))}
    </div>
  );
}
