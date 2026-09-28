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
 * Canonical pick targets for the three in-room projections.  Keep these in
 * world coordinates so panning, zooming, resizing and high-DPI displays all
 * resolve the same physical workstation.
 */
export const AGENT_OBSERVATION_STATIONS: readonly AgentObservationStation[] = [
  {
    role: 'Alec',
    label: 'Alec command glass',
    bounds: { x: 455, y: 302, w: 255, h: 110 },
    hitShape: 'rect',
  },
  {
    role: 'Kevin',
    label: 'Kevin star map',
    bounds: { x: 500, y: 409, w: 145, h: 72 },
    hitShape: 'ellipse',
  },
  {
    role: 'Benjamin',
    label: 'Benjamin QA scanner',
    bounds: { x: 978, y: 462, w: 145, h: 95 },
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
