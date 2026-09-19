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
 * Measured from the production `photonic-room-v3.webp` after its one-time
 * normalisation to 1600×678. The violet chair core occupies x=548..557 with a
 * centroid at x=552.5; every Alec overlay must derive from this geometry.
 */
export const ALEC_COMMAND_STATION = {
  sourceAsset: 'themes/ductor-space-lab/photonic-room-v3.webp',
  chair: {
    centerX: 552,
    backTopY: 310,
    backCoreY: 349,
    poseBottomY: 355,
    seatBaseY: 399,
    shellBottomY: 406,
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

// Dedicated working poses are kept as separate transparent atlases.  They are
// not slices from the walk sheet: each frame is authored around the furniture
// it operates so limbs, chair shells and holographic controls line up.
export const ALEC_SEATED_ASSET = 'themes/ductor-space-lab/alec-command-seated-v2.png';
export const KEVIN_STARMAP_ASSET = 'themes/ductor-space-lab/kevin-starmap-control-v2.png';
export const BENJAMIN_QA_ASSET = 'themes/ductor-space-lab/benjamin-qa-control-v1.png';

// The routing anchor stays on the walkable floor; it is not the drawing anchor
// for a seated body. `feetY` is retained for renderer compatibility, but here
// it means the hidden bottom of the authored pose. Aligning that bottom with
// the chair core leaves only Alec's head, shoulders and operating hands above
// the real backrest, which is the correct rear-view seating silhouette.
export const ALEC_SEAT = {
  x: ALEC_COMMAND_STATION.chair.centerX,
  feetY: ALEC_COMMAND_STATION.chair.poseBottomY,
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
export function getCommandGesture(time: number): { frame: number } {
  const phase = ((time % 6.4) + 6.4) % 6.4;
  if (phase < 1.4) return { frame: 0 };
  if (phase < 2.1) return { frame: 1 };
  if (phase < 2.8) return { frame: 0 };
  if (phase < 3.7) return { frame: 2 };
  return { frame: 3 };
}

/**
 * Animate only the three display apertures measured from photonic-room-v4.
 * Nothing is drawn over the chair, console shell or floor, so the activity
 * cannot drift away from the production furniture.
 */
/** Foreground chair shell: it places the lower body inside the command cradle. */
export function drawAlecSeatBack(ctx: CanvasRenderingContext2D, artwork: RoomArtwork): void {
  const { centerX: cx, backTopY, shellBottomY } = ALEC_COMMAND_STATION.chair;
  ctx.save();
  // Restore the real backrest, not merely the pedestal. The seated occupant
  // faces the console on the far side of this shell. Head and hands protrude
  // above/outside the backrest; torso and folded legs are occluded by it.
  ctx.beginPath();
  ctx.moveTo(cx - 2, backTopY);
  ctx.bezierCurveTo(
    cx - 13,
    backTopY + 1,
    cx - 24,
    backTopY + 19,
    cx - 27,
    backTopY + 35,
  );
  ctx.lineTo(cx - 34, 343);
  ctx.lineTo(cx - 35, 356);
  ctx.quadraticCurveTo(cx - 34, 371, cx - 21, 378);
  ctx.lineTo(cx - 23, 390);
  ctx.quadraticCurveTo(cx, shellBottomY, cx + 23, 390);
  ctx.lineTo(cx + 21, 378);
  ctx.quadraticCurveTo(cx + 34, 368, cx + 35, 350);
  ctx.lineTo(cx + 29, 343);
  ctx.lineTo(cx + 25, 345);
  ctx.bezierCurveTo(cx + 21, backTopY + 16, cx + 13, backTopY + 3, cx + 4, backTopY);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(artwork, 0, 0, artwork.width, artwork.height, 0, 0, 1600, 678);
  ctx.restore();
}

export const STAR_MAP_WORKSTATION = {
  approachPoint: { x: 569, y: 656 },
  interactionPoint: { x: 569, y: 638 },
  displayBounds: { x: STAR_MAP_PANEL.x, y: STAR_MAP_PANEL.y, w: STAR_MAP_PANEL.w, h: STAR_MAP_PANEL.h },
  displayAreas: [{ x: 513, y: 414, w: 104, h: 63 }],
  occlusionBounds: { x: 500, y: 525, w: 145, h: 65 },
};
