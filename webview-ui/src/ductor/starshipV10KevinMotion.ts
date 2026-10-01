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
    speed: 1.15,
    phase: 0.4,
    scaleAmplitude: 0.03,
    feather: 7,
    donorAngle: 0.42,
  },
  planet_gold_small: {
    angularAmplitude: 0.14,
    radialAmplitude: 1.6,
    speed: 0.96,
    phase: 2.1,
    scaleAmplitude: 0.025,
    feather: 6,
    donorAngle: 0.5,
  },
  planet_cyan: {
    angularAmplitude: 0.12,
    radialAmplitude: 2.4,
    speed: 0.82,
    phase: 3.7,
    scaleAmplitude: 0.034,
    feather: 8,
    donorAngle: 0.36,
  },
  planet_white: {
    angularAmplitude: 0.095,
    radialAmplitude: 2.0,
    speed: 0.68,
    phase: 5.2,
    scaleAmplitude: 0.036,
    feather: 9,
    donorAngle: 0.31,
  },
  planet_purple_small: {
    angularAmplitude: 0.16,
    radialAmplitude: 1.25,
    speed: 1.28,
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

function makeNavigationGridLayer(): HTMLCanvasElement {
  const canvas = createTransparentCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kevin navigation grid requires a 2D canvas');

  // Pixel audit: the lower half of the map has the lowest structural density.
  // Add only three medium-scale radial guides there. No dots, labels, extra
  // planets or new concentric rings.
  const angles = [1.22, Math.PI / 2, 1.92] as const;
  const startRadius = 48;
  const endRadius = 132;
  const tickRadii = [78, 108] as const;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    CENTER_X,
    CENTER_Y,
    MAP_RADIUS,
    MAP_RADIUS * Y_SCALE,
    0,
    0,
    Math.PI * 2,
  );
  ctx.clip();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const angle of angles) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const x0 = CENTER_X + cos * startRadius;
    const y0 = CENTER_Y + sin * startRadius * Y_SCALE;
    const x1 = CENTER_X + cos * endRadius;
    const y1 = CENTER_Y + sin * endRadius * Y_SCALE;

    ctx.strokeStyle = 'rgba(128, 222, 255, 0.19)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // A very faint inner highlight keeps the guide readable without becoming
    // another bright orbit line.
    ctx.strokeStyle = 'rgba(232, 249, 255, 0.08)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    for (const radius of tickRadii) {
      const x = CENTER_X + cos * radius;
      const y = CENTER_Y + sin * radius * Y_SCALE;

      // Perpendicular in screen space; short line ticks, never point markers.
      const px = -sin;
      const py = cos * Y_SCALE;
      const length = Math.hypot(px, py) || 1;
      const nx = px / length;
      const ny = py / length;
      const half = 2.6;

      ctx.strokeStyle = 'rgba(170, 232, 255, 0.22)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(x - nx * half, y - ny * half);
      ctx.lineTo(x + nx * half, y + ny * half);
      ctx.stroke();
    }
  }

  ctx.restore();
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

function buildProtectedMask(): Uint8Array {
  const protectedMask = new Uint8Array(WIDTH * HEIGHT);

  for (const definition of KEVIN_AUTHORED_OBJECTS) {
    if (definition.id !== 'sun' && !MOVING_PLANETS.has(definition.id)) continue;

    const mask = decodeKevinAuthoredMask(definition);
    for (let i = 0; i < mask.length; i += 1) {
      if (mask[i]) protectedMask[i] = 1;
    }
  }

  return protectedMask;
}

function isTinyArtifactCandidate(
  data: Uint8ClampedArray,
  pixel: number,
  protectedMask: Uint8Array,
): boolean {
  if (protectedMask[pixel]) return false;

  const x = pixel % WIDTH;
  const y = Math.floor(pixel / WIDTH);

  const u = x - CENTER_X;
  const v = (y - CENTER_Y) / Y_SCALE;
  if (u * u + v * v > MAP_RADIUS * MAP_RADIUS) return false;

  const offset = pixel * 4;
  const a = data[offset + 3]!;
  if (a < 8) return false;

  const r = data[offset]!;
  const g = data[offset + 1]!;
  const b = data[offset + 2]!;

  const brightness = (r + g + b) / 3;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);

  return brightness >= 118 && chroma >= 18;
}

function eraseMaskedArtifact(
  source: Uint8ClampedArray,
  target: Uint8ClampedArray,
  definition: KevinAuthoredObjectDefinition,
  mask: Uint8Array,
  feather: number,
  donorAngle: number,
): void {
  const points = maskCoordinates(mask);
  const padding = Math.ceil(feather + 2);
  const x0 = Math.max(0, definition.bounds.x - padding);
  const y0 = Math.max(0, definition.bounds.y - padding);
  const x1 = Math.min(WIDTH, definition.bounds.x + definition.bounds.w + padding);
  const y1 = Math.min(HEIGHT, definition.bounds.y + definition.bounds.h + padding);

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const distance = distanceToMask(x, y, points);
      const weight = patchWeight(distance, feather);
      if (weight <= 0) continue;

      const offset = (y * WIDTH + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const donorA = donorSample(source, x, y, donorAngle, channel);
        const donorB = donorSample(source, x, y, donorAngle * 1.45, channel);
        const donor = (donorA + donorB) * 0.5;

        target[offset + channel] = Math.round(
          source[offset + channel]! +
            (donor - source[offset + channel]!) * weight,
        );
      }

      target[offset + 3] = source[offset + 3]!;
    }
  }
}

function removeTinyArtifacts(
  source: Uint8ClampedArray,
  target: Uint8ClampedArray,
  protectedMask: Uint8Array,
): void {
  const visited = new Uint8Array(WIDTH * HEIGHT);
  const minX = Math.max(0, Math.floor(CENTER_X - MAP_RADIUS - 2));
  const maxX = Math.min(WIDTH - 1, Math.ceil(CENTER_X + MAP_RADIUS + 2));
  const minY = Math.max(0, Math.floor(CENTER_Y - MAP_RADIUS * Y_SCALE - 2));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(CENTER_Y + MAP_RADIUS * Y_SCALE + 2));

  const neighbors = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],            [1, 0],
    [-1, 1],  [0, 1],   [1, 1],
  ] as const;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const start = y * WIDTH + x;
      if (visited[start]) continue;
      if (!isTinyArtifactCandidate(target, start, protectedMask)) continue;

      const queue = [start];
      const component: number[] = [];
      visited[start] = 1;

      let boxMinX = x;
      let boxMaxX = x;
      let boxMinY = y;
      let boxMaxY = y;

      while (queue.length) {
        const pixel = queue.pop()!;
        component.push(pixel);

        const px = pixel % WIDTH;
        const py = Math.floor(pixel / WIDTH);

        if (px < boxMinX) boxMinX = px;
        if (px > boxMaxX) boxMaxX = px;
        if (py < boxMinY) boxMinY = py;
        if (py > boxMaxY) boxMaxY = py;

        for (const [dx, dy] of neighbors) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;

          const np = ny * WIDTH + nx;
          if (visited[np]) continue;
          if (!isTinyArtifactCandidate(target, np, protectedMask)) continue;

          visited[np] = 1;
          queue.push(np);
        }
      }

      const width = boxMaxX - boxMinX + 1;
      const height = boxMaxY - boxMinY + 1;

      if (component.length <= 18 && width <= 7 && height <= 7) {
        for (const pixel of component) {
          const px = pixel % WIDTH;
          const py = Math.floor(pixel / WIDTH);
          const offset = pixel * 4;

          for (let channel = 0; channel < 3; channel += 1) {
            const donorA = donorSample(source, px, py, 0.18, channel);
            const donorB = donorSample(source, px, py, 0.30, channel);
            const donorC = donorSample(source, px, py, 0.44, channel);
            target[offset + channel] = Math.round((donorA + donorB + donorC) / 3);
          }

          target[offset + 3] = source[offset + 3]!;
        }
      }
    }
  }
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
  const u = centroid.x - CENTER_X;
  const v = (centroid.y - CENTER_Y) / Y_SCALE;
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

function erasePlanetFromBase(
  source: Uint8ClampedArray,
  base: Uint8ClampedArray,
  definition: KevinAuthoredObjectDefinition,
  mask: Uint8Array,
  config: PlanetMotionConfig,
): void {
  eraseMaskedArtifact(
    source,
    base,
    definition,
    mask,
    config.feather,
    config.donorAngle,
  );
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
  const protectedMask = buildProtectedMask();

  for (const definition of KEVIN_AUTHORED_OBJECTS) {
    if (definition.id === 'marker_star') {
      const markerMask = decodeKevinAuthoredMask(definition);
      eraseMaskedArtifact(
        source,
        cleanBaseData.data,
        definition,
        markerMask,
        4,
        0.26,
      );
      continue;
    }

    if (
      definition.id === 'sun' ||
      !MOVING_PLANETS.has(definition.id)
    ) {
      continue;
    }

    const config = PLANET_MOTION[definition.id];
    const mask = decodeKevinAuthoredMask(definition);
    patches.push(buildPlanetPatch(definition, mask, config));
    erasePlanetFromBase(source, cleanBaseData.data, definition, mask, config);
  }

  removeTinyArtifacts(source, cleanBaseData.data, protectedMask);

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

  const navigationGrid = makeNavigationGridLayer();

  const frameCanvas = createTransparentCanvas();
  const frameCtx = frameCanvas.getContext('2d');
  if (!frameCtx) throw new Error('Kevin planet visual v2 requires a 2D canvas');

  return {
    width: WIDTH,
    height: HEIGHT,
    restDiffPixels: 0,
    render(timeSec: number, working: boolean): HTMLCanvasElement {
      if (timeSec <= 0.0001) return sourceEllipse;

      const intro = smoothstep(0, 0.65, timeSec);
      const activityBoost = working ? 1.24 : 1;

      frameCtx.save();
      frameCtx.setTransform(1, 0, 0, 1, 0, 0);
      frameCtx.clearRect(0, 0, WIDTH, HEIGHT);
      frameCtx.globalCompositeOperation = 'source-over';
      frameCtx.globalAlpha = 1;
      frameCtx.filter = 'none';
      frameCtx.drawImage(cleanBase, 0, 0);

      // Step 1 after pixel cleanup: restore medium-scale structure only in the
      // sparse lower field. Keep it restrained at idle, slightly clearer while
      // Kevin is active.
      frameCtx.globalAlpha = intro * (working ? 0.92 : 0.72);
      frameCtx.drawImage(navigationGrid, 0, 0);
      frameCtx.globalAlpha = 1;

      const states = patches
        .map((patch) => {
          const config = patch.config;
          const primaryWave =
            0.76 *
              Math.sin(
                timeSec * config.speed * activityBoost + config.phase,
              ) +
            0.24 *
              Math.sin(
                timeSec *
                  config.speed *
                  0.49 *
                  activityBoost +
                  config.phase * 2.27,
              );
          const radialWave = Math.sin(
            timeSec *
              config.speed *
              0.74 *
              activityBoost +
              config.phase * 1.67,
          );
          const theta =
            patch.orbitTheta +
            config.angularAmplitude * primaryWave * intro;
          const radius =
            patch.orbitRadius +
            config.radialAmplitude * radialWave * intro;
          const x = CENTER_X + Math.cos(theta) * radius;
          const y =
            CENTER_Y + Math.sin(theta) * radius * Y_SCALE;
          const depth = Math.sin(theta);
          return { patch, x, y, depth };
        })
        .sort((a, b) => a.depth - b.depth);

      for (const state of states) {
        const { patch, x, y, depth } = state;
        const config = patch.config;
        const scale =
          1 + config.scaleAmplitude * depth * intro;
        const opacity =
          0.96 + (depth + 1) * 0.02;
        const brightness =
          0.98 +
          (depth + 1) * 0.018 +
          Math.sin(timeSec * 0.72 + config.phase) * 0.006;

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
