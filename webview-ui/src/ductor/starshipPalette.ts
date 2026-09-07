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
    const violet = clamp((Math.min(r, b) - g - 4) / 45);
    const cyan = clamp((Math.min(g, b) - r - 12) / 55) * clamp((l - 48) / 70);
    const green = clamp((g - Math.max(r, b) - 5) / 50);
    const bio = (wx > 823 && wx < 922 && wy > 284 && wy < 434) ||
      (wy > 510 && wy < 605 && ((wx > 328 && wx < 460) || (wx > 719 && wx < 779))) ||
      (wx > 1320 && wx < 1380 && wy > 425 && wy < 480);
    // Lift low-value metal slightly instead of crushing the whole scene.
    const base = l + 5 * (1 - clamp(l / 100));
    const saturation = bio ? 0.38 : 0.34 + violet * 0.14;
    let rr = base + (r - l) * saturation;
    let gg = base + (g - l) * saturation;
    let bb = base + (b - l) * saturation;
    if (violet > 0) {
      const exposure = 1 - violet * 0.26;
      rr *= exposure; gg *= exposure; bb *= exposure;
    }
    if (bio) {
      // Olive nutrient fluid, distinct from computer light; retain body shadows.
      const strength = Math.max(green, cyan) * 0.75;
      rr += (l * 0.98 - rr) * strength;
      gg += (l * 1.04 - gg) * strength;
      bb += (l * 0.73 - bb) * strength;
    } else if (cyan > 0) {
      let color = [0.96, 1.01, 1.02];
      let station = false;
      if (wx > 310 && wx < 790 && wy > 304 && wy < 437 && (wy < 380 || wx < 650)) {
        color = [1.29, 0.96, 0.61]; station = true;
      } else if (wx > 500 && wx < 650 && wy > 436 && wy < 590) {
        color = [0.77, 1.02, 1.32]; station = true;
      } else if (wx > 955 && wx < 1178 && wy > 491 && wy < 601) {
        color = [1.00, 1.025, 0.97]; station = true;
      }
      const exposure = station && powered ? 0.94 : 0.58;
      rr += (l * color[0]! * exposure - rr) * cyan;
      gg += (l * color[1]! * exposure - gg) * cyan;
      bb += (l * color[2]! * exposure - bb) * cyan;
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
