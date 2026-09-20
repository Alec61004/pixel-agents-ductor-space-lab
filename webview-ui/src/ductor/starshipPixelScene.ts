/**
 * Runtime loader for the lossless photonic-room layer scene.
 *
 * The source image is 1926×816. Each layer keeps its own cropped PNG and
 * top-left destination anchor, so an agent can edit exact integer coordinates
 * without touching the simulation loop. The assembled canvas is cached once,
 * then the normal 1600×678 stage scales it like the original artwork.
 */

export const PIXEL_SCENE_MANIFEST =
  'themes/ductor-space-lab/pixel-scene/scene.json';

export interface StarshipPixelSceneLayer {
  id: string;
  source: { x: number; y: number; w: number; h: number };
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  tint?: string;
  tintMix?: number;
  asset: string;
}

export interface StarshipPixelSceneManifest {
  format?: string;
  version?: number;
  width: number;
  height: number;
  sourceSHA256?: string;
  layers: StarshipPixelSceneLayer[];
}

export interface StarshipPixelScene {
  readonly width: number;
  readonly height: number;
  readonly artwork: HTMLCanvasElement | OffscreenCanvas;
  readonly manifest: StarshipPixelSceneManifest;
}

type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;

const cache = new Map<string, Promise<StarshipPixelScene | undefined>>();

function createCanvas(width: number, height: number): RenderCanvas | undefined {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: RenderCanvas): CanvasRenderingContext2D | null {
  return canvas.getContext('2d') as CanvasRenderingContext2D | null;
}

function loadImage(url: string): Promise<HTMLImageElement | undefined> {
  if (typeof Image === 'undefined') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(undefined);
    image.src = url;
  });
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function renderManifest(
  manifestUrl: string,
  manifest: StarshipPixelSceneManifest,
): Promise<StarshipPixelScene | undefined> {
  const artwork = createCanvas(manifest.width, manifest.height);
  if (!artwork) return Promise.resolve(undefined);
  const ctx = context2d(artwork);
  if (!ctx) return Promise.resolve(undefined);

  const ordered = [...manifest.layers].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
  return Promise.all(
    ordered.map(async (layer) => {
      if (!layer.visible) return { layer, image: undefined };
      const url = new URL(layer.asset, manifestUrl).toString();
      return { layer, image: await loadImage(url) };
    }),
  ).then((loaded) => {
    if (loaded.some(({ layer, image }) => layer.visible && !image)) return undefined;

    ctx.clearRect(0, 0, manifest.width, manifest.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const { layer, image } of loaded) {
      if (!layer.visible || !image) continue;
      const width = Math.max(1, Math.round(layer.source.w));
      const height = Math.max(1, Math.round(layer.source.h));
      const sprite = createCanvas(width, height);
      const spriteCtx = sprite ? context2d(sprite) : null;
      if (!sprite || !spriteCtx) return undefined;

      spriteCtx.clearRect(0, 0, width, height);
      spriteCtx.imageSmoothingEnabled = true;
      spriteCtx.imageSmoothingQuality = 'high';
      spriteCtx.drawImage(image, 0, 0, width, height);

      const tintMix = clamp01(layer.tintMix ?? 0);
      if (tintMix > 0 && layer.tint && layer.tint.toLowerCase() !== '#ffffff') {
        spriteCtx.globalCompositeOperation = 'source-atop';
        spriteCtx.globalAlpha = tintMix;
        spriteCtx.fillStyle = layer.tint;
        spriteCtx.fillRect(0, 0, width, height);
        spriteCtx.globalAlpha = 1;
        spriteCtx.globalCompositeOperation = 'source-over';
      }

      ctx.save();
      ctx.translate(layer.x, layer.y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.scaleX || 1, layer.scaleY || 1);
      ctx.globalAlpha = clamp01(layer.opacity ?? 1);
      ctx.drawImage(sprite, 0, 0, width, height);
      ctx.restore();
    }

    return { width: manifest.width, height: manifest.height, artwork, manifest };
  });
}

export function loadStarshipPixelScene(
  manifestUrl: string,
): Promise<StarshipPixelScene | undefined> {
  const cached = cache.get(manifestUrl);
  if (cached) return cached;

  const pending = fetch(manifestUrl, { cache: 'no-cache' })
    .then(async (response) => {
      if (!response.ok) return undefined;
      const manifest = (await response.json()) as StarshipPixelSceneManifest;
      if (
        !finitePositive(manifest.width) ||
        !finitePositive(manifest.height) ||
        !Array.isArray(manifest.layers)
      ) {
        return undefined;
      }
      return renderManifest(manifestUrl, manifest);
    })
    .then((scene) => scene ?? undefined)
    .catch(() => undefined);

  cache.set(manifestUrl, pending);
  return pending;
}
