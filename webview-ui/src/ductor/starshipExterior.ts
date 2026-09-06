import type { RoomArtwork } from './starshipLivingRoom.js';

// Exterior-only animation in world coordinates. The original room remains the
// foreground; window masks also exclude instruments, tanks and their frames.
type Point = { x: number; y: number };
const WINDOWS = [
  [[400, 132], [743, 132], [777, 154], [777, 294], [754, 312], [400, 312], [385, 292], [385, 152]],
  [[834, 178], [879, 136], [1207, 136], [1254, 178], [1254, 477], [834, 477]],
  [[1346, 141], [1513, 141], [1497, 165], [1497, 427], [1330, 427], [1312, 413], [1312, 172]],
] as const;
const FOREGROUND = [
  [395, 153, 142, 148], // weapon rack
  [902, 129, 311, 77], // overhead science displays
  [819, 239, 117, 240], // specimen cylinder and projector stem
  [1218, 225, 70, 180], // angled navigation display
  [1229, 446, 51, 44], // plant at the window sill
] as const;

const LIVING_FOREGROUND = [
  [815, 232, 123, 280], // living specimen chamber and its crystal fin
  [1240, 265, 54, 177], // broad structural rib between windows
  [1260, 411, 62, 87], // bioluminescent growth on the sill
  [1390, 402, 142, 90], // research ribbon glass
] as const;

function clipExterior(ctx: CanvasRenderingContext2D, livingRoom: boolean) {
  ctx.beginPath();
  for (const polygon of WINDOWS) {
    ctx.moveTo(polygon[0][0], polygon[0][1]);
    for (const [x, y] of polygon.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
  }
  ctx.clip();
  ctx.beginPath();
  ctx.rect(0, 0, 1600, 678);
  for (const [x, y, w, h] of livingRoom ? LIVING_FOREGROUND : FOREGROUND) ctx.rect(x, y, w, h);
  ctx.clip('evenodd');
}

const wrap = (value: number, range: number) => ((value % range) + range) % range;
const STARS = Array.from({ length: 140 }, (_, i) => ({
  x: wrap(Math.sin(i * 72.19) * 41987, 1140),
  y: wrap(Math.sin(i * 37.31 + 8) * 28913, 335),
  depth: 0.25 + (i % 5) * 0.18,
}));

export function getExteriorShip(time: number, index: number) {
  return {
    x: 382 + wrap(170 + index * 257 - time * (4 + index * 1.7), 1140),
    y: 187 + index * 38 + Math.sin(time * 0.12 + index) * 5,
    scale: 0.65 + index * 0.17,
  };
}

export function getAccretionParticle(time: number, index: number): Point & { radius: number } {
  // Material accelerates around the centre as it drifts inward, then fades
  // before its loop resets. This is an artistic orbit, not a physics solver.
  const age = wrap(time * 0.045 + index * 0.61803398875, 1);
  const radius = 165 * (1 - age) + 29;
  const angle = index * 2.39996 + time * 0.13 + age * 8;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * 0.44;
  return {
    x: 1045 + x * 0.969 - y * 0.247,
    y: 329 + x * 0.247 + y * 0.969,
    radius,
  };
}

type ShipAsset = { x: number; y: number; clean: OffscreenCanvas; sprite: OffscreenCanvas };
const SHIP_REGIONS = [[563, 192, 53, 28], [612, 205, 57, 28], [538, 221, 27, 17]] as const;
const shipCache = new WeakMap<RoomArtwork, ShipAsset[] | null>();

function getShipAssets(bg: RoomArtwork): ShipAsset[] | null {
  if (shipCache.has(bg)) return shipCache.get(bg)!;
  if (typeof OffscreenCanvas === 'undefined') return null;
  try {
    const assets = SHIP_REGIONS.map(([x, y, width, height]) => {
      const clean = new OffscreenCanvas(width, height);
      const sprite = new OffscreenCanvas(width, height);
      const ctx = clean.getContext('2d')!;
      const spriteCtx = sprite.getContext('2d')!;
      ctx.drawImage(bg, x, y, width, height, 0, 0, width, height);
      const original = ctx.getImageData(0, 0, width, height);
      const ship = spriteCtx.createImageData(width, height);
      const source = new Uint8ClampedArray(original.data);
      const mask = new Uint8Array(width * height);
      for (let p = 0; p < original.data.length; p += 4) {
        // Extract the actual painted silhouettes, not a rectangle of space.
        const px = (p / 4) % width;
        const py = Math.floor(p / 4 / width);
        let silhouette = false;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (px + dx < 0 || px + dx >= width || py + dy < 0 || py + dy >= height) continue;
            const q = ((py + dy) * width + px + dx) * 4;
            if (source[q]! < 28 && source[q + 1]! < 25 && source[q + 2]! < 36) silhouette = true;
          }
        }
        if (silhouette) {
          mask[p / 4] = 1;
          ship.data.set(source.subarray(p, p + 4), p);
        }
      }
      // Reconstruct only silhouette pixels from their immediate unmasked sky,
      // leaving every surrounding star untouched (no rectangular sky patches).
      for (let pixel = 0; pixel < mask.length; pixel++) {
        if (!mask[pixel]) continue;
        const px = pixel % width, py = Math.floor(pixel / width);
        const color = [0, 0, 0];
        let weight = 0;
        for (let sy = 0; sy < height; sy += 2) {
          for (let sx = 0; sx < width; sx += 2) {
            const neighbor = sy * width + sx;
            if (mask[neighbor]) continue;
            const w = 1 / (1 + (sx - px) ** 2 + (sy - py) ** 2);
            for (let channel = 0; channel < 3; channel++) color[channel]! += source[neighbor * 4 + channel]! * w;
            weight += w;
          }
        }
        if (weight > 0) {
          for (let channel = 0; channel < 3; channel++) original.data[pixel * 4 + channel] = Math.round(color[channel]! / weight);
        }
      }
      ctx.putImageData(original, 0, 0);
      spriteCtx.putImageData(ship, 0, 0);
      return { x, y, clean, sprite };
    });
    shipCache.set(bg, assets);
    return assets;
  } catch {
    // Background overrides may be cross-origin: retain the original artwork.
    shipCache.set(bg, null);
    return null;
  }
}

const diskCache = new WeakMap<RoomArtwork, OffscreenCanvas | null>();

function getDiskTexture(bg: RoomArtwork) {
  if (diskCache.has(bg)) return diskCache.get(bg)!;
  if (typeof OffscreenCanvas === 'undefined') return null;
  try {
    const source = new OffscreenCanvas(1600, 678);
    const sourceCtx = source.getContext('2d')!;
    sourceCtx.drawImage(bg, 0, 0, 1600, 678);
    const pixels = sourceCtx.getImageData(0, 0, 1600, 678).data;
    const disk = new OffscreenCanvas(384, 384);
    const diskCtx = disk.getContext('2d')!;
    const texture = diskCtx.createImageData(384, 384);
    // Unproject the existing painted nebula into its disk plane once, so its
    // own pixel texture can rotate without moving the windows or instruments.
    for (let y = 0; y < 384; y++) {
      for (let x = 0; x < 384; x++) {
        const u = x - 192, v = (y - 192) * 0.44;
        const radius = Math.hypot(x - 192, y - 192);
        if (radius > 191) continue;
        let sx = 1045 + u * 0.969 - v * 0.247;
        let sy = 329 + u * 0.247 + v * 0.969;
        // Fill the part hidden behind the tank from the visible opposite side.
        // Sampling is confined to sky, excluding the foreground and moon.
        if (sx < 937) sx = 2090 - sx;
        if (sx > 1215) sx = 2430 - sx;
        if (sx > 1164 && sy < 282) sy = 564 - sy;
        const from = (Math.round(sy) * 1600 + Math.round(sx)) * 4;
        const to = (y * 384 + x) * 4;
        texture.data.set(pixels.subarray(from, from + 3), to);
        texture.data[to + 3] = Math.round(Math.min(1, (191 - radius) / 23) * 255);
      }
    }
    diskCtx.putImageData(texture, 0, 0);
    diskCache.set(bg, disk);
    return disk;
  } catch {
    diskCache.set(bg, null);
    return null;
  }
}

function drawAccretionFlow(ctx: CanvasRenderingContext2D, bg: RoomArtwork, time: number) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Keep all accretion effects within the existing painted nebula.
  ctx.beginPath();
  ctx.ellipse(1045, 329, 196, 94, 0.25, 0, Math.PI * 2);
  ctx.clip();
  const texture = getDiskTexture(bg);
  if (texture) {
    ctx.save();
    ctx.translate(1045, 329);
    ctx.transform(0.969, 0.247, -0.247 * 0.44, 0.969 * 0.44, 0, 0);
    ctx.rotate(time * 0.075);
    ctx.drawImage(texture, -192, -192);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'screen';
  // Short, uneven luminous streams follow the original tilted disk. Avoid
  // solid concentric UI rings, and let the purple painted texture show through.
  for (let i = 0; i < 110; i++) {
    const head = getAccretionParticle(time, i);
    const edgeFade = Math.min(1, (194 - head.radius) / 20, (head.radius - 29) / 12);
    ctx.globalAlpha = Math.max(0, edgeFade) * (0.13 + (i % 4) * 0.055);
    ctx.strokeStyle = i % 5 === 0 ? '#b6f4ff' : i % 2 ? '#9876f2' : '#64bada';
    ctx.lineWidth = i % 4 === 0 ? 2 : 1;
    ctx.beginPath();
    for (let segment = 0; segment < 7; segment++) {
      const p = getAccretionParticle(time - segment * 0.12, i);
      if (segment === 0) ctx.moveTo(Math.round(p.x), Math.round(p.y));
      else ctx.lineTo(Math.round(p.x), Math.round(p.y));
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  // A dark central shadow replaces the static white hub; a softly luminous
  // inner edge remains around it, inspired by accretion-disk visualizations.
  const shadow = ctx.createRadialGradient(1045, 323, 13, 1045, 323, 40);
  shadow.addColorStop(0, '#070616');
  shadow.addColorStop(0.55, '#08081cff');
  shadow.addColorStop(0.72, '#172443d0');
  shadow.addColorStop(0.9, '#42769828');
  shadow.addColorStop(1, '#42769800');
  ctx.globalAlpha = 1;
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(1045, 323, 43, 29, 0.25, 0, Math.PI * 2);
  ctx.fill();
  // Uneven inner wisps rotate faster than the outer flow, not the room itself.
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) {
    const angle = i * 1.71 + time * 0.85;
    ctx.globalAlpha = 0.16 + (Math.sin(angle) + 1) * 0.13;
    ctx.strokeStyle = i % 3 ? '#85e0f6' : '#dcc5ff';
    ctx.lineWidth = 1.2 + (i % 3) * 0.45;
    ctx.beginPath();
    ctx.ellipse(1045, 323, 43 + i % 3, 27 + i % 2, 0.25, angle, angle + 0.35 + (i % 3) * 0.19);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStarshipExterior(ctx: CanvasRenderingContext2D, bg: RoomArtwork, time: number, livingRoom = false, shipSource: RoomArtwork = bg) {
  if (!Number.isFinite(time)) return;
  ctx.save();
  clipExterior(ctx, livingRoom);
  ctx.imageSmoothingEnabled = false;
  // The new room has clean sky. Reuse original spacecraft sprites without
  // painting their old background reconstruction patches onto the new scene.
  const ships = getShipAssets(shipSource);
  if (ships && !livingRoom) {
    for (const asset of ships) ctx.drawImage(asset.clean, asset.x, asset.y);
  }
  // Parallax: nearby stars pass faster and leave brief, faint streaks. They all
  // move consistently across the windows so the bridge feels in flight.
  for (let i = 0; i < STARS.length; i++) {
    const star = STARS[i]!;
    const x = 380 + wrap(star.x - time * (2 + star.depth * 8), 1140);
    const y = 140 + star.y;
    ctx.globalAlpha = (0.12 + star.depth * 0.27) * (0.85 + Math.sin(time + i) * 0.15);
    ctx.fillStyle = i % 7 === 0 ? '#d4c4f5' : '#b8deef';
    ctx.fillRect(Math.round(x), Math.round(y), star.depth > 0.8 ? 2 : 1, 1);
    if (star.depth > 0.7) {
      ctx.globalAlpha *= 0.25;
      ctx.fillRect(Math.round(x) + 2, Math.round(y), 5, 1);
    }
  }
  drawAccretionFlow(ctx, bg, time);
  if (ships) {
    for (let index = 0; index < 4; index++) {
      const asset = ships[index % ships.length]!;
      const ship = getExteriorShip(time, index);
      ctx.globalAlpha = 0.9;
      const width = asset.sprite.width * ship.scale;
      const height = asset.sprite.height * ship.scale;
      // Small exhaust fades behind each silhouette, at its own depth/speed.
      const exhaust = ctx.createLinearGradient(ship.x + width - 2, 0, ship.x + width + 15 * ship.scale, 0);
      exhaust.addColorStop(0, '#81d9f0b0');
      exhaust.addColorStop(1, '#81d9f000');
      ctx.fillStyle = exhaust;
      ctx.fillRect(ship.x + width - 2, ship.y + height * 0.5, 17 * ship.scale, 2 * ship.scale);
      ctx.drawImage(asset.sprite, Math.round(ship.x), Math.round(ship.y), width, height);
    }
  }
  ctx.restore();
}
