type Point = readonly [number, number];

export interface ComputerBankActivity {
  alec: boolean;
  kevin: boolean;
}

const C = {
  void: '#090b14',
  deep: '#151928',
  panel: '#1f2333',
  mid: '#2b3045',
  edge: '#545d7e',
  cyan: '#00f0ff',
  ice: '#b0f6ff',
  mint: '#00ff99',
  amber: '#ffb830',
  violet: '#b84aff',
  magenta: '#ff2a8d',
} as const;

function poly(ctx: CanvasRenderingContext2D, points: readonly Point[], fill: string, stroke?: string) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function pixelButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  active: boolean,
  size = 4,
) {
  ctx.fillStyle = C.void;
  ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = active ? 0.85 : 0.35;
  ctx.fillRect(x, y, size, size);
  ctx.globalAlpha = 1;
}

function screen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
  time: number,
  active: boolean,
  mode: 'nav' | 'build' | 'status',
) {
  ctx.fillStyle = C.void;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = active ? 0.95 : 0.55;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, w - 4, h - 4);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.globalAlpha = active ? 0.48 : 0.2;
  const scan = (Math.floor(time * 9) % Math.max(1, h + 8)) - 4;
  ctx.fillRect(x + 2, y + scan, w - 4, 1);
  ctx.globalAlpha = active ? 0.8 : 0.35;

  if (mode === 'nav') {
    ctx.strokeStyle = C.ice;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + h - 7);
    ctx.lineTo(x + w * 0.34, y + h * 0.44);
    ctx.lineTo(x + w * 0.58, y + h * 0.64);
    ctx.lineTo(x + w - 5, y + 6);
    ctx.stroke();
    pixelButton(ctx, x + w * 0.34, y + h * 0.44, C.amber, active, 3);
    pixelButton(ctx, x + w * 0.75, y + 6, C.mint, active, 3);
  } else {
    const rows = mode === 'build' ? 5 : 4;
    for (let row = 0; row < rows; row++) {
      const yy = y + 5 + row * 5;
      const ww = Math.max(4, (w - 10) * (0.35 + ((row * 19) % 44) / 100));
      ctx.fillRect(x + 5, yy, ww, 1);
      if (row % 2 === 0) ctx.fillRect(x + 5, yy + 2, ww * 0.34, 1);
    }
    if (mode === 'build') {
      ctx.fillStyle = C.mint;
      ctx.fillRect(x + w - 12, y + h - 8, 6, 3);
    }
  }
  ctx.restore();
}

function centralCommandBank(ctx: CanvasRenderingContext2D, time: number, active: boolean) {
  // Opaque pixel-art backing replaces the old flat computer crop as one
  // coherent machine bay, while leaving the window and weapon rack above it.
  poly(
    ctx,
    [[407, 329], [431, 299], [711, 299], [734, 329], [729, 424], [413, 424]],
    C.deep,
    C.edge,
  );
  ctx.fillStyle = C.panel;
  ctx.fillRect(417, 343, 310, 71);
  ctx.fillStyle = '#111522';
  ctx.fillRect(423, 407, 298, 15);

  const monitors = [
    { x: 451, y: 305, w: 70, h: 49, accent: C.cyan, mode: 'nav' as const },
    { x: 551, y: 303, w: 78, h: 55, accent: C.mint, mode: 'build' as const },
    { x: 649, y: 305, w: 67, h: 49, accent: C.ice, mode: 'status' as const },
  ];
  for (const monitor of monitors) {
    ctx.fillStyle = C.void;
    ctx.fillRect(monitor.x - 4, monitor.y - 4, monitor.w + 8, monitor.h + 8);
    ctx.strokeStyle = monitor.accent;
    ctx.globalAlpha = active ? 0.75 : 0.5;
    ctx.strokeRect(monitor.x - 3.5, monitor.y - 3.5, monitor.w + 7, monitor.h + 7);
    ctx.globalAlpha = 1;
    screen(ctx, monitor.x, monitor.y, monitor.w, monitor.h, monitor.accent, time, active, monitor.mode);
  }

  // Alien command spine beneath the three screens: status core, tactile keys
  // and a pulse that travels through the centre processor while Alec works.
  ctx.fillStyle = C.void;
  ctx.fillRect(543, 362, 103, 62);
  ctx.strokeStyle = C.violet;
  ctx.globalAlpha = active ? 0.8 : 0.45;
  ctx.strokeRect(543.5, 362.5, 102, 61);
  ctx.globalAlpha = 1;
  screen(ctx, 553, 369, 83, 24, C.mint, time, active, 'status');
  for (let i = 0; i < 7; i++) {
    const p = (time * 3 + i) % 7;
    pixelButton(ctx, 553 + i * 10, 402, i === 5 ? C.magenta : i % 2 ? C.cyan : C.amber, active && p < 4, 5);
  }
  ctx.fillStyle = C.mid;
  ctx.fillRect(428, 421, 292, 8);
  ctx.fillStyle = C.cyan;
  ctx.globalAlpha = active ? 0.85 : 0.35;
  ctx.fillRect(438, 423, 72 + ((Math.sin(time * 2) + 1) * 0.5) * 72, 2);
  ctx.globalAlpha = 1;
}

function angledBuildBank(ctx: CanvasRenderingContext2D, time: number, active: boolean) {
  // Kevin's port console follows the original diagonal wall and chair axis.
  poly(ctx, [[303, 405], [354, 311], [420, 337], [449, 467], [397, 492]], C.deep, C.edge);
  poly(ctx, [[309, 403], [355, 320], [411, 341], [435, 454], [397, 477]], C.panel, '#3c435e');

  // Tall diagnostic screen.
  poly(ctx, [[316, 330], [353, 319], [358, 391], [323, 402]], C.void, C.cyan);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(321, 335);
  ctx.lineTo(348, 327);
  ctx.lineTo(352, 384);
  ctx.lineTo(327, 393);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = C.mint;
  ctx.globalAlpha = active ? 0.72 : 0.3;
  for (let i = 0; i < 8; i++) {
    const y = 338 + i * 6;
    ctx.fillRect(325 + (i % 3) * 3, y, 18 - (i % 4) * 2, 1);
  }
  const scan = (Math.floor(time * 8) % 63) + 330;
  ctx.fillRect(320, scan, 38, 1);
  ctx.restore();
  ctx.globalAlpha = 1;

  // Slanted build keypad with alien segmented readouts.
  poly(ctx, [[365, 354], [412, 365], [417, 428], [369, 415]], C.void, C.mint);
  for (let i = 0; i < 5; i++) {
    const y = 365 + i * 9;
    ctx.fillStyle = i === 2 ? C.amber : C.ice;
    ctx.globalAlpha = active ? 0.65 : 0.3;
    ctx.fillRect(375, y, 24 - (i % 3) * 4, 2);
    ctx.fillRect(403, y + 1, 5, 3);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 5; i++) {
    pixelButton(ctx, 329 + i * 8, 421 + i * 4, i % 2 ? C.mint : C.amber, active && i < 4, 4);
  }
}

export function drawStarshipComputerBanks(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  activity: ComputerBankActivity,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'source-over';
  centralCommandBank(ctx, timeSec, activity.alec);
  angledBuildBank(ctx, timeSec, activity.kevin);
  ctx.restore();
}

