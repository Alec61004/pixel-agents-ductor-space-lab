import { drawQAExperiment } from './starshipQA.js';
import { PHOTONIC_THEME } from './starshipPhotonicTheme.js';
import { prepareResearchPalette, drawResearchWorklights } from './starshipPalette.js';

export const LIVING_ROOM_ASSET = 'themes/ductor-space-lab/photonic-room-v1.png';
export type RoomArtwork = HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;
type Point = { x: number; y: number };
export interface RoomActivity {
  crew: readonly Point[];
  command: boolean;
  qa: boolean;
  navigation: boolean;
}

// All authored positions use the original 1600×678 simulation coordinates.
// Normalise once, not per frame, so map/ship texture sampling uses that same space.
const roomCache = new WeakMap<HTMLImageElement, RoomArtwork>();
export function getLivingRoomArtwork(image?: HTMLImageElement): RoomArtwork | undefined {
  if (!image || image.width < 1 || image.height < 1) return undefined;
  if (roomCache.has(image)) return roomCache.get(image);
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(1600, 678);
  else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 678;
  } else return undefined;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return undefined;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, 1600, 678);
  prepareResearchPalette(canvas, ctx);
  roomCache.set(image, canvas);
  return canvas;
}

export const LIVING_ROOM_ZONES = {
  pods: [
    { x: 330, y: 528, w: 48, h: 63 }, { x: 405, y: 538, w: 46, h: 59 },
    { x: 724, y: 540, w: 51, h: 60 }, { x: 827, y: 297, w: 91, h: 132 },
    { x: 1329, y: 442, w: 15, h: 29 }, { x: 1361, y: 442, w: 15, h: 28 },
  ],
  crystals: [
    [997, 76, 5, 12], [236, 212, 3, 8], [689, 538, 3, 10],
  ],
  conduits: [
    [[38, 640], [142, 644], [170, 607], [310, 604]],
    [[462, 627], [476, 653], [456, 677]],
    [[657, 579], [687, 625], [753, 631], [785, 676]],
    [[920, 532], [974, 587], [1070, 602], [1174, 580], [1300, 574]],
    [[1390, 613], [1452, 654], [1568, 635]],
    [[444, 78], [533, 87], [585, 47], [647, 54]],
    [[1385, 85], [1410, 85], [1437, 85]],
  ],
} as const;

/** Inner glass coordinates for the preserved alien specimen tank. */
export const SPECIMEN_TANK = {
  x: 836, y: 279, w: 73, h: 145,
  cx: 872.5, cy: 351.5,
} as const;

const wrap = (v: number) => ((v % 1) + 1) % 1;

export interface SpecimenVitalState {
  pulse: number;
  respiration: number;
  scan: number;
  alert: number;
}

/** Stable animation state for the body inside the authored tank artwork. */
export function getSpecimenVitalState(time: number, active: boolean): SpecimenVitalState {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  const pulseRate = active ? 1.75 : 1.05;
  const breathRate = active ? 0.72 : 0.34;
  return {
    pulse: 0.5 + Math.sin(t * pulseRate) * 0.5,
    respiration: 0.5 + Math.sin(t * breathRate + 0.9) * 0.5,
    scan: wrap(t * (active ? 0.42 : 0.12)),
    alert: active ? 0.68 + Math.sin(t * 0.9) * 0.16 : 0.28 + Math.sin(t * 0.35) * 0.06,
  };
}

export function getPodParticle(time: number, index: number, pod: number) {
  const age = wrap(time * (0.08 + index % 3 * 0.014) + index * 0.618 + pod * 0.23);
  return { x: 0.12 + wrap(index * 0.37 + pod * 0.11) * 0.76 + Math.sin(time * 0.7 + index) * 0.035,
    y: 0.94 - age * 0.88, opacity: Math.sin(age * Math.PI) * 0.55 };
}

export function getAirlockResponse(crew: readonly Point[]): number {
  const distance = Math.min(...crew.map(p => Math.hypot(p.x - 180, p.y - 592)));
  const t = Math.max(0, Math.min(1, (150 - distance) / 90));
  return t * t * (3 - 2 * t);
}

function drawCrystal(ctx: CanvasRenderingContext2D, time: number, x: number, y: number, rx: number, ry: number, index: number) {
  const phase = time * 0.6 + index * 0.8;
  const pulse = 0.28 + (Math.sin(phase) + 1) * 0.12;
  ctx.save(); ctx.beginPath();
  ctx.moveTo(x, y - ry); ctx.quadraticCurveTo(x + rx * 1.5, y, x, y + ry);
  ctx.quadraticCurveTo(x - rx * 1.5, y, x, y - ry); ctx.clip();
  const light = ctx.createRadialGradient(x, y, 1, x, y, ry);
  light.addColorStop(0, '#6edcf27a'); light.addColorStop(1, '#42b6d000');
  ctx.globalAlpha = pulse; ctx.fillStyle = light; ctx.fillRect(x - rx * 2, y - ry, rx * 4, ry * 2);
  // A traveling internal filament, confined to the crystal's actual surface.
  const front = y + ry - wrap(time * 0.11 + index * 0.13) * ry * 2;
  ctx.strokeStyle = '#b8f2fb'; ctx.lineWidth = 0.75; ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.moveTo(x - rx, front + 3);
  ctx.quadraticCurveTo(x, front - 4, x + rx, front + 3); ctx.stroke();
  ctx.restore();
}

function drawScanner(ctx: CanvasRenderingContext2D, time: number, x: number, y: number, rx: number, ry: number, active: boolean) {
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
  const phase = time * (active ? 0.75 : 0.16);
  ctx.globalAlpha = active ? 0.5 : 0.16;
  ctx.strokeStyle = PHOTONIC_THEME.cyan; ctx.lineWidth = 0.85;
  for (let i = 0; i < 3; i++) {
    const scanX = x - rx + wrap(phase * 0.2 + i / 3) * rx * 2;
    ctx.beginPath(); ctx.moveTo(scanX, y - ry); ctx.quadraticCurveTo(scanX + 9, y, scanX, y + ry); ctx.stroke();
  }
  // An alien sample rotates in the scan volume; the scanner reads its vertices.
  const points = Array.from({ length: 7 }, (_, i) => {
    const a = phase * 0.45 + i * Math.PI * 2 / 7;
    return { x: x + Math.cos(a) * rx * 0.45, y: y + Math.sin(a) * ry * 0.48 };
  });
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!, q = points[(i + 2) % points.length]!;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.fillStyle = i % 3 ? '#8debf8' : '#f3a64c'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
  }
  ctx.restore();
}

function drawSpecimenTank(ctx: CanvasRenderingContext2D, time: number, active: boolean, artwork?: RoomArtwork): void {
  const state = getSpecimenVitalState(time, active);
  // The curved glass boundary excludes both metal caps.
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(825, 288);
  ctx.quadraticCurveTo(872, 304, 920, 288); ctx.lineTo(920, 415);
  ctx.bezierCurveTo(912, 437, 836, 437, 825, 415); ctx.closePath(); ctx.clip();
  if (artwork) {
    // Reuse the textured organism, with subpixel buoyancy and refraction. Only
    // the interior moves: the pressure vessel and its metal rims stay fixed.
    ctx.save();
    const drift = Math.sin(time * 0.48) * 1.35;
    const swell = 1 + state.respiration * 0.006;
    ctx.translate(872.5, 356 + drift); ctx.scale(swell, 1);
    ctx.drawImage(artwork, 822, 286, 102, 148, -50.5, -70, 102, 148);
    ctx.restore();
  }
  // Absorption through deep liquid, with a shadowed centre and lit glass edges.
  const fluid = ctx.createLinearGradient(825, 0, 920, 0);
  fluid.addColorStop(0, '#2b241ea8'); fluid.addColorStop(0.12, '#76563246');
  fluid.addColorStop(0.38, '#45332248'); fluid.addColorStop(0.72, '#35291f62');
  fluid.addColorStop(0.94, '#9c743c36'); fluid.addColorStop(1, '#2b241eaa');
  ctx.fillStyle = fluid; ctx.fillRect(822, 286, 102, 150);
  // Warm optical veil: the live organism can remain green, but the vessel
  // reads as amber glass instead of a green neon cylinder.
  ctx.fillStyle = 'rgba(214,153,67,0.18)';
  ctx.fillRect(822, 286, 102, 150);
  const depth = ctx.createLinearGradient(0, 291, 0, 433);
  depth.addColorStop(0, '#211b176b'); depth.addColorStop(0.32, '#4c382400');
  depth.addColorStop(0.75, '#36291e18'); depth.addColorStop(1, '#2b211a58');
  ctx.fillStyle = depth; ctx.fillRect(822, 286, 102, 150);
  // Soft caustic pools wander over the organism, never wireframes or scan bars.
  ctx.globalCompositeOperation = 'screen';
  const specimenLight = ctx.createRadialGradient(867, 331, 3, 873, 352, 60);
  specimenLight.addColorStop(0, '#f2c67830');
  specimenLight.addColorStop(0.55, '#c49a590f'); specimenLight.addColorStop(1, '#8d6c3e00');
  ctx.fillStyle = specimenLight; ctx.fillRect(825, 291, 95, 144);
  for (let i = 0; i < 3; i++) {
    const x = 850 + i * 20 + Math.sin(time * 0.32 + i * 2) * 6;
    const y = 324 + i * 32 + Math.cos(time * 0.4 + i) * 9;
    const light = ctx.createRadialGradient(x, y, 1, x, y, 24);
    light.addColorStop(0, 'rgba(244,193,111,0.09)'); light.addColorStop(1, '#b4874d00');
    ctx.fillStyle = light; ctx.fillRect(x - 24, y - 24, 48, 48);
  }
  // Suspension tubing stays beside the specimen, behind the foreground glass.
  ctx.globalCompositeOperation = 'source-over';
  for (const side of [-1, 1]) {
    const x = 872 + side * 32;
    ctx.strokeStyle = '#49351fb0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, 294);
    ctx.bezierCurveTo(x - side * 8, 337, x + side * 5, 380, x - side * 3, 422); ctx.stroke();
    ctx.strokeStyle = '#ffe0a64a'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  // Distinct far/near bubbles: shaded bodies, bright crescent reflections.
  for (let i = 0; i < 23; i++) {
    const age = wrap(time * (0.043 + i % 4 * 0.013) + i * 0.173);
    const x = 832 + wrap(i * 0.618) * 80 + Math.sin(time * 0.65 + i) * 1.8;
    const y = 428 - age * 132, radius = 0.55 + i % 4 * 0.38;
    ctx.globalAlpha = Math.sin(age * Math.PI) * (i % 2 ? 0.62 : 0.3);
    ctx.fillStyle = '#644927'; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe1a3'; ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.arc(x - 0.15, y - 0.2, radius * 0.78, 3.5, 5.7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const glass = ctx.createLinearGradient(825, 0, 920, 0);
  glass.addColorStop(0, '#ffe3ad68'); glass.addColorStop(0.035, '#ffe3ad14');
  glass.addColorStop(0.09, '#ffe3ad30'); glass.addColorStop(0.19, '#ffe3ad00');
  glass.addColorStop(0.80, '#ffe3ad00'); glass.addColorStop(0.93, '#ffe3ad2a');
  glass.addColorStop(1, '#ffe3ad68');
  ctx.fillStyle = glass; ctx.fillRect(824, 291, 98, 145);
  ctx.fillStyle = '#fff0c514'; ctx.beginPath(); ctx.moveTo(837, 298);
  ctx.lineTo(846, 300); ctx.lineTo(857, 426); ctx.lineTo(852, 427); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Soft light on the floor connects each instrument to the room's materials. */
function drawDeckLighting(ctx: CanvasRenderingContext2D, time: number, activity: RoomActivity): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Follow the open deck; light must not wash over the consoles or windows.
  ctx.beginPath(); ctx.moveTo(405, 408); ctx.lineTo(675, 408);
  ctx.lineTo(675, 518); ctx.lineTo(803, 549); ctx.lineTo(935, 572);
  ctx.lineTo(1246, 592); ctx.lineTo(1510, 612); ctx.lineTo(1560, 678);
  ctx.lineTo(45, 678); ctx.lineTo(185, 560); ctx.lineTo(320, 505);
  ctx.closePath(); ctx.clip();
  const depth = ctx.createLinearGradient(0, 408, 0, 678);
  depth.addColorStop(0, '#09141c00'); depth.addColorStop(0.7, '#09141c0d');
  depth.addColorStop(1, '#09141c1c');
  ctx.fillStyle = depth; ctx.fillRect(0, 408, 1600, 270);
  ctx.globalCompositeOperation = 'screen';
  const sources = [
    { x: 558, y: 422, rx: 142, ry: 52, active: activity.command, rgb: '76,201,234' },
    { x: 568, y: 579, rx: 117, ry: 70, active: activity.navigation, rgb: '70,176,229' },
    { x: 1060, y: 591, rx: 125, ry: 49, active: activity.qa, rgb: '92,205,235' },
  ];
  for (const [index, source] of sources.entries()) {
    ctx.save(); ctx.translate(source.x, source.y); ctx.scale(source.rx, source.ry);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    const intensity = (source.active ? 0.14 : 0.05) + Math.sin(time * 0.6 + index) * 0.012;
    glow.addColorStop(0, `rgba(${source.rgb},${intensity})`);
    glow.addColorStop(0.4, `rgba(${source.rgb},${intensity * 0.45})`);
    glow.addColorStop(1, `rgba(${source.rgb},0)`);
    ctx.fillStyle = glow; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
  }
  ctx.restore();
}

/** Environment motion is drawn before characters and never repaints over them. */
export function drawLivingRoom(ctx: CanvasRenderingContext2D, time: number, activity: RoomActivity, artwork?: RoomArtwork): void {
  if (artwork) drawResearchWorklights(ctx, artwork, activity);
  drawDeckLighting(ctx, time, activity);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [i, [x, y, rx, ry]] of LIVING_ROOM_ZONES.crystals.entries()) drawCrystal(ctx, time, x, y, rx, ry, i);
  drawSpecimenTank(ctx, time, activity.command || activity.qa, artwork);
  // Each life-support vessel has its own bubble cadence and glass ripple.
  for (const [n, p] of LIVING_ROOM_ZONES.pods.entries()) {
    if (n === 3) continue; // The large tank has its own optical and particle pass.
    ctx.save(); ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, p.w * 0.15); ctx.clip();
    // Match the large vessel's deep liquid instead of adding lime bloom.
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const liquid = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
    liquid.addColorStop(0, '#6b4c2738'); liquid.addColorStop(0.5, '#79552a28');
    liquid.addColorStop(1, '#49352140');
    ctx.fillStyle = liquid; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < (p.w < 20 ? 3 : 6); i++) {
      const b = getPodParticle(time, i, n);
      ctx.globalAlpha = b.opacity * 0.6; ctx.strokeStyle = '#ffe0a0'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(p.x + b.x * p.w, p.y + b.y * p.h, 0.6 + i % 3 * 0.4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 0.025 + Math.sin(time * 0.65 + n) * 0.012;
    ctx.fillStyle = '#e2b05f'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }
  // The reference uses visible cyan energy rails even while idle.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineWidth = 1.15;
  ctx.strokeStyle = '#42cbe6';
  ctx.globalAlpha = 0.16 + (activity.command ? 0.10 : 0);
  for (const path of LIVING_ROOM_ZONES.conduits) {
    ctx.beginPath();
    path.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    });
    ctx.stroke();
  }
  ctx.restore();

  for (const [lane, path] of LIVING_ROOM_ZONES.conduits.entries()) {
    for (let packet = 0; packet < 4; packet++) {
      const travel = wrap(time * (activity.command ? 0.19 : 0.06) + packet / 4 + lane * 0.14) * (path.length - 1);
      const index = Math.floor(travel); const t = travel - index;
      const a = path[index]!, b = path[index + 1]!;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      ctx.globalAlpha = (activity.command ? 0.32 : 0.17) * Math.sin(wrap(travel / (path.length - 1)) * Math.PI);
      ctx.fillStyle = '#62d4e9'; ctx.fillRect(Math.round(x), Math.round(y), 3, 1);
    }
  }
  drawScanner(ctx, time, 1048, 527, 67, 21, false);
  if (activity.qa) drawQAExperiment(ctx, time);
  // The wide overhead lens tracks a star lattice; it is not another crystal.
  ctx.save(); ctx.beginPath(); ctx.ellipse(994, 75, 96, 21, 0, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 28; i++) {
    const x = 898 + wrap(i * 0.618 - time * 0.025) * 192;
    const y = 57 + wrap(i * 0.37) * 36;
    ctx.globalAlpha = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(time + i));
    ctx.fillStyle = '#8cdff1'; ctx.fillRect(x, y, i % 4 ? 1 : 2, 1);
  }
  ctx.restore();
  // Research uses a curved ribbon with a rolling spectral trace.
  ctx.save(); ctx.beginPath(); ctx.moveTo(1400, 407); ctx.quadraticCurveTo(1472, 396, 1528, 454);
  ctx.lineTo(1528, 479); ctx.quadraticCurveTo(1472, 437, 1400, 445); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = '#6edcf2'; ctx.globalAlpha = activity.qa ? 0.45 : 0.10; ctx.lineWidth = 0.75;
  ctx.beginPath();
  for (let i = 0; i <= 115; i += 2) {
    const y = 427 + (i / 115) ** 2 * 24 + Math.sin(i * 0.17 - time * 1.6) * (4 + 3 * Math.sin(i * 0.06));
    if (i === 0) ctx.moveTo(1405 + i, y); else ctx.lineTo(1405 + i, y);
  }
  ctx.stroke(); ctx.restore();
  // The right-wall neural culture sends pulses along branching filaments.
  ctx.save(); ctx.beginPath(); ctx.ellipse(1560, 380, 18, 91, -0.05, 0, Math.PI * 2); ctx.clip();
  for (let n = 0; n < 5; n++) {
    const age = wrap(time * 0.13 + n / 5);
    const y = 456 - age * 145;
    const x = 1560 + Math.sin(age * 9 + n) * (4 + n * 2);
    ctx.globalAlpha = Math.sin(age * Math.PI) * 0.25;
    ctx.fillStyle = '#67d7e9'; ctx.beginPath(); ctx.arc(x, y, 1.1 + n % 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Storage has small status lights instead of another animated display.
  for (const [i, [x, y]] of [[214, 361], [297, 359], [215, 430], [283, 311], [446, 56]].entries()) {
    ctx.globalAlpha = 0.12 + Math.max(0, Math.sin(time * 0.8 - i)) * 0.35;
    ctx.fillStyle = i % 2 ? '#f3a64c' : '#72dff2'; ctx.fillRect(x, y, 4, 1);
  }
  // Both side holograms transmit streams from their own emitters.
  for (const [n, x] of [714, 795].entries()) {
    for (let i = 0; i < 9; i++) {
      const age = wrap(time * (activity.navigation ? 0.35 : 0.1) + i / 9);
      ctx.globalAlpha = Math.sin(age * Math.PI) * (activity.navigation ? 0.3 : 0.08);
      ctx.fillStyle = PHOTONIC_THEME.cyan;
      ctx.fillRect(x + Math.sin(i * 2.4) * age * 28, 461 + n * 18 - age * 60, 1, 2);
    }
  }
  // A luminous membrane opens within the existing sealed airlock aperture.
  const open = getAirlockResponse(activity.crew);
  ctx.save(); ctx.beginPath();
  ctx.moveTo(116, 324); ctx.lineTo(147, 530); ctx.lineTo(121, 570); ctx.lineTo(90, 548); ctx.lineTo(100, 363); ctx.closePath(); ctx.clip();
  const glow = ctx.createLinearGradient(95, 0, 145, 0);
  glow.addColorStop(0, '#41dedc00'); glow.addColorStop(0.5, `rgba(91,218,241,${0.04 + open * 0.22})`); glow.addColorStop(1, '#41dedc00');
  ctx.globalAlpha = 1; ctx.fillStyle = glow; ctx.fillRect(90, 324, 60, 250);
  ctx.strokeStyle = '#9beafb'; ctx.globalAlpha = 0.12 + open * 0.3;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(116, 337);
    ctx.quadraticCurveTo(116 + side * (5 + open * 22), 435, 119 + side * open * 16, 554); ctx.stroke();
  }
  ctx.restore(); ctx.restore();
}
