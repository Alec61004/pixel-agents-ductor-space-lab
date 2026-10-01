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
// The redesigned hologram owns the entire star-map glass. The table/frame
// remain authored V10 pixels; only the polygon below is repainted.
const SUN_X = 270;
const SUN_Y = 80;
const ORBIT_Y_SCALE = 0.46;
const ORBIT_ANGULAR_SPEED = 0.055;

type MovingPlanetId = Exclude<KevinAuthoredObjectId, 'sun' | 'marker_star'>;
type PlanetStyle = 'rocky' | 'gas_banded' | 'ringed_gas' | 'icy' | 'moon';

const MOVING_PLANETS = new Set<KevinAuthoredObjectId>([
  'planet_orange',
  'planet_gold_small',
  'planet_cyan',
  'planet_white',
  'planet_purple_small',
]);

const PLANET_LAYOUT: Readonly<Record<MovingPlanetId, { radius: number; theta: number }>> = {
  // Balanced composition derived from the approved reference image.
  planet_white: { radius: 82, theta: -2.28 },
  planet_purple_small: { radius: 70, theta: -0.86 },
  planet_cyan: { radius: 112, theta: 0.10 },
  planet_gold_small: { radius: 112, theta: 1.06 },
  planet_orange: { radius: 112, theta: 2.20 },
};

const MAP_STAR_NODES = [
  [144, 80, 0.9],
  [159, 52, 0.7],
  [190, 30, 0.72],
  [230, 22, 0.55],
  [309, 24, 0.58],
  [388, 52, 0.86],
  [396, 83, 0.58],
  [369, 118, 0.72],
  [323, 132, 0.62],
  [228, 132, 0.55],
  [169, 116, 0.66],
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



function clipStarMapPolygon(ctx: CanvasRenderingContext2D): void {
  const first = KEVIN_STAR_MAP_POLYGON[0]!;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (let index = 1; index < KEVIN_STAR_MAP_POLYGON.length; index += 1) {
    const point = KEVIN_STAR_MAP_POLYGON[index]!;
    ctx.lineTo(point[0], point[1]);
  }
  ctx.closePath();
  ctx.clip();
}

function deterministicUnit(index: number, salt: number): number {
  const value = Math.sin(index * 91.713 + salt * 37.117) * 43758.5453;
  return value - Math.floor(value);
}

function drawStarMapBase(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  working: boolean,
): void {
  ctx.save();
  clipStarMapPolygon(ctx);

  // Opaque replacement plate: removes the authored solar graphic underneath so
  // the new map cannot become a second misaligned system on top of the old one.
  const base = ctx.createRadialGradient(
    SUN_X,
    SUN_Y,
    8,
    KEVIN_DISC.cx,
    KEVIN_DISC.cy,
    KEVIN_DISC.rx * 1.04,
  );
  base.addColorStop(0, '#0d3e64');
  base.addColorStop(0.42, '#082a4c');
  base.addColorStop(0.78, '#061d39');
  base.addColorStop(1, '#031329');
  ctx.globalAlpha = 0.965;
  ctx.fillStyle = base;
  ctx.fillRect(118, 4, 304, 142);

  // Soft holographic floor glow.
  const floor = ctx.createRadialGradient(
    SUN_X,
    116,
    0,
    SUN_X,
    116,
    128,
  );
  floor.addColorStop(0, working ? 'rgba(0,220,255,0.22)' : 'rgba(0,196,255,0.16)');
  floor.addColorStop(0.58, 'rgba(0,118,225,0.08)');
  floor.addColorStop(1, 'rgba(0,40,100,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = floor;
  ctx.fillRect(120, 20, 300, 126);

  // Fixed sector grid. It is intentionally subordinate to planets/belt.
  ctx.strokeStyle = working
    ? 'rgba(93,214,255,0.29)'
    : 'rgba(80,190,235,0.22)';
  ctx.lineWidth = 0.62;
  const gridRadii = [34, 54, 75, 96, 118, 137] as const;
  for (const radius of gridRadii) {
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

  // Eight restrained sector spokes: enough to read as astrogation, not a road map.
  for (let sector = 0; sector < 8; sector += 1) {
    const angle = (sector / 8) * Math.PI * 2;
    const x0 = SUN_X + Math.cos(angle) * 30;
    const y0 = SUN_Y + Math.sin(angle) * 30 * ORBIT_Y_SCALE;
    const x1 = SUN_X + Math.cos(angle) * 139;
    const y1 = SUN_Y + Math.sin(angle) * 139 * ORBIT_Y_SCALE;
    ctx.globalAlpha = sector % 2 === 0 ? 0.22 : 0.11;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Quiet outer stars give scale without returning to the noisy speckle pass.
  for (const [x, y, radius] of MAP_STAR_NODES) {
    const pulse = 0.78 + 0.22 * Math.sin(timeSec * 0.62 + x * 0.04);
    ctx.globalAlpha = (working ? 0.72 : 0.56) * pulse;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4.8);
    glow.addColorStop(0, 'rgba(255,255,245,0.96)');
    glow.addColorStop(0.22, 'rgba(125,226,255,0.72)');
    glow.addColorStop(1, 'rgba(43,142,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 4.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGalaxy(
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
  ctx.scale(1, 0.44);
  ctx.rotate(timeSec * 0.018 + phase);
  ctx.globalCompositeOperation = 'screen';

  const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.7);
  haze.addColorStop(0, magenta ? 'rgba(255,224,255,0.64)' : 'rgba(228,250,255,0.68)');
  haze.addColorStop(0.24, magenta ? 'rgba(207,83,255,0.27)' : 'rgba(90,209,255,0.29)');
  haze.addColorStop(1, magenta ? 'rgba(120,24,220,0)' : 'rgba(25,130,255,0)');
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.7, 0, Math.PI * 2);
  ctx.fill();

  for (let arm = 0; arm < 2; arm += 1) {
    ctx.beginPath();
    for (let step = 0; step <= 26; step += 1) {
      const t = step / 26;
      const rr = radius * (0.12 + 0.95 * t);
      const angle = arm * Math.PI + t * Math.PI * 2.25;
      const px = Math.cos(angle) * rr;
      const py = Math.sin(angle) * rr * 0.72;
      if (step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = magenta
      ? 'rgba(223,126,255,0.42)'
      : 'rgba(148,229,255,0.46)';
    ctx.lineWidth = 0.95;
    ctx.stroke();
  }
  ctx.restore();
}

function drawAsteroidBelt(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  working: boolean,
): void {
  const count = 52;
  const rotation = timeSec * 0.022;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let index = 0; index < count; index += 1) {
    const angle =
      (index / count) * Math.PI * 2 +
      rotation +
      (deterministicUnit(index, 1) - 0.5) * 0.12;
    const radius =
      64 + (deterministicUnit(index, 2) - 0.5) * 12;
    const x = SUN_X + Math.cos(angle) * radius;
    const y = SUN_Y + Math.sin(angle) * radius * ORBIT_Y_SCALE;
    const size = 0.55 + deterministicUnit(index, 3) * 0.92;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + deterministicUnit(index, 4));
    ctx.globalAlpha = (working ? 0.64 : 0.51) *
      (0.72 + deterministicUnit(index, 5) * 0.28);
    ctx.fillStyle =
      index % 7 === 0
        ? '#f0d2a8'
        : index % 3 === 0
          ? '#bfd8df'
          : '#d7d0c3';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.45, size * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawConstellations(
  ctx: CanvasRenderingContext2D,
  working: boolean,
): void {
  const groups = [
    [[141, 108], [157, 122], [176, 115], [193, 132]],
    [[223, 27], [241, 20], [263, 29], [283, 19], [305, 31]],
  ] as const;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const group of groups) {
    ctx.strokeStyle = working
      ? 'rgba(193,112,255,0.43)'
      : 'rgba(166,92,242,0.31)';
    ctx.lineWidth = 0.72;
    ctx.beginPath();
    group.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    });
    ctx.stroke();

    for (const point of group) {
      ctx.fillStyle = 'rgba(231,212,255,0.84)';
      ctx.beginPath();
      ctx.arc(point[0], point[1], 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawReferenceContext(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  working: boolean,
): void {
  ctx.save();
  clipStarMapPolygon(ctx);
  drawStarMapBase(ctx, timeSec, working);
  drawGalaxy(ctx, 160, 57, 14.5, timeSec, 0.15, true);
  drawGalaxy(ctx, 388, 55, 13.5, timeSec, 1.35, false);
  drawGalaxy(ctx, 369, 116, 11.2, timeSec, 2.30, true);
  drawAsteroidBelt(ctx, timeSec, working);
  drawConstellations(ctx, working);
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

function orbitalAngle(patch: PlanetPatch, timeSec: number): number {
  // Shared astrogation drift preserves the approved five-point composition.
  // Planets still travel on real ellipses; their spacing does not collapse
  // into random clusters after a few seconds.
  return patch.orbitTheta + timeSec * ORBIT_ANGULAR_SPEED;
}

function drawMeasuredOrbitTracks(
  ctx: CanvasRenderingContext2D,
  patches: readonly PlanetPatch[],
  working: boolean,
): void {
  ctx.save();
  clipStarMapPolygon(ctx);

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
  const visual = PLANET_VISUALS[id];
  const sprite = makePlanetSprite(visual);
  const layout = PLANET_LAYOUT[id];

  return {
    id,
    canvas: sprite,
    localCenterX: sprite.width / 2,
    localCenterY: sprite.height / 2,
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
    patches.push(buildPlanetPatch(definition, config));
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

      const intro = smoothstep(0, 0.9, timeSec);

      frameCtx.save();
      frameCtx.setTransform(1, 0, 0, 1, 0, 0);
      frameCtx.clearRect(0, 0, WIDTH, HEIGHT);
      frameCtx.globalCompositeOperation = 'source-over';
      frameCtx.globalAlpha = 1;
      frameCtx.filter = 'none';
      frameCtx.drawImage(cleanBase, 0, 0);

      // Repaint only the authored glass polygon. The rest of Kevin's station
      // remains the original V10 pixels.
      drawReferenceContext(frameCtx, timeSec, working);
      drawMeasuredOrbitTracks(frameCtx, patches, working);

      const states = patches
        .map((patch) => {
          const config = patch.config;
          const theta = orbitalAngle(patch, timeSec);
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
      clipStarMapPolygon(frameCtx);

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
