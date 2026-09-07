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

const CYAN = '#5fe0f4';
const CYAN_SOFT = '#9debf7';
const AMBER = '#f1a34d';
const AMBER_SOFT = '#ffd08a';
const NAVY = '#07151e';

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

function strokePath(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
  color: string,
  width: number,
  alpha: number,
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
  ctx.restore();
}

const upperConduits = [
  [[365,111],[418,92],[496,91],[540,58],[611,62],[654,94],[744,95]],
  [[1360,104],[1402,96],[1476,97],[1511,112]],
] as const;

const deckConduits = [
  [[38,640],[142,644],[170,607],[310,604]],
  [[462,627],[476,653],[456,677]],
  [[657,579],[687,625],[753,631],[785,676]],
  [[920,532],[974,587],[1070,602],[1174,580],[1300,574]],
  [[1390,613],[1452,654],[1568,635]],
] as const;

const amberPracticalLights = [
  [317,140],[352,218],[420,452],[445,453],[495,433],
  [626,450],[674,448],[778,453],[833,285],[918,286],
  [921,423],[1295,453],[1315,536],[1378,441],[1409,441],
  [1514,522],[1557,214],[1562,625],
] as const;

const cyanPracticalLights = [
  [108,459],[172,475],[311,458],[348,469],[548,452],
  [600,452],[713,468],[797,477],[1070,602],[1419,447],
  [1549,405],
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
  deck.addColorStop(0, 'rgba(4,15,22,0.03)');
  deck.addColorStop(0.55, 'rgba(4,15,22,0.10)');
  deck.addColorStop(1, 'rgba(2,9,14,0.24)');
  ctx.fillStyle = deck;
  ctx.fillRect(0, 390, 1600, 288);

  // Cool reflected metal band keeps the floor from becoming featureless black.
  ctx.globalCompositeOperation = 'screen';
  const floorSheen = ctx.createLinearGradient(0, 470, 0, 678);
  floorSheen.addColorStop(0, 'rgba(65,146,179,0)');
  floorSheen.addColorStop(0.68, 'rgba(65,146,179,0.045)');
  floorSheen.addColorStop(1, 'rgba(65,146,179,0.015)');
  ctx.fillStyle = floorSheen;
  ctx.fillRect(0, 440, 1600, 238);
  ctx.restore();

  // Side structures receive a subtle navy glaze, which moves the authored grey
  // toward the visual reference without painting over devices.
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(3,18,27,0.10)';
  ctx.fillRect(0, 100, 335, 470);
  ctx.fillRect(1290, 100, 310, 500);

  // Window frames get a cold inner edge rather than a broad neon outline.
  ctx.globalCompositeOperation = 'screen';
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = 'rgba(95,224,244,0.18)';
  for (const [x,y,w,h,r] of [
    [347,111,438,326,29],
    [850,106,458,353,30],
    [1321,110,262,347,26],
  ] as const) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  }

  // Upper hull practical conduits: thin cyan cores with dim broad halos.
  for (const path of upperConduits) {
    strokePath(ctx, path, CYAN, 4.0, 0.035);
    strokePath(ctx, path, CYAN_SOFT, 1.0, 0.30);
  }

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

  // Persistent cyan power rails make the room read as an active spacecraft.
  for (const path of deckConduits) {
    strokePath(ctx, path, CYAN, 3.2, 0.035);
    strokePath(ctx, path, CYAN_SOFT, 0.75, 0.24);
  }

  for (const [x,y] of amberPracticalLights) {
    glowDot(ctx, x, y, AMBER, 8, 0.12 * pulse);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.62 * pulse;
    ctx.fillStyle = AMBER_SOFT;
    ctx.fillRect(x - 1.5, y - 0.75, 3, 1.5);
    ctx.restore();
  }

  for (const [x,y] of cyanPracticalLights) {
    glowDot(ctx, x, y, CYAN, 9, 0.09 * pulse);
  }

  // Local station pools. These are deliberately elliptical reflections rather
  // than full-room bloom, matching the reference's hierarchy.
  const stations = [
    { x: 560, y: 426, rx: 185, ry: 58, color: '73,208,236', active: activity.command },
    { x: 568, y: 582, rx: 105, ry: 54, color: '77,195,238', active: activity.navigation },
    { x: 1060, y: 587, rx: 120, ry: 45, color: '78,202,232', active: activity.qa },
  ];
  ctx.globalCompositeOperation = 'screen';
  for (const [index,s] of stations.entries()) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(s.rx, s.ry);
    const g = ctx.createRadialGradient(0,0,0,0,0,1);
    const alpha = (s.active ? 0.10 : 0.035) + Math.sin(time * 0.7 + index) * 0.006;
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
    g.addColorStop(0,'rgba(241,163,77,0.105)');
    g.addColorStop(0.45,'rgba(241,163,77,0.035)');
    g.addColorStop(1,'rgba(241,163,77,0)');
    ctx.fillStyle=g;
    ctx.fillRect(-1,-1,2,2);
    ctx.restore();
  }

  // A few crisp white-cyan speculars reproduce the target's polished metal.
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(193,244,250,0.34)';
  ctx.lineWidth = 0.7;
  for (const [x0,y0,x1,y1] of [
    [111,479,111,535],[531,90,584,90],[711,94,745,94],
    [1379,128,1434,128],[1497,153,1540,153],
  ] as const) {
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
  }

  ctx.restore();
}
