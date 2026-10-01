import type { DuctorRoleName } from './ductorLabModel.js';

export type ObservationTab = 'code' | 'terminal' | 'browser';

export interface AgentObservationStation {
  role: DuctorRoleName;
  label: string;
  /** Bounds use the live Canvas world (1600 × 678), never viewport pixels. */
  bounds: { x: number; y: number; w: number; h: number };
  hitShape: 'rect' | 'ellipse';
}

/**
 * V10 semantic workstation bounds remapped from the authored 1926×816 scene
 * into the 1600×678 simulation world used by StarshipLab.
 */
export const AGENT_OBSERVATION_STATIONS: readonly AgentObservationStation[] = [
  {
    role: 'Alec',
    label: 'Alec command alcove',
    bounds: { x: 243, y: 241, w: 424, h: 187 },
    hitShape: 'rect',
  },
  {
    role: 'Kevin',
    label: 'Kevin star map',
    bounds: { x: 282, y: 424, w: 449, h: 191 },
    hitShape: 'ellipse',
  },
  {
    role: 'Benjamin',
    label: 'Benjamin analysis station',
    bounds: { x: 889, y: 374, w: 415, h: 233 },
    hitShape: 'ellipse',
  },
] as const;

export function getObservationStationAt(
  point: { x: number; y: number },
): AgentObservationStation | undefined {
  return AGENT_OBSERVATION_STATIONS.find((station) => {
    const { x, y, w, h } = station.bounds;
    if (station.hitShape === 'rect') {
      return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;
    }
    const nx = (point.x - (x + w / 2)) / (w / 2);
    const ny = (point.y - (y + h / 2)) / (h / 2);
    return nx * nx + ny * ny <= 1;
  });
}

export function observationColor(role: DuctorRoleName): string {
  switch (role) {
    case 'Alec':
      return '#b98bff';
    case 'Kevin':
      return '#6ee7ff';
    case 'Benjamin':
      return '#ffbe58';
  }
}
