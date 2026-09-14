export interface AlienCommandState {
  active: boolean;
  pulse: number;
  sweep: number;
  node: number;
  wake: number;
}

const COMMAND_NODES = [
  { x: 525, y: 351 },
  { x: 548, y: 329 },
  { x: 575, y: 340 },
  { x: 604, y: 321 },
  { x: 623, y: 354 },
  { x: 592, y: 369 },
  { x: 555, y: 365 },
] as const;

export function getAlienCommandState(timeSec: number, active: boolean): AlienCommandState {
  const time = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
  return {
    active,
    pulse: 0.5 + Math.sin(time * (active ? 2.1 : 0.7)) * 0.5,
    sweep: (time * (active ? 0.22 : 0.055)) % 1,
    node: Math.floor(time * (active ? 1.35 : 0.28)) % COMMAND_NODES.length,
    wake: active ? Math.min(1, time / 0.45) : 0.32,
  };
}

function tracePanel(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function drawPanelShell(ctx: CanvasRenderingContext2D, active: boolean, pulse: number) {
  const glow = active ? 0.72 + pulse * 0.18 : 0.28 + pulse * 0.08;
  // Separate growing ribs bind the alien displays to the ship's original machinery.
  for (const [x, side] of [
    [442, -1],
    [486, -1],
    [655, 1],
    [705, 1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, 326);
    ctx.bezierCurveTo(x + side * 9, 348, x + side * 7, 382, x + side * 13, 413);
    ctx.strokeStyle = side < 0 ? '#477c8d' : '#7955a0';
    ctx.globalAlpha = 0.34 + glow * 0.28;
    ctx.lineWidth = side < 0 ? 3 : 2;
    ctx.stroke();
    ctx.strokeStyle = side < 0 ? '#82e0d1' : '#b67adc';
    ctx.globalAlpha = glow * 0.35;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // A broken bioluminescent nerve joins the modules without becoming a box.
  ctx.beginPath();
  ctx.moveTo(444, 405);
  ctx.bezierCurveTo(493, 394, 520, 405, 570, 398);
  ctx.bezierCurveTo(620, 405, 661, 392, 711, 407);
  ctx.strokeStyle = '#566888';
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = '#79ddcf';
  ctx.globalAlpha = glow * 0.4;
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const x = 458 + i * 29;
    const y = 403 + Math.sin(i * 1.7) * 3;
    ctx.fillStyle = i % 4 === 0 ? '#f4a66b' : i % 2 === 0 ? '#8df5df' : '#7b8ee8';
    ctx.globalAlpha = glow * (i === 4 ? 1 : 0.55);
    ctx.fillRect(x, y, i === 4 ? 6 : 3, 2);
  }
}

function drawMembrane(
  ctx: CanvasRenderingContext2D,
  state: AlienCommandState,
) {
  const energy = state.active ? 0.68 + state.pulse * 0.25 : 0.28;
  ctx.beginPath();
  ctx.moveTo(501, 320);
  ctx.quadraticCurveTo(517, 301, 548, 309);
  ctx.quadraticCurveTo(570, 315, 594, 307);
  ctx.quadraticCurveTo(627, 297, 643, 321);
  ctx.quadraticCurveTo(653, 346, 638, 375);
  ctx.quadraticCurveTo(607, 387, 575, 379);
  ctx.quadraticCurveTo(540, 389, 507, 372);
  ctx.quadraticCurveTo(489, 347, 501, 320);
  ctx.closePath();

  const glass = ctx.createLinearGradient(500, 307, 644, 382);
  glass.addColorStop(0, '#0c2831');
  glass.addColorStop(0.5, '#10152b');
  glass.addColorStop(1, '#26173a');
  ctx.fillStyle = glass;
  ctx.globalAlpha = 0.98;
  ctx.fill();
  ctx.strokeStyle = '#77e9dc';
  ctx.globalAlpha = energy;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  ctx.clip();
  const core = ctx.createRadialGradient(575, 348, 1, 575, 348, 55);
  core.addColorStop(0, state.active ? '#b2fff030' : '#72cfc518');
  core.addColorStop(0.45, '#425f8e18');
  core.addColorStop(1, '#0a102000');
  ctx.fillStyle = core;
  ctx.globalAlpha = state.wake;
  ctx.fillRect(492, 296, 166, 96);

  // Fine stellar dust gives the membrane depth without using a human grid.
  for (let i = 0; i < 34; i++) {
    const x = 505 + ((i * 47.37) % 137);
    const y = 312 + ((i * 29.81) % 61);
    const twinkle = 0.45 + Math.sin(i * 1.7 + state.sweep * Math.PI * 2) * 0.25;
    ctx.fillStyle = i % 7 === 0 ? '#d9fff4' : '#7db9c6';
    ctx.globalAlpha = energy * twinkle;
    ctx.fillRect(Math.round(x), Math.round(y), i % 11 === 0 ? 2 : 1, 1);
  }

  // A branching neural map replaces familiar human charts and text.
  ctx.strokeStyle = '#6cdacc';
  ctx.lineWidth = 1;
  ctx.globalAlpha = energy * 0.45;
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [2, 5]] as const;
  for (const [from, to] of links) {
    const a = COMMAND_NODES[from]!;
    const b = COMMAND_NODES[to]!;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 5, b.x, b.y);
    ctx.stroke();
  }

  // Two worlds move independently through the command field; there are no drawn orbits.
  const orbit = state.sweep * Math.PI * 2;
  const worlds = [
    { x: 575 + Math.cos(orbit) * 35, y: 347 + Math.sin(orbit) * 13, r: 4.2, c: '#e4ad74' },
    { x: 575 + Math.cos(-orbit * 1.7 + 1.4) * 53, y: 347 + Math.sin(-orbit * 1.7 + 1.4) * 20, r: 2.1, c: '#8cd8d0' },
  ];
  for (const world of worlds) {
    const sphere = ctx.createRadialGradient(
      world.x - world.r * 0.35,
      world.y - world.r * 0.35,
      0,
      world.x,
      world.y,
      world.r,
    );
    sphere.addColorStop(0, '#fff6d9');
    sphere.addColorStop(0.35, world.c);
    sphere.addColorStop(1, '#0a1724');
    ctx.fillStyle = sphere;
    ctx.globalAlpha = energy;
    ctx.beginPath();
    ctx.arc(world.x, world.y, world.r, 0, Math.PI * 2);
    ctx.fill();
  }

  COMMAND_NODES.forEach((node, index) => {
    const selected = index === state.node;
    const radius = selected ? 3.5 + state.pulse : 1.7;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#fff1bd' : index % 3 === 0 ? '#e992c8' : '#89ead9';
    ctx.globalAlpha = selected ? energy : energy * 0.6;
    ctx.fill();
  });

  // The scan is a broken, slanted veil rather than a rectangular radar sweep.
  const scanX = 497 + state.sweep * 153;
  const scan = ctx.createLinearGradient(scanX - 13, 0, scanX + 4, 0);
  scan.addColorStop(0, '#9affec00');
  scan.addColorStop(0.75, '#9affec16');
  scan.addColorStop(1, '#d6fff04a');
  ctx.fillStyle = scan;
  ctx.globalAlpha = state.active ? 0.8 : 0.2;
  ctx.beginPath();
  ctx.moveTo(scanX - 15, 301);
  ctx.lineTo(scanX + 6, 301);
  ctx.lineTo(scanX - 8, 386);
  ctx.lineTo(scanX - 29, 386);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWingDisplay(
  ctx: CanvasRenderingContext2D,
  side: -1 | 1,
  state: AlienCommandState,
) {
  const left = side < 0;
  const x = left ? 438 : 655;
  const energy = state.active ? 0.62 + state.pulse * 0.2 : 0.22;
  const points = left
    ? ([[438, 333], [454, 317], [492, 319], [498, 371], [482, 397], [447, 390], [433, 365]] as const)
    : ([[655, 320], [699, 317], [716, 334], [723, 368], [708, 396], [671, 391], [650, 371]] as const);
  tracePanel(ctx, points);
  ctx.fillStyle = left ? '#0b202a' : '#1b102a';
  ctx.globalAlpha = 0.97;
  ctx.fill();
  ctx.strokeStyle = left ? '#57cbbb' : '#a56dcc';
  ctx.globalAlpha = energy;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.clip();

  if (left) {
    // Hull vitality is shown as a living spine with independent organs.
    ctx.strokeStyle = '#72d8c8';
    ctx.lineWidth = 1;
    ctx.globalAlpha = energy * 0.7;
    ctx.beginPath();
    ctx.moveTo(x + 8, 384);
    for (let i = 0; i <= 9; i++) {
      const py = 380 - i * 6;
      const px = x + 20 + Math.sin(i * 1.8 + state.sweep * Math.PI * 2) * 7;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const py = 350 + i * 8;
      ctx.beginPath();
      ctx.arc(x + 38 + (i % 2) * 11, py, 2 + (i === state.node % 5 ? state.pulse : 0), 0, Math.PI * 2);
      ctx.fillStyle = i === state.node % 5 ? '#ffd39a' : '#68bdb7';
      ctx.globalAlpha = energy;
      ctx.fill();
    }
  } else {
    // Command queues grow like crystalline branches rather than progress bars.
    for (let i = 0; i < 6; i++) {
      const py = 337 + i * 9;
      const length = 17 + ((i * 13 + state.node * 5) % 31);
      ctx.strokeStyle = i === state.node % 6 ? '#f0b1df' : '#8a73b7';
      ctx.globalAlpha = energy * (i === state.node % 6 ? 1 : 0.55);
      ctx.lineWidth = i === state.node % 6 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x + 8, py);
      ctx.lineTo(x + 8 + length, py);
      ctx.lineTo(x + 14 + length, py - 4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTouchDeck(ctx: CanvasRenderingContext2D, state: AlienCommandState) {
  tracePanel(ctx, [
    [495, 382],
    [535, 376],
    [570, 383],
    [610, 376],
    [646, 384],
    [662, 406],
    [653, 432],
    [489, 432],
    [478, 405],
  ]);
  const deck = ctx.createLinearGradient(478, 377, 662, 432);
  deck.addColorStop(0, '#0a1b25');
  deck.addColorStop(0.5, '#090d1b');
  deck.addColorStop(1, '#1c1028');
  ctx.fillStyle = deck;
  ctx.globalAlpha = 0.96;
  ctx.fill();
  ctx.strokeStyle = '#44577a';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.stroke();

  // Seven pressure-sensitive glyphs respond in sequence to Alec's authored hand poses.
  for (let i = 0; i < 7; i++) {
    const x = 500 + i * 23;
    const y = 407 + Math.abs(i - 3) * 2;
    const live = state.active && (i === state.node || i === (state.node + 1) % 7);
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 9, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fillStyle = live ? '#9affdf' : i % 2 ? '#3d5478' : '#503e72';
    ctx.globalAlpha = live ? 0.78 + state.pulse * 0.2 : 0.5;
    ctx.fill();
    ctx.strokeStyle = live ? '#e2ffef' : '#7b71a3';
    ctx.globalAlpha *= 0.7;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const core = ctx.createRadialGradient(570, 416, 0, 570, 416, 17);
  core.addColorStop(0, state.active ? '#d7fff070' : '#80c7bd25');
  core.addColorStop(0.35, '#67d5c538');
  core.addColorStop(1, '#22183900');
  ctx.fillStyle = core;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(552, 398, 36, 36);
}

export function drawAlienCommandBridge(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  active: boolean,
): void {
  const state = getAlienCommandState(timeSec, active);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'source-over';
  drawPanelShell(ctx, active, state.pulse);
  drawMembrane(ctx, state);
  drawWingDisplay(ctx, -1, state);
  drawWingDisplay(ctx, 1, state);
  drawTouchDeck(ctx, state);
  ctx.restore();
}
