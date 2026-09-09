/** Benjamin's scanner uses the same room coordinates as its authored oval table. */
const TAU = Math.PI * 2;
export function getQAScanState(time: number) {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  const cycle = (t % 7) / 7;
  return { rotation: t * 0.65, scan: cycle, validated: cycle > 0.8,
    touch: (Math.sin(t * 3.2) + 1) / 2 };
}

/** Solid shaded facets make the rotating sample readable at room scale. */
export function drawQAExperiment(ctx: CanvasRenderingContext2D, time: number): void {
  const state = getQAScanState(time), x = 1048, y = 468;
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const beam = ctx.createLinearGradient(x, y - 35, x, 532);
  beam.addColorStop(0, '#58d8ef00'); beam.addColorStop(0.48, '#58d8ef18');
  beam.addColorStop(1, '#79e7f65c');
  ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x - 34, y - 36);
  ctx.lineTo(x + 34, y - 36); ctx.lineTo(x + 16, 530);
  ctx.quadraticCurveTo(x, 537, x - 16, 530); ctx.closePath(); ctx.fill();
  const glow = ctx.createRadialGradient(x, y, 6, x, y, 57);
  glow.addColorStop(0, '#4fd4ec28'); glow.addColorStop(1, '#4fd4ec00');
  ctx.fillStyle = glow; ctx.fillRect(x - 57, y - 57, 114, 114);
  const rings = [[-33, 4], [-17, 24], [13, 18], [31, 3]].map(([height, radius], ring) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = state.rotation + i * TAU / 6 + ring * 0.23;
      const z = Math.sin(a) * radius!;
      return { x: x + Math.cos(a) * radius!, y: y + height! + z * 0.23, z };
    }));
  const faces = rings.slice(0, -1).flatMap((ring, level) => ring.map((p, i) => {
    const j = (i + 1) % 6;
    const points = [p, ring[j]!, rings[level + 1]![j]!, rings[level + 1]![i]!];
    return { points, depth: points.reduce((sum, v) => sum + v.z, 0) / 4 };
  })).sort((a, b) => a.depth - b.depth);
  for (const { points, depth } of faces) {
    const light = Math.max(18, Math.min(72, 40 + depth * 1.4));
    ctx.fillStyle = `hsla(${state.validated ? 38 : 190},${state.validated ? 48 : 38}%,${light}%,0.86)`;
    ctx.strokeStyle = '#a9eef879'; ctx.lineWidth = 0.65;
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // A broad light sheet traverses the specimen; its cross-section contracts
  // towards the tips. This stays above the operator's head and status bubble.
  const scanY = y - 32 + state.scan * 63;
  const width = 5 + Math.sin(state.scan * Math.PI) * 24;
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = state.validated ? '#f3a64c45' : '#77e4f638';
  ctx.strokeStyle = state.validated ? '#ffd28a' : '#a8eff8'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.ellipse(x, scanY, width, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // Two compact spectral readouts sit beside the floating sample.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const amplitude = 3 + (Math.sin(time * 2.1 + i * 1.7 + side) + 1) * 5;
      ctx.fillStyle = i < Math.floor(state.scan * 7) ? '#9beef8b8' : '#3ba9bf55';
      ctx.fillRect(x + side * 38 - (side < 0 ? amplitude : 0), y - 20 + i * 5, amplitude, 1.5);
    }
  }
  // Feedback travels along the real table's rim, and turns green on completion.
  ctx.strokeStyle = state.validated ? '#e7bd88' : '#9bcfdf'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, 527, 68, 23, 0, Math.PI, Math.PI + state.scan * Math.PI); ctx.stroke();
  ctx.restore();
}

/** Foreground controls follow Benjamin's hands; no background is pasted over him. */
export function drawQAContact(ctx: CanvasRenderingContext2D, time: number, x: number, y: number, scale: number): void {
  const state = getQAScanState(time);
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.globalCompositeOperation = 'screen';
  for (const side of [-1, 1]) {
    const tap = side < 0 ? state.touch : 1 - state.touch;
    const handX = side * 22, handY = -43 - tap * 3;
    ctx.fillStyle = '#153b4788'; ctx.strokeStyle = '#86e8f7'; ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.45 + tap * 0.45;
    ctx.beginPath(); ctx.ellipse(handX, handY, 11, 4, -side * 0.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = tap * 0.7; ctx.strokeStyle = '#c4f7fc';
    ctx.beginPath(); ctx.ellipse(handX, handY, 3 + tap * 7, 1 + tap * 3, -side * 0.2, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#9cedf8'; ctx.fillRect(handX - 2, handY - 1, 4, 2);
    // Short packets climb from the hand controls towards the scan emitter.
    for (let i = 0; i < 3; i++) {
      const travel = (time * 0.65 + i / 3 + (side + 1) * 0.15) % 1;
      ctx.globalAlpha = Math.sin(travel * Math.PI) * 0.6;
      ctx.fillRect(handX + side * travel * 15, handY - travel * 27, 1.5, 2.5);
    }
  }
  ctx.restore();
}
