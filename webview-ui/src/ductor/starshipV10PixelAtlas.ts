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
export const KEVIN_DISC = { cx: 270, cy: 82, rx: 151, ry: 67 } as const;

export type KevinAuthoredObjectId =
  | 'sun'
  | 'planet_orange'
  | 'planet_gold_small'
  | 'planet_cyan'
  | 'planet_white'
  | 'marker_star'
  | 'planet_purple_small';

export interface KevinAuthoredObjectDefinition {
  id: KevinAuthoredObjectId;
  /** Row-major [start,length] runs over the exact 540x230 authored PNG. */
  runs: readonly (readonly [number, number])[];
  bounds: PixelRegion;
  pixelCount: number;
}

/**
 * Exact source-pixel masks measured from the authored V10 Kevin PNG.
 *
 * These runs are not replacement artwork. Every selected pixel is copied from
 * the PNG byte-for-byte. They are intentionally checked into source so runtime
 * work can never silently drift back to approximate rectangular overlays.
 */
export const KEVIN_AUTHORED_OBJECTS: readonly KevinAuthoredObjectDefinition[] = [
  {
    id: 'sun',
    runs: [[23524,8],[24062,13],[24601,16],[25140,18],[25679,20],[26218,22],[26757,23],[27297,24],[27837,24],[28377,24],[28917,25],[29457,25],[29997,25],[30537,25],[31077,25],[31617,25],[32157,24],[32698,23],[33239,21],[33780,19],[34321,17],[34862,14],[35404,10]],
    bounds: { x: 297, y: 43, w: 25, h: 23 },
    pixelCount: 470,
  },
  {
    id: 'planet_orange',
    runs: [[30472,7],[31011,9],[31550,11],[32089,13],[32629,14],[33169,15],[33709,14],[34252,10],[34793,8]],
    bounds: { x: 229, y: 56, w: 15, h: 9 },
    pixelCount: 101,
  },
  {
    id: 'planet_gold_small',
    runs: [[21829,3],[22367,6],[22906,8],[23445,9],[23985,9],[24526,8],[25066,7],[25607,5]],
    bounds: { x: 225, y: 40, w: 9, h: 8 },
    pixelCount: 55,
  },
  {
    id: 'planet_cyan',
    runs: [[30068,5],[30607,7],[31147,11],[31686,13],[32225,14],[32764,15],[33303,16],[33843,16],[34383,16],[34923,16],[35463,16],[36004,15],[36545,10],[37086,8],[37628,6],[38170,4],[38712,1]],
    bounds: { x: 363, y: 55, w: 16, h: 17 },
    pixelCount: 189,
  },
  {
    id: 'planet_white',
    runs: [[36041,1],[36580,2],[37120,2],[37655,7],[38194,9],[38733,11],[39272,13],[39811,15],[40351,15],[40891,16],[41431,16],[41971,16],[42511,16],[43051,16],[43592,14],[44133,13],[44674,11],[45216,8]],
    bounds: { x: 391, y: 66, w: 16, h: 18 },
    pixelCount: 201,
  },
  {
    id: 'marker_star',
    runs: [[13841,2],[14380,3],[14917,9],[15456,11],[15996,11],[16539,8],[17080,3],[17620,2]],
    bounds: { x: 336, y: 25, w: 11, h: 8 },
    pixelCount: 49,
  },
  {
    id: 'planet_purple_small',
    runs: [[19698,1],[20237,5],[20776,7],[21315,9],[21856,7],[22397,5]],
    bounds: { x: 255, y: 36, w: 9, h: 6 },
    pixelCount: 34,
  },
] as const;

export function decodeKevinAuthoredMask(
  definition: KevinAuthoredObjectDefinition,
): Uint8Array {
  const mask = new Uint8Array(KEVIN_REGION.w * KEVIN_REGION.h);
  let count = 0;
  for (const [start, length] of definition.runs) {
    for (let i = start; i < start + length; i += 1) {
      if (i < 0 || i >= mask.length) throw new Error(`Kevin mask out of range: ${definition.id}`);
      if (mask[i]) throw new Error(`Kevin mask self-overlap: ${definition.id}`);
      mask[i] = 1;
      count += 1;
    }
  }
  if (count !== definition.pixelCount) {
    throw new Error(`Kevin mask pixel count mismatch: ${definition.id}`);
  }
  return mask;
}

export function getKevinAuthoredObjectMasks(): ReadonlyArray<{
  id: KevinAuthoredObjectId;
  mask: Uint8Array;
  bounds: PixelRegion;
  pixelCount: number;
}> {
  return KEVIN_AUTHORED_OBJECTS.map((definition) => ({
    id: definition.id,
    mask: decodeKevinAuthoredMask(definition),
    bounds: { ...definition.bounds },
    pixelCount: definition.pixelCount,
  }));
}

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

  const rgba = readRegion(source, KEVIN_REGION);
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

export function splitKevinAuthoredPixels(
  rgba: Uint8ClampedArray,
): { remainder: Uint8ClampedArray; layers: ExactPixelLayer[] } {
  if (rgba.length !== KEVIN_REGION.w * KEVIN_REGION.h * 4) {
    throw new Error('Kevin authored split expects exact 540x230 RGBA data');
  }
  const masks = getKevinAuthoredObjectMasks();
  const total = masks.reduce((sum, item) => sum + item.pixelCount, 0);
  if (total !== 1099) throw new Error('Kevin authored object pixel total changed unexpectedly');
  return splitExactPixels(rgba, masks);
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
