import type { DuctorRoleName } from './ductorLabModel.js';

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
