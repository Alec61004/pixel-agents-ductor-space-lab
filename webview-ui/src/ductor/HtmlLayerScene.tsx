import { useEffect, useState, type RefObject } from 'react';

interface SceneLayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  asset: string;
  source: { w: number; h: number };
}

interface SceneManifest {
  width: number;
  height: number;
  layers: SceneLayer[];
}

export interface HtmlLayerSceneProps {
  manifestUrl: string;
  sceneRef: RefObject<HTMLDivElement | null>;
  onReady: (ready: boolean) => void;
}

/**
 * Renders the V7 room directly from its scene manifest.
 *
 * Each PNG remains an independently positioned DOM element, so an agent can
 * change an object's x/y/z, opacity, transform, or source asset precisely by
 * editing public/assets/themes/ductor-space-lab/pixel-scene-v7/scene.json.
 */
export function HtmlLayerScene({
  manifestUrl,
  sceneRef,
  onReady,
}: HtmlLayerSceneProps) {
  const [manifest, setManifest] = useState<SceneManifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    setManifest(null);
    onReady(false);

    const loadManifest = async () => {
      try {
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error(`Unable to load V7 scene: ${response.status}`);
        const next = (await response.json()) as SceneManifest;
        if (!Array.isArray(next.layers) || !next.width || !next.height) {
          throw new Error('V7 scene manifest is invalid.');
        }
        if (!cancelled) {
          setManifest(next);
          onReady(true);
        }
      } catch {
        if (!cancelled) onReady(false);
      }
    };

    void loadManifest();
    return () => {
      cancelled = true;
    };
  }, [manifestUrl, onReady]);

  if (!manifest) return null;

  const manifestBase = new URL(manifestUrl, window.location.href);
  return (
    <div
      ref={sceneRef}
      className="starship-v7-room"
      aria-hidden="true"
      style={{ width: manifest.width, height: manifest.height }}
      data-v7-native-width={manifest.width}
      data-v7-native-height={manifest.height}
    >
      {manifest.layers.map((layer) => {
        if (!layer.visible) return null;
        const assetUrl = new URL(layer.asset, manifestBase).href;
        return (
          <span
            key={layer.id}
            className="starship-v7-layer"
            data-layer-id={layer.id}
            data-layer-name={layer.name}
            style={{
              left: layer.x,
              top: layer.y,
              zIndex: layer.z,
              width: layer.source.w,
              height: layer.source.h,
              opacity: layer.opacity,
              transform: `rotate(${layer.rotation}deg) scale(${layer.scaleX}, ${layer.scaleY})`,
            }}
          >
            <img src={assetUrl} alt="" draggable={false} width={layer.source.w} height={layer.source.h} />
          </span>
        );
      })}
    </div>
  );
}
