import {
  KEVIN_AUTHORED_OBJECTS,
  KEVIN_DISC,
  KEVIN_STAR_MAP_POLYGON,
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

// Two different geometries exist in the authored Kevin V10 crop:
// 1) the physical star-map glass/disc, measured by the semantic atlas;
// 2) the solar-system focus, measured from the authored Sun pixels.
// Never use the Sun as the clipping center of the physical map.
const SOURCE_SUN_X = 308.7;
const SOURCE_SUN_Y = 54.2;

// Reference composition mapped into the authored 540x230 Kevin glass.
const SUN_X = 270;
const SUN_Y = 74;
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

const REFERENCE_ORBITS: Readonly<Record<MovingPlanetId, { radius: number; theta: number }>> = {
  // Target centers at t≈0 after the intro morph:
  // white ≈ (218,46), purple ≈ (311,56), cyan ≈ (369,79),
  // gold ≈ (318,122), orange ≈ (185,121).
  planet_purple_small: { radius: 58, theta: -0.78 },
  planet_white: { radius: 82, theta: -2.25 },
  planet_cyan: { radius: 100, theta: 0.12 },
  planet_gold_small: { radius: 118, theta: 1.15 },
  planet_orange: { radius: 136, theta: 2.25 },
};

const REFERENCE_STAR_NODES = [
  [145, 82, 0.72],
  [164, 49, 0.54],
  [194, 31, 0.62],
  [236, 23, 0.48],
  [332, 27, 0.56],
  [393, 76, 0.74],
  [375, 104, 0.50],
  [341, 131, 0.62],
  [250, 133, 0.48],
  [174, 119, 0.58],
] as const;

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
  sourceCenterX: number;
  sourceCenterY: number;
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



function clipKevinMapSurface(ctx: CanvasRenderingContext2D): void {
  const first = KEVIN_STAR_MAP_POLYGON[0]!;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < KEVIN_STAR_MAP_POLYGON.length; i += 1) {
    const point = KEVIN_STAR_MAP_POLYGON[i]!;
    ctx.lineTo(point[0], point[1]);
  }
  ctx.closePath();
  ctx.clip();
}

function deterministicUnit(index: number, salt: number): number {
  const value = Math.sin(index * 91.713 + salt * 37.117) * 43758.5453;
  return value - Math.floor(value);
}

function drawGalaxyCluster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  timeSec: number,
  phase: number,
  magenta: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.42);
  ctx.rotate(timeSec * 0.025 + phase);
  ctx.globalCompositeOperation = 'screen';

  const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.6);
  haze.addColorStop(0, magenta ? 'rgba(242,210,255,0.50)' : 'rgba(220,248,255,0.54)');
  haze.addColorStop(0.22, magenta ? 'rgba(200,70,255,0.23)' : 'rgba(90,205,255,0.24)');
  haze.addColorStop(1, magenta ? 'rgba(120,20,220,0)' : 'rgba(20,120,255,0)');
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
  ctx.fill();

  for (let arm = 0; arm < 2; arm += 1) {
    ctx.beginPath();
    for (let step = 0; step <= 24; step += 1) {
      const t = step / 24;
      const rr = radius * (0.15 + 0.95 * t);
      const angle = arm * Math.PI + t * Math.PI * 2.15;
      const px = Math.cos(angle) * rr;
      const py = Math.sin(angle) * rr * 0.72;
      if (step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = magenta
      ? 'rgba(220,120,255,0.36)'
      : 'rgba(140,225,255,0.38)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  ctx.restore();
}

function drawReferenceAsteroidBelt(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  working: boolean,
): void {
  const count = 46;
  const rotation = timeSec * keplerAngularSpeed(68, 0.72);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < count; i += 1) {
    const angle =
      (i / count) * Math.PI * 2 +
      (deterministicUnit(i, 1) - 0.5) * 0.12 +
      rotation;
    const radius =
      67 + (deterministicUnit(i, 2) - 0.5) * 13;
    const x = SUN_X + Math.cos(angle) * radius;
    const y = SUN_Y + Math.sin(angle) * radius * ORBIT_Y_SCALE;
    const rock = 0.62 + deterministicUnit(i, 3) * 1.05;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + deterministicUnit(i, 4));
    ctx.globalAlpha = (working ? 0.58 : 0.46) *
      (0.72 + deterministicUnit(i, 5) * 0.28);
    ctx.fillStyle = i % 5 === 0 ? '#e9c99b' : i % 3 === 0 ? '#b8d7dd' : '#d6d1c7';
    ctx.beginPath();
    ctx.ellipse(0, 0, rock * 1.45, rock * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawReferenceSectorGrid(
  ctx: CanvasRenderingContext2D,
  working: boolean,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const alpha = working ? 0.24 : 0.16;
  const radii = [38, 58, 82, 100, 118, 136] as const;
  for (const radius of radii) {
    ctx.strokeStyle = `rgba(105,218,255,${alpha})`;
    ctx.lineWidth = radius === 136 ? 0.7 : 0.52;
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

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const x0 = SUN_X + Math.cos(angle) * 28;
    const y0 = SUN_Y + Math.sin(angle) * 28 * ORBIT_Y_SCALE;
    const x1 = SUN_X + Math.cos(angle) * 139;
    const y1 = SUN_Y + Math.sin(angle) * 139 * ORBIT_Y_SCALE;
    ctx.strokeStyle = `rgba(95,205,246,${alpha * (i % 2 === 0 ? 0.75 : 0.42)})`;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawReferenceConstellations(
  ctx: CanvasRenderingContext2D,
  working: boolean,
): void {
  const groups = [
    [[146, 109], [160, 122], [178, 115], [193, 130]],
    [[226, 26], [245, 20], [265, 29], [287, 20], [304, 31]],
  ] as const;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const group of groups) {
    ctx.strokeStyle = working
      ? 'rgba(192,112,255,0.38)'
      : 'rgba(168,96,245,0.27)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    group.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    });
    ctx.stroke();

    for (const point of group) {
      ctx.fillStyle = 'rgba(228,205,255,0.78)';
      ctx.beginPath();
      ctx.arc(point[0], point[1], 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawReferenceSun(
  ctx: CanvasRenderingContext2D,
  intro: number,
  timeSec: number,
): void {
  const x = SOURCE_SUN_X + (SUN_X - SOURCE_SUN_X) * intro;
  const y = SOURCE_SUN_Y + (SUN_Y - SOURCE_SUN_Y) * intro;
  const pulse = 0.96 + Math.sin(timeSec * 1.25) * 0.04;
  const radius = 11.6 * pulse;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = intro;

  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.1);
  glow.addColorStop(0, 'rgba(255,255,225,1)');
  glow.addColorStop(0.18, 'rgba(255,225,95,0.98)');
  glow.addColorStop(0.42, 'rgba(255,153,38,0.58)');
  glow.addColorStop(1, 'rgba(255,95,15,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff7b0';
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.84, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,207,88,0.92)';
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,236,168,0.58)';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLegacyMapContext(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  working: boolean,
): void {
  ctx.save();
  clipKevinMapSurface(ctx);

  // Deep-space clusters match the approved reference composition.
  drawGalaxyCluster(ctx, 158, 55, 13.5, timeSec, 0.25, true);
  drawGalaxyCluster(ctx, 382, 55, 12.5, timeSec, 1.45, false);
  drawGalaxyCluster(ctx, 366, 116, 11.5, timeSec, 2.2, true);

  // A restrained background star field: enough depth to read as a star map,
  // but no dense random speckle that previously looked like pixel debris.
  ctx.globalCompositeOperation = 'screen';
  for (const mote of LEGACY_HOLOGRAM_DUST.slice(0, 30)) {
    const point = mapLegacyPoint(mote.x, mote.y);
    ctx.globalAlpha = mote.alpha * (working ? 0.31 : 0.22);
    ctx.fillStyle = mote.depth > 0 ? '#c9f2ff' : '#79b6d6';
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(0.34, legacyRadiusX(mote.radius) * 0.72), 0, Math.PI * 2);
    ctx.fill();
  }

  for (const [x, y, radius] of REFERENCE_STAR_NODES) {
    ctx.globalAlpha = working ? 0.66 : 0.52;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 5.2);
    glow.addColorStop(0, 'rgba(255,255,245,0.95)');
    glow.addColorStop(0.24, 'rgba(126,230,255,0.72)');
    glow.addColorStop(1, 'rgba(72,170,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 5.2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawReferenceSectorGrid(ctx, working);
  drawReferenceConstellations(ctx, working);
  drawReferenceAsteroidBelt(ctx, timeSec, working);

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

  // Remove the authored Sun + all five planets + marker from the source plate.
  // The redesigned system is then rebuilt as one coherent composition.
  for (const definition of KEVIN_AUTHORED_OBJECTS) {
    const isPlanet = MOVING_PLANETS.has(definition.id);
    if (definition.id !== 'sun' && definition.id !== 'marker_star' && !isPlanet) continue;

    const radius =
      definition.id === 'sun'
        ? 15
        : definition.id === 'marker_star'
          ? 2
          : 3;
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
  const layout = REFERENCE_ORBITS[id];
  const visual = PLANET_VISUALS[id];
  const sprite = makePlanetSprite(visual);

  return {
    id,
    canvas: sprite,
    localCenterX: sprite.width / 2,
    localCenterY: sprite.height / 2,
    sourceCenterX: centroid.x,
    sourceCenterY: centroid.y,
    orbitRadius: layout.radius,
    orbitTheta: layout.theta,
    config,
    visual,
  };
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
  if (!frameCtx) throw new Error('Kevin planet visual v2 requires a 2D canvas');

  return {
    width: WIDTH,
    height: HEIGHT,
    restDiffPixels: 0,
    render(timeSec: number, working: boolean): HTMLCanvasElement {
      if (timeSec <= 0.0001) return sourceEllipse;

      const intro = smoothstep(0, 1.25, timeSec);

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
      drawReferenceSun(frameCtx, intro, timeSec);

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
          const targetX = SUN_X + Math.cos(theta) * radius;
          const targetY =
            SUN_Y + Math.sin(theta) * radius * ORBIT_Y_SCALE;
          const x =
            patch.sourceCenterX +
            (targetX - patch.sourceCenterX) * intro;
          const y =
            patch.sourceCenterY +
            (targetY - patch.sourceCenterY) * intro;
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
