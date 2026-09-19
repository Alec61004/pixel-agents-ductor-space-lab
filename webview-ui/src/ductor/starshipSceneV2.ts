/**
 * V2 bridge material/lighting pass.
 *
 * The room geometry still comes from the authored 1600×678 scene so routing,
 * workstation anchors and all current animation logic remain stable. This pass
 * deliberately separates material, practical lights and local reflections so
 * the bridge can be rebuilt section-by-section without another global recolor.
 */

export interface BridgeActivity {
  command: boolean;
  navigation: boolean;
  qa: boolean;
}

const CYAN = '#91cbdc';
const AMBER = '#ddb381';
const AMBER_SOFT = '#f5dfbd';

function glowDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  radius: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(0.2, color);
  g.addColorStop(1, '#00000000');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

const amberPracticalLights = [
  [317,140],[352,218],[778,453],[833,285],[918,286],
  [921,423],[1295,453],[1315,536],[1378,441],[1409,441],
  [1514,522],[1557,214],[1562,625],
] as const;

const cyanPracticalLights = [
  [108,459],[172,475],[311,458],[348,469],[797,477],
  [1070,602],[1419,447],[1549,405],
] as const;

function clipFloor(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(300, 395);
  ctx.lineTo(738, 397);
  ctx.lineTo(844, 485);
  ctx.lineTo(1240, 500);
  ctx.lineTo(1595, 540);
  ctx.lineTo(1600, 678);
  ctx.lineTo(0, 678);
  ctx.lineTo(0, 584);
  ctx.lineTo(205, 515);
  ctx.closePath();
  ctx.clip();
}

/** Blue-black graphite, stronger floor depth and crisp metal separation. */
export function drawBridgeMaterialPass(ctx: CanvasRenderingContext2D, time: number): void {
  void time;
  ctx.save();

  // Darken only the deck, never the windows.
  ctx.save();
  clipFloor(ctx);
  const deck = ctx.createLinearGradient(0, 395, 0, 678);
  deck.addColorStop(0, 'rgba(15,18,24,0)');
  deck.addColorStop(0.55, 'rgba(15,18,24,0.035)');
  deck.addColorStop(1, 'rgba(10,13,18,0.10)');
  ctx.fillStyle = deck;
  ctx.fillRect(0, 390, 1600, 288);

  // Cool reflected metal band keeps the floor from becoming featureless black.
  ctx.globalCompositeOperation = 'screen';
  const floorSheen = ctx.createLinearGradient(0, 470, 0, 678);
  floorSheen.addColorStop(0, 'rgba(65,146,179,0)');
  floorSheen.addColorStop(0.68, 'rgba(65,146,179,0.030)');
  floorSheen.addColorStop(1, 'rgba(65,146,179,0.010)');
  ctx.fillStyle = floorSheen;
  ctx.fillRect(0, 440, 1600, 238);
  ctx.restore();

  // Structural seams and conduits are already authored at full resolution in
  // room V3. Re-stroking their former coordinates created obvious ghost lines.
  ctx.restore();
}

/** Practical lights and local reflections, drawn below agents but above scenery. */
export function drawBridgeLightPass(
  ctx: CanvasRenderingContext2D,
  time: number,
  activity: BridgeActivity,
): void {
  ctx.save();
  const pulse = 0.86 + Math.sin(time * 0.9) * 0.08;

  for (const [x, y] of amberPracticalLights) {
    glowDot(ctx, x, y, AMBER, 10, 0.055 * pulse);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.22 * pulse;
    ctx.fillStyle = AMBER_SOFT;
    ctx.fillRect(x - 1.5, y - 0.75, 3, 1.5);
    ctx.restore();
  }

  for (const [x, y] of cyanPracticalLights) {
    glowDot(ctx, x, y, CYAN, 8, 0.025 * pulse);
  }


  // Local station pools. These are deliberately elliptical reflections rather
  // than full-room bloom, matching the reference's hierarchy.
  const stations = [
    { x: 568, y: 582, rx: 105, ry: 54, color: '122,170,204', active: activity.navigation },
    { x: 1060, y: 587, rx: 120, ry: 45, color: '138,191,187', active: activity.qa },
  ];
  ctx.globalCompositeOperation = 'screen';
  for (const [index,s] of stations.entries()) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(s.rx, s.ry);
    const g = ctx.createRadialGradient(0,0,0,0,0,1);
    const alpha = (s.active ? 0.07 : 0.006) + Math.sin(time * 0.7 + index) * 0.004;
    g.addColorStop(0, `rgba(${s.color},${alpha})`);
    g.addColorStop(0.48, `rgba(${s.color},${alpha * 0.36})`);
    g.addColorStop(1, `rgba(${s.color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-1,-1,2,2);
    ctx.restore();
  }

  // Amber specimen reflections are a deliberate second color family.
  for (const [x,y,rx,ry] of [
    [357,600,58,24],
    [431,603,58,23],
    [873,438,78,28],
    [1361,483,39,16],
  ] as const) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(rx,ry);
    const g=ctx.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,'rgba(221,179,129,0.040)');
    g.addColorStop(0.45,'rgba(221,179,129,0.012)');
    g.addColorStop(1,'rgba(221,179,129,0)');
    ctx.fillStyle=g;
    ctx.fillRect(-1,-1,2,2);
    ctx.restore();
  }

  // A few crisp white-cyan speculars reproduce the target's polished metal.
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(193,244,250,0.14)';
  ctx.lineWidth = 0.7;
  for (const [x0,y0,x1,y1] of [
    [111,479,111,535],[531,90,584,90],[711,94,745,94],
    [1379,128,1434,128],[1497,153,1540,153],
  ] as const) {
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
  }

  ctx.restore();
}
