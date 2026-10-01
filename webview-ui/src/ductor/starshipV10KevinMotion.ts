export interface KevinPixelMotion {
  readonly width: 540;
  readonly height: 230;
  readonly restDiffPixels: 0;
  render(timeSec: number, working: boolean): HTMLCanvasElement;
}

const WIDTH = 540;
const HEIGHT = 230;

// Measured from the authored V10 Kevin crop.
const CENTER_X = 308.7;
const CENTER_Y = 54.2;
const Y_SCALE = 0.32;
const MAP_RADIUS = 148;
const CENTER_PIN_START = 18;
const CENTER_PIN_END = 42;
const EDGE_PIN_START = MAP_RADIUS - 24;
const EDGE_PIN_END = MAP_RADIUS - 6;

interface WarpField {
  offsets: Int32Array;
  radius: Float32Array;
  theta: Float32Array;
  gate: Float32Array;
  angularFactor: Float32Array;
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

function buildWarpField(): WarpField {
  const offsets: number[] = [];
  const radii: number[] = [];
  const thetas: number[] = [];
  const gates: number[] = [];
  const angularFactors: number[] = [];

  const minX = Math.max(0, Math.floor(CENTER_X - MAP_RADIUS - 1));
  const maxX = Math.min(WIDTH - 1, Math.ceil(CENTER_X + MAP_RADIUS + 1));
  const verticalRadius = MAP_RADIUS * Y_SCALE;
  const minY = Math.max(0, Math.floor(CENTER_Y - verticalRadius - 1));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(CENTER_Y + verticalRadius + 1));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const u = x - CENTER_X;
      const v = (y - CENTER_Y) / Y_SCALE;
      const radius = Math.hypot(u, v);
      if (radius > MAP_RADIUS) continue;

      const centerGate = smoothstep(CENTER_PIN_START, CENTER_PIN_END, radius);
      const edgeGate = 1 - smoothstep(EDGE_PIN_START, EDGE_PIN_END, radius);
      const gate = centerGate * edgeGate;
      const radiusNorm = Math.max(0, Math.min(1, radius / MAP_RADIUS));

      offsets.push((y * WIDTH + x) * 4);
      radii.push(radius);
      thetas.push(Math.atan2(v, u));
      gates.push(gate);
      angularFactors.push(1.12 - radiusNorm * 0.68);
    }
  }

  return {
    offsets: Int32Array.from(offsets),
    radius: Float32Array.from(radii),
    theta: Float32Array.from(thetas),
    gate: Float32Array.from(gates),
    angularFactor: Float32Array.from(angularFactors),
  };
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

function buildExactRestFrame(
  source: Uint8ClampedArray,
  field: WarpField,
  target: Uint8ClampedArray,
): void {
  target.fill(0);
  for (let index = 0; index < field.offsets.length; index += 1) {
    const offset = field.offsets[index]!;
    target[offset] = source[offset]!;
    target[offset + 1] = source[offset + 1]!;
    target[offset + 2] = source[offset + 2]!;
    target[offset + 3] = source[offset + 3]!;
  }
}

function countRestDiff(
  source: Uint8ClampedArray,
  frame: Uint8ClampedArray,
  field: WarpField,
): number {
  let changed = 0;
  for (let index = 0; index < field.offsets.length; index += 1) {
    const offset = field.offsets[index]!;
    if (
      source[offset] !== frame[offset] ||
      source[offset + 1] !== frame[offset + 1] ||
      source[offset + 2] !== frame[offset + 2] ||
      source[offset + 3] !== frame[offset + 3]
    ) {
      changed += 1;
    }
  }
  return changed;
}

/**
 * Source-pixel animation for Kevin's V10 map.
 *
 * The authored station PNG is an opaque rectangular crop, so it must never be
 * used as an alpha mask. This renderer instead creates a transparent canvas and
 * writes pixels only inside the measured star-map ellipse. The room beneath is
 * therefore untouched everywhere outside the actual glass map.
 *
 * Motion is a differential elliptical-polar remap of the PNG's own pixels:
 * planets, glows, orbit lines and particles move together. No new HUD artwork,
 * planet sprites, white matte or rectangular station crop is composited.
 */
export async function loadKevinPixelMotion(assetUrl: string): Promise<KevinPixelMotion> {
  const image = await loadImage(assetUrl);
  if (image.naturalWidth !== WIDTH || image.naturalHeight !== HEIGHT) {
    throw new Error(
      `Kevin V10 source must be ${WIDTH}x${HEIGHT}, got ${image.naturalWidth}x${image.naturalHeight}`,
    );
  }

  const sourceData = sourceImageData(image);
  const source = sourceData.data;
  const field = buildWarpField();

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = WIDTH;
  frameCanvas.height = HEIGHT;
  const frameCtx = frameCanvas.getContext('2d');
  if (!frameCtx) throw new Error('Kevin pixel motion requires a 2D canvas');

  const frameData = new ImageData(WIDTH, HEIGHT);
  buildExactRestFrame(source, field, frameData.data);
  const restDiffPixels = countRestDiff(source, frameData.data, field);
  if (restDiffPixels !== 0) {
    throw new Error(`Kevin map rest reconstruction failed: ${restDiffPixels} pixels differ`);
  }
  frameCtx.putImageData(frameData, 0, 0);

  return {
    width: WIDTH,
    height: HEIGHT,
    restDiffPixels: 0,
    render(timeSec: number, working: boolean): HTMLCanvasElement {
      if (timeSec <= 0.0001) {
        buildExactRestFrame(source, field, frameData.data);
        frameCtx.putImageData(frameData, 0, 0);
        return frameCanvas;
      }

      // Always start transparent. Only the authored map ellipse is replaced.
      frameData.data.fill(0);

      const time = timeSec % 3600;
      const baseSpeed = working ? 0.018 : 0.010;

      for (let index = 0; index < field.offsets.length; index += 1) {
        const offset = field.offsets[index]!;
        const radius = field.radius[index]!;
        const theta = field.theta[index]!;
        const gate = field.gate[index]!;
        const angularFactor = field.angularFactor[index]!;

        const sourceTheta = theta - time * baseSpeed * angularFactor * gate;
        const sourceX = CENTER_X + Math.cos(sourceTheta) * radius;
        const sourceY = CENTER_Y + Math.sin(sourceTheta) * radius * Y_SCALE;

        for (let channel = 0; channel < 3; channel += 1) {
          const original = source[offset + channel]!;
          const warped = sampleBilinear(source, sourceX, sourceY, channel);
          frameData.data[offset + channel] = Math.round(
            original + (warped - original) * gate,
          );
        }

        // Preserve authored alpha only inside the true map replacement region.
        frameData.data[offset + 3] = source[offset + 3]!;
      }

      frameCtx.putImageData(frameData, 0, 0);
      return frameCanvas;
    },
  };
}
