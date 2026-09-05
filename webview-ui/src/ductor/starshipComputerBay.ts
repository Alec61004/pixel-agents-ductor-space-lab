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

export const ALEC_SEAT = { x: 560, feetY: 405, height: 74 };

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
  if (active) {
    const beat = Math.floor(time * 3) % 2;
    ctx.fillStyle = '#c5fff2'; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 6);
    ctx.fillRect(beat ? 578 : 538, 356, 3, 2);
  }
  ctx.restore();
}

/** The seat back is foreground furniture, and only occludes its seated occupant. */
export function drawAlecSeatBack(ctx: CanvasRenderingContext2D, artwork: HTMLImageElement): void {
  ctx.save(); ctx.beginPath();
  ctx.moveTo(538, 370); ctx.lineTo(547, 361); ctx.lineTo(572, 361);
  ctx.lineTo(582, 370); ctx.lineTo(582, 396); ctx.lineTo(570, 412);
  ctx.lineTo(548, 412); ctx.lineTo(537, 396); ctx.closePath(); ctx.clip();
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
