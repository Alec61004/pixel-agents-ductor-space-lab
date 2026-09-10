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

/**
 * Measured from the production `photonic-room-v4.webp` after its one-time
 * normalisation to 1600×678. The violet chair core occupies x=548..557 with a
 * centroid at x=552.5; every Alec overlay must derive from this geometry.
 */
export const ALEC_COMMAND_STATION = {
  sourceAsset: 'themes/ductor-space-lab/photonic-room-v4.webp',
  chair: { centerX: 552, backCoreY: 349, seatBaseY: 399 },
  field: { centerX: 552, centerY: 354 },
  contacts: {
    left: { x: 520, y: 356 },
    right: { x: 591, y: 356 },
  },
} as const;

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
    approachPoint: { x: ALEC_COMMAND_STATION.chair.centerX, y: 500 },
    interactionPoint: { x: ALEC_COMMAND_STATION.chair.centerX, y: 450 },
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
// Dedicated working poses are kept as separate transparent atlases.  They are
// not slices from the walk sheet: each frame is authored around the furniture
// it operates so limbs, chair shells and holographic controls line up.
export const ALEC_SEATED_ASSET = 'themes/ductor-space-lab/alec-command-seated-v2.png';
export const KEVIN_STARMAP_ASSET = 'themes/ductor-space-lab/kevin-starmap-control-v2.png';
export const BENJAMIN_QA_ASSET = 'themes/ductor-space-lab/benjamin-qa-control-v1.png';

// The routing anchor stays on the walkable floor; it is not the drawing anchor
// for a seated body. Both now share the measured chair centre on the x-axis.
export const ALEC_SEAT = {
  x: ALEC_COMMAND_STATION.chair.centerX,
  feetY: ALEC_COMMAND_STATION.chair.seatBaseY,
  height: 74,
};

export const ALEC_SEATED_ATLAS = {
  width: 2172, height: 724, columns: 4, bodyTop: 117, bodyBottom: 634,
};

export const KEVIN_STARMAP_ATLAS = {
  width: 2172, height: 724, columns: 4, bodyTop: 152, bodyBottom: 632,
};

export const BENJAMIN_QA_ATLAS = {
  width: 2172, height: 724, columns: 4, bodyTop: 124, bodyBottom: 651,
};

/**
 * Single source of truth for the star-map glass in photonic-room-v4.
 * The room artwork is normalised to 1600×678 before this panel is drawn.
 */
export const STAR_MAP_PANEL = {
  x: 510,
  y: 409,
  w: 110,
  h: 70,
  centerX: 53,
  centerY: 35.5,
} as const;

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
  const energy = active ? 0.88 : 0.12;
  const phase = time * (active ? 1.5 : 0.35);
  const nodes = [[470, 346], [552, 344], [674, 344]] as const;

  // The command cradle is a spatial interface rather than a row of human
  // monitors. Concentric field arcs sit behind Alec while data packets converge
  // from both wings of the living console. The body is drawn later, so the
  // projection reads as a volume surrounding the seated operator.
  const commandX = ALEC_COMMAND_STATION.field.centerX;
  const commandY = ALEC_COMMAND_STATION.field.centerY;
  const commandPulse = 0.5 + Math.sin(phase * 1.7) * 0.5;
  ctx.lineWidth = 0.8;
  for (let ring = 0; ring < 3; ring++) {
    const orbit = phase * (0.32 + ring * 0.06) + ring * 1.7;
    const rx = 31 + ring * 9;
    const ry = 9 + ring * 3;
    ctx.globalAlpha = energy * (0.16 + ring * 0.045);
    ctx.strokeStyle = ring === 1 ? '#f3b86a' : '#78e7f5';
    ctx.beginPath();
    ctx.ellipse(commandX, commandY, rx, ry, 0, orbit, orbit + Math.PI * 0.92);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(commandX, commandY, rx, ry, 0, orbit + Math.PI, orbit + Math.PI * 1.72);
    ctx.stroke();
  }
  for (let glyph = 0; glyph < 7; glyph++) {
    const angle = phase * 0.42 + glyph * Math.PI * 2 / 7;
    const gx = commandX + Math.cos(angle) * 43;
    const gy = commandY + Math.sin(angle) * 13;
    const size = glyph % 3 === 0 ? 2.3 : 1.5;
    ctx.globalAlpha = energy * (0.38 + commandPulse * 0.32);
    ctx.fillStyle = glyph % 3 === 0 ? '#ffd08a' : '#a9f5fb';
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(angle + Math.PI / 4);
    ctx.fillRect(-size / 2, -size / 2, size, size); ctx.restore();
  }
  const commandFeeds = [
    { x: 446, y: 365, bendX: 498, bendY: 381, offset: 0 },
    { x: 694, y: 362, bendX: 626, bendY: 382, offset: 0.46 },
  ] as const;
  for (const feed of commandFeeds) {
    ctx.globalAlpha = energy * 0.22;
    ctx.strokeStyle = '#58d8eb';
    ctx.beginPath(); ctx.moveTo(feed.x, feed.y);
    ctx.quadraticCurveTo(feed.bendX, feed.bendY, commandX, commandY + 17); ctx.stroke();
    for (let packet = 0; packet < 4; packet++) {
      const t = (phase * 0.13 + packet / 4 + feed.offset) % 1;
      const inv = 1 - t;
      const px = inv * inv * feed.x + 2 * inv * t * feed.bendX + t * t * commandX;
      const py = inv * inv * feed.y + 2 * inv * t * feed.bendY + t * t * (commandY + 17);
      ctx.globalAlpha = energy * (0.42 + Math.sin(t * Math.PI) * 0.4);
      ctx.fillStyle = packet === 0 ? '#ffbf6b' : '#8debf7';
      ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
    }
  }
  for (let n = 0; n < nodes.length; n++) {
    const [x, y] = nodes[n]!;
    for (let i = 0; i < 5; i++) {
      const rise = (phase * 0.24 + i / 5 + n * 0.17) % 1;
      const px = x + Math.sin(phase + i * 1.9) * (7 + i * 2);
      const py = y - rise * 29;
      ctx.globalAlpha = energy * Math.sin(rise * Math.PI) * 0.8;
      ctx.strokeStyle = i % 2 ? '#69ddf3' : '#f3a64c';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(px, py - 2); ctx.lineTo(px + 2, py);
      ctx.lineTo(px, py + 2); ctx.lineTo(px - 2, py); ctx.closePath(); ctx.stroke();
    }
    ctx.globalAlpha = energy * (0.16 + 0.12 * Math.sin(phase * 2 + n));
    ctx.strokeStyle = '#69ddf3';
    ctx.beginPath(); ctx.ellipse(x, y, 11 + Math.sin(phase + n) * 3, 3, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const travel = (time * (active ? 0.19 : 0.035) + i / 8) % 1;
    const x = 427 + travel * 339;
    const y = 363 + Math.sin(travel * Math.PI * 5) * 5;
    ctx.globalAlpha = energy * (0.4 + 0.3 * Math.sin(travel * Math.PI));
    ctx.fillStyle = i % 3 === 0 ? '#f3a64c' : '#8be9f8'; ctx.fillRect(Math.round(x), Math.round(y), 3, 1);
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
    ctx.strokeStyle = '#75e2f5';
    for (let i = 0; i < 4; i++) {
      const v = vertices[i]!;
      const next = vertices[(i + 1) % 4]!;
      ctx.globalAlpha = energy * (v.y > cy ? 0.6 : 0.25);
      ctx.beginPath(); ctx.moveTo(x, cy - r); ctx.lineTo(v.x, v.y);
      ctx.lineTo(x, cy + r); ctx.moveTo(v.x, v.y); ctx.lineTo(next.x, next.y); ctx.stroke();
      ctx.fillStyle = '#b7f3fb'; ctx.fillRect(Math.round(v.x), Math.round(v.y), 1, 1);
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
    ctx.globalAlpha = energy * 0.30; ctx.strokeStyle = '#3ed2ed';
    ctx.beginPath(); ctx.moveTo(x0, y0 + 8);
    ctx.quadraticCurveTo((x0 + x1) / 2, y0 + 24, x1, y1 + 8); ctx.stroke();
    for (let p = 0; p < 3; p++) {
      const t = (phase * 0.17 + p / 3) % 1;
      const px = x0 + (x1 - x0) * t;
      const py = (1-t)*(1-t)*(y0+8) + 2*t*(1-t)*(y0+24) + t*t*(y1+8);
      ctx.globalAlpha = energy * 0.78; ctx.fillStyle = p === 1 ? '#f3a64c' : '#a9f1fb';
      ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
    }
  }
  ctx.restore();
}

/** Draw after the occupant, so a hand contact visibly lights the armrest. */
export function drawCommandContact(ctx: CanvasRenderingContext2D, time: number): void {
  const { contact } = getCommandGesture(time);
  if (!contact) return;
  const point = contact < 0
    ? ALEC_COMMAND_STATION.contacts.left
    : ALEC_COMMAND_STATION.contacts.right;
  const { x, y } = point;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
  glow.addColorStop(0, '#ffd38ba8'); glow.addColorStop(0.45, '#5fe1f45c'); glow.addColorStop(1, '#1ba7c400');
  ctx.fillStyle = glow; ctx.fillRect(x - 9, y - 9, 18, 18);
  ctx.strokeStyle = '#ffd08a'; ctx.globalAlpha = 0.78; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.ellipse(x, y, 5, 2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

/** Foreground chair shell: it places the lower body inside the command cradle. */
export function drawAlecSeatBack(ctx: CanvasRenderingContext2D, artwork: RoomArtwork): void {
  const cx = ALEC_COMMAND_STATION.chair.centerX;
  ctx.save();
  // Restore the exact lower pedestal from the current room. Keeping this mask
  // narrow prevents a second, invented chair silhouette from drifting away
  // from the baked workstation.
  ctx.beginPath(); ctx.rect(cx - 28, 389, 56, 32); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(cx - 23, 388); ctx.quadraticCurveTo(cx, 380, cx + 23, 388);
  ctx.lineTo(cx + 22, 404); ctx.quadraticCurveTo(cx, 420, cx - 22, 404);
  ctx.closePath(); ctx.clip();
  ctx.drawImage(artwork, 0, 0, artwork.width, artwork.height, 0, 0, 1600, 678);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  // A compact front band hides only the boots. Its curve follows the current
  // chair base, leaving the bent knees, torso and both controls correctly
  // aligned with the console surface.
  ctx.fillStyle = 'rgba(8, 23, 31, 0.97)';
  ctx.strokeStyle = 'rgba(117, 225, 234, 0.54)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 20, 386); ctx.quadraticCurveTo(cx, 379, cx + 20, 386);
  ctx.lineTo(cx + 18, 402); ctx.quadraticCurveTo(cx, 413, cx - 18, 402);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(126, 239, 246, 0.38)';
  ctx.beginPath(); ctx.ellipse(cx, 386, 17, 3.8, 0, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(244, 173, 91, 0.62)';
  ctx.globalAlpha = 0.62;
  ctx.beginPath(); ctx.moveTo(cx - 12, 402); ctx.quadraticCurveTo(cx, 408, cx + 12, 402); ctx.stroke();
  ctx.fillStyle = '#9e69f7'; ctx.globalAlpha = 0.78;
  ctx.fillRect(cx - 1.5, 392, 3, 7);
  ctx.restore();
}

export const STAR_MAP_WORKSTATION = {
  approachPoint: { x: 569, y: 656 },
  interactionPoint: { x: 569, y: 638 },
  displayBounds: { x: STAR_MAP_PANEL.x, y: STAR_MAP_PANEL.y, w: STAR_MAP_PANEL.w, h: STAR_MAP_PANEL.h },
  displayAreas: [{ x: 513, y: 414, w: 104, h: 63 }],
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
