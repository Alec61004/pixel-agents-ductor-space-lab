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
export function drawAlecCommandDisplays(
  ctx: CanvasRenderingContext2D,
  time: number,
  active: boolean,
): void {
  const panels = ORIGINAL_COMPUTER_BAYS.Alec.displayAreas;
  const motion = time * (active ? 1.45 : 0.28);
  const scan = ((motion % 1) + 1) % 1;
  const gestureFrame = getCommandGesture(time).frame;
  const focusedPanel = gestureFrame === 1 ? 0 : gestureFrame === 2 ? 2 : 1;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [panelIndex, panel] of panels.entries()) {
    const focused = panelIndex === focusedPanel;
    const energy = active ? (focused ? 0.82 : 0.44) : 0.09;
    ctx.save();
    ctx.beginPath();
    ctx.rect(panel.x, panel.y, panel.w, panel.h);
    ctx.clip();

    // A narrow sweep samples the baked display instead of replacing it.
    ctx.globalAlpha = energy * 0.34;
    ctx.fillStyle = '#b7f5fb';
    const scanX = panel.x - 2 + scan * (panel.w + 4);
    ctx.fillRect(Math.round(scanX), panel.y, 2, panel.h);

    // Independent spectral channels keep all three alien displays alive.
    for (let channel = 0; channel < 6; channel++) {
      const x = panel.x + 4 + channel * ((panel.w - 8) / 6);
      const amplitude = 0.35 + 0.65 * (0.5 + Math.sin(motion * 2.2 + channel * 1.7 + panelIndex));
      const height = Math.max(2, Math.round((panel.h - 8) * amplitude));
      ctx.globalAlpha = energy * (0.24 + amplitude * 0.28);
      ctx.fillStyle = channel === (panelIndex + 2) % 6 ? '#ffd08a' : '#75e8f5';
      ctx.fillRect(Math.round(x), panel.y + panel.h - 4 - height, 2, height);
    }

    // The waveform reacts to Alec's left/right gesture without a free-floating
    // hand glow, so interaction remains locked to the original glass.
    ctx.globalAlpha = energy * 0.72;
    ctx.strokeStyle = focused ? '#fff0bd' : '#8debf7';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    for (let x = 1; x < panel.w; x += 3) {
      const px = panel.x + x;
      const py = panel.y + panel.h * 0.46
        + Math.sin(x * 0.38 - motion * 3.1 + panelIndex) * (focused ? 3.2 : 1.8);
      if (x === 1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}


/**
 * Animate the small cyan/amber emitters already painted into the Alec bay.
 *
 * The reference artwork carries the geometry; this pass only adds restrained
 * travelling glints over those authored light nodes. It deliberately replaces
 * the old display-scan/typing overlay instead of drawing a second console.
 */
const ALEC_LIGHT_LANES = [
  {
    points: [
      [420, 452], [445, 453], [495, 433], [548, 452],
      [600, 452], [626, 450], [674, 448],
    ],
    color: '#a9f5fb',
    speed: 0.18,
    phase: 0,
  },
  {
    points: [
      [445, 453], [470, 447], [495, 433], [530, 425],
      [560, 426], [590, 439], [626, 450],
    ],
    color: '#ffd38d',
    speed: 0.13,
    phase: 0.43,
  },
] as const;

const ALEC_LIGHT_NODES = [
  [420, 452, '#a9f5fb'],
  [445, 453, '#ffd38d'],
  [495, 433, '#a9f5fb'],
  [548, 452, '#a9f5fb'],
  [600, 452, '#a9f5fb'],
  [626, 450, '#ffd38d'],
  [674, 448, '#a9f5fb'],
] as const;

function sampleAlecLightLane(
  points: readonly (readonly [number, number])[],
  progress: number,
): { x: number; y: number } {
  const segmentCount = Math.max(1, points.length - 1);
  const scaled = Math.max(0, Math.min(0.999999, progress)) * segmentCount;
  const segment = Math.min(segmentCount - 1, Math.floor(scaled));
  const local = scaled - segment;
  const from = points[segment]!;
  const to = points[segment + 1]!;
  return {
    x: from[0] + (to[0] - from[0]) * local,
    y: from[1] + (to[1] - from[1]) * local,
  };
}

function drawAlecLightSpark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size: number,
  alpha: number,
): void {
  const radius = size * 4.5;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(0.24, color);
  glow.addColorStop(1, '#00000000');

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.55, size * 0.55);
  ctx.beginPath();
  ctx.moveTo(x - size * 2.2, y);
  ctx.lineTo(x + size * 2.2, y);
  ctx.moveTo(x, y - size * 2.2);
  ctx.lineTo(x, y + size * 2.2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.7, size * 0.6), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draw only moving glints for the live Alec command-bay activity. */
export function drawAlecStationLightMotion(
  ctx: CanvasRenderingContext2D,
  time: number,
  active: boolean,
): void {
  if (!active) return;

  ctx.save();
  for (const lane of ALEC_LIGHT_LANES) {
    const progress = ((time * lane.speed + lane.phase) % 1 + 1) % 1;

    // A short, dim trail makes the point read as travelling energy while
    // leaving the original cyan/amber hardware visible underneath.
    for (let trail = 4; trail >= 1; trail--) {
      const trailPoint = sampleAlecLightLane(
        lane.points,
        (progress - trail * 0.018 + 1) % 1,
      );
      drawAlecLightSpark(
        ctx,
        trailPoint.x,
        trailPoint.y,
        lane.color,
        0.62 + (4 - trail) * 0.08,
        0.045 + (4 - trail) * 0.025,
      );
    }

    const point = sampleAlecLightLane(lane.points, progress);
    drawAlecLightSpark(ctx, point.x, point.y, lane.color, 1.35, 0.7);
  }

  // Let the authored emitters breathe very slightly, so the whole bay feels
  // alive even while the travelling glints are between two nodes.
  for (const [x, y, color] of ALEC_LIGHT_NODES) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.8 + x * 0.035);
    drawAlecLightSpark(ctx, x, y, color, 0.42, 0.12 + pulse * 0.08);
  }
  ctx.restore();
}

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
