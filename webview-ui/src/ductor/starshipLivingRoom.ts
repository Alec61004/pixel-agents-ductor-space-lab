import { PHOTONIC_THEME } from './starshipPhotonicTheme.js';

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

const wrap = (v: number) => ((v % 1) + 1) % 1;
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
  light.addColorStop(0, '#99ffebb0'); light.addColorStop(1, '#49e8da00');
  ctx.globalAlpha = pulse; ctx.fillStyle = light; ctx.fillRect(x - rx * 2, y - ry, rx * 4, ry * 2);
  // A traveling internal filament, confined to the crystal's actual surface.
  const front = y + ry - wrap(time * 0.11 + index * 0.13) * ry * 2;
  ctx.strokeStyle = '#b7fff0'; ctx.lineWidth = 0.75; ctx.globalAlpha = 0.35;
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
    ctx.fillStyle = i % 3 ? '#adffeb' : '#ffb4a2'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
  }
  ctx.restore();
}

/** Environment motion is drawn before characters and never repaints over them. */
export function drawLivingRoom(ctx: CanvasRenderingContext2D, time: number, activity: RoomActivity): void {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [i, [x, y, rx, ry]] of LIVING_ROOM_ZONES.crystals.entries()) drawCrystal(ctx, time, x, y, rx, ry, i);
  // Each life-support vessel has its own bubble cadence and glass ripple.
  for (const [n, p] of LIVING_ROOM_ZONES.pods.entries()) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, p.w * 0.15); ctx.clip();
    for (let i = 0; i < (n === 3 ? 17 : 8); i++) {
      const b = getPodParticle(time, i, n);
      ctx.globalAlpha = b.opacity; ctx.strokeStyle = '#b4ffe0'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(p.x + b.x * p.w, p.y + b.y * p.h, 0.6 + i % 3 * 0.4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 0.06 + Math.sin(time * 1.1 + n) * 0.025;
    ctx.fillStyle = '#77ffd0'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }
  for (const [lane, path] of LIVING_ROOM_ZONES.conduits.entries()) {
    for (let packet = 0; packet < 4; packet++) {
      const travel = wrap(time * (activity.command ? 0.19 : 0.06) + packet / 4 + lane * 0.14) * (path.length - 1);
      const index = Math.floor(travel); const t = travel - index;
      const a = path[index]!, b = path[index + 1]!;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      ctx.globalAlpha = 0.45 * Math.sin(wrap(travel / (path.length - 1)) * Math.PI);
      ctx.fillStyle = '#a6ffed'; ctx.fillRect(Math.round(x), Math.round(y), 3, 1);
    }
  }
  drawScanner(ctx, time, 1048, 527, 67, 21, activity.qa);
  // The wide overhead lens tracks a star lattice; it is not another crystal.
  ctx.save(); ctx.beginPath(); ctx.ellipse(994, 75, 96, 21, 0, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 28; i++) {
    const x = 898 + wrap(i * 0.618 - time * 0.025) * 192;
    const y = 57 + wrap(i * 0.37) * 36;
    ctx.globalAlpha = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(time + i));
    ctx.fillStyle = '#79e4ff'; ctx.fillRect(x, y, i % 4 ? 1 : 2, 1);
  }
  ctx.restore();
  // Research uses a curved ribbon with a rolling spectral trace.
  ctx.save(); ctx.beginPath(); ctx.moveTo(1400, 407); ctx.quadraticCurveTo(1472, 396, 1528, 454);
  ctx.lineTo(1528, 479); ctx.quadraticCurveTo(1472, 437, 1400, 445); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = '#8fffee'; ctx.globalAlpha = activity.qa ? 0.65 : 0.3; ctx.lineWidth = 0.75;
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
    ctx.globalAlpha = Math.sin(age * Math.PI) * 0.65;
    ctx.fillStyle = '#abffed'; ctx.beginPath(); ctx.arc(x, y, 1.1 + n % 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Storage has small status lights instead of another animated display.
  for (const [i, [x, y]] of [[214, 361], [297, 359], [215, 430], [283, 311], [446, 56]].entries()) {
    ctx.globalAlpha = 0.12 + Math.max(0, Math.sin(time * 0.8 - i)) * 0.35;
    ctx.fillStyle = i % 2 ? '#ffbd9e' : '#89fbed'; ctx.fillRect(x, y, 4, 1);
  }
  // Both side holograms transmit streams from their own emitters.
  for (const [n, x] of [714, 795].entries()) {
    for (let i = 0; i < 9; i++) {
      const age = wrap(time * (activity.navigation ? 0.35 : 0.1) + i / 9);
      ctx.globalAlpha = Math.sin(age * Math.PI) * 0.5;
      ctx.fillStyle = PHOTONIC_THEME.cyan;
      ctx.fillRect(x + Math.sin(i * 2.4) * age * 28, 461 + n * 18 - age * 60, 1, 2);
    }
  }
  // A luminous membrane opens within the existing sealed airlock aperture.
  const open = getAirlockResponse(activity.crew);
  ctx.save(); ctx.beginPath();
  ctx.moveTo(116, 324); ctx.lineTo(147, 530); ctx.lineTo(121, 570); ctx.lineTo(90, 548); ctx.lineTo(100, 363); ctx.closePath(); ctx.clip();
  const glow = ctx.createLinearGradient(95, 0, 145, 0);
  glow.addColorStop(0, '#41dedc00'); glow.addColorStop(0.5, `rgba(109,255,243,${0.06 + open * 0.28})`); glow.addColorStop(1, '#41dedc00');
  ctx.globalAlpha = 1; ctx.fillStyle = glow; ctx.fillRect(90, 324, 60, 250);
  ctx.strokeStyle = '#a5fff6'; ctx.globalAlpha = 0.3 + open * 0.5;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(116, 337);
    ctx.quadraticCurveTo(116 + side * (5 + open * 22), 435, 119 + side * open * 16, 554); ctx.stroke();
  }
  ctx.restore(); ctx.restore();
}
