import { drawQAExperiment } from './starshipQA.js';
import { PHOTONIC_THEME } from './starshipPhotonicTheme.js';
import { STARSHIP_SCENE_OBJECTS } from './starshipSceneLayout.js';

export const LIVING_ROOM_ASSET = 'themes/ductor-space-lab/photonic-room-v3.webp';
export type RoomArtwork = HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;
type Point = { x: number; y: number };
export interface RoomActivity {
  crew: readonly Point[];
  command: boolean;
  qa: boolean;
  qaTime?: number;
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
  // The room is high-resolution painted artwork, not a sprite sheet. A single
  // high-quality downsample keeps hull seams and instrument text crisp without
  // introducing the jagged edges produced by nearest-neighbour scaling.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, 1600, 678);
  roomCache.set(image, canvas);
  return canvas;
}

export const LIVING_ROOM_ZONES = {
  pods: [
    { ...STARSHIP_SCENE_OBJECTS.floorPodLeft.bounds },
    { ...STARSHIP_SCENE_OBJECTS.floorPodRight.bounds },
    { ...STARSHIP_SCENE_OBJECTS.floorPodCenter.bounds },
    { ...STARSHIP_SCENE_OBJECTS.specimenTank.bounds },
    { ...STARSHIP_SCENE_OBJECTS.rightSpecimenA.bounds },
    { ...STARSHIP_SCENE_OBJECTS.rightSpecimenB.bounds },
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
  ...STARSHIP_SCENE_OBJECTS.specimenTank.bounds,
  cx: 879, cy: 332.5,
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

function drawSpecimenTank(ctx: CanvasRenderingContext2D, time: number, active: boolean, _artwork?: RoomArtwork): void {
  const state = getSpecimenVitalState(time, active);
  const { x, y, w, h, cx, cy } = SPECIMEN_TANK;
  // Animate only the liquid interior. The authored creature and vessel shell
  // stay sharp, so no sampled rectangle can appear over the new room artwork.
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(x, y + 9);
  ctx.quadraticCurveTo(cx, y - 3, x + w, y + 9); ctx.lineTo(x + w, y + h - 13);
  ctx.bezierCurveTo(x + w - 8, y + h + 2, x + 8, y + h + 2, x, y + h - 13);
  ctx.closePath(); ctx.clip();

  // Warm pulse and a moving caustic make the preserved body feel suspended.
  ctx.globalCompositeOperation = 'screen';
  const specimenLight = ctx.createRadialGradient(cx - 5, cy - 22, 3, cx, cy, 76);
  specimenLight.addColorStop(0, `rgba(255,218,151,${0.035 + state.pulse * 0.055})`);
  specimenLight.addColorStop(0.58, '#d5aa6810'); specimenLight.addColorStop(1, '#8d6c3e00');
  ctx.fillStyle = specimenLight; ctx.fillRect(x, y, w, h);
  const causticX = x - 18 + wrap(state.scan) * (w + 36);
  const caustic = ctx.createLinearGradient(causticX - 17, 0, causticX + 17, 0);
  caustic.addColorStop(0, '#fff0bd00'); caustic.addColorStop(0.5, active ? '#fff0bd18' : '#fff0bd0b');
  caustic.addColorStop(1, '#fff0bd00');
  ctx.fillStyle = caustic; ctx.fillRect(x, y, w, h);

  ctx.globalCompositeOperation = 'source-over';
  for (const side of [-1, 1]) {
    const tubeX = cx + side * 43;
    ctx.strokeStyle = '#4b39275e'; ctx.lineWidth = 2.3;
    ctx.beginPath(); ctx.moveTo(tubeX, y + 12);
    ctx.bezierCurveTo(tubeX - side * 8, cy - 24, tubeX + side * 5, cy + 34, tubeX - side * 3, y + h - 8); ctx.stroke();
    ctx.strokeStyle = '#ffe1aa2f'; ctx.lineWidth = 0.65; ctx.stroke();
  }

  for (let i = 0; i < 27; i++) {
    const age = wrap(time * (0.043 + i % 4 * 0.013) + i * 0.173);
    const bubbleX = x + 9 + wrap(i * 0.618) * (w - 18) + Math.sin(time * 0.65 + i) * 2;
    const bubbleY = y + h - 7 - age * (h - 18), radius = 0.55 + i % 4 * 0.38;
    ctx.globalAlpha = Math.sin(age * Math.PI) * (i % 2 ? 0.52 : 0.25);
    ctx.fillStyle = '#624a2b'; ctx.beginPath(); ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe5b4'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(bubbleX - 0.15, bubbleY - 0.2, radius * 0.78, 3.5, 5.7); ctx.stroke();
  }

  ctx.globalAlpha = 1;
  const glass = ctx.createLinearGradient(x, 0, x + w, 0);
  glass.addColorStop(0, '#ffe4ad32'); glass.addColorStop(0.06, '#ffe4ad0b');
  glass.addColorStop(0.18, '#ffe4ad12'); glass.addColorStop(0.78, '#ffe4ad00');
  glass.addColorStop(0.94, '#ffe4ad12'); glass.addColorStop(1, '#ffe4ad36');
  ctx.fillStyle = glass; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Environment motion is drawn before characters and never repaints over them. */
export function drawLivingRoom(ctx: CanvasRenderingContext2D, time: number, activity: RoomActivity, artwork?: RoomArtwork): void {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  drawSpecimenTank(ctx, time, activity.command || activity.qa, artwork);
  // Each life-support vessel has its own bubble cadence and glass ripple.
  for (const [n, p] of LIVING_ROOM_ZONES.pods.entries()) {
    if (n === 3) continue; // The large tank has its own optical and particle pass.
    ctx.save(); ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, p.w * 0.15); ctx.clip();
    // Match the large vessel's deep liquid instead of adding lime bloom.
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const liquid = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
    liquid.addColorStop(0, '#6b4c271f'); liquid.addColorStop(0.5, '#79552a16');
    liquid.addColorStop(1, '#49352124');
    ctx.fillStyle = liquid; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < (p.w < 20 ? 3 : 6); i++) {
      const b = getPodParticle(time, i, n);
      ctx.globalAlpha = b.opacity * 0.6; ctx.strokeStyle = '#ffe0a0'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(p.x + b.x * p.w, p.y + b.y * p.h, 0.6 + i % 3 * 0.4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 0.025 + Math.sin(time * 0.65 + n) * 0.012;
    ctx.fillStyle = '#e9b768'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }
  // The bridge lighting pass owns the rail itself; this layer contributes only
  // sparse moving packets so the baked rail is not outlined a second time.
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
  if (activity.qa) drawQAExperiment(ctx, activity.qaTime ?? time);
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
