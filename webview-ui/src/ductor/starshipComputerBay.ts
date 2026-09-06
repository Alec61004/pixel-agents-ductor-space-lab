import type { DuctorRoleName } from './ductorLabModel.js';
import type { RoomArtwork } from './starshipLivingRoom.js';

/** Pixel bounds in the authored 1600×678 starship background. */
export interface ComputerBayBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ComputerBayOperator = Extract<DuctorRoleName, 'Alec' | 'Kevin'>;

export interface OriginalComputerBay {
  operator: ComputerBayOperator;
  label: string;
  roleDescription: string;
  bayId: 'central-command' | 'port-build';
  /** Full region occupied by this bay in the baked room background. */
  backgroundBounds: ComputerBayBounds;
  /** Authored chair/feet anchors used by the character simulation. */
  approachPoint: { x: number; y: number };
  interactionPoint: { x: number; y: number };
  facing: 'back';
  /** Existing screen glass only — never draw over the bezels or furniture. */
  displayBounds: ComputerBayBounds;
  displayAreas: readonly ComputerBayBounds[];
  occlusionBounds: ComputerBayBounds;
  stationIndex: number;
}

/**
 * Canonical source assets for the two computer bays.
 *
 * The visible room is a flattened `starship-bg.png`; these files are the
 * original tile/sprite source to consult before replacing any bay artwork.
 */
export const ORIGINAL_COMPUTER_BAY_ASSETS = {
  background: 'themes/ductor-space-lab/starship-bg.png',
  consoleTile: 'themes/ductor-space-lab/console-neon.png',
  tileDefinition: 'src/office/sprites/ductorSpaceLabTiles.json#consoleNeon',
  sourceCommit: 'd03b57d16534ba970e9cf1f9258d096fcc477dce',
} as const;

/**
 * Single source of truth for the two original computer areas.
 * Keep all coordinate and source-asset changes here so debugging does not
 * require searching through simulation/rendering code.
 */
export const ORIGINAL_COMPUTER_BAYS: Record<ComputerBayOperator, OriginalComputerBay> = {
  Alec: {
    operator: 'Alec',
    label: 'Alec — Strategy',
    roleDescription: 'Strategy',
    bayId: 'central-command',
    backgroundBounds: { x: 407, y: 299, w: 327, h: 130 },
    approachPoint: { x: 560, y: 500 },
    interactionPoint: { x: 560, y: 450 },
    facing: 'back',
    displayBounds: { x: 455, y: 302, w: 255, h: 110 },
    displayAreas: [
      { x: 465, y: 312, w: 49, h: 25 },
      { x: 560, y: 312, w: 48, h: 25 },
      { x: 650, y: 312, w: 49, h: 25 },
    ],
    occlusionBounds: { x: 442, y: 389, w: 72, h: 60 },
    stationIndex: 1,
  },
  Kevin: {
    operator: 'Kevin',
    label: 'Kevin — Build',
    roleDescription: 'Build',
    bayId: 'port-build',
    backgroundBounds: { x: 303, y: 311, w: 146, h: 181 },
    approachPoint: { x: 420, y: 535 },
    interactionPoint: { x: 420, y: 500 },
    facing: 'back',
    displayBounds: { x: 314, y: 320, w: 111, h: 126 },
    displayAreas: [
      { x: 318, y: 331, w: 35, h: 62 },
      { x: 365, y: 357, w: 49, h: 72 },
    ],
    occlusionBounds: { x: 391, y: 414, w: 62, h: 61 },
    stationIndex: 4,
  },
};

/** Approved photonic bay artwork; coordinates remain in the original room space. */
export const PHOTONIC_BAY_ASSET = 'themes/ductor-space-lab/photonic-bay-v1.png';
export const ALEC_SEATED_ASSET = 'themes/ductor-space-lab/alec-seated.png';

// The seated pelvis is inside the shell at (560, 369). The routing anchor
// stays on the walkable floor; it is not a drawing anchor for a seated body.
export const ALEC_SEAT = { x: 560, feetY: 393, height: 80 };

export const ALEC_SEATED_ATLAS = {
  width: 2172, height: 724, columns: 4, bodyTop: 117, bodyBottom: 634,
};

/** Read, touch left, read, touch right, then rest. Hold times avoid flicker. */
export function getCommandGesture(time: number): { frame: number; contact: number } {
  const phase = ((time % 6.4) + 6.4) % 6.4;
  if (phase < 1.4) return { frame: 0, contact: 0 };
  if (phase < 2.1) return { frame: 1, contact: -1 };
  if (phase < 2.8) return { frame: 0, contact: 0 };
  if (phase < 3.7) return { frame: 2, contact: 1 };
  return { frame: 3, contact: 0 };
}

/** Light travels along the authored console, reacting to each hand contact. */
export function drawPhotonicActivity(ctx: CanvasRenderingContext2D, time: number, active: boolean): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const energy = active ? 1 : 0.22;
  const phase = time * (active ? 1.5 : 0.35);
  const nodes = [[470, 346], [552, 344], [674, 344]] as const;
  for (let n = 0; n < nodes.length; n++) {
    const [x, y] = nodes[n]!;
    for (let i = 0; i < 5; i++) {
      const rise = (phase * 0.24 + i / 5 + n * 0.17) % 1;
      const px = x + Math.sin(phase + i * 1.9) * (7 + i * 2);
      const py = y - rise * 29;
      ctx.globalAlpha = energy * Math.sin(rise * Math.PI) * 0.8;
      ctx.strokeStyle = i % 3 ? '#77fff0' : '#ffc1af';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(px, py - 2); ctx.lineTo(px + 2, py);
      ctx.lineTo(px, py + 2); ctx.lineTo(px - 2, py); ctx.closePath(); ctx.stroke();
    }
    ctx.globalAlpha = energy * (0.16 + 0.12 * Math.sin(phase * 2 + n));
    ctx.strokeStyle = '#7ffff1';
    ctx.beginPath(); ctx.ellipse(x, y, 11 + Math.sin(phase + n) * 3, 3, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const travel = (time * (active ? 0.19 : 0.035) + i / 8) % 1;
    const x = 427 + travel * 339;
    const y = 363 + Math.sin(travel * Math.PI * 5) * 5;
    ctx.globalAlpha = energy * (0.4 + 0.3 * Math.sin(travel * Math.PI));
    ctx.fillStyle = '#9effee'; ctx.fillRect(Math.round(x), Math.round(y), 3, 1);
  }
  // Three faceted volumes emerge from the existing projectors. Perspective
  // comes from orbiting vertices, not scaling a flat picture up and down.
  for (let n = 0; n < nodes.length; n++) {
    const [x, y] = nodes[n]!;
    const r = n === 1 ? 15 : 10;
    const cy = y - 21;
    const vertices = Array.from({ length: 4 }, (_, i) => {
      const angle = phase * 0.45 + i * Math.PI / 2 + n;
      return { x: x + Math.cos(angle) * r, y: cy + Math.sin(angle) * r * 0.32 };
    });
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = '#85fff0';
    for (let i = 0; i < 4; i++) {
      const v = vertices[i]!;
      const next = vertices[(i + 1) % 4]!;
      ctx.globalAlpha = energy * (v.y > cy ? 0.6 : 0.25);
      ctx.beginPath(); ctx.moveTo(x, cy - r); ctx.lineTo(v.x, v.y);
      ctx.lineTo(x, cy + r); ctx.moveTo(v.x, v.y); ctx.lineTo(next.x, next.y); ctx.stroke();
      ctx.fillStyle = '#baffee'; ctx.fillRect(Math.round(v.x), Math.round(v.y), 1, 1);
    }
    // Short alien glyphs grow from each emitter, confined to its footprint.
    for (let i = 0; i < 3; i++) {
      const gy = y - 4 - i * 5;
      ctx.globalAlpha = energy * (0.3 + 0.15 * Math.sin(phase * 2 - i - n));
      ctx.beginPath(); ctx.moveTo(x + r + 4, gy); ctx.lineTo(x + r + 7, gy - 2);
      ctx.lineTo(x + r + 10, gy); ctx.lineTo(x + r + 8, gy + 2); ctx.stroke();
    }
  }
  // Data packets follow the curved console surface between the projectors.
  for (let lane = 0; lane < 2; lane++) {
    const [x0, y0] = nodes[lane]!; const [x1, y1] = nodes[lane + 1]!;
    ctx.globalAlpha = energy * 0.2; ctx.strokeStyle = '#5ce8df';
    ctx.beginPath(); ctx.moveTo(x0, y0 + 8);
    ctx.quadraticCurveTo((x0 + x1) / 2, y0 + 24, x1, y1 + 8); ctx.stroke();
    for (let p = 0; p < 3; p++) {
      const t = (phase * 0.17 + p / 3) % 1;
      const px = x0 + (x1 - x0) * t;
      const py = (1-t)*(1-t)*(y0+8) + 2*t*(1-t)*(y0+24) + t*t*(y1+8);
      ctx.globalAlpha = energy * 0.75; ctx.fillStyle = '#baffee';
      ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
    }
  }
  ctx.restore();
}

/** Draw after the occupant, so a hand contact visibly lights the armrest. */
export function drawCommandContact(ctx: CanvasRenderingContext2D, time: number): void {
  const { contact } = getCommandGesture(time);
  if (!contact) return;
  const x = contact < 0 ? 536 : 585;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, 362, 0, x, 362, 9);
  glow.addColorStop(0, '#bbfff5a0'); glow.addColorStop(1, '#54efdf00');
  ctx.fillStyle = glow; ctx.fillRect(x - 9, 353, 18, 18);
  ctx.strokeStyle = '#98ffed'; ctx.globalAlpha = 0.7; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.ellipse(x, 362, 5, 2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

/** The seat back is foreground furniture, and only occludes its seated occupant. */
export function drawAlecSeatBack(ctx: CanvasRenderingContext2D, artwork: RoomArtwork): void {
  ctx.save(); ctx.beginPath();
  // Trace the actual rear shell, never the floor or pedestal. Hands remain
  // outside this silhouette, with the head and shoulders above its top edge.
  ctx.moveTo(537, 378); ctx.lineTo(538, 363); ctx.lineTo(547, 353);
  ctx.lineTo(555, 348); ctx.lineTo(565, 348); ctx.lineTo(575, 353);
  ctx.lineTo(583, 365); ctx.lineTo(583, 382); ctx.lineTo(575, 402);
  ctx.lineTo(564, 411); ctx.lineTo(550, 408); ctx.lineTo(541, 393);
  ctx.closePath(); ctx.clip();
  ctx.drawImage(artwork, 0, 0, artwork.width, artwork.height, 0, 0, 1600, 678);
  ctx.restore();
}

export const STAR_MAP_WORKSTATION = {
  approachPoint: { x: 569, y: 656 },
  interactionPoint: { x: 569, y: 638 },
  displayBounds: { x: 505, y: 442, w: 140, h: 98 },
  displayAreas: [{ x: 505, y: 442, w: 140, h: 98 }],
  occlusionBounds: { x: 500, y: 525, w: 145, h: 65 },
};

/** Only replace the furniture area. Preserve the original star map and exterior. */
export function drawPhotonicComputerBay(
  ctx: CanvasRenderingContext2D,
  artwork?: HTMLImageElement,
): void {
  if (!artwork || !artwork.width || !artwork.height) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.moveTo(303, 315);
  ctx.lineTo(380, 315);
  ctx.lineTo(380, 299);
  ctx.lineTo(790, 299);
  ctx.lineTo(790, 438);
  ctx.lineTo(500, 438);
  ctx.lineTo(500, 498);
  ctx.lineTo(303, 498);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(artwork, 0, 0, artwork.width, artwork.height, 0, 0, 1600, 678);
  ctx.restore();
}
