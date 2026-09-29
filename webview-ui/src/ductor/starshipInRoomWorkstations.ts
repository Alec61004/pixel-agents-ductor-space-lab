import type { DuctorRoleName } from './ductorLabModel.js';
import type { StarshipAgent } from './starshipSimulation.js';

/**
 * Editable scene map for the three in-room workstations.
 *
 * Every coordinate is in the room's 1600 × 678 world space.  The renderer
 * scales this single coordinate system with the room itself, so zoom, pan and
 * device pixel ratio cannot move a workstation away from its physical desk.
 */
export interface InRoomWorkstationLayer {
  readonly id: string;
  readonly role: DuctorRoleName;
  readonly bounds: { x: number; y: number; w: number; h: number };
  readonly z: 'room-interface';
}

export const IN_ROOM_WORKSTATION_LAYERS: readonly InRoomWorkstationLayer[] = [
  {
    id: 'alec-command-glass',
    role: 'Alec',
    bounds: { x: 455, y: 302, w: 255, h: 110 },
    z: 'room-interface',
  },
  {
    id: 'kevin-star-map',
    role: 'Kevin',
    bounds: { x: 500, y: 409, w: 145, h: 72 },
    z: 'room-interface',
  },
  {
    id: 'benjamin-qa-scanner',
    role: 'Benjamin',
    bounds: { x: 978, y: 462, w: 145, h: 95 },
    z: 'room-interface',
  },
] as const;

function activity(agent?: StarshipAgent): number {
  if (!agent || agent.state === 'offline' || agent.reportedState === 'offline') return 0.12;
  if (agent.reportedState === 'working' || agent.reportedState === 'review') return 1;
  if (agent.reportedState === 'waiting' || agent.state === 'waiting') return 0.55;
  return 0.34;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.rect(x, y, w, h);
}

function drawAlecCommandGlass(ctx: CanvasRenderingContext2D, time: number, level: number): void {
  const { x, y, w, h } = IN_ROOM_WORKSTATION_LAYERS[0]!.bounds;
  const pulse = 0.55 + Math.sin(time * 2.2) * 0.45;
  const glass = { x: x + 10, y: y + 10, w: w - 20, h: h - 25 };
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, glass.x, glass.y, glass.w, glass.h, 5);
  ctx.clip();

  const wash = ctx.createLinearGradient(glass.x, glass.y, glass.x + glass.w, glass.y + glass.h);
  wash.addColorStop(0, 'rgba(24, 145, 255, 0.10)');
  wash.addColorStop(0.56, 'rgba(22, 229, 255, 0.025)');
  wash.addColorStop(1, 'rgba(157, 68, 255, 0.10)');
  ctx.globalAlpha = 0.42 + level * 0.34;
  ctx.fillStyle = wash;
  ctx.fillRect(glass.x, glass.y, glass.w, glass.h);

  const panels = [
    { x: glass.x + 6, y: glass.y + 14, w: 58, h: 30, tint: '#56edff', label: 'SYNC' },
    { x: glass.x + 78, y: glass.y + 8, w: 77, h: 42, tint: '#a987ff', label: 'ALEC' },
    { x: glass.x + 170, y: glass.y + 14, w: 54, h: 30, tint: '#5ae9ff', label: 'PLAN' },
  ];
  ctx.font = "bold 5px 'JetBrains Mono', monospace";
  for (const [index, panel] of panels.entries()) {
    ctx.globalAlpha = (0.38 + level * 0.42) * (0.75 + pulse * 0.25);
    ctx.strokeStyle = panel.tint;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    roundedRect(ctx, panel.x, panel.y, panel.w, panel.h, 2);
    ctx.stroke();
    ctx.globalAlpha = 0.25 + level * 0.2;
    ctx.fillStyle = panel.tint;
    ctx.fillText(panel.label, panel.x + 5, panel.y + 8);
    for (let row = 0; row < 3; row++) {
      const progress = 0.32 + (((index + row) * 0.23 + time * 0.08) % 0.52);
      ctx.globalAlpha = 0.18 + level * 0.25;
      ctx.fillRect(panel.x + 5, panel.y + 13 + row * 5, (panel.w - 10) * progress, 1);
      ctx.globalAlpha = 0.10 + level * 0.14;
      ctx.fillRect(panel.x + 5, panel.y + 14 + row * 5, panel.w - 10, 1);
    }
  }
  for (let n = 0; n < 20; n++) {
    const px = glass.x + ((n * 37 + time * 14) % glass.w);
    const py = glass.y + 4 + ((n * 19) % (glass.h - 8));
    ctx.globalAlpha = (0.08 + level * 0.14) * (n % 3 === 0 ? pulse : 1);
    ctx.fillStyle = n % 4 === 0 ? '#d69bff' : '#84f4ff';
    ctx.fillRect(px, py, 1.2, 1.2);
  }
  ctx.restore();
}

function drawOrbit(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, phase: number, color: string, alpha: number): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, phase, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawKevinStarMap(ctx: CanvasRenderingContext2D, time: number, level: number): void {
  const { x, y, w, h } = IN_ROOM_WORKSTATION_LAYERS[1]!.bounds;
  const cx = x + w / 2;
  const cy = y + h / 2 + 4;
  const breathe = 0.5 + Math.sin(time * 1.8) * 0.5;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.47, h * 0.43, 0, 0, Math.PI * 2);
  ctx.clip();
  const floor = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.5);
  floor.addColorStop(0, 'rgba(90, 240, 255, 0.30)');
  floor.addColorStop(0.48, 'rgba(47, 120, 255, 0.10)');
  floor.addColorStop(1, 'rgba(16, 34, 70, 0)');
  ctx.globalAlpha = 0.36 + level * 0.5;
  ctx.fillStyle = floor;
  ctx.fillRect(x, y, w, h);
  for (let ring = 0; ring < 3; ring++) {
    drawOrbit(ctx, cx, cy, 14 + ring * 13, 5 + ring * 6.3, -0.1, ring === 2 ? '#c277ff' : '#62edff', 0.30 + level * 0.22);
  }
  for (let spoke = 0; spoke < 10; spoke++) {
    const angle = (spoke / 10) * Math.PI * 2 + time * 0.08;
    ctx.globalAlpha = 0.12 + level * 0.18;
    ctx.strokeStyle = '#72edff';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * 52, cy + Math.sin(angle) * 18);
    ctx.stroke();
  }
  const planets = [
    { orbit: 14, phase: 0.2, color: '#ffc767', size: 3.8 },
    { orbit: 27, phase: 2.8, color: '#d783ff', size: 2.8 },
    { orbit: 40, phase: 4.5, color: '#8deeff', size: 3.1 },
  ];
  for (const planet of planets) {
    const angle = planet.phase + time * (0.4 + planet.orbit * 0.01);
    const px = cx + Math.cos(angle) * planet.orbit;
    const py = cy + Math.sin(angle) * (planet.orbit * 0.44);
    ctx.globalAlpha = 0.46 + level * 0.44;
    ctx.fillStyle = planet.color;
    ctx.beginPath();
    ctx.arc(px, py, planet.size, 0, Math.PI * 2);
    ctx.fill();
  }
  const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
  sun.addColorStop(0, '#fff7c4');
  sun.addColorStop(0.25, '#ffc55b');
  sun.addColorStop(1, '#ffac3d00');
  ctx.globalAlpha = 0.48 + level * 0.45 + breathe * 0.07;
  ctx.fillStyle = sun;
  ctx.fillRect(cx - 12, cy - 12, 24, 24);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.52 + level * 0.36;
  ctx.strokeStyle = '#67f1ff';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.47, h * 0.43, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "bold 8px 'JetBrains Mono', monospace";
  ctx.fillStyle = '#83f5ff';
  ctx.fillText('KEVIN', cx - 17, y + h + 11);
  ctx.restore();
}

function drawBenjaminScanner(ctx: CanvasRenderingContext2D, time: number, level: number): void {
  const { x, y, w, h } = IN_ROOM_WORKSTATION_LAYERS[2]!.bounds;
  const cx = x + w / 2;
  const tableY = y + h * 0.72;
  const sweep = ((time * 0.22) % 1) * Math.PI * 2;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, tableY, w * 0.43, h * 0.23, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let ring = 0; ring < 4; ring++) {
    drawOrbit(ctx, cx, tableY, 13 + ring * 11, 4 + ring * 4.3, 0, ring % 2 ? '#a678ff' : '#6af2ff', 0.22 + level * 0.22);
  }
  ctx.globalAlpha = 0.18 + level * 0.34;
  ctx.fillStyle = '#62eaff';
  ctx.fillRect(cx - 1, tableY - h * 0.22, 2, h * 0.46);
  ctx.restore();

  ctx.save();
  ctx.translate(cx, tableY - 25);
  ctx.globalAlpha = 0.44 + level * 0.42;
  ctx.strokeStyle = '#76f2ff';
  ctx.lineWidth = 0.7;
  for (let latitude = -2; latitude <= 2; latitude++) {
    ctx.beginPath();
    ctx.ellipse(0, latitude * 4, 25, 6 + Math.abs(latitude) * 1.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let longitude = 0; longitude < 6; longitude++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 7 + longitude * 3.5, 24, longitude * Math.PI / 6 + time * 0.12, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.30 + level * 0.30;
  ctx.strokeStyle = '#cd9aff';
  ctx.beginPath();
  ctx.arc(0, 0, 27, sweep, sweep + 0.72);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.52 + level * 0.36;
  ctx.strokeStyle = '#72f1ff';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(cx, tableY, w * 0.43, h * 0.23, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "bold 8px 'JetBrains Mono', monospace";
  ctx.fillStyle = '#83f5ff';
  ctx.fillText('BENJAMIN', cx - 31, y + h + 10);
  ctx.restore();
}

/**
 * Draw the three work areas directly into the authored room layer.  These are
 * interface details only; hardware, furniture and characters remain in their
 * own image/layer assets and are not repainted or displaced.
 */
export function drawInRoomAgentWorkstations(
  ctx: CanvasRenderingContext2D,
  agents: readonly StarshipAgent[],
  time: number,
): void {
  const byRole = new Map(agents.map((agent) => [agent.name, agent]));
  drawAlecCommandGlass(ctx, time, activity(byRole.get('Alec')));
  drawKevinStarMap(ctx, time, activity(byRole.get('Kevin')));
  drawBenjaminScanner(ctx, time, activity(byRole.get('Benjamin')));
}
