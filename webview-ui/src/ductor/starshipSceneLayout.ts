export interface SceneBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StarshipSceneObject {
  id: string;
  label: string;
  bounds: SceneBounds;
}

/**
 * Stable, editable scene map for the photonic room.
 *
 * Coordinates use the renderer's 1600 × 678 world space. Structural bounds
 * were measured from the production room; interaction bounds come from the
 * converted HTML scene's 1920 × 810 hotspots and are normalised here once.
 */
export const STARSHIP_SCENE_SIZE = { width: 1600, height: 678 } as const;

export const STARSHIP_SCENE_OBJECTS = {
  airlock: { id: 'airlock', label: 'Airlock', bounds: { x: 92, y: 290, w: 158, h: 341 } },
  leftStorage: { id: 'left-storage', label: 'Specimen Storage', bounds: { x: 197, y: 130, w: 136, h: 348 } },
  alecCommand: { id: 'alec-command', label: 'Alec Command Station', bounds: { x: 407, y: 299, w: 327, h: 130 } },
  hologramConsole: { id: 'hologram-console', label: 'Hologram Console', bounds: { x: 624, y: 325, w: 192, h: 183 } },
  floorPodLeft: { id: 'floor-pod-left', label: 'Left Floor Pod', bounds: { x: 326, y: 483, w: 48, h: 101 } },
  floorPodRight: { id: 'floor-pod-right', label: 'Right Floor Pod', bounds: { x: 392, y: 483, w: 47, h: 101 } },
  floorPodCenter: { id: 'floor-pod-center', label: 'Center Floor Pod', bounds: { x: 719, y: 487, w: 49, h: 99 } },
  specimenTank: { id: 'specimen-pod', label: 'Specimen Pod', bounds: { x: 821, y: 235, w: 116, h: 195 } },
  kevinStarMap: { id: 'kevin-star-map', label: 'Kevin Star Map', bounds: { x: 510, y: 409, w: 110, h: 70 } },
  qaStation: { id: 'qa-station', label: 'Benjamin QA Station', bounds: { x: 1010, y: 520, w: 110, h: 55 } },
  starPortal: { id: 'star-portal', label: 'Star Portal', bounds: { x: 928, y: 461, w: 272, h: 115 } },
  rightSpecimenA: { id: 'right-specimen-a', label: 'Right Specimen A', bounds: { x: 1325, y: 390, w: 21, h: 55 } },
  rightSpecimenB: { id: 'right-specimen-b', label: 'Right Specimen B', bounds: { x: 1354, y: 390, w: 22, h: 55 } },
} as const satisfies Record<string, StarshipSceneObject>;

export type StarshipSceneObjectId = keyof typeof STARSHIP_SCENE_OBJECTS;

export const STARSHIP_SCENE_HOTSPOTS = [
  {
    id: 'star-portal',
    bounds: STARSHIP_SCENE_OBJECTS.starPortal.bounds,
    statusLabel: 'STAR PORTAL / ACTIVE',
  },
  {
    id: 'specimen-pod',
    bounds: { x: 768, y: 203, w: 176, h: 298 },
    statusLabel: 'SPECIMEN POD / STABLE',
  },
  {
    id: 'hologram-console',
    bounds: STARSHIP_SCENE_OBJECTS.hologramConsole.bounds,
    statusLabel: 'HOLOGRAM CONSOLE / ONLINE',
  },
] as const;

export function getStarshipSceneHotspotAt(point: { x: number; y: number }) {
  return STARSHIP_SCENE_HOTSPOTS.find(({ bounds }) =>
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.w &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.h,
  );
}
