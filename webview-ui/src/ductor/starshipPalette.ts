import type { RoomActivity, RoomArtwork } from './starshipLivingRoom.js';

type RoomContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const worklightCache = new WeakMap<RoomArtwork, RoomArtwork>();
const stations = [
  { key: 'command', x: 310, y: 304, w: 480, h: 133 },
  { key: 'navigation', x: 500, y: 436, w: 150, h: 154 },
  { key: 'qa', x: 955, y: 491, w: 223, h: 110 },
] as const;

/** Grade only authored scenery, once at load. Crew sprites and UI stay separate.
 * Neutral metal retains its luminance; only saturated emission loses exposure.
 * Coordinate masks use the same 1600 × 678 space as the room's instruments. */
export function gradeResearchRoom(pixels: Uint8ClampedArray, width: number, height: number, powered = false): void {
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4;
    if (!pixels[p + 3]) continue;

    const r = pixels[p]!, g = pixels[p + 1]!, b = pixels[p + 2]!;
    const l = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const wx = x * 1600 / width, wy = y * 678 / height;

    const violet = clamp((Math.min(r, b) - g + 2) / 46);
    const cyan = clamp((Math.min(g, b) - r - 7) / 52) * clamp((l - 34) / 76);
    const green = clamp((g - Math.max(r, b) - 3) / 48);
    const warm = clamp((r - b - 7) / 54) * clamp((l - 30) / 88);
    const bright = clamp((l - 92) / 100);

    const window =
      wy > 105 && wy < 448 &&
      ((wx > 340 && wx < 790) || (wx > 855 && wx < 1310) || (wx > 1320 && wx < 1590));
    const bio = (wx > 823 && wx < 922 && wy > 284 && wy < 434) ||
      (wy > 510 && wy < 605 && ((wx > 328 && wx < 460) || (wx > 719 && wx < 779))) ||
      (wx > 1320 && wx < 1380 && wy > 425 && wy < 480);
    const command = wx > 310 && wx < 790 && wy > 304 && wy < 437 && (wy < 380 || wx < 650);
    const navigation = wx > 500 && wx < 650 && wy > 436 && wy < 590;
    const qa = wx > 955 && wx < 1178 && wy > 491 && wy < 601;
    const station = command || navigation || qa;

    let rr: number, gg: number, bb: number;

    if (window) {
      // Force the authored purple room sky toward the deep cobalt reference,
      // while preserving the bright sun and warm nebula highlights.
      rr = r * 0.58 + l * 0.10;
      gg = g * 0.86 + l * 0.12;
      bb = Math.min(255, b * 1.15 + l * 0.08);

      const purpleCut = Math.max(violet, clamp((r - g + 2) / 42));
      if (purpleCut > 0.01) {
        const strength = purpleCut * 0.86;
        rr += (l * 0.34 - rr) * strength;
        gg += (l * 0.90 - gg) * strength;
        bb += (l * 1.42 - bb) * strength;
      }

      if (warm > 0.01 || (bright > 0.25 && r > g)) {
        const strength = Math.max(warm, bright * 0.5) * 0.88;
        rr += (l * 1.48 - rr) * strength;
        gg += (l * 1.07 - gg) * strength;
        bb += (l * 0.52 - bb) * strength;
      }
    } else if (bio) {
      // Amber/olive specimen glass: warm the fluid hard enough that the
      // original green bake does not dominate the room.
      const strength = Math.max(0.45, green, cyan, warm);
      rr = l * (0.92 + 0.46 * strength);
      gg = l * (0.84 + 0.20 * strength);
      bb = l * (0.57 + 0.08 * strength);
      if (bright > 0) {
        rr += 28 * bright;
        gg += 16 * bright;
      }
    } else {
      // Blue-black graphite. Preserve luminance, but deliberately avoid the
      // previous neutral-grey result.
      rr = l * 0.66 + (r - l) * 0.16;
      gg = l * 0.91 + (g - l) * 0.22;
      bb = l * 1.12 + (b - l) * 0.30;

      if (cyan > 0.01) {
        const exposure = station ? (powered ? 1.28 : 1.02) : 0.90;
        const color = qa ? [0.54, 1.12, 1.35] :
          navigation ? [0.50, 1.08, 1.40] :
          command ? [0.52, 1.13, 1.37] :
          [0.58, 1.03, 1.25];
        const strength = cyan * (station ? 0.92 : 0.72);
        rr += (l * color[0]! * exposure - rr) * strength;
        gg += (l * color[1]! * exposure - gg) * strength;
        bb += (l * color[2]! * exposure - bb) * strength;
      }

      if (warm > 0.01) {
        const strength = warm * (command ? 1.0 : 0.84);
        rr += (l * 1.52 - rr) * strength;
        gg += (l * 0.94 - gg) * strength;
        bb += (l * 0.38 - bb) * strength;
      }

      // Keep bright metal edges readable instead of crushing them into navy.
      if (bright > 0) {
        const lift = bright * 0.34;
        rr += (l * 0.92 - rr) * lift;
        gg += (l * 1.05 - gg) * lift;
        bb += (l * 1.12 - bb) * lift;
      }
    }

    pixels[p] = rr; pixels[p + 1] = gg; pixels[p + 2] = bb;
  }
}
function makeCanvas(): HTMLCanvasElement | OffscreenCanvas | undefined {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(1600, 678);
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 678;
  return canvas;
}

export function prepareResearchPalette(canvas: RoomArtwork, ctx: RoomContext): void {
  // Custom cross-origin artwork can be non-readable. Keep that artwork usable.
  if (typeof ctx.getImageData !== 'function') return;
  try {
    const idle = ctx.getImageData(0, 0, 1600, 678);
    const on = ctx.createImageData(1600, 678); on.data.set(idle.data);
    gradeResearchRoom(idle.data, 1600, 678);
    gradeResearchRoom(on.data, 1600, 678, true);
    // Store only the extra emitted light. Screen composition adds it without
    // repainting any window, moving sample, or other animated room contents.
    for (let p = 0; p < on.data.length; p += 4) {
      let lit = false;
      for (let c = 0; c < 3; c++) {
        const extra = Math.max(0, on.data[p + c]! - idle.data[p + c]!);
        on.data[p + c] = extra * 255 / Math.max(1, 255 - idle.data[p + c]!);
        lit ||= extra > 0;
      }
      on.data[p + 3] = lit ? idle.data[p + 3]! : 0;
    }
    const emission = makeCanvas();
    const emissionCtx = emission?.getContext('2d') as RoomContext | null | undefined;
    if (emission && emissionCtx) { emissionCtx.putImageData(on, 0, 0); worklightCache.set(canvas, emission); }
    ctx.putImageData(idle, 0, 0);
  } catch { /* Keep the ungraded source if pixel access is unavailable. */ }
}

export function drawResearchWorklights(ctx: CanvasRenderingContext2D, artwork: RoomArtwork, activity: RoomActivity): void {
  const emission = worklightCache.get(artwork);
  if (!emission) return;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 1;
  for (const s of stations) {
    if (activity[s.key]) ctx.drawImage(emission, s.x, s.y, s.w, s.h, s.x, s.y, s.w, s.h);
  }
  ctx.restore();
}
