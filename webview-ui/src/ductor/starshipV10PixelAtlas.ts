export interface PixelRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PixelComponent {
  id: string;
  area: number;
  bounds: PixelRegion;
  centroid: { x: number; y: number };
  mean: { r: number; g: number; b: number; a: number };
  peakLuma: number;
  mask: Uint8Array;
}

export interface V10PixelAtlas {
  region: PixelRegion;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  brightMask: Uint8Array;
  objectCandidates: PixelComponent[];
}

type Surface = HTMLCanvasElement | OffscreenCanvas;
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const KEVIN_REGION: PixelRegion = { x: 340, y: 510, w: 540, h: 230 };
const KEVIN_DISC = { cx: 270, cy: 82, rx: 151, ry: 67 };

function canvas(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function context(surface: Surface): Context {
  const ctx = surface.getContext('2d') as Context | null;
  if (!ctx) throw new Error('V10 pixel atlas requires a 2D canvas');
  return ctx;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function pixelOffset(width: number, x: number, y: number): number {
  return (y * width + x) * 4;
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function insideEllipse(x: number, y: number): boolean {
  const dx = (x - KEVIN_DISC.cx) / KEVIN_DISC.rx;
  const dy = (y - KEVIN_DISC.cy) / KEVIN_DISC.ry;
  return dx * dx + dy * dy <= 1;
}

function readRegion(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  region: PixelRegion,
): Uint8ClampedArray {
  const work = canvas(region.w, region.h);
  const ctx = context(work);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    source,
    region.x,
    region.y,
    region.w,
    region.h,
    0,
    0,
    region.w,
    region.h,
  );
  return ctx.getImageData(0, 0, region.w, region.h).data;
}

/**
 * Candidate mask from the actual source RGB values.
 *
 * This is deliberately color/data driven rather than a collection of painted
 * rectangles. The ellipse only limits the search to the authored glass disc;
 * membership inside that disc is decided pixel-by-pixel from the PNG itself.
 */
function buildKevinBrightMask(rgba: Uint8ClampedArray): Uint8Array {
  const { w, h } = KEVIN_REGION;
  const mask = new Uint8Array(w * h);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!insideEllipse(x, y)) continue;
      const i = pixelOffset(w, x, y);
      const r = rgba[i]!;
      const g = rgba[i + 1]!;
      const b = rgba[i + 2]!;
      const a = rgba[i + 3]!;
      if (a < 12) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      const light = luma(r, g, b);

      const cyan = b > r * 1.13 && g > r * 1.06 && b > 72;
      const amber = r > b * 1.22 && g > b * 1.05 && r > 88;
      const violet = b > g * 1.03 && r > g * 0.72 && b > 82;
      const luminousNeutral = light > 150 && chroma > 10;

      if (
        light > 54 &&
        chroma > 18 &&
        (cyan || amber || violet || luminousNeutral)
      ) {
        mask[y * w + x] = 1;
      }
    }
  }

  return mask;
}

function erode(mask: Uint8Array, width: number, height: number, passes = 1): Uint8Array {
  let current = mask.slice();
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Uint8Array(current.length);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = y * width + x;
        if (!current[idx]) continue;
        let keep = 1;
        for (let oy = -1; oy <= 1 && keep; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (!current[(y + oy) * width + x + ox]) {
              keep = 0;
              break;
            }
          }
        }
        next[idx] = keep;
      }
    }
    current = next;
  }
  return current;
}

function dilate(mask: Uint8Array, width: number, height: number, passes = 1): Uint8Array {
  let current = mask.slice();
  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.slice();
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = y * width + x;
        if (!current[idx]) continue;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            next[(y + oy) * width + x + ox] = 1;
          }
        }
      }
    }
    current = next;
  }
  return current;
}

function connectedComponents(
  mask: Uint8Array,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): PixelComponent[] {
  const visited = new Uint8Array(mask.length);
  const output: PixelComponent[] = [];
  const queueX = new Int32Array(mask.length);
  const queueY = new Int32Array(mask.length);
  let serial = 0;

  for (let sy = 0; sy < height; sy += 1) {
    for (let sx = 0; sx < width; sx += 1) {
      const seed = sy * width + sx;
      if (!mask[seed] || visited[seed]) continue;

      let head = 0;
      let tail = 0;
      queueX[tail] = sx;
      queueY[tail] = sy;
      tail += 1;
      visited[seed] = 1;

      const componentMask = new Uint8Array(mask.length);
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      let peakLuma = 0;
      let minX = sx;
      let maxX = sx;
      let minY = sy;
      let maxY = sy;

      while (head < tail) {
        const x = queueX[head]!;
        const y = queueY[head]!;
        head += 1;
        const idx = y * width + x;
        componentMask[idx] = 1;

        const p = idx * 4;
        const r = rgba[p]!;
        const g = rgba[p + 1]!;
        const b = rgba[p + 2]!;
        const a = rgba[p + 3]!;

        area += 1;
        sumX += x;
        sumY += y;
        sumR += r;
        sumG += g;
        sumB += b;
        sumA += a;
        peakLuma = Math.max(peakLuma, luma(r, g, b));
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (!ox && !oy) continue;
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = ny * width + nx;
            if (!mask[ni] || visited[ni]) continue;
            visited[ni] = 1;
            queueX[tail] = nx;
            queueY[tail] = ny;
            tail += 1;
          }
        }
      }

      if (area < 4) continue;
      output.push({
        id: `kevin-component-${serial++}`,
        area,
        bounds: {
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
        },
        centroid: { x: sumX / area, y: sumY / area },
        mean: {
          r: sumR / area,
          g: sumG / area,
          b: sumB / area,
          a: sumA / area,
        },
        peakLuma,
        mask: componentMask,
      });
    }
  }

  return output;
}

/**
 * Analyze Kevin's authored V10 crop at source-pixel resolution.
 *
 * Thin orbit lines are suppressed for component discovery with morphology;
 * the returned brightMask remains the unmodified per-pixel source decision so
 * no source information is lost.
 */
export function analyzeKevinPixels(
  source: CanvasImageSource,
  sourceWidth = 1926,
  sourceHeight = 816,
): V10PixelAtlas {
  if (sourceWidth !== 1926 || sourceHeight !== 816) {
    throw new Error('Kevin pixel analysis expects the authored 1926x816 V10 scene');
  }

  const rgba = readRegion(source, sourceWidth, sourceHeight, KEVIN_REGION);
  const brightMask = buildKevinBrightMask(rgba);

  // Remove one-pixel orbit/data filaments while detecting discrete objects.
  const solid = dilate(erode(brightMask, KEVIN_REGION.w, KEVIN_REGION.h, 1), KEVIN_REGION.w, KEVIN_REGION.h, 1);
  const objectCandidates = connectedComponents(
    solid,
    rgba,
    KEVIN_REGION.w,
    KEVIN_REGION.h,
  )
    .filter((component) => component.area >= 6 && component.area <= 2600)
    .sort((a, b) => {
      const scoreA = a.area * (a.peakLuma / 255);
      const scoreB = b.area * (b.peakLuma / 255);
      return scoreB - scoreA;
    });

  return {
    region: { ...KEVIN_REGION },
    width: KEVIN_REGION.w,
    height: KEVIN_REGION.h,
    rgba,
    brightMask,
    objectCandidates,
  };
}

export interface ExactPixelLayer {
  id: string;
  rgba: Uint8ClampedArray;
  mask: Uint8Array;
}

/**
 * Losslessly split exact source pixels by masks.
 *
 * A mask never recolors or regenerates a source pixel: selected pixels are
 * copied byte-for-byte to their object layer and cleared from the remainder.
 * Recombining remainder + all layers must therefore be exactly 0 RGBA diff
 * when masks do not overlap.
 */
export function splitExactPixels(
  rgba: Uint8ClampedArray,
  masks: ReadonlyArray<{ id: string; mask: Uint8Array }>,
): { remainder: Uint8ClampedArray; layers: ExactPixelLayer[] } {
  const pixelCount = rgba.length / 4;
  const claimed = new Uint8Array(pixelCount);
  const remainder = rgba.slice();
  const layers: ExactPixelLayer[] = [];

  for (const entry of masks) {
    if (entry.mask.length !== pixelCount) throw new Error(`Mask size mismatch: ${entry.id}`);
    const layer = new Uint8ClampedArray(rgba.length);

    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      if (!entry.mask[pixel]) continue;
      if (claimed[pixel]) throw new Error(`Overlapping pixel masks at pixel ${pixel}`);
      claimed[pixel] = 1;
      const i = pixel * 4;
      layer[i] = rgba[i]!;
      layer[i + 1] = rgba[i + 1]!;
      layer[i + 2] = rgba[i + 2]!;
      layer[i + 3] = rgba[i + 3]!;
      remainder[i] = 0;
      remainder[i + 1] = 0;
      remainder[i + 2] = 0;
      remainder[i + 3] = 0;
    }

    layers.push({ id: entry.id, rgba: layer, mask: entry.mask.slice() });
  }

  return { remainder, layers };
}

export function reconstructExactPixels(
  remainder: Uint8ClampedArray,
  layers: ReadonlyArray<ExactPixelLayer>,
): Uint8ClampedArray {
  const out = remainder.slice();

  for (const layer of layers) {
    for (let i = 0; i < out.length; i += 4) {
      if (!layer.rgba[i + 3]) continue;
      out[i] = layer.rgba[i]!;
      out[i + 1] = layer.rgba[i + 1]!;
      out[i + 2] = layer.rgba[i + 2]!;
      out[i + 3] = layer.rgba[i + 3]!;
    }
  }

  return out;
}

export function countRgbaDiff(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let changed = 0;

  for (let i = 0; i < a.length; i += 4) {
    if (
      a[i] !== b[i] ||
      a[i + 1] !== b[i + 1] ||
      a[i + 2] !== b[i + 2] ||
      a[i + 3] !== b[i + 3]
    ) {
      changed += 1;
    }
  }

  return changed;
}
