import {
  KEVIN_AUTHORED_OBJECTS,
  KEVIN_DISC,
  KEVIN_STAR_MAP_POLYGON,
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

// The atlas polygon is the measured edge of the actual glass map. The old
// ellipse is only a conservative bounding approximation and clips valid source
// area along the upper edge.
function traceKevinStarMap(ctx: CanvasRenderingContext2D): void {
  const [first, ...rest] = KEVIN_STAR_MAP_POLYGON;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (const [x, y] of rest) ctx.lineTo(x, y);
  ctx.closePath();
}

function clipToKevinStarMap(ctx: CanvasRenderingContext2D): void {
  traceKevinStarMap(ctx);
  ctx.clip();
}

function insideMap(x: number, y: number): boolean {
  let inside = false;
  for (
    let index = 0, previous = KEVIN_STAR_MAP_POLYGON.length - 1;
    index < KEVIN_STAR_MAP_POLYGON.length;
    previous = index, index += 1
  ) {
    const [xi, yi] = KEVIN_STAR_MAP_POLYGON[index]!;
    const [xj, yj] = KEVIN_STAR_MAP_POLYGON[previous]!;
    const crosses = (yi > y) !== (yj > y);
    if (crosses && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

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

interface SemanticDustPoint {
  x: number;
  y: number;
  depth: number;
  radius: number;
  alpha: number;
}

const SEMANTIC_DUST_MOTES: readonly SemanticDustPoint[] = Array.from(
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

function mapSemanticPoint(x: number, y: number): { x: number; y: number } {
  const nx = (x - LEGACY_MAP_CENTER_X) / LEGACY_MAP_HALF_W;
  const ny = (y - LEGACY_MAP_CENTER_Y) / LEGACY_MAP_HALF_H;
  return {
    x: KEVIN_DISC.cx + nx * KEVIN_DISC.rx,
    y: KEVIN_DISC.cy + ny * KEVIN_DISC.ry,
  };
}

function semanticRadiusX(radius: number): number {
  return (radius / LEGACY_MAP_HALF_W) * KEVIN_DISC.rx;
}

function semanticRadiusY(radius: number): number {
  return (radius / LEGACY_MAP_HALF_H) * KEVIN_DISC.ry;
}

function drawSemanticMapStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  opacity: number,
): void {
  const point = mapSemanticPoint(x, y);
  const mappedRadius = Math.max(0.75, semanticRadiusX(radius));

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

function drawSemanticHazeLayer(
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
    const point = mapSemanticPoint(legacyX, legacyY);
    const rx = semanticRadiusX(11) * 1.7;
    const ry =
      semanticRadiusY(11) *
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

function drawSemanticDustLayer(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  working: boolean,
): void {
  for (const mote of SEMANTIC_DUST_MOTES) {
    const drift = Math.sin(timeSec * 0.18 + mote.depth * 0.13);
    const point = mapSemanticPoint(
      mote.x + drift * mote.depth * 0.65,
      mote.y +
        Math.cos(timeSec * 0.13 + mote.depth * 0.2) *
          mote.depth *
          0.3,
    );
    const mappedRadius = Math.max(
      0.28,
      semanticRadiusX(mote.radius),
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

function drawSemanticStarGridLayer(
  ctx: CanvasRenderingContext2D,
  working: boolean,
): void {
  for (let i = 0; i < 38; i += 1) {
    const x = 7 + ((i * 37.73) % 91);
    const y = 7 + ((i * 19.31) % 57);
    const point = mapSemanticPoint(x, y);
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

function drawSemanticNavigationLayer(
  ctx: CanvasRenderingContext2D,
  working: boolean,
): void {
  const p32_15 = mapSemanticPoint(32, 15);
  const p54_38 = mapSemanticPoint(54, 38);
  const p86_20 = mapSemanticPoint(86, 20);
  const p87_51 = mapSemanticPoint(87, 51);
  const c1 = mapSemanticPoint(35, 28);
  const c2 = mapSemanticPoint(43, 35);
  const c3 = mapSemanticPoint(66, 32);
  const c4 = mapSemanticPoint(76, 23);
  const c5 = mapSemanticPoint(68, 44);
  const c6 = mapSemanticPoint(79, 46);

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

function drawSemanticStarNodesLayer(
  ctx: CanvasRenderingContext2D,
  working: boolean,
): void {
  drawSemanticMapStar(ctx, 32, 15, 0.42, '#ffae83', working ? 0.66 : 0.50);
  drawSemanticMapStar(ctx, 86, 20, 0.68, '#c1f3ff', working ? 0.82 : 0.64);
  drawSemanticMapStar(ctx, 87, 51, 0.50, '#bceeff', working ? 0.68 : 0.50);
  drawSemanticMapStar(ctx, 69, 27, 0.28, '#bceeff', working ? 0.74 : 0.56);
  drawSemanticMapStar(ctx, 18, 45, 0.30, '#bceeff', working ? 0.58 : 0.42);
}

function drawSemanticGuideOrbitLayer(
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

function drawSemanticMapContext(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  working: boolean,
): void {
  ctx.save();
  clipToKevinStarMap(ctx);

  // Keep the exact historical drawing order so this refactor is visual-no-op.
  drawSemanticHazeLayer(ctx, timeSec, working);
  drawSemanticDustLayer(ctx, timeSec, working);
  drawSemanticStarGridLayer(ctx, working);
  drawSemanticNavigationLayer(ctx, working);
  drawSemanticStarNodesLayer(ctx, working);
  drawSemanticGuideOrbitLayer(ctx, working);

  ctx.restore();
}

function copyMapSurface(
  source: Uint8ClampedArray,
  target: Uint8ClampedArray,
): void {
  target.fill(0);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (!insideMap(x, y)) continue;
      const offset = (y * WIDTH + x) * 4;
      target[offset] = source[offset]!;
      target[offset + 1] = source[offset + 1]!;
      target[offset + 2] = source[offset + 2]!;
      target[offset + 3] = source[offset + 3]!;
    }
  }
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
    clipToKevinStarMap(ctx);
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

function buildSourceMapBaseOwners(
  source: Uint8ClampedArray,
  claimed: Uint8Array,
  prefix: 'source' | 'authored',
): KevinOwnerMask[] {
  const mapMask = createMapMask();
  const buckets = {
    glass: new Uint8Array(WIDTH * HEIGHT),
    rim: new Uint8Array(WIDTH * HEIGHT),
    orbit: new Uint8Array(WIDTH * HEIGHT),
    warm: new Uint8Array(WIDTH * HEIGHT),
    violet: new Uint8Array(WIDTH * HEIGHT),
    emission: new Uint8Array(WIDTH * HEIGHT),
  };

  for (let pixel = 0; pixel < mapMask.length; pixel += 1) {
    if (!mapMask[pixel] || claimed[pixel]) continue;
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);
    const offset = pixel * 4;
    const r = source[offset]!;
    const g = source[offset + 1]!;
    const b = source[offset + 2]!;
    const a = source[offset + 3]!;
    const brightness = (r + g + b) / 3;
    const radial = Math.hypot(
      (x - KEVIN_DISC.cx) / KEVIN_DISC.rx,
      (y - KEVIN_DISC.cy) / KEVIN_DISC.ry,
    );
    const cyan = b > r * 1.13 && g > r * 1.04 && b > 56;
    const warm = r > b * 1.24 && g > b * 1.04 && r > 78;
    const violet = b > g * 1.04 && r > g * 0.72 && b > 72;

    if (a < 8 || brightness < 42) buckets.glass[pixel] = 1;
    else if (radial >= 0.86 && brightness >= 56) buckets.rim[pixel] = 1;
    else if (cyan && brightness >= 64) buckets.orbit[pixel] = 1;
    else if (warm) buckets.warm[pixel] = 1;
    else if (violet) buckets.violet[pixel] = 1;
    else if (brightness >= 104) buckets.emission[pixel] = 1;
    else buckets.glass[pixel] = 1;
  }

  const definitions: readonly [keyof typeof buckets, string, KevinPixelOwnerCategory, number][] = [
    ['glass', 'glass-field', 'map-base', 0],
    ['rim', 'rim-hud', 'authored-detail', 4],
    ['orbit', 'source-filament', 'guide-orbit', 5],
    ['warm', 'warm-marker', 'authored-detail', 6],
    ['violet', 'violet-marker', 'authored-detail', 6],
    ['emission', 'neutral-emission', 'authored-detail', 6],
  ];

  return definitions
    .map(([key, subpart, category, z]): KevinOwnerMask | null => {
      const mask = buckets[key];
      const count = maskPixelCount(mask);
      if (!count) return null;
      return {
        definition: {
          id: prefix + '_map_' + key,
          parentId: prefix === 'source' ? null : 'authored_map',
          category,
          subpart,
          dynamic: false,
          z,
          sourcePixelCount: count,
        },
        mask,
      };
    })
    .filter((owner): owner is KevinOwnerMask => owner !== null);
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

  for (const definition of KEVIN_AUTHORED_OBJECTS) {
    if (!MOVING_PLANETS.has(definition.id)) continue;
    const exact = decodeKevinAuthoredMask(definition);
    for (let pixel = 0; pixel < exact.length; pixel += 1) {
      if (exact[pixel]) claimed[pixel] = 1;
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

  return [
    ...buildSourceMapBaseOwners(cleanPixels, claimed, 'authored'),
    ...owners,
    ...sunOwners,
  ];
}

function buildSourceFrameOwnerMasks(source: Uint8ClampedArray): KevinOwnerMask[] {
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

  return [
    ...buildSourceMapBaseOwners(source, claimed, 'source'),
    ...owners,
  ];
}


function buildSemanticContextOwnerMasks(
  timeSec: number,
  working: boolean,
  patches: readonly PlanetPatch[],
): KevinOwnerMask[] {
  const layers: KevinOwnerMask[] = [];
  const add = (
    definition: KevinPixelOwnerDefinition,
    mask: Uint8Array,
  ): void => {
    layers.push({ definition, mask });
  };

  for (let cloud = 0; cloud < 12; cloud += 1) {
    add(
      {
        id: `haze_${String(cloud + 1).padStart(3, '0')}`,
        parentId: 'haze_wisps',
        category: 'haze',
        subpart: 'individual-haze-cloud',
        dynamic: true,
        z: 20,
        primitiveIndex: cloud,
      },
      rasterizeSemanticHazeOwner(cloud, timeSec, working),
    );
  }

  for (let index = 0; index < SEMANTIC_DUST_MOTES.length; index += 1) {
    add(
      {
        id: `dust_${String(index + 1).padStart(3, '0')}`,
        parentId: 'dust_motes',
        category: 'dust',
        subpart: 'individual-dust-mote',
        dynamic: true,
        z: 30,
        primitiveIndex: index,
      },
      rasterizeSemanticDustOwner(index, timeSec, working),
    );
  }

  for (let index = 0; index < 38; index += 1) {
    add(
      {
        id: `star_grid_${String(index + 1).padStart(3, '0')}`,
        parentId: 'star_grid',
        category: 'star-grid',
        subpart: 'individual-grid-star',
        dynamic: false,
        z: 40,
        primitiveIndex: index,
      },
      rasterizeSemanticStarGridOwner(index, working),
    );
  }

  for (let branch = 0; branch < 3; branch += 1) {
    add(
      {
        id: `navigation_branch_${String(branch + 1).padStart(2, '0')}`,
        parentId: 'navigation_branches',
        category: 'navigation',
        subpart: 'individual-navigation-branch',
        dynamic: false,
        z: 50,
        primitiveIndex: branch,
      },
      rasterizeSemanticNavigationBranchOwner(branch, working),
    );
  }

  for (let index = 0; index < SEMANTIC_STAR_NODE_SPECS.length; index += 1) {
    add(
      {
        id: `star_node_${String(index + 1).padStart(2, '0')}`,
        parentId: 'star_nodes',
        category: 'star-node',
        subpart: 'individual-glowing-node',
        dynamic: false,
        z: 60,
        primitiveIndex: index,
      },
      rasterizeSemanticStarNodeOwner(index, working),
    );
  }

  for (let index = 0; index < 3; index += 1) {
    add(
      {
        id: `guide_orbit_${String(index + 1).padStart(2, '0')}`,
        parentId: 'guide_orbits',
        category: 'guide-orbit',
        subpart: 'individual-guide-ellipse',
        dynamic: false,
        z: 70,
        primitiveIndex: index,
      },
      rasterizeSemanticGuideOrbitOwner(index, working),
    );
  }

  patches.forEach((patch, index) => {
    add(
      {
        id: `planet_orbit_${patch.id}`,
        parentId: patch.id,
        category: 'planet-orbit',
        subpart: 'measured-orbit',
        dynamic: false,
        z: 80,
        primitiveIndex: index,
      },
      rasterizeSemanticMeasuredOrbitOwner(patch, working),
    );
  });

  assertSemanticContextOwnerMasks(layers, patches.length);
  return layers;
}

function assertSemanticContextOwnerMasks(
  layers: readonly KevinOwnerMask[],
  planetCount: number,
): void {
  const expectedByCategory: Readonly<Record<KevinPixelOwnerCategory, number>> = {
    'map-base': 0,
    'authored-detail': 0,
    sun: 0,
    haze: 12,
    dust: 150,
    'star-grid': 38,
    navigation: 3,
    'star-node': 5,
    'guide-orbit': 3,
    'planet-orbit': planetCount,
    planet: 0,
    transition: 0,
  };
  const ids = new Set<string>();
  const counts = new Map<KevinPixelOwnerCategory, number>();

  for (const layer of layers) {
    if (!ids.add(layer.definition.id)) {
      throw new Error(`Kevin semantic owner id is duplicated: ${layer.definition.id}`);
    }
    if (maskPixelCount(layer.mask) === 0) {
      throw new Error(`Kevin semantic owner has no pixels: ${layer.definition.id}`);
    }
    counts.set(
      layer.definition.category,
      (counts.get(layer.definition.category) ?? 0) + 1,
    );
  }

  for (const [category, expected] of Object.entries(expectedByCategory)) {
    if (!expected) continue;
    const actual = counts.get(category as KevinPixelOwnerCategory) ?? 0;
    if (actual !== expected) {
      throw new Error(
        `Kevin semantic owner count mismatch for ${category}: expected ${expected}, got ${actual}`,
      );
    }
  }
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

function rasterizeSemanticHazeOwner(
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
    const point = mapSemanticPoint(legacyX, legacyY);
    const rx = semanticRadiusX(11) * 1.7;
    const ry =
      semanticRadiusY(11) *
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

function rasterizeSemanticDustOwner(
  index: number,
  timeSec: number,
  working: boolean,
): Uint8Array {
  const mote = SEMANTIC_DUST_MOTES[index]!;
  return rasterizeOwner((ctx) => {
    const drift = Math.sin(timeSec * 0.18 + mote.depth * 0.13);
    const point = mapSemanticPoint(
      mote.x + drift * mote.depth * 0.65,
      mote.y +
        Math.cos(timeSec * 0.13 + mote.depth * 0.2) *
          mote.depth *
          0.3,
    );
    const mappedRadius = Math.max(0.28, semanticRadiusX(mote.radius));
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

function rasterizeSemanticStarGridOwner(
  index: number,
  working: boolean,
): Uint8Array {
  return rasterizeOwner((ctx) => {
    const x = 7 + ((index * 37.73) % 91);
    const y = 7 + ((index * 19.31) % 57);
    const point = mapSemanticPoint(x, y);
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

function rasterizeSemanticNavigationBranchOwner(
  branch: number,
  working: boolean,
): Uint8Array {
  return rasterizeOwner((ctx) => {
    const p32_15 = mapSemanticPoint(32, 15);
    const p54_38 = mapSemanticPoint(54, 38);
    const p86_20 = mapSemanticPoint(86, 20);
    const p87_51 = mapSemanticPoint(87, 51);
    const c1 = mapSemanticPoint(35, 28);
    const c2 = mapSemanticPoint(43, 35);
    const c3 = mapSemanticPoint(66, 32);
    const c4 = mapSemanticPoint(76, 23);
    const c5 = mapSemanticPoint(68, 44);
    const c6 = mapSemanticPoint(79, 46);

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

const SEMANTIC_STAR_NODE_SPECS = [
  [32, 15, 0.42, '#ffae83'],
  [86, 20, 0.68, '#c1f3ff'],
  [87, 51, 0.50, '#bceeff'],
  [69, 27, 0.28, '#bceeff'],
  [18, 45, 0.30, '#bceeff'],
] as const;

function rasterizeSemanticStarNodeOwner(
  index: number,
  working: boolean,
): Uint8Array {
  const [x, y, radius, color] = SEMANTIC_STAR_NODE_SPECS[index]!;
  const opacity = [
    working ? 0.66 : 0.50,
    working ? 0.82 : 0.64,
    working ? 0.68 : 0.50,
    working ? 0.74 : 0.56,
    working ? 0.58 : 0.42,
  ][index]!;
  return rasterizeOwner((ctx) => {
    drawSemanticMapStar(ctx, x, y, radius, color, opacity);
  });
}

function rasterizeSemanticGuideOrbitOwner(
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

function rasterizeSemanticMeasuredOrbitOwner(
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
  clipToKevinStarMap(ctx);
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
  timeSec: number = 0,
): void {
  ctx.save();
  clipToKevinStarMap(ctx);

  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = working
    ? 'rgba(77, 232, 247, 0.40)'
    : 'rgba(77, 232, 247, 0.22)';
  ctx.lineWidth = working ? 0.85 : 0.65;

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

    // Traveling holographic photon beacon along each orbital track
    const beaconSpeed = 0.8 / Math.sqrt(Math.max(1, radius / 40));
    const beaconTheta = timeSec * beaconSpeed + (radius % 7);
    const bx = SUN_X + Math.cos(beaconTheta) * radius;
    const by = SUN_Y + Math.sin(beaconTheta) * radius * ORBIT_Y_SCALE;
    const bGlow = ctx.createRadialGradient(bx, by, 0, bx, by, 3.5);
    bGlow.addColorStop(0, '#ffffff');
    bGlow.addColorStop(0.35, '#00f0ff');
    bGlow.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = bGlow;
    ctx.beginPath();
    ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
    ctx.fill();
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
  copyMapSurface(source, sourceEllipseData.data);

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
      if (!insideMap(x, y)) continue;
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
      `Kevin source-map reconstruction failed: ${restDiffPixels} pixels differ`,
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
      primitiveCount: SEMANTIC_DUST_MOTES.length,
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

      layers.push(...buildSemanticContextOwnerMasks(timeSec, working, patches));

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
      drawSemanticMapContext(frameCtx, timeSec, working);
      drawMeasuredOrbitTracks(frameCtx, patches, working, timeSec);

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
      clipToKevinStarMap(frameCtx);

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

      // Volumetric holographic overlay pass on the disc glass
      frameCtx.globalCompositeOperation = 'screen';

      // 1. Volumetric vertical light cylinder rising from the projector dish
      const holoCol = frameCtx.createLinearGradient(0, 140, 0, 15);
      holoCol.addColorStop(0, working ? 'rgba(0, 240, 255, 0.22)' : 'rgba(0, 180, 240, 0.10)');
      holoCol.addColorStop(0.45, 'rgba(0, 150, 230, 0.08)');
      holoCol.addColorStop(0.85, 'rgba(0, 80, 180, 0.03)');
      holoCol.addColorStop(1, 'rgba(0, 0, 0, 0)');
      frameCtx.fillStyle = holoCol;
      frameCtx.beginPath();
      frameCtx.ellipse(KEVIN_DISC.cx, 75, 130, 58, 0, 0, Math.PI * 2);
      frameCtx.fill();

      // Soft base dish aura
      const dishGlow = frameCtx.createRadialGradient(
        KEVIN_DISC.cx,
        KEVIN_DISC.cy,
        4,
        KEVIN_DISC.cx,
        KEVIN_DISC.cy,
        KEVIN_DISC.rx * 0.95,
      );
      dishGlow.addColorStop(0, working ? 'rgba(0, 229, 255, 0.32)' : 'rgba(0, 190, 240, 0.16)');
      dishGlow.addColorStop(0.4, working ? 'rgba(0, 140, 220, 0.16)' : 'rgba(0, 110, 190, 0.08)');
      dishGlow.addColorStop(0.8, 'rgba(0, 70, 140, 0.04)');
      dishGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      frameCtx.fillStyle = dishGlow;
      frameCtx.beginPath();
      frameCtx.ellipse(
        KEVIN_DISC.cx,
        KEVIN_DISC.cy,
        KEVIN_DISC.rx * 0.95,
        KEVIN_DISC.ry * 0.95,
        0,
        0,
        Math.PI * 2,
      );
      frameCtx.fill();

      // 2. Concentric tactical azimuth rings with rotating tick marks
      const bearingSpin = timeSec * 0.07;
      frameCtx.strokeStyle = 'rgba(77, 232, 247, 0.45)';
      frameCtx.lineWidth = 0.65;
      frameCtx.beginPath();
      frameCtx.ellipse(KEVIN_DISC.cx, KEVIN_DISC.cy, 138, 138 * ORBIT_Y_SCALE, 0, 0, Math.PI * 2);
      frameCtx.stroke();

      for (let t = 0; t < 24; t++) {
        const ang = bearingSpin + (t * Math.PI) / 12;
        const r1 = t % 6 === 0 ? 132 : 135.5;
        const r2 = 140;
        frameCtx.beginPath();
        frameCtx.moveTo(KEVIN_DISC.cx + Math.cos(ang) * r1, KEVIN_DISC.cy + Math.sin(ang) * r1 * ORBIT_Y_SCALE);
        frameCtx.lineTo(KEVIN_DISC.cx + Math.cos(ang) * r2, KEVIN_DISC.cy + Math.sin(ang) * r2 * ORBIT_Y_SCALE);
        frameCtx.strokeStyle = t % 6 === 0 ? 'rgba(0, 240, 255, 0.85)' : 'rgba(77, 232, 247, 0.35)';
        frameCtx.lineWidth = t % 6 === 0 ? 0.85 : 0.4;
        frameCtx.stroke();
      }

      // Inner counter-rotating tactical range ring
      frameCtx.beginPath();
      frameCtx.ellipse(KEVIN_DISC.cx, KEVIN_DISC.cy, 88, 88 * ORBIT_Y_SCALE, 0, 0, Math.PI * 2);
      frameCtx.strokeStyle = 'rgba(157, 123, 245, 0.35)';
      frameCtx.lineWidth = 0.45;
      frameCtx.stroke();
      for (let t = 0; t < 12; t++) {
        const ang = -bearingSpin * 1.5 + (t * Math.PI) / 6;
        frameCtx.beginPath();
        frameCtx.moveTo(KEVIN_DISC.cx + Math.cos(ang) * 85, KEVIN_DISC.cy + Math.sin(ang) * 85 * ORBIT_Y_SCALE);
        frameCtx.lineTo(KEVIN_DISC.cx + Math.cos(ang) * 91, KEVIN_DISC.cy + Math.sin(ang) * 91 * ORBIT_Y_SCALE);
        frameCtx.strokeStyle = 'rgba(157, 123, 245, 0.55)';
        frameCtx.lineWidth = 0.35;
        frameCtx.stroke();
      }

      // 3. Constellation Navigation Web & Warp Lanes
      const navStars = [
        { x: 185, y: 28, r: 1.1, c: '#4de8f7' },
        { x: 232, y: 18, r: 0.9, c: '#befff1' },
        { x: 382, y: 24, r: 1.2, c: '#ffcf6e' },
        { x: 345, y: 14, r: 0.8, c: '#c1f3ff' },
        { x: 165, y: 52, r: 1.0, c: '#9d7bf5' },
        { x: 395, y: 62, r: 0.8, c: '#4de8f7' },
      ];
      frameCtx.strokeStyle = 'rgba(77, 232, 247, 0.22)';
      frameCtx.lineWidth = 0.35;
      frameCtx.beginPath();
      frameCtx.moveTo(navStars[0]!.x, navStars[0]!.y);
      frameCtx.lineTo(navStars[1]!.x, navStars[1]!.y);
      frameCtx.lineTo(navStars[3]!.x, navStars[3]!.y);
      frameCtx.lineTo(navStars[2]!.x, navStars[2]!.y);
      frameCtx.moveTo(navStars[0]!.x, navStars[0]!.y);
      frameCtx.lineTo(navStars[4]!.x, navStars[4]!.y);
      frameCtx.moveTo(navStars[2]!.x, navStars[2]!.y);
      frameCtx.lineTo(navStars[5]!.x, navStars[5]!.y);
      frameCtx.stroke();

      for (let sIdx = 0; sIdx < navStars.length; sIdx++) {
        const star = navStars[sIdx]!;
        const twinkle = 0.7 + Math.sin(timeSec * 2.5 + sIdx * 1.7) * 0.3;
        frameCtx.fillStyle = star.c;
        frameCtx.globalAlpha = twinkle * 0.85;
        frameCtx.beginPath();
        frameCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        frameCtx.fill();
        // Diamond flare
        frameCtx.strokeStyle = star.c;
        frameCtx.lineWidth = 0.25;
        frameCtx.beginPath();
        frameCtx.moveTo(star.x - star.r * 2.2, star.y);
        frameCtx.lineTo(star.x + star.r * 2.2, star.y);
        frameCtx.moveTo(star.x, star.y - star.r * 2.2);
        frameCtx.lineTo(star.x, star.y + star.r * 2.2);
        frameCtx.stroke();
      }
      frameCtx.globalAlpha = 1;

      // 4. Shimmering Asteroid Belt orbiting between inner and outer worlds
      for (let aIdx = 0; aIdx < 36; aIdx++) {
        const aAng = (aIdx * 0.1745) + timeSec * 0.05;
        const aDistX = 54 + Math.sin(aIdx * 37.1) * 3.5;
        const aDistY = aDistX * ORBIT_Y_SCALE;
        const ax = SUN_X + Math.cos(aAng) * aDistX;
        const ay = SUN_Y + Math.sin(aAng) * aDistY;
        const aTwinkle = 0.35 + 0.65 * Math.sin(timeSec * 3.0 + aIdx * 2.1);
        frameCtx.fillStyle = aIdx % 3 === 0 ? '#bceeff' : '#ffea9f';
        frameCtx.globalAlpha = 0.5 * aTwinkle;
        frameCtx.beginPath();
        frameCtx.arc(ax, ay, 0.45, 0, Math.PI * 2);
        frameCtx.fill();
      }
      frameCtx.globalAlpha = 1;

      // 5. Dynamic Orbital Comets (traveling neon pulses along each planet track)
      for (const st of states) {
        const orbitR = st.patch.orbitRadius;
        // Orbit path
        frameCtx.beginPath();
        frameCtx.ellipse(SUN_X, SUN_Y, orbitR, orbitR * ORBIT_Y_SCALE, 0, 0, Math.PI * 2);
        frameCtx.strokeStyle = st.patch.id === 'planet_cyan' ? 'rgba(77, 232, 247, 0.30)' : 'rgba(157, 123, 245, 0.24)';
        frameCtx.lineWidth = 0.4;
        frameCtx.stroke();

        // Traveling photon beacon with fading tail
        const curTheta = st.patch.orbitTheta + keplerAngularSpeed(st.patch.orbitRadius, st.patch.config.speed) * timeSec;
        for (let tail = 0; tail < 5; tail++) {
          const tAng = curTheta - tail * 0.04;
          const tx = SUN_X + Math.cos(tAng) * orbitR;
          const ty = SUN_Y + Math.sin(tAng) * orbitR * ORBIT_Y_SCALE;
          frameCtx.fillStyle = '#4de8f7';
          frameCtx.globalAlpha = (1 - tail / 5) * 0.65;
          frameCtx.beginPath();
          frameCtx.arc(tx, ty, 0.6 - tail * 0.08, 0, Math.PI * 2);
          frameCtx.fill();
        }

        // Atmosphere aura around each planet
        const haloR = 4.5;
        const atmo = frameCtx.createRadialGradient(st.x, st.y, 0.5, st.x, st.y, haloR);
        atmo.addColorStop(0, 'rgba(77, 232, 247, 0.45)');
        atmo.addColorStop(0.6, 'rgba(0, 160, 240, 0.15)');
        atmo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        frameCtx.fillStyle = atmo;
        frameCtx.beginPath();
        frameCtx.arc(st.x, st.y, haloR, 0, Math.PI * 2);
        frameCtx.fill();

        // 3D holographic ring for the gas planet
        if (st.patch.id === 'planet_cyan') {
          frameCtx.beginPath();
          frameCtx.ellipse(st.x, st.y, 7.5, 2.8, -0.22, 0, Math.PI * 2);
          frameCtx.strokeStyle = 'rgba(120, 240, 255, 0.55)';
          frameCtx.lineWidth = 0.55;
          frameCtx.stroke();
        }
      }
      frameCtx.globalAlpha = 1;

      // 6. Central Sun stellar corona and 6-point diffraction flares
      const sunPulse = 0.5 + Math.sin(timeSec * 2.4) * 0.5;
      const coronaRadius = 18 + sunPulse * 5;
      const sunCorona = frameCtx.createRadialGradient(SUN_X, SUN_Y, 1, SUN_X, SUN_Y, coronaRadius);
      sunCorona.addColorStop(0, 'rgba(255, 255, 230, 0.95)');
      sunCorona.addColorStop(0.18, 'rgba(255, 230, 120, 0.85)');
      sunCorona.addColorStop(0.42, 'rgba(255, 150, 40, 0.48)');
      sunCorona.addColorStop(0.72, 'rgba(0, 229, 255, 0.24)');
      sunCorona.addColorStop(1, 'rgba(0, 160, 240, 0)');
      frameCtx.fillStyle = sunCorona;
      frameCtx.beginPath();
      frameCtx.arc(SUN_X, SUN_Y, coronaRadius, 0, Math.PI * 2);
      frameCtx.fill();

      // 6-point solar diffraction spikes with trigonometric rotation (never ctx.rotate)
      const flareAngle = timeSec * 0.08;
      const flareLen = 24 + sunPulse * 6;
      for (let s = 0; s < 3; s++) {
        const ang = flareAngle + (s * Math.PI) / 3;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        const len = s === 0 ? flareLen : flareLen * 0.65;
        frameCtx.strokeStyle = s === 0 ? 'rgba(255, 250, 210, 0.8)' : 'rgba(120, 240, 255, 0.5)';
        frameCtx.lineWidth = s === 0 ? 0.75 : 0.45;
        frameCtx.beginPath();
        frameCtx.moveTo(SUN_X - cosA * len, SUN_Y - sinA * len * ORBIT_Y_SCALE);
        frameCtx.lineTo(SUN_X + cosA * len, SUN_Y + sinA * len * ORBIT_Y_SCALE);
        frameCtx.stroke();
      }

      // 7. Tactical target reticle tracking primary exoplanet
      if (states.length > 0) {
        const targetWorld = states[0]!;
        const tx = targetWorld.x;
        const ty = targetWorld.y;
        frameCtx.strokeStyle = 'rgba(77, 232, 247, 0.75)';
        frameCtx.lineWidth = 0.45;
        // Target brackets [ ]
        frameCtx.beginPath();
        frameCtx.moveTo(tx - 6, ty - 3); frameCtx.lineTo(tx - 6, ty - 5); frameCtx.lineTo(tx - 4, ty - 5);
        frameCtx.moveTo(tx + 6, ty - 3); frameCtx.lineTo(tx + 6, ty - 5); frameCtx.lineTo(tx + 4, ty - 5);
        frameCtx.moveTo(tx - 6, ty + 3); frameCtx.lineTo(tx - 6, ty + 5); frameCtx.lineTo(tx - 4, ty + 5);
        frameCtx.moveTo(tx + 6, ty + 3); frameCtx.lineTo(tx + 6, ty + 5); frameCtx.lineTo(tx + 4, ty + 5);
        frameCtx.stroke();

        frameCtx.font = "bold 4.5px 'JetBrains Mono', monospace";
        frameCtx.fillStyle = 'rgba(77, 232, 247, 0.9)';
        frameCtx.fillText('KEPLER-452b', tx + 8, ty - 2);
        frameCtx.font = "3.8px 'JetBrains Mono', monospace";
        frameCtx.fillStyle = 'rgba(157, 123, 245, 0.8)';
        frameCtx.fillText('SURVEY: LOCKED', tx + 8, ty + 3);
      }

      // 8. Holographic vertical scanning laser beam
      const scanY = 16 + ((timeSec * 28) % 115);
      const scanGrad = frameCtx.createLinearGradient(140, scanY, 400, scanY);
      scanGrad.addColorStop(0, 'rgba(77, 232, 247, 0)');
      scanGrad.addColorStop(0.3, 'rgba(77, 232, 247, 0.35)');
      scanGrad.addColorStop(0.7, 'rgba(77, 232, 247, 0.35)');
      scanGrad.addColorStop(1, 'rgba(77, 232, 247, 0)');
      frameCtx.fillStyle = scanGrad;
      frameCtx.fillRect(140, scanY, 260, 1.0);

      // 9. Tactical sci-fi HUD vector text & brackets
      frameCtx.font = "bold 6.8px 'JetBrains Mono', monospace";
      frameCtx.fillStyle = 'rgba(77, 232, 247, 0.95)';
      frameCtx.fillText('SYS.KEPLER // SEC-07', 156, 36);
      frameCtx.font = "5px 'JetBrains Mono', monospace";
      frameCtx.fillStyle = 'rgba(77, 232, 247, 0.70)';
      frameCtx.fillText(working ? 'STATUS: ACTIVE TELEMETRY' : 'STATUS: PASSIVE RADAR', 156, 44);
      frameCtx.font = "4px 'JetBrains Mono', monospace";
      frameCtx.fillStyle = 'rgba(157, 123, 245, 0.65)';
      frameCtx.fillText('RA 19h 44m · DEC +44°27\' // 6 BODIES', 156, 51);

      // Corner HUD brackets
      frameCtx.strokeStyle = 'rgba(77, 232, 247, 0.45)';
      frameCtx.lineWidth = 0.45;
      frameCtx.beginPath();
      frameCtx.moveTo(150, 32); frameCtx.lineTo(146, 32); frameCtx.lineTo(146, 38);
      frameCtx.moveTo(150, 54); frameCtx.lineTo(146, 54); frameCtx.lineTo(146, 48);
      frameCtx.stroke();

      frameCtx.restore();

      // =========================================================================
      // KEVIN SIDE CONSOLE MONITORS (LEFT HUD & RIGHT HUD)
      // =========================================================================
      if (working || intro > 0) {
        // --- LEFT MONITOR: RADAR SWEEP & OSCILLOSCOPE WAVE ---
        // Polygon: [77, 37], [137, 37], [137, 118], [77, 118]
        frameCtx.save();
        frameCtx.beginPath();
        frameCtx.moveTo(80, 40);
        frameCtx.lineTo(134, 40);
        frameCtx.lineTo(134, 115);
        frameCtx.lineTo(80, 115);
        frameCtx.closePath();
        frameCtx.clip();

        // Monitor CRT background glow
        frameCtx.fillStyle = 'rgba(4, 21, 30, 0.88)';
        frameCtx.fillRect(77, 37, 60, 81);

        // Circular tactical radar display
        const radarCx = 107;
        const radarCy = 65;
        const radarR = 21;
        frameCtx.beginPath();
        frameCtx.arc(radarCx, radarCy, radarR, 0, Math.PI * 2);
        frameCtx.strokeStyle = 'rgba(77, 232, 247, 0.35)';
        frameCtx.lineWidth = 0.5;
        frameCtx.stroke();

        frameCtx.beginPath();
        frameCtx.arc(radarCx, radarCy, radarR * 0.5, 0, Math.PI * 2);
        frameCtx.strokeStyle = 'rgba(77, 232, 247, 0.20)';
        frameCtx.stroke();

        // 360-degree radar sweep beam
        const sweepAng = timeSec * 2.8;
        frameCtx.beginPath();
        frameCtx.moveTo(radarCx, radarCy);
        frameCtx.lineTo(radarCx + Math.cos(sweepAng) * radarR, radarCy + Math.sin(sweepAng) * radarR);
        frameCtx.strokeStyle = 'rgba(0, 255, 200, 0.85)';
        frameCtx.lineWidth = 0.75;
        frameCtx.stroke();

        // Radar target blips
        for (let b = 0; b < 3; b++) {
          const bAng = b * 2.1 + 0.5;
          const bDist = 8 + b * 5;
          const bx = radarCx + Math.cos(bAng) * bDist;
          const by = radarCy + Math.sin(bAng) * bDist;
          const diff = ((sweepAng - bAng) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const bAlpha = Math.max(0, 1 - diff / 2.5);
          frameCtx.fillStyle = 'rgba(0, 255, 180, ' + (bAlpha * 0.9).toFixed(2) + ')';
          frameCtx.beginPath();
          frameCtx.arc(bx, by, 1.0, 0, Math.PI * 2);
          frameCtx.fill();
        }

        // Oscilloscope waveform across the lower screen
        frameCtx.beginPath();
        for (let wx = 82; wx <= 132; wx += 2) {
          const wy = 100 + Math.sin(wx * 0.35 + timeSec * 6) * 4.5 + Math.cos(wx * 0.7 - timeSec * 4) * 2;
          if (wx === 82) frameCtx.moveTo(wx, wy);
          else frameCtx.lineTo(wx, wy);
        }
        frameCtx.strokeStyle = 'rgba(77, 232, 247, 0.75)';
        frameCtx.lineWidth = 0.6;
        frameCtx.stroke();

        // Left monitor HUD text
        frameCtx.font = "bold 3.8px 'JetBrains Mono', monospace";
        frameCtx.fillStyle = 'rgba(77, 232, 247, 0.85)';
        frameCtx.fillText('RADAR 360°', 83, 46);
        frameCtx.font = "3.2px 'JetBrains Mono', monospace";
        frameCtx.fillStyle = 'rgba(157, 123, 245, 0.75)';
        frameCtx.fillText('SIG: +18.4 dB', 83, 110);

        frameCtx.restore();

        // --- RIGHT MONITOR: TELEMETRY BARS & MATRIX STREAM ---
        // Polygon: [410, 38], [474, 38], [474, 118], [410, 118]
        frameCtx.save();
        frameCtx.beginPath();
        frameCtx.moveTo(412, 40);
        frameCtx.lineTo(471, 40);
        frameCtx.lineTo(471, 115);
        frameCtx.lineTo(412, 115);
        frameCtx.closePath();
        frameCtx.clip();

        // Monitor CRT background glow
        frameCtx.fillStyle = 'rgba(4, 21, 30, 0.88)';
        frameCtx.fillRect(410, 38, 64, 80);

        // Header
        frameCtx.font = "bold 3.8px 'JetBrains Mono', monospace";
        frameCtx.fillStyle = 'rgba(77, 232, 247, 0.85)';
        frameCtx.fillText('ORBIT TELEMETRY', 415, 46);

        // Dynamic multi-channel level bars
        for (let bar = 0; bar < 6; bar++) {
          const barX = 416 + bar * 9;
          const barH = 14 + Math.sin(timeSec * 3.5 + bar * 1.2) * 8 + Math.cos(timeSec * 1.8 + bar) * 4;
          const barY = 82 - Math.max(2, Math.min(24, barH));
          const barGrad = frameCtx.createLinearGradient(0, 82, 0, barY);
          barGrad.addColorStop(0, '#00e5ff');
          barGrad.addColorStop(0.7, '#9d7bf5');
          barGrad.addColorStop(1, '#ffea9f');
          frameCtx.fillStyle = barGrad;
          frameCtx.fillRect(barX, barY, 6, 82 - barY);
        }

        // Horizontal base line
        frameCtx.strokeStyle = 'rgba(77, 232, 247, 0.4)';
        frameCtx.lineWidth = 0.5;
        frameCtx.beginPath();
        frameCtx.moveTo(415, 83);
        frameCtx.lineTo(469, 83);
        frameCtx.stroke();

        // Matrix readout text
        frameCtx.font = "3.2px 'JetBrains Mono', monospace";
        frameCtx.fillStyle = 'rgba(77, 232, 247, 0.8)';
        frameCtx.fillText('VEL: 29.8 km/s', 415, 92);
        frameCtx.fillText('MASS: 1.05 M⊕', 415, 98);
        frameCtx.fillText('STATUS: LOCKED', 415, 104);

        // Blinking green LED beacon
        const ledOn = Math.sin(timeSec * 5) > 0;
        frameCtx.fillStyle = ledOn ? '#00ff88' : '#006633';
        frameCtx.beginPath();
        frameCtx.arc(465, 103, 1.5, 0, Math.PI * 2);
        frameCtx.fill();

        frameCtx.restore();
      }

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
