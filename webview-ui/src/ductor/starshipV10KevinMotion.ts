import {
  KEVIN_AUTHORED_OBJECTS,
  KEVIN_DISC,
  decodeKevinAuthoredMask,
  type KevinAuthoredObjectDefinition,
  type KevinAuthoredObjectId,
} from './starshipV10PixelAtlas.js';

export type KevinMotionLayerKind =
  | 'authored-static'
  | 'generated-static'
  | 'procedural-dynamic'
  | 'planet-dynamic';

export interface KevinMotionLayerAudit {
  id: string;
  kind: KevinMotionLayerKind;
  z: number;
  primitiveCount?: number;
  sourcePixelCount?: number;
  orbitRadius?: number;
  orbitPeriodSec?: number;
}

export type KevinPixelOwnerCategory =
  | 'map-base'
  | 'authored-detail'
  | 'sun'
  | 'haze'
  | 'dust'
  | 'star-grid'
  | 'navigation'
  | 'star-node'
  | 'guide-orbit'
  | 'planet-orbit'
  | 'planet'
  | 'transition';

export interface KevinPixelOwnerDefinition {
  id: string;
  parentId: string | null;
  category: KevinPixelOwnerCategory;
  subpart: string;
  dynamic: boolean;
  z: number;
  sourcePixelCount?: number;
  primitiveIndex?: number;
}

export interface KevinPixelOwnershipSnapshot {
  readonly width: 540;
  readonly height: 230;
  readonly timeSec: number;
  readonly working: boolean;
  readonly owners: readonly KevinPixelOwnerDefinition[];
  readonly primaryOwner: Uint16Array;
  readonly stackOffsets: Uint32Array;
  readonly stackOwnerIndices: Uint16Array;
  readonly mapMask: Uint8Array;
}

export function getKevinPixelOwnerStack(
  snapshot: KevinPixelOwnershipSnapshot,
  x: number,
  y: number,
): readonly KevinPixelOwnerDefinition[] {
  if (x < 0 || y < 0 || x >= snapshot.width || y >= snapshot.height) return [];
  const pixel = y * snapshot.width + x;
  const start = snapshot.stackOffsets[pixel]!;
  const end = snapshot.stackOffsets[pixel + 1]!;
  const owners: KevinPixelOwnerDefinition[] = [];
  for (let index = start; index < end; index += 1) {
    const owner = snapshot.owners[snapshot.stackOwnerIndices[index]!];
    if (owner) owners.push(owner);
  }
  return owners;
}

export interface KevinPixelMotion {
  readonly width: 540;
  readonly height: 230;
  readonly restDiffPixels: 0;
  readonly layerAudit: readonly KevinMotionLayerAudit[];
  buildPixelOwnership(
    timeSec: number,
    working: boolean,
  ): KevinPixelOwnershipSnapshot;
  render(timeSec: number, working: boolean): HTMLCanvasElement;
}

const WIDTH = 540;
const HEIGHT = 230;

// Two different geometries exist in the authored Kevin V10 crop:
// 1) the physical star-map glass/disc, measured by the semantic atlas;
// 2) the solar-system focus, measured from the authored Sun pixels.
// Never use the Sun as the clipping center of the physical map.
const SUN_X = 308.7;
const SUN_Y = 54.2;
const ORBIT_Y_SCALE = KEVIN_DISC.ry / KEVIN_DISC.rx;
const KEPLER_REFERENCE_RADIUS = 60;
const KEPLER_REFERENCE_PERIOD_SEC = 18;

type MovingPlanetId = Exclude<KevinAuthoredObjectId, 'sun' | 'marker_star'>;
type PlanetStyle = 'rocky' | 'gas_banded' | 'ringed_gas' | 'icy' | 'moon';

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

interface PlanetVisualSpec {
  style: PlanetStyle;
  radius: number;
  primary: string;
  secondary: string;
  highlight: string;
  accent?: string;
  ring?: string;
  tilt: number;
}

const PLANET_MOTION: Readonly<Record<MovingPlanetId, PlanetMotionConfig>> = {
  planet_orange: {
    angularAmplitude: 0.13,
    radialAmplitude: 2.2,
    speed: 1,
    phase: 0.4,
    scaleAmplitude: 0.03,
    feather: 7,
    donorAngle: 0.42,
  },
  planet_gold_small: {
    angularAmplitude: 0.14,
    radialAmplitude: 1.6,
    speed: 1,
    phase: 2.1,
    scaleAmplitude: 0.025,
    feather: 6,
    donorAngle: 0.5,
  },
  planet_cyan: {
    angularAmplitude: 0.12,
    radialAmplitude: 2.4,
    speed: 1,
    phase: 3.7,
    scaleAmplitude: 0.034,
    feather: 8,
    donorAngle: 0.36,
  },
  planet_white: {
    angularAmplitude: 0.095,
    radialAmplitude: 2.0,
    speed: 1,
    phase: 5.2,
    scaleAmplitude: 0.036,
    feather: 9,
    donorAngle: 0.31,
  },
  planet_purple_small: {
    angularAmplitude: 0.16,
    radialAmplitude: 1.25,
    speed: 1,
    phase: 1.25,
    scaleAmplitude: 0.026,
    feather: 6,
    donorAngle: 0.47,
  },
};

const PLANET_VISUALS: Readonly<Record<MovingPlanetId, PlanetVisualSpec>> = {
  planet_orange: {
    style: 'gas_banded',
    radius: 7.5,
    primary: '#c7814c',
    secondary: '#6f3f2c',
    highlight: '#f1c891',
    accent: '#9c5635',
    tilt: -0.12,
  },
  planet_gold_small: {
    style: 'rocky',
    radius: 5.4,
    primary: '#c9a85a',
    secondary: '#70552f',
    highlight: '#f2dfa3',
    accent: '#8f713a',
    tilt: 0.15,
  },
  planet_cyan: {
    style: 'icy',
    radius: 8.5,
    primary: '#68bde4',
    secondary: '#235a86',
    highlight: '#d4f4ff',
    accent: '#4c95ba',
    tilt: -0.08,
  },
  planet_white: {
    style: 'ringed_gas',
    radius: 9.5,
    primary: '#d9d2c3',
    secondary: '#8e8577',
    highlight: '#fff8e8',
    accent: '#b5aa99',
    ring: 'rgba(232,220,196,0.72)',
    tilt: -0.28,
  },
  planet_purple_small: {
    style: 'moon',
    radius: 5.2,
    primary: '#9d75c7',
    secondary: '#4b3567',
    highlight: '#dac8f4',
    accent: '#6d4d8e',
    tilt: 0.22,
  },
};

interface PlanetPatch {
  id: MovingPlanetId;
  canvas: HTMLCanvasElement;
  localCenterX: number;
  localCenterY: number;
  orbitRadius: number;
  orbitTheta: number;
  config: PlanetMotionConfig;
  visual: PlanetVisualSpec;
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

const LEGACY_MAP_CENTER_X = 54;
const LEGACY_MAP_CENTER_Y = 35.5;
const LEGACY_MAP_HALF_W = 49;
const LEGACY_MAP_HALF_H = 30.5;

interface LegacyDustPoint {
  x: number;
  y: number;
  depth: number;
  radius: number;
  alpha: number;
}

const LEGACY_HOLOGRAM_DUST: readonly LegacyDustPoint[] = Array.from(
  { length: 150 },
  (_, index) => {
    const random = (salt: number) => {
      const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    const u = random(1);
    const spread =
      (random(2) + random(3) + random(4) - 1.5) *
      (4 + Math.sin(u * Math.PI) * 7);
    return {
      x: 12 + u * 81 + spread * 0.3,
      y: 54 - u * 38 + Math.sin(u * 6) * 3 + spread,
      depth: random(5) * 12 - 6,
      radius: 0.075 + random(6) * 0.18,
      alpha: 0.12 + random(7) * 0.48,
    };
  },
);

function mapLegacyPoint(x: number, y: number): { x: number; y: number } {
  const nx = (x - LEGACY_MAP_CENTER_X) / LEGACY_MAP_HALF_W;
  const ny = (y - LEGACY_MAP_CENTER_Y) / LEGACY_MAP_HALF_H;
  return {
    x: KEVIN_DISC.cx + nx * KEVIN_DISC.rx,
    y: KEVIN_DISC.cy + ny * KEVIN_DISC.ry,
  };
}

function legacyRadiusX(radius: number): number {
  return (radius / LEGACY_MAP_HALF_W) * KEVIN_DISC.rx;
}

function legacyRadiusY(radius: number): number {
  return (radius / LEGACY_MAP_HALF_H) * KEVIN_DISC.ry;
}

function drawLegacyMapStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  opacity: number,
): void {
  const point = mapLegacyPoint(x, y);
  const mappedRadius = Math.max(0.75, legacyRadiusX(radius));

  ctx.globalAlpha = opacity;
  const glow = ctx.createRadialGradient(
    point.x,
    point.y,
    0,
    point.x,
    point.y,
    mappedRadius * 4.5,
  );
  glow.addColorStop(0, '#fff9eb');
  glow.addColorStop(0.14, '#fff0ce');
  glow.addColorStop(0.30, color);
  glow.addColorStop(0.55, color + '42');
  glow.addColorStop(1, color + '00');

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(point.x, point.y, mappedRadius * 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff5dc';
  ctx.beginPath();
  ctx.arc(point.x, point.y, mappedRadius * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawLegacyHazeLayer(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  working: boolean,
): void {
  ctx.globalCompositeOperation = 'lighter';
  for (let cloud = 0; cloud < 12; cloud += 1) {
    const u = cloud / 11;
    const legacyX = 14 + u * 78;
    const legacyY =
      53 -
      u * 36 +
      Math.sin(u * 6 + timeSec * 0.025) * 3;
    const point = mapLegacyPoint(legacyX, legacyY);
    const rx = legacyRadiusX(11) * 1.7;
    const ry =
      legacyRadiusY(11) *
      (0.6 + (cloud % 3) * 0.12);

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.scale(1, ry / Math.max(0.001, rx));
    const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    haze.addColorStop(0, working ? '#56bdd632' : '#56bdd622');
    haze.addColorStop(0.35, '#348da918');
    haze.addColorStop(1, '#16435b00');
    ctx.fillStyle = haze;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawLegacyDustLayer(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  working: boolean,
): void {
  for (const mote of LEGACY_HOLOGRAM_DUST) {
    const drift = Math.sin(timeSec * 0.18 + mote.depth * 0.13);
    const point = mapLegacyPoint(
      mote.x + drift * mote.depth * 0.65,
      mote.y +
        Math.cos(timeSec * 0.13 + mote.depth * 0.2) *
          mote.depth *
          0.3,
    );
    const mappedRadius = Math.max(
      0.28,
      legacyRadiusX(mote.radius),
    );
    ctx.globalAlpha =
      mote.alpha *
      (working ? 0.72 : 0.52) *
      (0.8 + Math.sin(timeSec * 0.8 + mote.x) * 0.2);
    ctx.fillStyle = mote.depth > 0 ? '#beedf0' : '#5ba8c3';
    ctx.beginPath();
    ctx.arc(point.x, point.y, mappedRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLegacyStarGridLayer(
  ctx: CanvasRenderingContext2D,
  working: boolean,
): void {
  for (let i = 0; i < 38; i += 1) {
    const x = 7 + ((i * 37.73) % 91);
    const y = 7 + ((i * 19.31) % 57);
    const point = mapLegacyPoint(x, y);
    const radius = i % 7 === 0 ? 0.72 : 0.42;
    ctx.globalAlpha =
      (working ? 0.34 : 0.24) *
      (0.68 + (i % 4) * 0.08);
    ctx.fillStyle = '#bedee8';
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLegacyNavigationLayer(
  ctx: CanvasRenderingContext2D,
  working: boolean,
): void {
  const p32_15 = mapLegacyPoint(32, 15);
  const p54_38 = mapLegacyPoint(54, 38);
  const p86_20 = mapLegacyPoint(86, 20);
  const p87_51 = mapLegacyPoint(87, 51);
  const c1 = mapLegacyPoint(35, 28);
  const c2 = mapLegacyPoint(43, 35);
  const c3 = mapLegacyPoint(66, 32);
  const c4 = mapLegacyPoint(76, 23);
  const c5 = mapLegacyPoint(68, 44);
  const c6 = mapLegacyPoint(79, 46);

  ctx.globalAlpha = working ? 0.24 : 0.16;
  ctx.strokeStyle = '#70c4d8';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(p32_15.x, p32_15.y);
  ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p54_38.x, p54_38.y);
  ctx.bezierCurveTo(c3.x, c3.y, c4.x, c4.y, p86_20.x, p86_20.y);
  ctx.moveTo(p54_38.x, p54_38.y);
  ctx.bezierCurveTo(c5.x, c5.y, c6.x, c6.y, p87_51.x, p87_51.y);
  ctx.stroke();
}

function drawLegacyStarNodesLayer(
  ctx: CanvasRenderingContext2D,
  working: boolean,
): void {
  drawLegacyMapStar(ctx, 32, 15, 0.42, '#ffae83', working ? 0.66 : 0.50);
  drawLegacyMapStar(ctx, 86, 20, 0.68, '#c1f3ff', working ? 0.82 : 0.64);
  drawLegacyMapStar(ctx, 87, 51, 0.50, '#bceeff', working ? 0.68 : 0.50);
  drawLegacyMapStar(ctx, 69, 27, 0.28, '#bceeff', working ? 0.74 : 0.56);
  drawLegacyMapStar(ctx, 18, 45, 0.30, '#bceeff', working ? 0.58 : 0.42);
}

function drawLegacyGuideOrbitLayer(
  ctx: CanvasRenderingContext2D,
  working: boolean,
): void {
  const guideRadii = [56, 91, 132] as const;
  ctx.strokeStyle = '#70c4d8';
  ctx.lineWidth = 0.62;
  ctx.globalAlpha = working ? 0.16 : 0.10;
  for (const radius of guideRadii) {
    ctx.beginPath();
    ctx.ellipse(
      SUN_X,
      SUN_Y,
      radius,
      radius * ORBIT_Y_SCALE,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
}

function drawLegacyMapContext(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  working: boolean,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    KEVIN_DISC.cx,
    KEVIN_DISC.cy,
    KEVIN_DISC.rx,
    KEVIN_DISC.ry,
    0,
    0,
    Math.PI * 2,
  );
  ctx.clip();

  // Keep the exact historical drawing order so this refactor is visual-no-op.
  drawLegacyHazeLayer(ctx, timeSec, working);
  drawLegacyDustLayer(ctx, timeSec, working);
  drawLegacyStarGridLayer(ctx, working);
  drawLegacyNavigationLayer(ctx, working);
  drawLegacyStarNodesLayer(ctx, working);
  drawLegacyGuideOrbitLayer(ctx, working);

  ctx.restore();
}

function copyMapEllipse(
  source: Uint8ClampedArray,
  target: Uint8ClampedArray,
): void {
  target.fill(0);
  const minX = Math.max(0, Math.floor(KEVIN_DISC.cx - KEVIN_DISC.rx - 1));
  const maxX = Math.min(WIDTH - 1, Math.ceil(KEVIN_DISC.cx + KEVIN_DISC.rx + 1));
  const minY = Math.max(0, Math.floor(KEVIN_DISC.cy - KEVIN_DISC.ry - 1));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(KEVIN_DISC.cy + KEVIN_DISC.ry + 1));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - KEVIN_DISC.cx) / KEVIN_DISC.rx;
      const dy = (y - KEVIN_DISC.cy) / KEVIN_DISC.ry;
      if (dx * dx + dy * dy > 1) continue;
      const offset = (y * WIDTH + x) * 4;
      target[offset] = source[offset]!;
      target[offset + 1] = source[offset + 1]!;
      target[offset + 2] = source[offset + 2]!;
      target[offset + 3] = source[offset + 3]!;
    }
  }
}

function insideMap(x: number, y: number): boolean {
  const dx = (x - KEVIN_DISC.cx) / KEVIN_DISC.rx;
  const dy = (y - KEVIN_DISC.cy) / KEVIN_DISC.ry;
  return dx * dx + dy * dy <= 1;
}

function addDilatedMask(
  target: Uint8Array,
  mask: Uint8Array,
  radius: number,
  protectedMask?: Uint8Array,
): void {
  const radiusSq = radius * radius;

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);

    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        if (ox * ox + oy * oy > radiusSq) continue;
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) continue;
        if (!insideMap(nx, ny)) continue;
        const np = ny * WIDTH + nx;
        if (protectedMask?.[np]) continue;
        target[np] = 1;
      }
    }
  }
}

interface PixelComponent {
  pixels: number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function collectComponents(mask: Uint8Array): PixelComponent[] {
  const visited = new Uint8Array(mask.length);
  const components: PixelComponent[] = [];
  const neighbors = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],            [1, 0],
    [-1, 1],  [0, 1],   [1, 1],
  ] as const;

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel] || visited[pixel]) continue;

    const queue = [pixel];
    const pixels: number[] = [];
    visited[pixel] = 1;

    const startX = pixel % WIDTH;
    const startY = Math.floor(pixel / WIDTH);
    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;

    while (queue.length) {
      const current = queue.pop()!;
      pixels.push(current);

      const x = current % WIDTH;
      const y = Math.floor(current / WIDTH);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) continue;
        const np = ny * WIDTH + nx;
        if (!mask[np] || visited[np]) continue;
        visited[np] = 1;
        queue.push(np);
      }
    }

    components.push({ pixels, minX, maxX, minY, maxY });
  }

  return components;
}

function isDecorativeSourcePixel(
  source: Uint8ClampedArray,
  pixel: number,
  protectedMask: Uint8Array,
): boolean {
  if (protectedMask[pixel]) return false;

  const x = pixel % WIDTH;
  const y = Math.floor(pixel / WIDTH);
  if (!insideMap(x, y)) return false;

  const offset = pixel * 4;
  const r = source[offset]!;
  const g = source[offset + 1]!;
  const b = source[offset + 2]!;
  const a = source[offset + 3]!;
  if (a < 8) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const brightness = (r + g + b) / 3;

  const purple =
    b >= 82 &&
    r >= 52 &&
    b > g * 1.10 &&
    r > g * 0.70;

  const warm =
    r >= 104 &&
    g >= 62 &&
    b < g * 0.76 &&
    r > b * 1.26;

  const neutralBright =
    brightness >= 142 &&
    chroma <= 62;

  return purple || warm || neutralBright;
}

function buildCleanupMask(source: Uint8ClampedArray): Uint8Array {
  const cleanup = new Uint8Array(WIDTH * HEIGHT);
  const protectedMask = new Uint8Array(WIDTH * HEIGHT);

  const sun = KEVIN_AUTHORED_OBJECTS.find((definition) => definition.id === 'sun');
  if (!sun) throw new Error('Kevin authored sun mask is missing');
  addDilatedMask(protectedMask, decodeKevinAuthoredMask(sun), 12);

  // Deterministic removal of only known authored movable bodies and marker.
  for (const definition of KEVIN_AUTHORED_OBJECTS) {
    if (definition.id === 'sun') continue;
    if (definition.id !== 'marker_star' && !MOVING_PLANETS.has(definition.id)) continue;

    const radius = definition.id === 'marker_star' ? 2 : 3;
    addDilatedMask(
      cleanup,
      decodeKevinAuthoredMask(definition),
      radius,
      protectedMask,
    );
  }

  // Detect source decorations only. This analysis is performed against the
  // untouched PNG, never against a partially repaired frame.
  const candidates = new Uint8Array(WIDTH * HEIGHT);
  for (let pixel = 0; pixel < candidates.length; pixel += 1) {
    if (isDecorativeSourcePixel(source, pixel, protectedMask)) {
      candidates[pixel] = 1;
    }
  }

  for (const component of collectComponents(candidates)) {
    const width = component.maxX - component.minX + 1;
    const height = component.maxY - component.minY + 1;
    const maxDim = Math.max(width, height);
    const minDim = Math.max(1, Math.min(width, height));

    // Source-pixel audit: decorative dots, dashes and small blocks stay under
    // these limits. Long cyan orbit strokes do not.
    const markerLike =
      component.pixels.length >= 2 &&
      component.pixels.length <= 180 &&
      maxDim <= 30 &&
      minDim <= 13;

    if (!markerLike) continue;

    const componentMask = new Uint8Array(WIDTH * HEIGHT);
    for (const pixel of component.pixels) componentMask[pixel] = 1;
    addDilatedMask(cleanup, componentMask, 1, protectedMask);
  }

  return cleanup;
}

function boundaryPixelsForComponent(
  component: PixelComponent,
  cleanupMask: Uint8Array,
): number[] {
  const boundary = new Set<number>();

  for (const pixel of component.pixels) {
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);

    for (let oy = -2; oy <= 2; oy += 1) {
      for (let ox = -2; ox <= 2; ox += 1) {
        if (!ox && !oy) continue;
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) continue;
        if (!insideMap(nx, ny)) continue;
        const np = ny * WIDTH + nx;
        if (cleanupMask[np]) continue;
        boundary.add(np);
      }
    }
  }

  const values = Array.from(boundary);
  if (values.length <= 180) return values;

  // Deterministic even down-sampling keeps load cost bounded.
  const sampled: number[] = [];
  for (let i = 0; i < 180; i += 1) {
    sampled.push(values[Math.floor((i * values.length) / 180)]!);
  }
  return sampled;
}

function repairComponentFromBoundary(
  source: Uint8ClampedArray,
  target: Uint8ClampedArray,
  component: PixelComponent,
  cleanupMask: Uint8Array,
): void {
  const boundary = boundaryPixelsForComponent(component, cleanupMask);
  if (!boundary.length) return;

  for (const pixel of component.pixels) {
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);
    const offset = pixel * 4;

    let totalWeight = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    for (const boundaryPixel of boundary) {
      const bx = boundaryPixel % WIDTH;
      const by = Math.floor(boundaryPixel / WIDTH);
      const dx = bx - x;
      const dy = by - y;
      const weight = 1 / (dx * dx + dy * dy + 0.5);
      const boundaryOffset = boundaryPixel * 4;

      totalWeight += weight;
      sumR += source[boundaryOffset]! * weight;
      sumG += source[boundaryOffset + 1]! * weight;
      sumB += source[boundaryOffset + 2]! * weight;
    }

    target[offset] = Math.round(sumR / totalWeight);
    target[offset + 1] = Math.round(sumG / totalWeight);
    target[offset + 2] = Math.round(sumB / totalWeight);
    target[offset + 3] = source[offset + 3]!;
  }
}

function buildCleanBasePixels(
  source: Uint8ClampedArray,
  sourceEllipse: Uint8ClampedArray,
): Uint8ClampedArray {
  const clean = sourceEllipse.slice();
  const cleanupMask = buildCleanupMask(source);

  // Boundary interpolation uses only untouched neighboring source pixels.
  // Unlike the old angular donor pass it cannot copy distant dark squares,
  // planets or unrelated HUD fragments into the repaired region.
  for (const component of collectComponents(cleanupMask)) {
    repairComponentFromBoundary(source, clean, component, cleanupMask);
  }

  return clean;
}


interface KevinOwnerMask {
  definition: KevinPixelOwnerDefinition;
  mask: Uint8Array;
}


const NO_OWNER = 0xffff;

function createMapMask(): Uint8Array {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (insideMap(x, y)) mask[y * WIDTH + x] = 1;
    }
  }
  return mask;
}

function maskPixelCount(mask: Uint8Array): number {
  let count = 0;
  for (const value of mask) count += value ? 1 : 0;
  return count;
}

function maskToAlphaCanvas(mask: Uint8Array): HTMLCanvasElement {
  const canvas = createTransparentCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kevin owner mask requires a 2D canvas');
  const image = ctx.createImageData(WIDTH, HEIGHT);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    image.data[pixel * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function alphaMaskFromCanvas(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Kevin owner raster requires a readable 2D canvas');
  const rgba = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (rgba[pixel * 4 + 3]! > 0) mask[pixel] = 1;
  }
  return mask;
}

function rasterizeOwner(
  draw: (ctx: CanvasRenderingContext2D) => void,
  clipToMap = true,
): Uint8Array {
  const canvas = createTransparentCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kevin owner raster requires a 2D canvas');

  ctx.save();
  if (clipToMap) {
    ctx.beginPath();
    ctx.ellipse(
      KEVIN_DISC.cx,
      KEVIN_DISC.cy,
      KEVIN_DISC.rx,
      KEVIN_DISC.ry,
      0,
      0,
      Math.PI * 2,
    );
    ctx.clip();
  }
  draw(ctx);
  ctx.restore();

  return alphaMaskFromCanvas(canvas);
}

function classifyAuthoredDetail(
  rgba: Uint8ClampedArray,
  component: PixelComponent,
): string {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const pixel of component.pixels) {
    const offset = pixel * 4;
    r += rgba[offset]!;
    g += rgba[offset + 1]!;
    b += rgba[offset + 2]!;
  }
  const count = Math.max(1, component.pixels.length);
  r /= count;
  g /= count;
  b /= count;

  if (b > r * 1.13 && g > r * 1.06) return 'cyan-detail';
  if (r > b * 1.22 && g > b * 1.05) return 'warm-detail';
  if (b > g * 1.03 && r > g * 0.72) return 'violet-detail';
  return 'neutral-detail';
}

function buildSunOwnerMasks(
  source: Uint8ClampedArray,
): KevinOwnerMask[] {
  const definition = KEVIN_AUTHORED_OBJECTS.find((item) => item.id === 'sun');
  if (!definition) throw new Error('Kevin authored sun mask is missing');

  const sourceMask = decodeKevinAuthoredMask(definition);
  const core = new Uint8Array(sourceMask.length);
  const inner = new Uint8Array(sourceMask.length);
  const outer = new Uint8Array(sourceMask.length);

  const cx = definition.bounds.x + (definition.bounds.w - 1) / 2;
  const cy = definition.bounds.y + (definition.bounds.h - 1) / 2;
  const rx = Math.max(1, definition.bounds.w / 2);
  const ry = Math.max(1, definition.bounds.h / 2);

  for (let pixel = 0; pixel < sourceMask.length; pixel += 1) {
    if (!sourceMask[pixel]) continue;
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    const radial = Math.hypot(dx, dy);
    const offset = pixel * 4;
    const luma =
      source[offset]! * 0.2126 +
      source[offset + 1]! * 0.7152 +
      source[offset + 2]! * 0.0722;

    if (radial <= 0.43 || luma >= 220) core[pixel] = 1;
    else if (radial <= 0.76 || luma >= 155) inner[pixel] = 1;
    else outer[pixel] = 1;
  }

  return [
    {
      definition: {
        id: 'sun_outer_glow',
        parentId: 'sun',
        category: 'sun',
        subpart: 'outer-glow',
        dynamic: false,
        z: 10,
        sourcePixelCount: maskPixelCount(outer),
      },
      mask: outer,
    },
    {
      definition: {
        id: 'sun_inner_glow',
        parentId: 'sun',
        category: 'sun',
        subpart: 'inner-glow',
        dynamic: false,
        z: 11,
        sourcePixelCount: maskPixelCount(inner),
      },
      mask: inner,
    },
    {
      definition: {
        id: 'sun_core',
        parentId: 'sun',
        category: 'sun',
        subpart: 'core',
        dynamic: false,
        z: 12,
        sourcePixelCount: maskPixelCount(core),
      },
      mask: core,
    },
  ];
}

function buildAuthoredOwnerMasks(
  source: Uint8ClampedArray,
  cleanPixels: Uint8ClampedArray,
): KevinOwnerMask[] {
  const mapMask = createMapMask();
  const claimed = new Uint8Array(mapMask.length);
  const owners: KevinOwnerMask[] = [];

  const sunOwners = buildSunOwnerMasks(source);
  for (const owner of sunOwners) {
    for (let pixel = 0; pixel < owner.mask.length; pixel += 1) {
      if (owner.mask[pixel]) claimed[pixel] = 1;
    }
  }

  const protectedMask = claimed.slice();
  const candidates = new Uint8Array(WIDTH * HEIGHT);
  for (let pixel = 0; pixel < candidates.length; pixel += 1) {
    if (isDecorativeSourcePixel(cleanPixels, pixel, protectedMask)) {
      candidates[pixel] = 1;
    }
  }

  const components = collectComponents(candidates)
    .filter((component) => component.pixels.length >= 2)
    .sort((a, b) => {
      if (a.minY !== b.minY) return a.minY - b.minY;
      if (a.minX !== b.minX) return a.minX - b.minX;
      return a.pixels.length - b.pixels.length;
    });

  components.forEach((component, index) => {
    const mask = new Uint8Array(WIDTH * HEIGHT);
    for (const pixel of component.pixels) {
      if (!mapMask[pixel] || claimed[pixel]) continue;
      mask[pixel] = 1;
      claimed[pixel] = 1;
    }
    const count = maskPixelCount(mask);
    if (!count) return;

    const semantic = classifyAuthoredDetail(cleanPixels, component);
    owners.push({
      definition: {
        id: `authored_detail_${String(index + 1).padStart(3, '0')}`,
        parentId: 'authored_map',
        category: 'authored-detail',
        subpart: semantic,
        dynamic: false,
        z: 5,
        sourcePixelCount: count,
        primitiveIndex: index,
      },
      mask,
    });
  });

  const base = new Uint8Array(WIDTH * HEIGHT);
  for (let pixel = 0; pixel < mapMask.length; pixel += 1) {
    if (mapMask[pixel] && !claimed[pixel]) base[pixel] = 1;
  }

  return [
    {
      definition: {
        id: 'authored_map_base',
        parentId: null,
        category: 'map-base',
        subpart: 'glass-and-unclassified-source-pixels',
        dynamic: false,
        z: 0,
        sourcePixelCount: maskPixelCount(base),
      },
      mask: base,
    },
    ...owners,
    ...sunOwners,
  ];
}

function buildSourceFrameOwnerMasks(
  source: Uint8ClampedArray,
): KevinOwnerMask[] {
  const mapMask = createMapMask();
  const claimed = new Uint8Array(mapMask.length);
  const owners: KevinOwnerMask[] = [];

  for (const definition of KEVIN_AUTHORED_OBJECTS) {
    const exact = decodeKevinAuthoredMask(definition);
    for (let pixel = 0; pixel < exact.length; pixel += 1) {
      if (exact[pixel]) claimed[pixel] = 1;
    }
    owners.push({
      definition: {
        id: `source_${definition.id}`,
        parentId:
          definition.id === 'sun'
            ? 'sun'
            : definition.id === 'marker_star'
              ? 'authored_map'
              : definition.id,
        category:
          definition.id === 'sun'
            ? 'sun'
            : definition.id === 'marker_star'
              ? 'authored-detail'
              : 'planet',
        subpart: 'authored-source-pixels',
        dynamic: false,
        z: 10,
        sourcePixelCount: definition.pixelCount,
      },
      mask: exact,
    });
  }

  const base = new Uint8Array(mapMask.length);
  for (let pixel = 0; pixel < mapMask.length; pixel += 1) {
    if (mapMask[pixel] && !claimed[pixel]) base[pixel] = 1;
  }

  return [
    {
      definition: {
        id: 'source_map_base',
        parentId: null,
        category: 'map-base',
        subpart: 'authored-source-background',
        dynamic: false,
        z: 0,
        sourcePixelCount: maskPixelCount(base),
      },
      mask: base,
    },
    ...owners,
  ];
}

function buildOwnershipSnapshotFromMasks(
  timeSec: number,
  working: boolean,
  layers: readonly KevinOwnerMask[],
): KevinPixelOwnershipSnapshot {
  const mapMask = createMapMask();
  const pixelCount = WIDTH * HEIGHT;
  const counts = new Uint16Array(pixelCount);
  const primaryOwner = new Uint16Array(pixelCount);
  primaryOwner.fill(NO_OWNER);

  layers.forEach((layer, ownerIndex) => {
    if (ownerIndex >= NO_OWNER) {
      throw new Error('Kevin pixel-owner index exceeds Uint16 capacity');
    }
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      if (!layer.mask[pixel]) continue;
      counts[pixel] += 1;
      primaryOwner[pixel] = ownerIndex;
    }
  });

  const stackOffsets = new Uint32Array(pixelCount + 1);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    stackOffsets[pixel + 1] = stackOffsets[pixel]! + counts[pixel]!;
  }

  const stackOwnerIndices = new Uint16Array(stackOffsets[pixelCount]!);
  const cursors = stackOffsets.slice(0, pixelCount);

  layers.forEach((layer, ownerIndex) => {
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      if (!layer.mask[pixel]) continue;
      const cursor = cursors[pixel]!;
      stackOwnerIndices[cursor] = ownerIndex;
      cursors[pixel] = cursor + 1;
    }
  });

  return {
    width: WIDTH,
    height: HEIGHT,
    timeSec,
    working,
    owners: layers.map((layer) => layer.definition),
    primaryOwner,
    stackOffsets,
    stackOwnerIndices,
    mapMask,
  };
}

function rasterizeLegacyHazeOwner(
  cloud: number,
  timeSec: number,
  working: boolean,
): Uint8Array {
  return rasterizeOwner((ctx) => {
    ctx.globalCompositeOperation = 'lighter';
    const u = cloud / 11;
    const legacyX = 14 + u * 78;
    const legacyY =
      53 -
      u * 36 +
      Math.sin(u * 6 + timeSec * 0.025) * 3;
    const point = mapLegacyPoint(legacyX, legacyY);
    const rx = legacyRadiusX(11) * 1.7;
    const ry =
      legacyRadiusY(11) *
      (0.6 + (cloud % 3) * 0.12);

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.scale(1, ry / Math.max(0.001, rx));
    const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    haze.addColorStop(0, working ? '#56bdd632' : '#56bdd622');
    haze.addColorStop(0.35, '#348da918');
    haze.addColorStop(1, '#16435b00');
    ctx.fillStyle = haze;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  });
}

function rasterizeLegacyDustOwner(
  index: number,
  timeSec: number,
  working: boolean,
): Uint8Array {
  const mote = LEGACY_HOLOGRAM_DUST[index]!;
  return rasterizeOwner((ctx) => {
    const drift = Math.sin(timeSec * 0.18 + mote.depth * 0.13);
    const point = mapLegacyPoint(
      mote.x + drift * mote.depth * 0.65,
      mote.y +
        Math.cos(timeSec * 0.13 + mote.depth * 0.2) *
          mote.depth *
          0.3,
    );
    const mappedRadius = Math.max(0.28, legacyRadiusX(mote.radius));
    ctx.globalAlpha =
      mote.alpha *
      (working ? 0.72 : 0.52) *
      (0.8 + Math.sin(timeSec * 0.8 + mote.x) * 0.2);
    ctx.fillStyle = mote.depth > 0 ? '#beedf0' : '#5ba8c3';
    ctx.beginPath();
    ctx.arc(point.x, point.y, mappedRadius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function rasterizeLegacyStarGridOwner(
  index: number,
  working: boolean,
): Uint8Array {
  return rasterizeOwner((ctx) => {
    const x = 7 + ((index * 37.73) % 91);
    const y = 7 + ((index * 19.31) % 57);
    const point = mapLegacyPoint(x, y);
    const radius = index % 7 === 0 ? 0.72 : 0.42;
    ctx.globalAlpha =
      (working ? 0.34 : 0.24) *
      (0.68 + (index % 4) * 0.08);
    ctx.fillStyle = '#bedee8';
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function rasterizeNavigationBranchOwner(
  branch: number,
  working: boolean,
): Uint8Array {
  return rasterizeOwner((ctx) => {
    const p32_15 = mapLegacyPoint(32, 15);
    const p54_38 = mapLegacyPoint(54, 38);
    const p86_20 = mapLegacyPoint(86, 20);
    const p87_51 = mapLegacyPoint(87, 51);
    const c1 = mapLegacyPoint(35, 28);
    const c2 = mapLegacyPoint(43, 35);
    const c3 = mapLegacyPoint(66, 32);
    const c4 = mapLegacyPoint(76, 23);
    const c5 = mapLegacyPoint(68, 44);
    const c6 = mapLegacyPoint(79, 46);

    ctx.globalAlpha = working ? 0.24 : 0.16;
    ctx.strokeStyle = '#70c4d8';
    ctx.lineWidth = 0.75;
    ctx.beginPath();

    if (branch === 0) {
      ctx.moveTo(p32_15.x, p32_15.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p54_38.x, p54_38.y);
    } else if (branch === 1) {
      ctx.moveTo(p54_38.x, p54_38.y);
      ctx.bezierCurveTo(c3.x, c3.y, c4.x, c4.y, p86_20.x, p86_20.y);
    } else {
      ctx.moveTo(p54_38.x, p54_38.y);
      ctx.bezierCurveTo(c5.x, c5.y, c6.x, c6.y, p87_51.x, p87_51.y);
    }
    ctx.stroke();
  });
}

const LEGACY_STAR_NODE_SPECS = [
  [32, 15, 0.42, '#ffae83'],
  [86, 20, 0.68, '#c1f3ff'],
  [87, 51, 0.50, '#bceeff'],
  [69, 27, 0.28, '#bceeff'],
  [18, 45, 0.30, '#bceeff'],
] as const;

function rasterizeLegacyStarNodeOwner(
  index: number,
  working: boolean,
): Uint8Array {
  const [x, y, radius, color] = LEGACY_STAR_NODE_SPECS[index]!;
  const opacity = [
    working ? 0.66 : 0.50,
    working ? 0.82 : 0.64,
    working ? 0.68 : 0.50,
    working ? 0.74 : 0.56,
    working ? 0.58 : 0.42,
  ][index]!;
  return rasterizeOwner((ctx) => {
    drawLegacyMapStar(ctx, x, y, radius, color, opacity);
  });
}

function rasterizeGuideOrbitOwner(
  index: number,
  working: boolean,
): Uint8Array {
  const radii = [56, 91, 132] as const;
  const radius = radii[index]!;
  return rasterizeOwner((ctx) => {
    ctx.strokeStyle = '#70c4d8';
    ctx.lineWidth = 0.62;
    ctx.globalAlpha = working ? 0.16 : 0.10;
    ctx.beginPath();
    ctx.ellipse(
      SUN_X,
      SUN_Y,
      radius,
      radius * ORBIT_Y_SCALE,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  });
}

function rasterizeMeasuredOrbitOwner(
  patch: PlanetPatch,
  working: boolean,
): Uint8Array {
  return rasterizeOwner((ctx) => {
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = working
      ? 'rgba(112, 218, 242, 0.18)'
      : 'rgba(100, 194, 224, 0.12)';
    ctx.lineWidth = working ? 0.72 : 0.58;
    ctx.beginPath();
    ctx.ellipse(
      SUN_X,
      SUN_Y,
      patch.orbitRadius,
      patch.orbitRadius * ORBIT_Y_SCALE,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  });
}

function buildPlanetOwnerMasks(
  patch: PlanetPatch,
  x: number,
  y: number,
  depth: number,
  intro: number,
  timeSec: number,
): KevinOwnerMask[] {
  const config = patch.config;
  const scale = 1 + config.scaleAmplitude * depth * intro;
  const opacity = 0.95 + (depth + 1) * 0.025;
  const hologramPulse =
    Math.sin(timeSec * 0.65 + config.phase) * 0.005;
  const brightness =
    0.985 +
    (depth + 1) * 0.016 +
    hologramPulse;

  const canvas = createTransparentCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kevin planet owner raster requires 2D canvas');

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    KEVIN_DISC.cx,
    KEVIN_DISC.cy,
    KEVIN_DISC.rx,
    KEVIN_DISC.ry,
    0,
    0,
    Math.PI * 2,
  );
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;
  ctx.filter = `brightness(${brightness.toFixed(3)})`;
  ctx.drawImage(
    patch.canvas,
    -patch.localCenterX,
    -patch.localCenterY,
  );
  ctx.restore();

  const rgba = canvas
    .getContext('2d', { willReadFrequently: true })!
    .getImageData(0, 0, WIDTH, HEIGHT)
    .data;

  const masks = {
    atmosphere: new Uint8Array(WIDTH * HEIGHT),
    ring: new Uint8Array(WIDTH * HEIGHT),
    highlight: new Uint8Array(WIDTH * HEIGHT),
    surface: new Uint8Array(WIDTH * HEIGHT),
    shadow: new Uint8Array(WIDTH * HEIGHT),
  };

  const radius = patch.visual.radius;
  const cosTilt = Math.cos(-patch.visual.tilt);
  const sinTilt = Math.sin(-patch.visual.tilt);

  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
    const alpha = rgba[pixel * 4 + 3]!;
    if (!alpha) continue;

    const px = pixel % WIDTH;
    const py = Math.floor(pixel / WIDTH);
    const localX = (px + 0.5 - x) / scale;
    const localY = (py + 0.5 - y) / scale;
    const radial = Math.hypot(localX, localY);

    if (radial > radius) {
      if (patch.visual.style === 'ringed_gas') {
        const rx = localX * cosTilt - localY * sinTilt;
        const ry = localX * sinTilt + localY * cosTilt;
        const ringMetric = Math.sqrt(
          (rx * rx) / ((radius * 2.02) ** 2) +
          (ry * ry) / ((radius * 0.60) ** 2),
        );
        if (Math.abs(ringMetric - 1) <= 0.18) masks.ring[pixel] = 1;
        else masks.atmosphere[pixel] = 1;
      } else {
        masks.atmosphere[pixel] = 1;
      }
      continue;
    }

    const offset = pixel * 4;
    const luma =
      rgba[offset]! * 0.2126 +
      rgba[offset + 1]! * 0.7152 +
      rgba[offset + 2]! * 0.0722;

    if (luma >= 180) masks.highlight[pixel] = 1;
    else if (luma <= 78) masks.shadow[pixel] = 1;
    else masks.surface[pixel] = 1;
  }

  const prefix = patch.id;
  const definitions: Array<[keyof typeof masks, string, number]> = [
    ['atmosphere', 'atmosphere', 100],
    ['ring', 'ring', 101],
    ['shadow', 'body-shadow', 102],
    ['surface', 'body-surface', 103],
    ['highlight', 'body-highlight', 104],
  ];

  const output: KevinOwnerMask[] = [];
  for (const [key, subpart, zOffset] of definitions) {
    const mask = masks[key];
    const count = maskPixelCount(mask);
    if (!count) continue;
    output.push({
      definition: {
        id: `${prefix}_${subpart.replaceAll('-', '_')}`,
        parentId: prefix,
        category: 'planet',
        subpart,
        dynamic: true,
        z: zOffset,
        sourcePixelCount: count,
      },
      mask,
    });
  }
  return output;
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

function makePlanetSprite(spec: PlanetVisualSpec): HTMLCanvasElement {
  const padding = spec.style === 'ringed_gas' ? 18 : 11;
  const size = Math.ceil((spec.radius + padding) * 2);
  const cx = size / 2;
  const cy = size / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kevin realistic planet requires a 2D canvas');

  ctx.clearRect(0, 0, size, size);

  // A subtle atmosphere only, avoiding the neon-dot look from earlier versions.
  const atmosphere = ctx.createRadialGradient(
    cx - spec.radius * 0.25,
    cy - spec.radius * 0.25,
    spec.radius * 0.25,
    cx,
    cy,
    spec.radius * 1.45,
  );
  atmosphere.addColorStop(0, 'rgba(255,255,255,0.028)');
  atmosphere.addColorStop(0.64, 'rgba(150,220,255,0.012)');
  atmosphere.addColorStop(1, 'rgba(100,190,255,0)');
  ctx.fillStyle = atmosphere;
  ctx.beginPath();
  ctx.arc(cx, cy, spec.radius * 1.45, 0, Math.PI * 2);
  ctx.fill();

  if (spec.style === 'ringed_gas' && spec.ring) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spec.tilt);
    ctx.strokeStyle = 'rgba(70,62,54,0.24)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, spec.radius * 2.02, spec.radius * 0.60, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = spec.ring;
    ctx.lineWidth = 1.05;
    ctx.beginPath();
    ctx.ellipse(0, 0, spec.radius * 2.02, spec.radius * 0.60, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, spec.radius, 0, Math.PI * 2);
  ctx.clip();

  const body = ctx.createRadialGradient(
    cx - spec.radius * 0.42,
    cy - spec.radius * 0.38,
    spec.radius * 0.08,
    cx + spec.radius * 0.2,
    cy + spec.radius * 0.1,
    spec.radius * 1.22,
  );
  body.addColorStop(0, spec.highlight);
  body.addColorStop(0.34, spec.primary);
  body.addColorStop(0.78, spec.secondary);
  body.addColorStop(1, '#11131a');
  ctx.fillStyle = body;
  ctx.fillRect(
    cx - spec.radius - 2,
    cy - spec.radius - 2,
    spec.radius * 2 + 4,
    spec.radius * 2 + 4,
  );

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spec.tilt);
  ctx.translate(-cx, -cy);

  if (spec.style === 'gas_banded' || spec.style === 'ringed_gas') {
    const bandCount = spec.style === 'gas_banded' ? 3 : 2;
    for (let band = -bandCount; band <= bandCount; band += 1) {
      const y = cy + band * (spec.radius * 0.24);
      const thickness = spec.radius * (band % 2 === 0 ? 0.09 : 0.06);
      ctx.globalAlpha = band % 2 === 0 ? 0.22 : 0.12;
      ctx.fillStyle =
        band % 3 === 0
          ? (spec.accent ?? spec.secondary)
          : band % 2 === 0
            ? spec.highlight
            : spec.secondary;
      ctx.beginPath();
      ctx.ellipse(
        cx,
        y,
        spec.radius * 1.05,
        thickness,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    if (spec.style === 'gas_banded') {
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = spec.accent ?? '#8d4e35';
      ctx.beginPath();
      ctx.ellipse(
        cx + spec.radius * 0.28,
        cy + spec.radius * 0.18,
        spec.radius * 0.22,
        spec.radius * 0.11,
        -0.12,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else if (spec.style === 'rocky' || spec.style === 'moon') {
    const craterCount = spec.style === 'rocky' ? 4 : 3;
    for (let i = 0; i < craterCount; i += 1) {
      const angle = i * 2.17 + spec.tilt;
      const radial = spec.radius * (0.18 + (i % 4) * 0.13);
      const px = cx + Math.cos(angle) * radial;
      const py = cy + Math.sin(angle * 1.31) * radial * 0.72;
      const craterRadius =
        spec.radius * (0.055 + (i % 3) * 0.027);
      ctx.globalAlpha = 0.18 + (i % 2) * 0.06;
      ctx.fillStyle = i % 2 === 0 ? spec.secondary : (spec.accent ?? spec.secondary);
      ctx.beginPath();
      ctx.arc(px, py, craterRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = spec.highlight;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.arc(px - craterRadius * 0.2, py - craterRadius * 0.2, craterRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (spec.style === 'icy') {
    for (let i = -1; i <= 1; i += 1) {
      ctx.globalAlpha = 0.10 + (i === 0 ? 0.05 : 0);
      ctx.strokeStyle = i % 2 === 0 ? spec.highlight : (spec.accent ?? spec.primary);
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.moveTo(
        cx - spec.radius * 0.86,
        cy + i * spec.radius * 0.18,
      );
      ctx.quadraticCurveTo(
        cx,
        cy + i * spec.radius * 0.12 - spec.radius * 0.08,
        cx + spec.radius * 0.88,
        cy + i * spec.radius * 0.16,
      );
      ctx.stroke();
    }
  }

  ctx.restore();

  // Terminator: one side falls naturally into shadow instead of glowing uniformly.
  const terminator = ctx.createLinearGradient(
    cx - spec.radius,
    cy,
    cx + spec.radius,
    cy,
  );
  terminator.addColorStop(0, 'rgba(255,255,255,0.12)');
  terminator.addColorStop(0.38, 'rgba(255,255,255,0)');
  terminator.addColorStop(0.68, 'rgba(0,0,0,0.12)');
  terminator.addColorStop(1, 'rgba(0,0,0,0.58)');
  ctx.fillStyle = terminator;
  ctx.fillRect(
    cx - spec.radius,
    cy - spec.radius,
    spec.radius * 2,
    spec.radius * 2,
  );

  ctx.restore();

  // Thin directional rim light, not a full neon ring.
  ctx.strokeStyle = 'rgba(224,244,255,0.22)';
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  ctx.arc(
    cx,
    cy,
    spec.radius - 0.4,
    Math.PI * 0.64,
    Math.PI * 1.58,
  );
  ctx.stroke();

  return canvas;
}

function keplerAngularSpeed(radius: number, speedMultiplier: number): number {
  const safeRadius = Math.max(1, radius);
  const period =
    KEPLER_REFERENCE_PERIOD_SEC *
    Math.pow(safeRadius / KEPLER_REFERENCE_RADIUS, 1.5);
  return (Math.PI * 2 * speedMultiplier) / period;
}

function drawMeasuredOrbitTracks(
  ctx: CanvasRenderingContext2D,
  patches: readonly PlanetPatch[],
  working: boolean,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    KEVIN_DISC.cx,
    KEVIN_DISC.cy,
    KEVIN_DISC.rx,
    KEVIN_DISC.ry,
    0,
    0,
    Math.PI * 2,
  );
  ctx.clip();

  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = working
    ? 'rgba(112, 218, 242, 0.18)'
    : 'rgba(100, 194, 224, 0.12)';
  ctx.lineWidth = working ? 0.72 : 0.58;

  const uniqueRadii = [...patches]
    .map((patch) => patch.orbitRadius)
    .sort((a, b) => a - b);

  for (const radius of uniqueRadii) {
    ctx.beginPath();
    ctx.ellipse(
      SUN_X,
      SUN_Y,
      radius,
      radius * ORBIT_Y_SCALE,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function buildPlanetPatch(
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
  const centroid = planetCentroid(mask);
  const u = centroid.x - SUN_X;
  const v = (centroid.y - SUN_Y) / ORBIT_Y_SCALE;
  const visual = PLANET_VISUALS[id];
  const sprite = makePlanetSprite(visual);

  return {
    id,
    canvas: sprite,
    localCenterX: sprite.width / 2,
    localCenterY: sprite.height / 2,
    orbitRadius: Math.hypot(u, v),
    orbitTheta: Math.atan2(v, u),
    config,
    visual,
  };
}

function buildSourceAndCleanBase(
  source: Uint8ClampedArray,
): {
  sourceEllipse: HTMLCanvasElement;
  cleanBase: HTMLCanvasElement;
  cleanPixels: Uint8ClampedArray;
  patches: PlanetPatch[];
} {
  const sourceEllipseData = new ImageData(WIDTH, HEIGHT);
  copyMapEllipse(source, sourceEllipseData.data);

  const cleanPixels = buildCleanBasePixels(source, sourceEllipseData.data);
  const cleanBaseData = new ImageData(
    new Uint8ClampedArray(cleanPixels),
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
    patches.push(buildPlanetPatch(definition, mask, config));
  }

  const sourceEllipse = createTransparentCanvas();
  const sourceCtx = sourceEllipse.getContext('2d');
  if (!sourceCtx) throw new Error('Kevin source ellipse requires 2D canvas');
  sourceCtx.putImageData(sourceEllipseData, 0, 0);

  const cleanBase = createTransparentCanvas();
  const cleanCtx = cleanBase.getContext('2d');
  if (!cleanCtx) throw new Error('Kevin clean base requires 2D canvas');
  cleanCtx.putImageData(cleanBaseData, 0, 0);

  return {
    sourceEllipse,
    cleanBase,
    cleanPixels: new Uint8ClampedArray(cleanPixels),
    patches,
  };
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
      const dx = (x - KEVIN_DISC.cx) / KEVIN_DISC.rx;
      const dy = (y - KEVIN_DISC.cy) / KEVIN_DISC.ry;
      if (dx * dx + dy * dy > 1) continue;
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
 * Kevin V10 planet visual v2.
 *
 * The authored map/orbits/sun remain as the scene's physical source of truth.
 * Only the five small moving bodies are redesigned as compact, shaded planets
 * with directional light, surface structure and restrained atmosphere. Motion
 * remains tied to the original measured orbital positions.
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
  const { sourceEllipse, cleanBase, cleanPixels, patches } =
    buildSourceAndCleanBase(source);

  const restDiffPixels = countEllipseDiff(source, sourceEllipse);
  if (restDiffPixels !== 0) {
    throw new Error(
      `Kevin source ellipse reconstruction failed: ${restDiffPixels} pixels differ`,
    );
  }

  const authoredOwnerMasks = buildAuthoredOwnerMasks(source, cleanPixels);
  const sourceFrameOwnerMasks = buildSourceFrameOwnerMasks(source);

  const sourcePixelCount = (id: KevinAuthoredObjectId): number =>
    KEVIN_AUTHORED_OBJECTS.find((definition) => definition.id === id)?.pixelCount ?? 0;

  const layerAudit: readonly KevinMotionLayerAudit[] = [
    {
      id: 'authored_sun',
      kind: 'authored-static',
      z: 10,
      sourcePixelCount: sourcePixelCount('sun'),
    },
    {
      id: 'haze_wisps',
      kind: 'procedural-dynamic',
      z: 20,
      primitiveCount: 12,
    },
    {
      id: 'dust_motes',
      kind: 'procedural-dynamic',
      z: 30,
      primitiveCount: LEGACY_HOLOGRAM_DUST.length,
    },
    {
      id: 'star_grid',
      kind: 'generated-static',
      z: 40,
      primitiveCount: 38,
    },
    {
      id: 'navigation_branches',
      kind: 'generated-static',
      z: 50,
      primitiveCount: 3,
    },
    {
      id: 'star_nodes',
      kind: 'generated-static',
      z: 60,
      primitiveCount: 5,
    },
    {
      id: 'guide_orbits',
      kind: 'generated-static',
      z: 70,
      primitiveCount: 3,
    },
    {
      id: 'measured_planet_orbits',
      kind: 'generated-static',
      z: 80,
      primitiveCount: patches.length,
    },
    ...patches.map((patch, index): KevinMotionLayerAudit => ({
      id: patch.id,
      kind: 'planet-dynamic',
      z: 100 + index,
      sourcePixelCount: sourcePixelCount(patch.id),
      orbitRadius: patch.orbitRadius,
      orbitPeriodSec:
        (Math.PI * 2) /
        keplerAngularSpeed(patch.orbitRadius, patch.config.speed),
    })),
  ];


  const frameCanvas = createTransparentCanvas();
  const frameCtx = frameCanvas.getContext('2d');
  if (!frameCtx) throw new Error('Kevin planet visual v2 requires a 2D canvas');

  return {
    width: WIDTH,
    height: HEIGHT,
    restDiffPixels: 0,
    layerAudit,
    buildPixelOwnership(
      timeSec: number,
      working: boolean,
    ): KevinPixelOwnershipSnapshot {
      if (timeSec <= 0.0001) {
        return buildOwnershipSnapshotFromMasks(
          timeSec,
          working,
          sourceFrameOwnerMasks,
        );
      }

      const intro = smoothstep(0, 0.65, timeSec);
      const layers: KevinOwnerMask[] = authoredOwnerMasks.map((owner) => ({
        definition: owner.definition,
        mask: owner.mask,
      }));

      for (let cloud = 0; cloud < 12; cloud += 1) {
        layers.push({
          definition: {
            id: `haze_${String(cloud + 1).padStart(3, '0')}`,
            parentId: 'haze_wisps',
            category: 'haze',
            subpart: 'individual-haze-cloud',
            dynamic: true,
            z: 20,
            primitiveIndex: cloud,
          },
          mask: rasterizeLegacyHazeOwner(cloud, timeSec, working),
        });
      }

      for (let index = 0; index < LEGACY_HOLOGRAM_DUST.length; index += 1) {
        layers.push({
          definition: {
            id: `dust_${String(index + 1).padStart(3, '0')}`,
            parentId: 'dust_motes',
            category: 'dust',
            subpart: 'individual-dust-mote',
            dynamic: true,
            z: 30,
            primitiveIndex: index,
          },
          mask: rasterizeLegacyDustOwner(index, timeSec, working),
        });
      }

      for (let index = 0; index < 38; index += 1) {
        layers.push({
          definition: {
            id: `star_grid_${String(index + 1).padStart(3, '0')}`,
            parentId: 'star_grid',
            category: 'star-grid',
            subpart: 'individual-grid-star',
            dynamic: false,
            z: 40,
            primitiveIndex: index,
          },
          mask: rasterizeLegacyStarGridOwner(index, working),
        });
      }

      for (let branch = 0; branch < 3; branch += 1) {
        layers.push({
          definition: {
            id: `navigation_branch_${String(branch + 1).padStart(2, '0')}`,
            parentId: 'navigation_branches',
            category: 'navigation',
            subpart: 'individual-navigation-branch',
            dynamic: false,
            z: 50,
            primitiveIndex: branch,
          },
          mask: rasterizeNavigationBranchOwner(branch, working),
        });
      }

      for (let index = 0; index < LEGACY_STAR_NODE_SPECS.length; index += 1) {
        layers.push({
          definition: {
            id: `star_node_${String(index + 1).padStart(2, '0')}`,
            parentId: 'star_nodes',
            category: 'star-node',
            subpart: 'individual-glowing-node',
            dynamic: false,
            z: 60,
            primitiveIndex: index,
          },
          mask: rasterizeLegacyStarNodeOwner(index, working),
        });
      }

      for (let index = 0; index < 3; index += 1) {
        layers.push({
          definition: {
            id: `guide_orbit_${String(index + 1).padStart(2, '0')}`,
            parentId: 'guide_orbits',
            category: 'guide-orbit',
            subpart: 'individual-guide-ellipse',
            dynamic: false,
            z: 70,
            primitiveIndex: index,
          },
          mask: rasterizeGuideOrbitOwner(index, working),
        });
      }

      patches.forEach((patch, index) => {
        layers.push({
          definition: {
            id: `planet_orbit_${patch.id}`,
            parentId: patch.id,
            category: 'planet-orbit',
            subpart: 'measured-orbit',
            dynamic: false,
            z: 80,
            primitiveIndex: index,
          },
          mask: rasterizeMeasuredOrbitOwner(patch, working),
        });
      });

      const states = patches
        .map((patch) => {
          const omega = keplerAngularSpeed(
            patch.orbitRadius,
            patch.config.speed,
          );
          const theta = patch.orbitTheta + omega * timeSec;
          const radius = patch.orbitRadius;
          const x = SUN_X + Math.cos(theta) * radius;
          const y =
            SUN_Y + Math.sin(theta) * radius * ORBIT_Y_SCALE;
          const depth = Math.sin(theta);
          return { patch, x, y, depth };
        })
        .sort((a, b) => a.depth - b.depth);

      for (const state of states) {
        layers.push(
          ...buildPlanetOwnerMasks(
            state.patch,
            state.x,
            state.y,
            state.depth,
            intro,
            timeSec,
          ),
        );
      }

      if (intro < 1) {
        const sourceOverlayMask = alphaMaskFromCanvas(sourceEllipse);
        layers.push({
          definition: {
            id: 'transition_source_overlay',
            parentId: null,
            category: 'transition',
            subpart: 'authored-source-crossfade',
            dynamic: true,
            z: 1000,
          },
          mask: sourceOverlayMask,
        });
      }

      return buildOwnershipSnapshotFromMasks(
        timeSec,
        working,
        layers,
      );
    },
    render(timeSec: number, working: boolean): HTMLCanvasElement {
      if (timeSec <= 0.0001) return sourceEllipse;

      const intro = smoothstep(0, 0.65, timeSec);

      frameCtx.save();
      frameCtx.setTransform(1, 0, 0, 1, 0, 0);
      frameCtx.clearRect(0, 0, WIDTH, HEIGHT);
      frameCtx.globalCompositeOperation = 'source-over';
      frameCtx.globalAlpha = 1;
      frameCtx.filter = 'none';
      frameCtx.drawImage(cleanBase, 0, 0);

      // Context is ported from the original Kevin star-map renderer and mapped
      // into the exact physical V10 glass. The solar system keeps its authored
      // Sun focus inside that glass; these are intentionally separate centers.
      drawLegacyMapContext(frameCtx, timeSec, working);
      drawMeasuredOrbitTracks(frameCtx, patches, working);

      const states = patches
        .map((patch) => {
          const config = patch.config;

          // Stable prograde orbital motion. Radius never breathes or reverses.
          // Kepler's third-law relationship makes inner worlds visibly faster
          // and outer worlds slower while preserving each authored start point.
          const omega = keplerAngularSpeed(
            patch.orbitRadius,
            config.speed,
          );
          const theta = patch.orbitTheta + omega * timeSec;
          const radius = patch.orbitRadius;
          const x = SUN_X + Math.cos(theta) * radius;
          const y =
            SUN_Y + Math.sin(theta) * radius * ORBIT_Y_SCALE;
          const depth = Math.sin(theta);
          return { patch, x, y, depth };
        })
        .sort((a, b) => a.depth - b.depth);

      // Planet sprites belong to the holographic glass as well. Clip them to
      // the authored disc so rings/glow can never float over the metal table.
      frameCtx.save();
      frameCtx.beginPath();
      frameCtx.ellipse(
        KEVIN_DISC.cx,
        KEVIN_DISC.cy,
        KEVIN_DISC.rx,
        KEVIN_DISC.ry,
        0,
        0,
        Math.PI * 2,
      );
      frameCtx.clip();

      for (const state of states) {
        const { patch, x, y, depth } = state;
        const config = patch.config;
        const scale =
          1 + config.scaleAmplitude * depth * intro;
        const opacity =
          0.95 + (depth + 1) * 0.025;
        const hologramPulse =
          Math.sin(timeSec * 0.65 + config.phase) * 0.005;
        const brightness =
          0.985 +
          (depth + 1) * 0.016 +
          hologramPulse;

        frameCtx.save();
        frameCtx.translate(x, y);
        frameCtx.scale(scale, scale);

        frameCtx.globalAlpha = opacity;
        frameCtx.filter =
          `brightness(${brightness.toFixed(3)})`;
        frameCtx.drawImage(
          patch.canvas,
          -patch.localCenterX,
          -patch.localCenterY,
        );
        frameCtx.restore();
      }
      frameCtx.restore();

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
