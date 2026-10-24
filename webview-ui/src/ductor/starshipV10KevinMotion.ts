import {
  KEVIN_STAR_MAP_POLYGON,
  getKevinAuthoredObjectMasks,
  type KevinAuthoredObjectId,
} from './starshipV10PixelAtlas.js';

type Surface = HTMLCanvasElement | OffscreenCanvas;
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface KevinSprite {
  id: KevinAuthoredObjectId;
  surface: Surface;
  centerX: number;
  centerY: number;
  orbitCenter: { x: number; y: number };
  orbitYScale: number;
  orbitRadius: number;
  orbitTheta: number;
  speed: number;
}

export interface KevinPixelMotion {
  readonly width: 540;
  readonly height: 230;
  readonly restDiffPixels: number;
  render(timeSec: number, working: boolean): Surface;
}

const WIDTH = 540;
const HEIGHT = 230;
const ORBIT_CENTER = { x: 308.68936170212766, y: 54.161702127659574 };
const ORBIT_Y_SCALE = 0.32;

const DONOR_ROTATION_DEG: Readonly<Record<KevinAuthoredObjectId, number>> = {
  sun: 0,
  planet_orange: 168,
  planet_gold_small: 60,
  planet_cyan: -48,
  planet_white: -24,
  marker_star: -54,
  planet_purple_small: 18,
};

const PLANET_CONFIG: Readonly<
  Record<
    KevinAuthoredObjectId,
    {
      center: { x: number; y: number };
      yScale: number;
      speed: number;
    }
  >
> = {
  sun: { center: ORBIT_CENTER, yScale: ORBIT_Y_SCALE, speed: 0 },
  planet_orange: { center: ORBIT_CENTER, yScale: ORBIT_Y_SCALE, speed: 0.22 },
  planet_gold_small: { center: ORBIT_CENTER, yScale: ORBIT_Y_SCALE, speed: 0.16 },
  planet_cyan: { center: ORBIT_CENTER, yScale: ORBIT_Y_SCALE, speed: 0.19 },
  // Calibrated orbit center for planet_white so it stays strictly within the glass dish
  planet_white: { center: { x: 315, y: 78 }, yScale: 0.36, speed: 0.12 },
  marker_star: { center: ORBIT_CENTER, yScale: ORBIT_Y_SCALE, speed: 0.09 },
  planet_purple_small: { center: ORBIT_CENTER, yScale: ORBIT_Y_SCALE, speed: 0.27 },
};

function makeCanvas(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getContext(surface: Surface): Context {
  const ctx = surface.getContext('2d') as Context | null;
  if (!ctx) throw new Error('Kevin pixel motion requires a 2D canvas');
  return ctx;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error(`Kevin V10 PNG timed out: ${url}`));
    }, 15000);
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Kevin V10 PNG failed: ${url}`));
    };
    img.src = url;
  });
}

function sourcePixels(image: HTMLImageElement): Uint8ClampedArray {
  if (image.naturalWidth !== WIDTH || image.naturalHeight !== HEIGHT) {
    throw new Error(
      `Kevin V10 source must be ${WIDTH}x${HEIGHT}, got ${image.naturalWidth}x${image.naturalHeight}`,
    );
  }
  const surface = makeCanvas(WIDTH, HEIGHT);
  const ctx = getContext(surface);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
}

function sampleBilinear(
  rgba: Uint8ClampedArray,
  x: number,
  y: number,
): readonly [number, number, number, number] {
  const x0 = Math.max(0, Math.min(WIDTH - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(HEIGHT - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(WIDTH - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(HEIGHT - 1, y0 + 1));
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const output = [0, 0, 0, 0];

  for (let channel = 0; channel < 4; channel += 1) {
    const p00 = rgba[(y0 * WIDTH + x0) * 4 + channel]!;
    const p10 = rgba[(y0 * WIDTH + x1) * 4 + channel]!;
    const p01 = rgba[(y1 * WIDTH + x0) * 4 + channel]!;
    const p11 = rgba[(y1 * WIDTH + x1) * 4 + channel]!;
    const top = p00 + (p10 - p00) * fx;
    const bottom = p01 + (p11 - p01) * fx;
    output[channel] = Math.round(top + (bottom - top) * fy);
  }

  return output as unknown as readonly [number, number, number, number];
}

function donorCoordinate(
  x: number,
  y: number,
  rotationDeg: number,
): { x: number; y: number } {
  const angle = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const u = x - ORBIT_CENTER.x;
  const v = (y - ORBIT_CENTER.y) / ORBIT_Y_SCALE;
  const rotatedU = cos * u - sin * v;
  const rotatedV = sin * u + cos * v;
  return {
    x: ORBIT_CENTER.x + rotatedU,
    y: ORBIT_CENTER.y + rotatedV * ORBIT_Y_SCALE,
  };
}

function buildCleanPlate(
  rgba: Uint8ClampedArray,
): { surface: Surface; masks: ReturnType<typeof getKevinAuthoredObjectMasks> } {
  const clean = rgba.slice();
  const masks = getKevinAuthoredObjectMasks();

  for (const object of masks) {
    if (object.id === 'sun') continue;
    const donorRotation = DONOR_ROTATION_DEG[object.id];

    for (let pixel = 0; pixel < object.mask.length; pixel += 1) {
      if (!object.mask[pixel]) continue;
      const x = pixel % WIDTH;
      const y = Math.floor(pixel / WIDTH);
      const donor = donorCoordinate(x, y, donorRotation);
      const sampled = sampleBilinear(rgba, donor.x, donor.y);
      const offset = pixel * 4;
      clean[offset] = sampled[0];
      clean[offset + 1] = sampled[1];
      clean[offset + 2] = sampled[2];
      clean[offset + 3] = sampled[3];
    }
  }

  const surface = makeCanvas(WIDTH, HEIGHT);
  getContext(surface).putImageData(new ImageData(clean, WIDTH, HEIGHT), 0, 0);
  return { surface, masks };
}

function buildSprites(
  rgba: Uint8ClampedArray,
  masks: ReturnType<typeof getKevinAuthoredObjectMasks>,
): KevinSprite[] {
  const sprites: KevinSprite[] = [];

  for (const object of masks) {
    if (object.id === 'sun') continue;

    const surface = makeCanvas(WIDTH, HEIGHT);
    const spritePixels = new Uint8ClampedArray(rgba.length);
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let pixel = 0; pixel < object.mask.length; pixel += 1) {
      if (!object.mask[pixel]) continue;
      const x = pixel % WIDTH;
      const y = Math.floor(pixel / WIDTH);
      const offset = pixel * 4;
      spritePixels[offset] = rgba[offset]!;
      spritePixels[offset + 1] = rgba[offset + 1]!;
      spritePixels[offset + 2] = rgba[offset + 2]!;
      spritePixels[offset + 3] = rgba[offset + 3]!;
      sumX += x;
      sumY += y;
      count += 1;
    }

    if (!count) continue;
    getContext(surface).putImageData(new ImageData(spritePixels, WIDTH, HEIGHT), 0, 0);

    const centerX = sumX / count;
    const centerY = sumY / count;
    const config = PLANET_CONFIG[object.id];
    const u = centerX - config.center.x;
    const v = (centerY - config.center.y) / config.yScale;

    sprites.push({
      id: object.id,
      surface,
      centerX,
      centerY,
      orbitCenter: config.center,
      orbitYScale: config.yScale,
      orbitRadius: Math.hypot(u, v),
      orbitTheta: Math.atan2(v, u),
      speed: config.speed,
    });
  }

  return sprites;
}

function renderFrame(
  target: Surface,
  cleanPlate: Surface,
  sprites: readonly KevinSprite[],
  timeSec: number,
  working: boolean,
): void {
  const ctx = getContext(target);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.drawImage(cleanPlate, 0, 0);

  // Clip to table polygon so no sprite pixel can ever escape the table rim
  ctx.save();
  ctx.beginPath();
  const [first, ...rest] = KEVIN_STAR_MAP_POLYGON;
  ctx.moveTo(first[0], first[1]);
  for (const [px, py] of rest) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.clip();

  const speedBoost = working ? 1.4 : 1;
  for (const sprite of sprites) {
    const theta = sprite.orbitTheta + sprite.speed * timeSec * speedBoost;
    const nextX = sprite.orbitCenter.x + Math.cos(theta) * sprite.orbitRadius;
    const nextY =
      sprite.orbitCenter.y + Math.sin(theta) * sprite.orbitRadius * sprite.orbitYScale;
    const dx = Math.round(nextX - sprite.centerX);
    const dy = Math.round(nextY - sprite.centerY);
    ctx.drawImage(sprite.surface, dx, dy);
  }
  ctx.restore();

  if (working) {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 2.8);
    ctx.save();
    ctx.beginPath();
    const [firstP, ...restP] = KEVIN_STAR_MAP_POLYGON;
    ctx.moveTo(firstP[0], firstP[1]);
    for (const [px, py] of restP) ctx.lineTo(px, py);
    ctx.closePath();
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(0, 240, 255, ${(pulse * 0.08).toFixed(3)})`;
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function diffPixels(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let changed = 0;
  for (let offset = 0; offset < a.length; offset += 4) {
    if (
      a[offset] !== b[offset] ||
      a[offset + 1] !== b[offset + 1] ||
      a[offset + 2] !== b[offset + 2] ||
      a[offset + 3] !== b[offset + 3]
    ) {
      changed += 1;
    }
  }
  return changed;
}

/**
 * Kevin V10 motion is assembled from exact authored source pixels.
 *
 * No new planets, orbit rings, glow sprites or HUD artwork are drawn. Six
 * existing source-pixel objects are lifted from the PNG, their old pixels are
 * replaced by same-radius donor pixels from the same table texture, and the
 * original objects are translated along their calibrated elliptical orbits.
 *
 * render(0, false) reconstructs the authored PNG at 0 RGBA diff.
 */
export async function loadKevinPixelMotion(assetUrl: string): Promise<KevinPixelMotion> {
  const image = await loadImage(assetUrl);
  const rgba = sourcePixels(image);
  const { surface: cleanPlate, masks } = buildCleanPlate(rgba);
  const sprites = buildSprites(rgba, masks);
  const frame = makeCanvas(WIDTH, HEIGHT);

  renderFrame(frame, cleanPlate, sprites, 0, false);
  const restPixels = getContext(frame).getImageData(0, 0, WIDTH, HEIGHT).data;
  const restDiffPixels = diffPixels(rgba, restPixels);
  if (restDiffPixels !== 0) {
    throw new Error(`Kevin source-pixel reconstruction failed: ${restDiffPixels} pixels differ`);
  }

  return {
    width: WIDTH,
    height: HEIGHT,
    restDiffPixels,
    render(timeSec: number, working: boolean): Surface {
      renderFrame(frame, cleanPlate, sprites, timeSec, working);
      return frame;
    },
  };
}
