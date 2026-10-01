export interface V10RoomActivity {
  Alec: boolean;
  Kevin: boolean;
  Benjamin: boolean;
}

const TAU = Math.PI * 2;

type SourceSurface = CanvasImageSource;

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

function clipEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.clip();
}

/**
 * Repaint a region from the authored source itself with a tiny camera drift.
 * Because the source fully replaces the region before any live drawing, this is
 * image motion rather than a transparent overlay on top of a frozen picture.
 */
function repaintSourceParallax(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
  phase: number,
  amount = 5,
): void {
  const dx = Math.sin(time * 0.11 + phase) * amount;
  const dy = Math.cos(time * 0.09 + phase * 1.7) * amount * 0.55;
  const zoom = 1.025 + pulse(time, 0.07, phase) * 0.01;
  const sw = w / zoom;
  const sh = h / zoom;
  const sx = x + (w - sw) / 2 - dx;
  const sy = y + (h - sh) / 2 - dy;

  ctx.drawImage(source, sx, sy, sw, sh, x, y, w, h);
}

/** Repaint the tank from the authored pixels, one horizontal slice at a time. */
function repaintSourceWave(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
): void {
  const slice = 3;
  const margin = 6;
  for (let row = 0; row < h; row += slice) {
    const sh = Math.min(slice, h - row);
    const offset = Math.sin(time * 1.05 + row * 0.16) * 2.4;
    ctx.drawImage(
      source,
      x - margin,
      y + row,
      w + margin * 2,
      sh,
      x - margin + offset,
      y + row,
      w + margin * 2,
      sh,
    );
  }
}

function cleanGlassFromSource(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  x: number,
  y: number,
  w: number,
  h: number,
  blurPx = 12,
  brightness = 0.45,
): void {
  ctx.save();
  clipRect(ctx, x, y, w, h);
  ctx.filter = 'blur(' + blurPx + 'px) brightness(' + brightness + ') saturate(0.85)';
  ctx.drawImage(
    source,
    x - blurPx,
    y - blurPx,
    w + blurPx * 2,
    h + blurPx * 2,
    x - blurPx,
    y - blurPx,
    w + blurPx * 2,
    h + blurPx * 2,
  );
  ctx.filter = 'none';
  ctx.restore();
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

  for (let i = 0; i < 22; i += 1) {
    const sx = x + ((i * 73.31 + phase * 97) % w);
    const sy = y + ((i * 41.17 + phase * 53 + time * (1.2 + (i % 4) * 0.35)) % h);
    const twinkle = 0.1 + 0.32 * pulse(time, 1.2 + (i % 5) * 0.15, i * 0.8);
    const radius = i % 9 === 0 ? 1.25 : 0.5;

    ctx.globalAlpha = twinkle;
    ctx.fillStyle = i % 6 === 0 ? '#ffd69a' : '#bcecff';
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

function drawLeftWindow(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  time: number,
): void {
  const x = 456;
  const y = 108;
  const w = 442;
  const h = 164;

  ctx.save();
  clipRect(ctx, x, y, w, h);
  repaintSourceParallax(ctx, source, x, y, w, h, time, 0.4, 5);
  ctx.restore();

  drawWindowStars(ctx, time, x, y, w, h, 0.4);
}

function drawBlackHoleWindow(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  time: number,
): void {
  const x = 1004;
  const y = 108;
  const w = 500;
  const h = 320;
  const cx = 1244;
  const cy = 326;

  ctx.save();
  clipRect(ctx, x, y, w, h);
  repaintSourceParallax(ctx, source, x, y, w, h, time, 1.7, 3.2);
  ctx.restore();

  // The source itself moves first. These arcs are restrained energy highlights,
  // not the primary motion, so the baked accretion disc never reads as frozen.
  ctx.save();
  clipRect(ctx, x, y, w, h);
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);

  for (let ring = 0; ring < 5; ring += 1) {
    const rx = 92 + ring * 19;
    const ry = 24 + ring * 7;
    const phase = time * (0.34 + ring * 0.032) + ring * 1.1;
    for (let arc = 0; arc < 3; arc += 1) {
      const start = phase + arc * (TAU / 3);
      ctx.globalAlpha = 0.04 + ring * 0.009;
      ctx.strokeStyle = arc % 2 === 0 ? '#ffbe63' : '#62d9ff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, start, start + 0.52);
      ctx.stroke();
    }
  }
  ctx.restore();

  drawWindowStars(ctx, time, x, y, w, h, 1.7);
}

function drawRightWindow(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  time: number,
): void {
  const x = 1578;
  const y = 108;
  const w = 238;
  const h = 292;

  ctx.save();
  clipRect(ctx, x, y, w, h);
  repaintSourceParallax(ctx, source, x, y, w, h, time, 2.3, 4.2);
  ctx.restore();

  drawWindowStars(ctx, time, x, y, w, h, 2.3);
}

function drawAlecStation(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  time: number,
  working: boolean,
): void {
  const boost = working ? 1 : 0.5;
  const central = { x: 490, y: 308, w: 194, h: 94 };
  const left = { x: 404, y: 338, w: 66, h: 60 };
  const right = { x: 702, y: 338, w: 58, h: 62 };

  // Remove the frozen UI from the authored screenshot but preserve its glass,
  // luminance and color temperature by deriving the clean plate from itself.
  cleanGlassFromSource(ctx, source, central.x, central.y, central.w, central.h, 14, 0.42);
  cleanGlassFromSource(ctx, source, left.x, left.y, left.w, left.h, 9, 0.48);
  cleanGlassFromSource(ctx, source, right.x, right.y, right.w, right.h, 9, 0.48);

  const cx = central.x + central.w / 2;
  const cy = central.y + central.h / 2;

  ctx.save();
  clipRect(ctx, central.x, central.y, central.w, central.h);
  ctx.globalCompositeOperation = 'lighter';

  const sweep = time * (working ? 1.9 : 0.58);
  ctx.globalAlpha = 0.42 * boost;
  ctx.strokeStyle = '#70f4ff';
  ctx.lineWidth = working ? 1.6 : 0.9;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweep) * 86, cy + Math.sin(sweep) * 40);
  ctx.stroke();

  for (let ring = 1; ring <= 3; ring += 1) {
    ctx.globalAlpha = (0.08 + ring * 0.018) * boost;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ring * 26, ring * 13, 0, 0, TAU);
    ctx.stroke();
  }

  for (let i = 0; i < 9; i += 1) {
    const a = i * 1.77 + time * (0.14 + (i % 3) * 0.025);
    const r = 18 + (i % 4) * 18;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r * 0.48;
    ctx.globalAlpha = (0.2 + pulse(time, 2.3, i) * 0.48) * boost;
    ctx.fillStyle = i % 3 === 0 ? '#ffbf62' : '#79efff';
    ctx.beginPath();
    ctx.arc(px, py, working ? 1.5 : 0.9, 0, TAU);
    ctx.fill();
  }

  const scanY = central.y + ((time * (working ? 34 : 11)) % central.h);
  ctx.globalAlpha = 0.12 * boost;
  ctx.fillStyle = '#71eaff';
  ctx.fillRect(central.x + 8, scanY, central.w - 16, 1);
  ctx.restore();

  const screens = [
    { ...left, phase: 0 },
    { ...right, phase: 2 },
  ];

  for (const screen of screens) {
    ctx.save();
    clipRect(ctx, screen.x, screen.y, screen.w, screen.h);
    ctx.globalCompositeOperation = 'lighter';

    for (let row = 0; row < 5; row += 1) {
      const progress =
        (time * (working ? 32 : 8) + row * 17 + screen.phase * 11) % (screen.w + 26);
      ctx.globalAlpha = (0.11 + row * 0.02) * boost;
      ctx.fillStyle = row % 2 ? '#b96dff' : '#6eeaff';
      ctx.fillRect(screen.x + progress - 26, screen.y + 8 + row * 10, 20, 1.4);
    }

    ctx.restore();
  }
}

interface KevinWorld {
  orbitX: number;
  orbitY: number;
  speed: number;
  phase: number;
  radius: number;
  color: string;
  ring?: boolean;
}

const KEVIN_WORLDS: readonly KevinWorld[] = [
  { orbitX: 42, orbitY: 17, speed: 0.43, phase: 0.2, radius: 3.4, color: '#8feeff' },
  { orbitX: 69, orbitY: 29, speed: 0.29, phase: 2.1, radius: 4.5, color: '#d8b8ff', ring: true },
  { orbitX: 99, orbitY: 41, speed: 0.19, phase: 4.2, radius: 5.2, color: '#a4d8ff' },
  { orbitX: 124, orbitY: 51, speed: 0.13, phase: 1.3, radius: 3.3, color: '#f6d39a' },
  { orbitX: 82, orbitY: 34, speed: 0.23, phase: 5.1, radius: 2.7, color: '#9ce5c9' },
];

function drawKevinPlanet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  opacity: number,
  ring: boolean,
  time: number,
): void {
  ctx.save();
  ctx.globalAlpha = opacity;

  const glow = ctx.createRadialGradient(
    x - radius * 0.4,
    y - radius * 0.45,
    0,
    x,
    y,
    radius * 2.25,
  );
  glow.addColorStop(0, '#ffffff');
  glow.addColorStop(0.24, color);
  glow.addColorStop(1, 'rgba(60,190,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.25, 0, TAU);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.globalAlpha = opacity * 0.95;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();

  const shade = ctx.createLinearGradient(x - radius, y, x + radius, y);
  shade.addColorStop(0, 'rgba(255,255,255,0.18)');
  shade.addColorStop(0.45, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,6,18,0.72)');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();

  if (ring) {
    ctx.strokeStyle = '#d9f6ff';
    ctx.globalAlpha = opacity * 0.55;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.7, radius * 0.55, time * 0.05, 0, TAU);
    ctx.stroke();
  }

  ctx.restore();
}

function drawKevinStation(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  time: number,
  working: boolean,
): void {
  const cx = 610;
  const cy = 594;
  const rx = 142;
  const ry = 60;
  const boost = working ? 1 : 0.62;

  // This is the key difference from the previous fake-looking pass:
  // fully replace the frozen star-map interior first, then render the system.
  ctx.save();
  clipEllipse(ctx, cx, cy, rx, ry);
  ctx.filter = 'blur(16px) brightness(0.34) saturate(0.75)';
  ctx.drawImage(source, cx - rx - 18, cy - ry - 18, rx * 2 + 36, ry * 2 + 36,
    cx - rx - 18, cy - ry - 18, rx * 2 + 36, ry * 2 + 36);
  ctx.filter = 'none';

  const glass = ctx.createRadialGradient(cx, cy, 5, cx, cy, rx);
  glass.addColorStop(0, 'rgba(10,70,94,0.68)');
  glass.addColorStop(0.58, 'rgba(5,42,64,0.58)');
  glass.addColorStop(1, 'rgba(1,15,27,0.82)');
  ctx.fillStyle = glass;
  ctx.globalAlpha = 0.78;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  ctx.globalCompositeOperation = 'lighter';
  for (const world of KEVIN_WORLDS) {
    ctx.globalAlpha = 0.11 * boost;
    ctx.strokeStyle = '#73e5ff';
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.ellipse(cx, cy, world.orbitX, world.orbitY, -0.08, 0, TAU);
    ctx.stroke();
  }

  const positions = KEVIN_WORLDS.map((world) => {
    const angle = time * world.speed + world.phase;
    return {
      ...world,
      depth: Math.sin(angle),
      x: cx + Math.cos(angle) * world.orbitX,
      y: cy + Math.sin(angle) * world.orbitY,
    };
  });

  for (const world of positions.filter((p) => p.depth < 0).sort((a, b) => a.depth - b.depth)) {
    drawKevinPlanet(
      ctx,
      world.x,
      world.y,
      world.radius,
      world.color,
      (0.48 + (world.depth + 1) * 0.13) * boost,
      Boolean(world.ring),
      time,
    );
  }

  const sunRadius = 8.5 + pulse(time, 1.6) * 2.2;
  const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunRadius * 2.6);
  sun.addColorStop(0, '#fffde7');
  sun.addColorStop(0.2, '#ffd16b');
  sun.addColorStop(0.58, '#ff9c35');
  sun.addColorStop(1, 'rgba(255,118,28,0)');
  ctx.globalAlpha = 0.84 * boost;
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, cy, sunRadius * 2.6, 0, TAU);
  ctx.fill();

  for (const world of positions.filter((p) => p.depth >= 0).sort((a, b) => a.depth - b.depth)) {
    drawKevinPlanet(
      ctx,
      world.x,
      world.y,
      world.radius,
      world.color,
      (0.58 + world.depth * 0.18) * boost,
      Boolean(world.ring),
      time,
    );
  }

  for (let mote = 0; mote < 34; mote += 1) {
    const a = mote * 2.317 + time * (0.025 + (mote % 4) * 0.008);
    const radius = 18 + ((mote * 23) % 116);
    const px = cx + Math.cos(a) * radius;
    const py = cy + Math.sin(a) * radius * 0.42;
    ctx.globalAlpha = (0.09 + (mote % 5) * 0.025) * boost;
    ctx.fillStyle = mote % 6 === 0 ? '#ffd28d' : '#a8eaff';
    ctx.beginPath();
    ctx.arc(px, py, mote % 7 === 0 ? 0.9 : 0.45, 0, TAU);
    ctx.fill();
  }

  const scan = time * (working ? 1.45 : 0.36);
  ctx.globalAlpha = 0.17 * boost;
  ctx.strokeStyle = '#9af8ff';
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(scan) * 132, cy + Math.sin(scan) * 53);
  ctx.stroke();

  ctx.restore();
}

function drawBenjaminStation(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  time: number,
  working: boolean,
): void {
  const cx = 1300;
  const cy = 582;
  const rx = 136;
  const ry = 62;
  const boost = working ? 1 : 0.55;

  ctx.save();
  clipEllipse(ctx, cx, cy, rx, ry);
  ctx.filter = 'blur(13px) brightness(0.38) saturate(0.8)';
  ctx.drawImage(source, cx - rx - 16, cy - ry - 16, rx * 2 + 32, ry * 2 + 32,
    cx - rx - 16, cy - ry - 16, rx * 2 + 32, ry * 2 + 32);
  ctx.filter = 'none';

  const glass = ctx.createRadialGradient(cx, cy, 8, cx, cy, rx);
  glass.addColorStop(0, 'rgba(14,75,98,0.52)');
  glass.addColorStop(0.6, 'rgba(9,39,58,0.55)');
  glass.addColorStop(1, 'rgba(2,16,29,0.82)');
  ctx.fillStyle = glass;
  ctx.globalAlpha = 0.76;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  ctx.globalCompositeOperation = 'lighter';

  for (let ring = 0; ring < 5; ring += 1) {
    const erx = 46 + ring * 19;
    const ery = 19 + ring * 8;
    const offset = time * (0.35 + ring * 0.035) * (ring % 2 ? -1 : 1);
    ctx.globalAlpha = (0.075 + ring * 0.018) * boost;
    ctx.strokeStyle = ring % 2 ? '#9a7cff' : '#62ecff';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.ellipse(cx, cy, erx, ery, offset * 0.04, offset, offset + Math.PI * 1.45);
    ctx.stroke();
  }

  for (let i = 0; i < 14; i += 1) {
    const a = time * (0.3 + (i % 4) * 0.04) + i * 1.91;
    const erx = 35 + (i % 5) * 18;
    const ery = erx * 0.42;
    const px = cx + Math.cos(a) * erx;
    const py = cy + Math.sin(a) * ery;
    ctx.globalAlpha = (0.2 + 0.48 * pulse(time, 1.4, i)) * boost;
    ctx.fillStyle = i % 4 === 0 ? '#ff74c8' : '#71ecff';
    ctx.beginPath();
    ctx.arc(px, py, i % 5 === 0 ? 1.9 : 1.1, 0, TAU);
    ctx.fill();
  }

  const scanY = cy - 52 + ((time * (working ? 44 : 14)) % 104);
  const scan = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
  scan.addColorStop(0, 'rgba(93,236,255,0)');
  scan.addColorStop(0.5, 'rgba(119,238,255,' + 0.22 * boost + ')');
  scan.addColorStop(1, 'rgba(93,236,255,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = scan;
  ctx.fillRect(cx - 128, scanY - 8, 256, 16);
  ctx.restore();

  // Rear displays are also cleaned and redrawn so their baked traces do not sit
  // visibly underneath the live data.
  const monitors = [
    { x: 1126, y: 478, w: 54, h: 58, phase: 0.1 },
    { x: 1190, y: 470, w: 58, h: 64, phase: 1.3 },
    { x: 1342, y: 474, w: 54, h: 61, phase: 2.4 },
  ];

  for (const monitor of monitors) {
    cleanGlassFromSource(ctx, source, monitor.x, monitor.y, monitor.w, monitor.h, 8, 0.46);
    ctx.save();
    clipRect(ctx, monitor.x, monitor.y, monitor.w, monitor.h);
    ctx.globalCompositeOperation = 'lighter';
    for (let row = 0; row < 4; row += 1) {
      const width = monitor.w * (0.28 + 0.52 * pulse(time, 0.7, row + monitor.phase));
      ctx.globalAlpha = (0.09 + 0.09 * pulse(time, 2.0, row + monitor.phase)) * boost;
      ctx.fillStyle = row % 2 ? '#bd71ff' : '#63ebff';
      ctx.fillRect(monitor.x + 7, monitor.y + 9 + row * 11, width, 1.3);
    }
    ctx.restore();
  }
}

function drawBioPedestal(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  time: number,
): void {
  const x = 860;
  const y = 404;
  const w = 172;
  const h = 69;

  ctx.save();
  clipRect(ctx, x, y, w, h);
  repaintSourceWave(ctx, source, x, y, w, h, time);
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 16; i += 1) {
    const baseX = x + 10 + ((i * 43.7) % (w - 20));
    const speed = 6 + (i % 5) * 1.9;
    const py = y + h - ((time * speed + i * 19) % h);
    const px = baseX + Math.sin(time * 0.7 + i * 1.3) * (1.5 + (i % 3));
    const radius = 0.8 + (i % 4) * 0.36;
    ctx.globalAlpha = 0.055 + (i % 5) * 0.025;
    ctx.strokeStyle = i % 4 === 0 ? '#ffe38b' : '#9df8ff';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnergyAccents(ctx: CanvasRenderingContext2D, time: number): void {
  const accents = [
    { x: 486, y: 418, w: 54, h: 2, phase: 0.1 },
    { x: 690, y: 413, w: 52, h: 2, phase: 1.4 },
    { x: 486, y: 666, w: 58, h: 2, phase: 2.1 },
    { x: 704, y: 651, w: 61, h: 2, phase: 0.8 },
    { x: 1133, y: 665, w: 66, h: 2, phase: 1.9 },
    { x: 1454, y: 666, w: 60, h: 2, phase: 0.3 },
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const accent of accents) {
    ctx.globalAlpha = 0.035 + pulse(time, 1.15, accent.phase) * 0.07;
    ctx.fillStyle = accent.phase > 1 ? '#ffac4f' : '#5ceaff';
    ctx.fillRect(accent.x, accent.y, accent.w, accent.h);
  }
  ctx.restore();
}

/**
 * Animate V10 as a living scene rather than painting decorations over a still.
 *
 * The static PNG remains only the physical structure. Animated interiors are
 * first repainted/cleaned from the authored source, then reconstructed frame by
 * frame. Windows and liquid use the source pixels themselves as moving texture.
 */
export function drawV10RoomMotion(
  ctx: CanvasRenderingContext2D,
  source: SourceSurface,
  timeSec: number,
  activity: V10RoomActivity,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = true;

  drawLeftWindow(ctx, source, timeSec);
  drawBlackHoleWindow(ctx, source, timeSec);
  drawRightWindow(ctx, source, timeSec);
  drawBioPedestal(ctx, source, timeSec);
  drawAlecStation(ctx, source, timeSec, activity.Alec);
  drawKevinStation(ctx, source, timeSec, activity.Kevin);
  drawBenjaminStation(ctx, source, timeSec, activity.Benjamin);
  drawEnergyAccents(ctx, timeSec);

  ctx.restore();
}
