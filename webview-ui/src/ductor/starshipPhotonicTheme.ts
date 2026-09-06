/** Shared material and light palette for the bridge and Home controls. */
export const PHOTONIC_THEME = {
  void: '#071316', hull: '#0c2028', panel: '#102c35', line: '#28535c',
  cyan: '#77f5e5', violet: '#b998ed', magenta: '#f4aa9d', amber: '#f5c99f',
  text: '#dfefeb', dim: '#8eaaa9',
} as const;

export const PHOTONIC_CSS_VARS = Object.entries(PHOTONIC_THEME)
  .map(([key, value]) => `--${key}: ${value};`).join('\n');

/** Accents stay inside authored glass and equipment, in room coordinates. */
export function drawPhotonicRoom(
  ctx: CanvasRenderingContext2D,
  time: number,
  qaActive: boolean,
): void {
  ctx.save();
  const panels = [
    { x: 225, y: 241, w: 57, h: 68 },
    { x: 219, y: 334, w: 66, h: 56 },
    { x: 1038, y: 516, w: 76, h: 57 },
    { x: 1366, y: 461, w: 25, h: 24 },
    { x: 1441, y: 448, w: 47, h: 21 },
  ];
  for (let n = 0; n < panels.length; n++) {
    const p = panels[n]!;
    const active = n === 2 && qaActive;
    ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#13504e'; ctx.globalAlpha = 0.22; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.globalCompositeOperation = 'lighter';
    const phase = time * (active ? 0.45 : 0.12) + n;
    ctx.globalAlpha = active ? 0.5 : 0.22; ctx.strokeStyle = PHOTONIC_THEME.cyan; ctx.lineWidth = 0.65;
    // Broken hexagonal traces give the remote stations the same crystal language.
    const cx = p.x + p.w * 0.5, cy = p.y + p.h * 0.5, r = Math.min(p.w, p.h) * 0.27;
    for (let v = 0; v < 6; v++) {
      const a = phase + v * Math.PI / 3;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r*0.65);
      ctx.lineTo(cx + Math.cos(a+0.7)*r, cy + Math.sin(a+0.7)*r*0.65); ctx.stroke();
    }
    for (let d = 0; d < 4; d++) {
      const y = p.y + ((phase * 6 + d * p.h / 4) % p.h);
      ctx.fillStyle = PHOTONIC_THEME.cyan;
      ctx.fillRect(p.x + 3, Math.round(y), 2 + d % 2 * 2, 1);
    }
    ctx.restore();
  }
  // Equipment indicator lights share a slow ambient heartbeat across the room.
  ctx.globalCompositeOperation = 'lighter';
  for (const [n, [x, y]] of [[354,613], [434,613], [715,615], [862,484], [1072,605]].entries()) {
    ctx.globalAlpha = 0.18 + 0.12 * Math.sin(time * 1.3 - n * 0.8);
    ctx.fillStyle = PHOTONIC_THEME.cyan;
    ctx.fillRect(x, y, 4, 1);
  }
  ctx.restore();
}
