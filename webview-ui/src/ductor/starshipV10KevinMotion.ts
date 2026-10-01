import {
  KEVIN_AUTHORED_OBJECTS,
  decodeKevinAuthoredMask,
  type KevinAuthoredObjectDefinition,
  type KevinAuthoredObjectId,
} from './starshipV10PixelAtlas.js';

export interface KevinPixelMotion {
  readonly width: 540;
  readonly height: 230;
  readonly restDiffPixels: 0;
  render(timeSec: number, working: boolean): HTMLCanvasElement;
}

const WIDTH = 540;
const HEIGHT = 230;

// Measured from the authored Kevin V10 crop.
const CENTER_X = 308.7;
const CENTER_Y = 54.2;
const Y_SCALE = 0.32;
const MAP_RADIUS = 148;

const MOVING_PLANETS = new Set<KevinAuthoredObjectId>([
  'planet_orange',
  'planet_gold_small',
  'planet_cyan',
  'planet_white',
  'planet_purple_small',
]);

interface PlanetMotionConfig {
  angularAmplitude: number;
  radialAmplitude: number;
  speed: number;
  phase: number;
  scaleAmplitude: number;
  feather: number;
  donorAngle: number;
}

const PLANET_MOTION: Readonly<Record<
  Exclude<KevinAuthoredObjectId, 'sun' | 'marker_star'>,
  PlanetMotionConfig
>> = {
  planet_orange: {
    angularAmplitude: 0.045,
    radialAmplitude: 0.7,
    speed: 0.56,
    phase: 0.4,
    scaleAmplitude: 0.014,
    feather: 7,
    donorAngle: 0.42,
  },
  planet_gold_small: {
    angularAmplitude: 0.052,
    radialAmplitude: 0.55,
    speed: 0.43,
    phase: 2.1,
    scaleAmplitude: 0.012,
    feather: 6,
    donorAngle: 0.5,
  },
  planet_cyan: {
    angularAmplitude: 0.038,
    radialAmplitude: 0.85,
    speed: 0.37,
    phase: 3.7,
    scaleAmplitude: 0.017,
    feather: 8,
    donorAngle: 0.36,
  },
  planet_white: {
    angularAmplitude: 0.028,
    radialAmplitude: 0.7,
    speed: 0.31,
    phase: 5.2,
    scaleAmplitude: 0.019,
    feather: 9,
    donorAngle: 0.31,
  },
  planet_purple_small: {
    angularAmplitude: 0.05,
    radialAmplitude: 0.45,
    speed: 0.61,
    phase: 1.25,
    scaleAmplitude: 0.012,
    feather: 6,
    donorAngle: 0.47,
  },
};

interface PlanetPatch {
  id: Exclude<KevinAuthoredObjectId, 'sun' | 'marker_star'>;
  canvas: HTMLCanvasElement;
  centerX: number;
  centerY: number;
  localCenterX: number;
  localCenterY: number;
  orbitRadius: number;
  orbitTheta: number;
  config: PlanetMotionConfig;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error(`Kevin V10 PNG timed out: ${url}`));
    }, 15000);
    image.onload = () => {
      clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Kevin V10 PNG failed: ${url}`));
    };
    image.src = url;
  });
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sourceImageData(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Kevin source pixels require a 2D canvas');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, WIDTH, HEIGHT);
}

function createTransparentCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return canvas;
}

function copyMapEllipse(
  source: Uint8ClampedArray,
  target: Uint8ClampedArray,
): void {
  target.fill(0);
  const verticalRadius = MAP_RADIUS * Y_SCALE;
  const minX = Math.max(0, Math.floor(CENTER_X - MAP_RADIUS - 1));
  const maxX = Math.min(WIDTH - 1, Math.ceil(CENTER_X + MAP_RADIUS + 1));
  const minY = Math.max(0, Math.floor(CENTER_Y - verticalRadius - 1));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(CENTER_Y + verticalRadius + 1));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const u = x - CENTER_X;
      const v = (y - CENTER_Y) / Y_SCALE;
      if (u * u + v * v > MAP_RADIUS * MAP_RADIUS) continue;
      const offset = (y * WIDTH + x) * 4;
      target[offset] = source[offset]!;
      target[offset + 1] = source[offset + 1]!;
      target[offset + 2] = source[offset + 2]!;
      target[offset + 3] = source[offset + 3]!;
    }
  }
}

function sampleBilinear(
  source: Uint8ClampedArray,
  x: number,
  y: number,
  channel: number,
): number {
  const clampedX = Math.max(0, Math.min(WIDTH - 1.001, x));
  const clampedY = Math.max(0, Math.min(HEIGHT - 1.001, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(WIDTH - 1, x0 + 1);
  const y1 = Math.min(HEIGHT - 1, y0 + 1);
  const fx = clampedX - x0;
  const fy = clampedY - y0;

  const p00 = source[(y0 * WIDTH + x0) * 4 + channel]!;
  const p10 = source[(y0 * WIDTH + x1) * 4 + channel]!;
  const p01 = source[(y1 * WIDTH + x0) * 4 + channel]!;
  const p11 = source[(y1 * WIDTH + x1) * 4 + channel]!;

  const top = p00 + (p10 - p00) * fx;
  const bottom = p01 + (p11 - p01) * fx;
  return top + (bottom - top) * fy;
}

function donorSample(
  source: Uint8ClampedArray,
  x: number,
  y: number,
  donorAngle: number,
  channel: number,
): number {
  const u = x - CENTER_X;
  const v = (y - CENTER_Y) / Y_SCALE;
  const radius = Math.hypot(u, v);
  const theta = Math.atan2(v, u);

  const sampleAt = (angle: number): number => {
    const sx = CENTER_X + Math.cos(angle) * radius;
    const sy = CENTER_Y + Math.sin(angle) * radius * Y_SCALE;
    return sampleBilinear(source, sx, sy, channel);
  };

  // Average both angular directions so orbit-line texture survives while
  // local planet color is suppressed.
  return (
    sampleAt(theta + donorAngle) +
    sampleAt(theta - donorAngle)
  ) * 0.5;
}

function maskCoordinates(mask: Uint8Array): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    points.push({ x: pixel % WIDTH, y: Math.floor(pixel / WIDTH) });
  }
  return points;
}

function distanceToMask(
  x: number,
  y: number,
  points: readonly { x: number; y: number }[],
): number {
  let bestSquared = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const dx = point.x - x;
    const dy = point.y - y;
    const squared = dx * dx + dy * dy;
    if (squared < bestSquared) bestSquared = squared;
  }
  return Math.sqrt(bestSquared);
}

function patchWeight(distance: number, feather: number): number {
  if (distance <= 0.5) return 1;
  if (distance >= feather) return 0;
  return 1 - smoothstep(0.5, feather, distance);
}

function planetCentroid(mask: Uint8Array): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    sumX += pixel % WIDTH;
    sumY += Math.floor(pixel / WIDTH);
    count += 1;
  }
  if (!count) throw new Error('Kevin planet mask has no pixels');
  return { x: sumX / count, y: sumY / count };
}

function buildPlanetPatch(
  source: Uint8ClampedArray,
  definition: KevinAuthoredObjectDefinition,
  mask: Uint8Array,
  config: PlanetMotionConfig,
): PlanetPatch {
  if (
    definition.id === 'sun' ||
    definition.id === 'marker_star' ||
    !MOVING_PLANETS.has(definition.id)
  ) {
    throw new Error(`Invalid moving Kevin object: ${definition.id}`);
  }

  const id = definition.id;
  const points = maskCoordinates(mask);
  const centroid = planetCentroid(mask);
  const padding = Math.ceil(config.feather + 2);
  const x0 = Math.max(0, definition.bounds.x - padding);
  const y0 = Math.max(0, definition.bounds.y - padding);
  const x1 = Math.min(
    WIDTH,
    definition.bounds.x + definition.bounds.w + padding,
  );
  const y1 = Math.min(
    HEIGHT,
    definition.bounds.y + definition.bounds.h + padding,
  );
  const patchWidth = x1 - x0;
  const patchHeight = y1 - y0;
  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = patchWidth;
  patchCanvas.height = patchHeight;
  const patchCtx = patchCanvas.getContext('2d');
  if (!patchCtx) throw new Error('Kevin planet patch requires a 2D canvas');
  const patchData = new ImageData(patchWidth, patchHeight);

  for (let localY = 0; localY < patchHeight; localY += 1) {
    for (let localX = 0; localX < patchWidth; localX += 1) {
      const sourceX = x0 + localX;
      const sourceY = y0 + localY;
      const distance = distanceToMask(sourceX, sourceY, points);
      const weight = patchWeight(distance, config.feather);
      if (weight <= 0) continue;

      const sourceOffset = (sourceY * WIDTH + sourceX) * 4;
      const patchOffset = (localY * patchWidth + localX) * 4;
      patchData.data[patchOffset] = source[sourceOffset]!;
      patchData.data[patchOffset + 1] = source[sourceOffset + 1]!;
      patchData.data[patchOffset + 2] = source[sourceOffset + 2]!;
      patchData.data[patchOffset + 3] = Math.round(255 * weight);
    }
  }

  patchCtx.putImageData(patchData, 0, 0);

  const u = centroid.x - CENTER_X;
  const v = (centroid.y - CENTER_Y) / Y_SCALE;

  return {
    id,
    canvas: patchCanvas,
    centerX: centroid.x,
    centerY: centroid.y,
    localCenterX: centroid.x - x0,
    localCenterY: centroid.y - y0,
    orbitRadius: Math.hypot(u, v),
    orbitTheta: Math.atan2(v, u),
    config,
  };
}

function erasePlanetFromBase(
  source: Uint8ClampedArray,
  base: Uint8ClampedArray,
  definition: KevinAuthoredObjectDefinition,
  mask: Uint8Array,
  config: PlanetMotionConfig,
): void {
  const points = maskCoordinates(mask);
  const padding = Math.ceil(config.feather + 2);
  const x0 = Math.max(0, definition.bounds.x - padding);
  const y0 = Math.max(0, definition.bounds.y - padding);
  const x1 = Math.min(
    WIDTH,
    definition.bounds.x + definition.bounds.w + padding,
  );
  const y1 = Math.min(
    HEIGHT,
    definition.bounds.y + definition.bounds.h + padding,
  );

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const distance = distanceToMask(x, y, points);
      const weight = patchWeight(distance, config.feather);
      if (weight <= 0) continue;
      const offset = (y * WIDTH + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const donor = donorSample(
          source,
          x,
          y,
          config.donorAngle,
          channel,
        );
        base[offset + channel] = Math.round(
          source[offset + channel]! +
            (donor - source[offset + channel]!) * weight,
        );
      }
      base[offset + 3] = source[offset + 3]!;
    }
  }
}

function buildSourceAndCleanBase(
  source: Uint8ClampedArray,
): {
  sourceEllipse: HTMLCanvasElement;
  cleanBase: HTMLCanvasElement;
  patches: PlanetPatch[];
} {
  const sourceEllipseData = new ImageData(WIDTH, HEIGHT);
  copyMapEllipse(source, sourceEllipseData.data);

  const cleanBaseData = new ImageData(
    new Uint8ClampedArray(sourceEllipseData.data),
    WIDTH,
    HEIGHT,
  );
  const patches: PlanetPatch[] = [];

  for (const definition of KEVIN_AUTHORED_OBJECTS) {
    if (
      definition.id === 'sun' ||
      definition.id === 'marker_star' ||
      !MOVING_PLANETS.has(definition.id)
    ) {
      continue;
    }

    const config = PLANET_MOTION[definition.id];
    const mask = decodeKevinAuthoredMask(definition);
    patches.push(buildPlanetPatch(source, definition, mask, config));
    erasePlanetFromBase(source, cleanBaseData.data, definition, mask, config);
  }

  const sourceEllipse = createTransparentCanvas();
  const sourceCtx = sourceEllipse.getContext('2d');
  if (!sourceCtx) throw new Error('Kevin source ellipse requires 2D canvas');
  sourceCtx.putImageData(sourceEllipseData, 0, 0);

  const cleanBase = createTransparentCanvas();
  const cleanCtx = cleanBase.getContext('2d');
  if (!cleanCtx) throw new Error('Kevin clean base requires 2D canvas');
  cleanCtx.putImageData(cleanBaseData, 0, 0);

  return { sourceEllipse, cleanBase, patches };
}

function countEllipseDiff(
  source: Uint8ClampedArray,
  sourceEllipse: HTMLCanvasElement,
): number {
  const ctx = sourceEllipse.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Kevin rest QA requires 2D canvas');
  const rendered = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
  let changed = 0;

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const u = x - CENTER_X;
      const v = (y - CENTER_Y) / Y_SCALE;
      if (u * u + v * v > MAP_RADIUS * MAP_RADIUS) continue;
      const offset = (y * WIDTH + x) * 4;
      if (
        source[offset] !== rendered[offset] ||
        source[offset + 1] !== rendered[offset + 1] ||
        source[offset + 2] !== rendered[offset + 2] ||
        source[offset + 3] !== rendered[offset + 3]
      ) {
        changed += 1;
      }
    }
  }

  return changed;
}

/**
 * Hybrid Kevin motion.
 *
 * The authored orbit lines, particles, glass texture and sun stay almost
 * completely still. Only five authored planet patches move a few pixels around
 * their existing orbital positions. Each patch includes its own source glow via
 * a feathered mask; scale/brightness vary by only ~1-2% for subtle depth.
 *
 * This avoids both previous failure modes: rotating the whole map like a disc,
 * and sliding hard-edged planet stickers across a static background.
 */
export async function loadKevinPixelMotion(
  assetUrl: string,
): Promise<KevinPixelMotion> {
  const image = await loadImage(assetUrl);
  if (image.naturalWidth !== WIDTH || image.naturalHeight !== HEIGHT) {
    throw new Error(
      `Kevin V10 source must be ${WIDTH}x${HEIGHT}, got ${image.naturalWidth}x${image.naturalHeight}`,
    );
  }

  const sourceData = sourceImageData(image);
  const source = sourceData.data;
  const { sourceEllipse, cleanBase, patches } =
    buildSourceAndCleanBase(source);

  const restDiffPixels = countEllipseDiff(source, sourceEllipse);
  if (restDiffPixels !== 0) {
    throw new Error(
      `Kevin source ellipse reconstruction failed: ${restDiffPixels} pixels differ`,
    );
  }

  const frameCanvas = createTransparentCanvas();
  const frameCtx = frameCanvas.getContext('2d');
  if (!frameCtx) throw new Error('Kevin hybrid motion requires a 2D canvas');

  return {
    width: WIDTH,
    height: HEIGHT,
    restDiffPixels: 0,
    render(timeSec: number, working: boolean): HTMLCanvasElement {
      if (timeSec <= 0.0001) return sourceEllipse;

      const intro = smoothstep(0, 1.4, timeSec);
      const activityBoost = working ? 1.18 : 1;

      frameCtx.save();
      frameCtx.setTransform(1, 0, 0, 1, 0, 0);
      frameCtx.clearRect(0, 0, WIDTH, HEIGHT);
      frameCtx.globalCompositeOperation = 'source-over';
      frameCtx.globalAlpha = 1;
      frameCtx.filter = 'none';
      frameCtx.drawImage(cleanBase, 0, 0);

      const sorted = patches
        .map((patch) => {
          const config = patch.config;
          const wave =
            Math.sin(timeSec * config.speed * activityBoost + config.phase);
          const radialWave =
            Math.sin(
              timeSec * config.speed * 0.67 * activityBoost +
                config.phase * 1.73,
            );
          const theta =
            patch.orbitTheta + config.angularAmplitude * wave * intro;
          const radius =
            patch.orbitRadius +
            config.radialAmplitude * radialWave * intro;
          const x = CENTER_X + Math.cos(theta) * radius;
          const y = CENTER_Y + Math.sin(theta) * radius * Y_SCALE;
          const depth = Math.sin(theta);
          return { patch, theta, x, y, depth };
        })
        .sort((a, b) => a.depth - b.depth);

      for (const state of sorted) {
        const { patch, x, y, depth } = state;
        const config = patch.config;
        const scale =
          1 + config.scaleAmplitude * depth * intro;
        const opacity =
          0.975 + (depth + 1) * 0.0125;
        const brightness =
          0.985 +
          (depth + 1) * 0.012 +
          Math.sin(timeSec * 0.72 + config.phase) * 0.008;

        frameCtx.save();
        frameCtx.translate(x, y);
        frameCtx.scale(scale, scale);
        frameCtx.globalAlpha = opacity;
        frameCtx.filter = `brightness(${brightness.toFixed(3)})`;
        frameCtx.drawImage(
          patch.canvas,
          -patch.localCenterX,
          -patch.localCenterY,
        );
        frameCtx.restore();
      }

      // Cross-fade from the exact authored frame during startup so there is no
      // visual pop when the clean plate takes over.
      if (intro < 1) {
        frameCtx.globalAlpha = 1 - intro;
        frameCtx.filter = 'none';
        frameCtx.drawImage(sourceEllipse, 0, 0);
      }

      frameCtx.restore();
      return frameCanvas;
    },
  };
}
