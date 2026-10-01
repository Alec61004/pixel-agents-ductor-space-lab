export interface V10RoomActivity {
  Alec: boolean;
  Kevin: boolean;
  Benjamin: boolean;
}

const TAU = Math.PI * 2;

function pulse(time: number, speed: number, phase = 0): number {
  return 0.5 + 0.5 * Math.sin(time * speed + phase);
}

function clipRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
}

function drawWindowStars(
  ctx: CanvasRenderingContext2D,
  time: number,
  x: number,
  y: number,
  w: number,
  h: number,
  phase: number,
): void {
  ctx.save();
  clipRect(ctx, x, y, w, h);
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 28; i += 1) {
    const seedX = (i * 73.31 + phase * 97) % w;
    const seedY = (i * 41.17 + phase * 53) % h;
    const drift = (time * (2.2 + (i % 4) * 0.7)) % (h + 20);
    const sx = x + seedX + Math.sin(time * 0.12 + i) * (1 + (i % 3));
    const sy = y + ((seedY + drift) % h);
    const twinkle = 0.22 + 0.58 * pulse(time, 1.2 + (i % 5) * 0.15, i * 0.8);
    const radius = i % 9 === 0 ? 1.7 : i % 4 === 0 ? 1.05 : 0.6;

    ctx.globalAlpha = twinkle;
    ctx.fillStyle = i % 6 === 0 ? '#ffd69a' : '#bcecff';
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, TAU);
    ctx.fill();

    if (i % 9 === 0) {
      ctx.globalAlpha = twinkle * 0.35;
      ctx.strokeStyle = '#c9f4ff';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(sx - 6, sy);
      ctx.lineTo(sx + 6, sy);
      ctx.moveTo(sx, sy - 6);
      ctx.lineTo(sx, sy + 6);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawLeftWindow(ctx: CanvasRenderingContext2D, time: number): void {
  // V10 window-left interior. Keep clear of the metal frame and lower console.
  drawWindowStars(ctx, time, 456, 108, 442, 164, 0.4);

  ctx.save();
  clipRect(ctx, 456, 108, 442, 164);
  ctx.globalCompositeOperation = 'lighter';
  const sweepX = 470 + ((time * 24) % 520) - 70;
  const trail = ctx.createLinearGradient(sweepX - 60, 0, sweepX + 30, 0);
  trail.addColorStop(0, 'rgba(94,216,255,0)');
  trail.addColorStop(0.76, 'rgba(94,216,255,0.04)');
  trail.addColorStop(1, 'rgba(200,248,255,0.28)');
  ctx.fillStyle = trail;
  ctx.fillRect(sweepX - 60, 124, 90, 2);
  ctx.restore();
}

function drawBlackHoleWindow(ctx: CanvasRenderingContext2D, time: number): void {
  // Accretion flow is drawn as moving arc segments around the baked-in black hole.
  const cx = 1244;
  const cy = 326;

  ctx.save();
  clipRect(ctx, 1004, 108, 500, 320);
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);

  for (let ring = 0; ring < 5; ring += 1) {
    const rx = 94 + ring * 18;
    const ry = 25 + ring * 7;
    const phase = time * (0.32 + ring * 0.035) + ring * 1.1;
    for (let arc = 0; arc < 4; arc += 1) {
      const start = phase + arc * (TAU / 4);
      const span = 0.42 + ring * 0.02;
      ctx.globalAlpha = 0.07 + ring * 0.018;
      ctx.strokeStyle = arc % 2 === 0 ? '#ffbe63' : '#62d9ff';
      ctx.lineWidth = 2.2 - ring * 0.18;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, start, start + span);
      ctx.stroke();
    }
  }

  const glow = ctx.createRadialGradient(0, 0, 38, 0, 0, 132);
  glow.addColorStop(0, 'rgba(255,159,55,0)');
  glow.addColorStop(0.48, `rgba(255,176,72,${0.05 + pulse(time, 0.8) * 0.035})`);
  glow.addColorStop(1, 'rgba(83,183,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-150, -80, 300, 160);
  ctx.restore();

  drawWindowStars(ctx, time, 1010, 112, 488, 306, 1.7);
}

function drawRightWindow(ctx: CanvasRenderingContext2D, time: number): void {
  drawWindowStars(ctx, time, 1578, 108, 238, 292, 2.3);

  ctx.save();
  clipRect(ctx, 1578, 108, 238, 292);
  ctx.globalCompositeOperation = 'lighter';
  const t = (time * 0.07) % 1;
  const x = 1602 + t * 172;
  const y = 226 - t * 44;
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#77ddff';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - 26, y + 7);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

function drawAlecStation(
  ctx: CanvasRenderingContext2D,
  time: number,
  working: boolean,
): void {
  const boost = working ? 1 : 0.42;
  const cx = 292 + 295;
  const cy = 290 + 66;

  // Central tactical display.
  ctx.save();
  clipRect(ctx, 292 + 198, 290 + 18, 194, 94);
  ctx.globalCompositeOperation = 'lighter';

  const sweep = time * (working ? 1.8 : 0.55);
  ctx.globalAlpha = 0.22 * boost;
  ctx.strokeStyle = '#70f4ff';
  ctx.lineWidth = working ? 2 : 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweep) * 86, cy + Math.sin(sweep) * 42);
  ctx.stroke();

  for (let ring = 1; ring <= 3; ring += 1) {
    ctx.globalAlpha = (0.055 + ring * 0.015) * boost;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ring * 26, ring * 13, 0, 0, TAU);
    ctx.stroke();
  }

  for (let i = 0; i < 8; i += 1) {
    const a = i * 1.77 + time * (0.14 + (i % 3) * 0.025);
    const r = 18 + (i % 4) * 18;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.48;
    ctx.globalAlpha = (0.18 + pulse(time, 2.3, i) * 0.4) * boost;
    ctx.fillStyle = i % 3 === 0 ? '#ffbf62' : '#79efff';
    ctx.beginPath();
    ctx.arc(x, y, working ? 1.6 : 0.9, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Side-monitor data crawl, tied to their actual screen interiors.
  const screens = [
    { x: 292 + 112, y: 290 + 48, w: 66, h: 60, phase: 0 },
    { x: 292 + 410, y: 290 + 48, w: 58, h: 62, phase: 2 },
  ];
  for (const screen of screens) {
    ctx.save();
    clipRect(ctx, screen.x, screen.y, screen.w, screen.h);
    ctx.globalCompositeOperation = 'lighter';
    for (let row = 0; row < 5; row += 1) {
      const progress = (time * (working ? 36 : 9) + row * 17 + screen.phase * 11) % (screen.w + 30);
      ctx.globalAlpha = (0.08 + row * 0.018) * boost;
      ctx.fillStyle = row % 2 ? '#b96dff' : '#6eeaff';
      ctx.fillRect(screen.x + progress - 30, screen.y + 8 + row * 10, 24, 1.4);
    }
    ctx.restore();
  }
}

function drawKevinStation(
  ctx: CanvasRenderingContext2D,
  time: number,
  working: boolean,
): void {
  // Same design principle as the older Kevin map: a live orbital system, not a shifted PNG.
  const cx = 340 + 270;
  const cy = 510 + 84;
  const boost = working ? 1 : 0.56;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 142, 60, 0, 0, TAU);
  ctx.clip();

  // Slight glass veil suppresses the baked-in static highlights without replacing the table.
  ctx.globalAlpha = 0.12 * boost;
  const glass = ctx.createRadialGradient(cx, cy, 10, cx, cy, 146);
  glass.addColorStop(0, '#0c5370');
  glass.addColorStop(0.55, '#07334f');
  glass.addColorStop(1, '#02121f');
  ctx.fillStyle = glass;
  ctx.fillRect(cx - 150, cy - 66, 300, 132);

  ctx.globalCompositeOperation = 'lighter';
  const worlds = [
    { rx: 42, ry: 18, speed: 0.42, phase: 0.2, r: 3.4, color: '#8feeff' },
    { rx: 70, ry: 30, speed: 0.29, phase: 2.1, r: 4.4, color: '#d8b8ff' },
    { rx: 103, ry: 43, speed: 0.19, phase: 4.2, r: 5.2, color: '#a4d8ff' },
    { rx: 128, ry: 52, speed: 0.13, phase: 1.3, r: 3.2, color: '#f6d39a' },
  ];

  for (const world of worlds) {
    ctx.globalAlpha = 0.13 * boost;
    ctx.strokeStyle = '#73e5ff';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(cx, cy, world.rx, world.ry, -0.08, 0, TAU);
    ctx.stroke();
  }

  // Draw far-side planets first for depth.
  const positions = worlds.map((world) => {
    const angle = time * world.speed + world.phase;
    return {
      ...world,
      angle,
      depth: Math.sin(angle),
      x: cx + Math.cos(angle) * world.rx,
      y: cy + Math.sin(angle) * world.ry,
    };
  });

  const drawPlanet = (world: (typeof positions)[number]) => {
    const breathe = 0.86 + pulse(time, 1.1, world.phase) * 0.18;
    ctx.globalAlpha = (0.58 + (world.depth + 1) * 0.11) * boost;
    const g = ctx.createRadialGradient(
      world.x - world.r * 0.45,
      world.y - world.r * 0.45,
      0,
      world.x,
      world.y,
      world.r * 2.2,
    );
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.22, world.color);
    g.addColorStop(1, 'rgba(68,190,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(world.x, world.y, world.r * 2.2 * breathe, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.85 * boost;
    ctx.fillStyle = world.color;
    ctx.beginPath();
    ctx.arc(world.x, world.y, world.r * breathe, 0, TAU);
    ctx.fill();
  };

  positions.filter((p) => p.depth < 0).sort((a, b) => a.depth - b.depth).forEach(drawPlanet);

  const sunPulse = 8 + pulse(time, 1.7) * 3;
  const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunPulse * 2.4);
  sun.addColorStop(0, '#fffbe8');
  sun.addColorStop(0.25, '#ffc75f');
  sun.addColorStop(1, 'rgba(255,138,35,0)');
  ctx.globalAlpha = 0.85 * boost;
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, cy, sunPulse * 2.4, 0, TAU);
  ctx.fill();

  positions.filter((p) => p.depth >= 0).sort((a, b) => a.depth - b.depth).forEach(drawPlanet);

  // A survey beam is always alive; work makes it faster and brighter.
  const scan = time * (working ? 1.5 : 0.35);
  ctx.globalAlpha = 0.2 * boost;
  ctx.strokeStyle = '#8ef7ff';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(scan) * 134, cy + Math.sin(scan) * 54);
  ctx.stroke();

  ctx.restore();
}

function drawBenjaminStation(
  ctx: CanvasRenderingContext2D,
  time: number,
  working: boolean,
): void {
  const cx = 1070 + 230;
  const cy = 450 + 132;
  const boost = working ? 1 : 0.5;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 136, 62, 0, 0, TAU);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';

  // Concentric analysis rings rotate in alternating directions.
  for (let ring = 0; ring < 5; ring += 1) {
    const rx = 46 + ring * 19;
    const ry = 19 + ring * 8;
    const offset = time * (0.35 + ring * 0.035) * (ring % 2 ? -1 : 1);
    ctx.globalAlpha = (0.06 + ring * 0.018) * boost;
    ctx.strokeStyle = ring % 2 ? '#9a7cff' : '#62ecff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, offset * 0.04, offset, offset + Math.PI * 1.45);
    ctx.stroke();
  }

  // Nodes orbit the central projected object independently.
  for (let i = 0; i < 14; i += 1) {
    const a = time * (0.3 + (i % 4) * 0.04) + i * 1.91;
    const rx = 35 + (i % 5) * 18;
    const ry = rx * 0.42;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    ctx.globalAlpha = (0.18 + 0.5 * pulse(time, 1.4, i)) * boost;
    ctx.fillStyle = i % 4 === 0 ? '#ff74c8' : '#71ecff';
    ctx.beginPath();
    ctx.arc(x, y, i % 5 === 0 ? 2.1 : 1.2, 0, TAU);
    ctx.fill();
  }

  const scanY = cy - 52 + ((time * (working ? 44 : 14)) % 104);
  const scan = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
  scan.addColorStop(0, 'rgba(93,236,255,0)');
  scan.addColorStop(0.5, `rgba(119,238,255,${0.24 * boost})`);
  scan.addColorStop(1, 'rgba(93,236,255,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = scan;
  ctx.fillRect(cx - 128, scanY - 8, 256, 16);
  ctx.restore();

  // Rear monitors blink independently instead of moving with the hologram.
  const monitorYs = [482, 497, 512];
  for (let i = 0; i < monitorYs.length; i += 1) {
    const x = 1137 + i * 72;
    ctx.globalAlpha = (0.06 + 0.08 * pulse(time, 2.1 + i * 0.2, i)) * boost;
    ctx.fillStyle = i === 1 ? '#b26dff' : '#64e9ff';
    ctx.fillRect(x, monitorYs[i]!, 42, 2);
  }
  ctx.globalAlpha = 1;
}

function drawBioPedestal(ctx: CanvasRenderingContext2D, time: number): void {
  // Interior of the V10 glass specimen tank.
  ctx.save();
  clipRect(ctx, 860, 404, 172, 69);
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 18; i += 1) {
    const baseX = 870 + ((i * 43.7) % 150);
    const speed = 7 + (i % 5) * 2.2;
    const y = 470 - ((time * speed + i * 19) % 65);
    const x = baseX + Math.sin(time * 0.7 + i * 1.3) * (2 + (i % 3));
    const r = 0.9 + (i % 4) * 0.45;
    ctx.globalAlpha = 0.08 + (i % 5) * 0.035;
    ctx.strokeStyle = i % 4 === 0 ? '#ffe38b' : '#9df8ff';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
  }

  const waterGlow = ctx.createLinearGradient(0, 404, 0, 473);
  waterGlow.addColorStop(0, 'rgba(92,235,255,0)');
  waterGlow.addColorStop(0.6, `rgba(92,235,255,${0.02 + pulse(time, 0.8) * 0.025})`);
  waterGlow.addColorStop(1, 'rgba(255,186,74,0)');
  ctx.fillStyle = waterGlow;
  ctx.fillRect(860, 404, 172, 69);
  ctx.restore();
}

function drawEnergyAccents(ctx: CanvasRenderingContext2D, time: number): void {
  // Small authored light strips only; never cover structural surfaces.
  const accents = [
    { x: 486, y: 418, w: 54, h: 3, phase: 0.1 },
    { x: 690, y: 413, w: 52, h: 3, phase: 1.4 },
    { x: 486, y: 666, w: 58, h: 3, phase: 2.1 },
    { x: 704, y: 651, w: 61, h: 3, phase: 0.8 },
    { x: 1133, y: 665, w: 66, h: 3, phase: 1.9 },
    { x: 1454, y: 666, w: 60, h: 3, phase: 0.3 },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const accent of accents) {
    ctx.globalAlpha = 0.05 + pulse(time, 1.15, accent.phase) * 0.11;
    ctx.fillStyle = accent.phase > 1 ? '#ffac4f' : '#5ceaff';
    ctx.fillRect(accent.x, accent.y, accent.w, accent.h);
  }
  ctx.restore();
}

/**
 * V10 ambient/system pass.
 *
 * The authored PNGs remain the physical room. This pass only draws live data,
 * light, space, fluid and holographic content inside the corresponding device
 * interiors. It runs continuously so an idle room still feels operational.
 */
export function drawV10RoomMotion(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  activity: V10RoomActivity,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = true;

  drawLeftWindow(ctx, timeSec);
  drawBlackHoleWindow(ctx, timeSec);
  drawRightWindow(ctx, timeSec);
  drawBioPedestal(ctx, timeSec);
  drawAlecStation(ctx, timeSec, activity.Alec);
  drawKevinStation(ctx, timeSec, activity.Kevin);
  drawBenjaminStation(ctx, timeSec, activity.Benjamin);
  drawEnergyAccents(ctx, timeSec);

  ctx.restore();
}
