export type KevinMotionLayerKind =
  | 'authored-static'
  | 'generated-static'
  | 'procedural-dynamic'
  | 'planet-dynamic';

export interface KevinMotionLayerAudit {
  id: string;
  kind: KevinMotionLayerKind;
  z: number;
  primitiveCount?: number;
  sourcePixelCount?: number;
  orbitRadius?: number;
  orbitPeriodSec?: number;
}

export type KevinPixelOwnerCategory =
  | 'map-base'
  | 'authored-detail'
  | 'sun'
  | 'haze'
  | 'dust'
  | 'star-grid'
  | 'navigation'
  | 'star-node'
  | 'guide-orbit'
  | 'planet-orbit'
  | 'planet'
  | 'transition';

export interface KevinPixelOwnerDefinition {
  id: string;
  parentId: string | null;
  category: KevinPixelOwnerCategory;
  subpart: string;
  dynamic: boolean;
  z: number;
  sourcePixelCount?: number;
  primitiveIndex?: number;
}

export interface KevinPixelOwnershipSnapshot {
  readonly width: 540;
  readonly height: 230;
  readonly timeSec: number;
  readonly working: boolean;
  readonly owners: readonly KevinPixelOwnerDefinition[];
  readonly primaryOwner: Uint16Array;
  readonly stackOffsets: Uint32Array;
  readonly stackOwnerIndices: Uint16Array;
  readonly mapMask: Uint8Array;
}

export function getKevinPixelOwnerStack(
  snapshot: KevinPixelOwnershipSnapshot,
  x: number,
  y: number,
): readonly KevinPixelOwnerDefinition[] {
  if (x < 0 || y < 0 || x >= snapshot.width || y >= snapshot.height) return [];
  const pixel = y * snapshot.width + x;
  const start = snapshot.stackOffsets[pixel]!;
  const end = snapshot.stackOffsets[pixel + 1]!;
  const owners: KevinPixelOwnerDefinition[] = [];
  for (let index = start; index < end; index += 1) {
    const owner = snapshot.owners[snapshot.stackOwnerIndices[index]!];
    if (owner) owners.push(owner);
  }
  return owners;
}

export interface KevinPixelMotion {
  readonly width: 540;
  readonly height: 230;
  readonly restDiffPixels: 0;
  readonly layerAudit: readonly KevinMotionLayerAudit[];
  buildPixelOwnership(
    timeSec: number,
    working: boolean,
  ): KevinPixelOwnershipSnapshot;
  render(timeSec: number, working: boolean): HTMLCanvasElement;
}

const WIDTH = 540;
const HEIGHT = 230;
const DISH_CX = 290.0;
const DISH_CY = 76.0;
const DISH_RX = 152.0;
const DISH_RY = 64.0;
const ORBIT_Y_RATIO = DISH_RY / DISH_RX; // 0.42105

const POLY_PERFECT: readonly (readonly [number, number])[] = [
  [130, 80], [138, 48], [152, 28], [175, 16], [210, 8],
  [253, 5], [300, 7], [337, 12], [365, 17], [385, 22],
  [405, 27], [420, 32], [435, 36], [443, 48], [448, 65],
  [447, 85], [440, 105], [425, 118], [395, 130], [347, 144],
  [270, 147], [196, 144], [160, 134], [145, 120], [134, 102],
];

interface PlanetConfig {
  id: string;
  r: number;
  startAngle: number;
  speed: number;
  color: string;
  dw: number;
  dh: number;
  spriteSrc: string;
}

const PLANETS: readonly PlanetConfig[] = [
  {
    id: 'mercury',
    r: 24,
    startAngle: 4.2,
    speed: 0.9,
    color: 'rgba(200, 220, 255,',
    dw: 12,
    dh: 11,
    spriteSrc:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAALCAYAAABLcGxfAAAB9ElEQVR42gXBz24SQQAH4N/O/gF2C6WFYEysqK3BmwnRS5+j1jcwMdFTjx42xJtJrQcfwcTY9NTYxEtPJtQLTQk1tE0xpVAKXRiWHViY3Z3B71Ns2yalUknO922T5QvvDg9+ve5Sf81Xk3DD2CULlB+/j1pfK5Wfvg0QBQAuDr+vymiyS71ZsVa7QNsZY2kxhsySASWRwlH16rhab2yWy+UG2bF30oFuHaRW1ootD5Ej78lQT2P9xQrWXz6S2SSipzmjGJ/Lg3w+n9YePIxvpSxZaDrjMJ7L65lBDdKPcHJ6h5ihEB5MSZdpoZlKFxLO7ZZmGtjo9LkUYqQ+e/IYhDyHwwLU2i6MhAmdM4wjqNZiVgY83NBYpGXrf85JNmvN6SREs09wOxBQtDgWlpcRi0L4jarSvXaV0TTMktNr2h94rqSD7lyNaZgyikUTMPQ5vM4ZdDAomjrve770J7M+MdXhHp0EpEmlYMJCIICeO4EbGWjddFGpnKFDA9GnI2Jo2NO4FdvmM+eVDKPCZe0k6g0JYYyTG8eB7wlpxS05pB2dT93zNCHbCgB8eP9mtf6vt8sDUQyMHLrDCDM2gKYKBL6DoXN1HInxpufxhmrbNvn46TM1Uwvf7ieF5w/aGTZyLH/G+Gzc++vS1hfXHb7lXNwBIP8B68Eax2BUywcAAAAASUVORK5CYII=',
  },
  {
    id: 'venus',
    r: 38,
    startAngle: 2.4,
    speed: 0.48,
    color: 'rgba(255, 225, 150,',
    dw: 16,
    dh: 15,
    spriteSrc:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAPCAYAAADtc08vAAADPUlEQVR42mXTz2scZRwH4M/3nXdmdmZ/zGY3m92sSUxWQqUQJAS8SA5CUVHEFExvkYC34iEXD57WvQgFkSJSPAZKEemhQTyVqmCo9WCMKaZJakiaX5tms9nJTnZ2d2bnfV8PgiA+/8NDAFAug1UqkADwyUfvTE+WnPk4p2kGUTQsExG06onrL//y5HTx68UflwGgDLAKIEkpEBFUaark3Jh7/WZeD+aC50faxdk5EjYhkAq6ZSCdc1ALbLHrabc//WZ1wd3ZaSoFIqXK7Nq1R+kPXis8KAp3cuvxhiLRkbm8zaTG6emWi1BKVSjY0krGWX6sRJvN2Orn369fWX80e04AsPTVh/cum+7Mwx9+DdMZyxgs2vD9EMlMAq1mBzzG4Z51EEYSgVBhtvii8edFcunjG99d1b6ozL9bMruVjZU/orVtXy9kDUBKkJIwYxzOYB+S2RR0A2ictlE9k1rcjqKEk7l8aeKV31mpj1/Xw4ayTUUDeQsDgzY0BrR9gTCMUHtWh1QciYwDJxODkzKRySUoznyVscV1nnP4VI7pxFSaZfu7YJxgmjGkchzn9RY008Th5gHGX51AfpSgW3V0gx7b2z8iT/WmmG1rKaeYQe6lIglSOD7wcFbzEYQCXjPA5m/76AYS8Wwa/SNFcIsjEpKkiCDCMMW1hOXpsV4uf2lcMalIRDs4OW6h026gfziDIFIYnyxh+/E63JqHmG1CI1IiFGTYhsePjxorAxS92Q2lJG5qoxOjKIz58LwQ2YKDkZeHsL/bwE/3tzA8nEQ8aSCIhGRmggkttsI398JbeQNvob2h6idtMCYBEDTdwF9rewi7PezuNtFpR3i6fQ6dMyidVHw4R6c9eYsAYLEyc+8Fqs8ErVoIbhrPtmrw3ACcAEGEdijhBRJuW6Db7YWDY0VD5YaWvrzz8KqmymX22fru/awTf8MChp6sHah6vSOJMWq2BfmBBDGoKJKyFSpKFwY4+vKrJxLvz84eBv9euDI75bw9UriZiLy5xmFVq1ZduBcBdA2w7Bh8MmE5juBO+vZzEV+4e/fBPxf+t3HhvWm75893L1rTURAWg14PvuBVD8Yyj5mLd779+T8b/wZ/to6FnUoM4QAAAABJRU5ErkJggg==',
  },
  {
    id: 'earth',
    r: 54,
    startAngle: 1.2,
    speed: 0.32,
    color: 'rgba(80, 200, 255,',
    dw: 18,
    dh: 18,
    spriteSrc:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAEcklEQVR42l3UXWxTZQDG8ec97+l3u67d1pZtHfvogMEYQdGBDFw0EkmILMEZCVHkSoI33nhHXNALE700mUFUDAYNq4o4Y3SJmiFQBwNhGxFW9tWedrRbe876cc5pz8frhSFRn/vfc/kneLTBQUqiUYMBsO0Z2Lf/8KEjG5tDu1xOW6MCgrVKNX17QYglr/9xPnnuo7F/zAhF9CUD/zkBAFtz5LXPL4x+OnOPfZ3KsrjK2OWEyE5PJtjoUpmdWZDYG+PTrPeTi6PYvD3yyAIAwdAQR06dMm07n9s98PbJS4f799a1iALTizlz7MYkN7vqJGFXGQFfgEmqy5yXSly5pYUky2Ju5ruRg+WR01fZ0BBHGGOEbNvb+uL77918vudJn2d+Wu9yCzxnSeLH6RJMNENIx5AquzGT9CFkcaDeoumr6yP8mtcmTp397HF2eWSRI4Sw/uOvDx99erdPjE3rIWOKV6X7MJQEujs0PPPYBvTt2o/5TBBWmcKqa5iYEfj8+K+6Iyf5ug7sHyaEMFp36OizA68ce6dBqJhVRabb1ntQz+tQuSpMRxt0g8fywxDqiBUNVoYbkzPQNA2qXOaWp++aPX29nZVw6xU+vOfpY2V4WUpIMGbo+OqWjJc7s7im9iB62wqHsYjE3fsQZ5fwMLMKC6/D5yFQ5BJgVBmXFlhT55ZjdMfxNz+Q0qb/l++vkrnUCplM6qjaRJieEPgyxVK8CGeNjoJYRNjvAKU6KKUgTAcxVKJqMrE2htxcyG0PGoU11Do4oioKWKGA6LUmTE7J2B5WsXtLPTJpAx6/A71929DW2galYsBi4cCBkWxSQDGfD/KpkoZqlSDgdcLCu5ArVtAa9iOeZvgiXUBPxIUDOw2E3Cbuzk2gxDEwnkeNwwWvRUE8IyGzpoNXVSWj8d72WSHHaj0O4ndZwWtltFiqsLud4BQT3a1u2GgtqgWgsHITYq2BxQcyKlKekUATqWpGhqdSNmYLrm9LE940cqtUXNFQ4wijwetEe6ML1GoinclgOZuFoRm481ccLmZgU9CJBzIzzTo/x/FcjMtcv3E2YJeJp9ZG7LyBLR1BRJp8kMsl6BUZnA4sz4v4/eoYfv5tFDUc4IUdUoGiwnhia42QilI6S7N/Tiys63tqZ1//ns77t+K6jWjcQiKFvFREtaqCMgU8caLd7YEoidDKGkoVOzh4dLWthxpNLT8VTp98l2eMEdK794Ttreab/q0bfMsTMd00KrxaNdBQS5DJyZhbTGGdtQi/pwFC1oCQkPWOHd087YiIaznhBBgj9BTAkS/PiRlVvVLfvelguL3D7TMUVpZEc3FxgZQKEhEEAfnlOHuQksyiGSS+3n5qbOjKFRKzLygXPpwCwFGMjzMMDlL1YnQpm89+a9/c1W4PBTZ6ahwczxOyIusI1HmQ571E8m3ifD3dhIWCPyTv3RmsXjpzB4ODFMPDJvl3kxCNGgDgHHh1X/vWJ44wSneticVGyhHA5kirqhwrJufOy998PPZ/8zf7cjprLC/I1QAAAABJRU5ErkJggg==',
  },
  {
    id: 'mars',
    r: 72,
    startAngle: 5.6,
    speed: 0.22,
    color: 'rgba(255, 110, 70,',
    dw: 15,
    dh: 15,
    spriteSrc:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAC7UlEQVR42k3TTWgcdRjH8d/z/OdlM7uzmyaGWBe3TQVRUBv1Jm3RGlAQD4IUpbSX4lEDgrfCukfBg1fxoi2eCp69GCkRwRewwUIq1jTbZNPuJrub7OzO7Mz/5fFQBO/f7/FDANBsNrnVajkA+PyTty4+XV+8VJuJl8N4vloUZtTd2ry11314ffXL9W8f9eBWC47+G18/0zi1+s7KVwt+cJ6GY+hkgp3EoasZRjRqVR8s+drt3Z0Pvvjuz61mE0wiQm++evLE1QsrPzVcUB/e37Zpb0hHg5SGFtQvRO5lJL+PSZ5pzKmFyHR2D3tnvv7+rzYTEX/09tlrz7FX7/66oauSqoqy/Fis6Pl6CS8verRcI14KrPpls6O7B9P6PIfXiMDqs9WV99546smP99b/sCG0l42mgAjgeQApdBOHn7sFjBMc80Ttj3MbkTk5XwvueC81jl/Ruz0hm2FmtgRQABAjnTjsjy3ujgRljxCzgfIE9zODwyMtxsoVriicHveGFFRCNsqDBcObCRCWfAQeIfIAR0BZAbnWiJXjJMtpkpvTbHMbG+dgwoBIBJ7HyHPBfqJBTHj2GGOOHfqFoADg4OhhmmNqJfZy65IZ5jBPCrFRSDq32NodgpXCA014IhTEvuC3gUGiBQwjIwOKAk68g0m+MVuJz0/7hy4tCjV1QHts4ZFB6gj3BhaREhxowd2RRUmM85nZV7yhlh6v6jSYffdgkInNUrba4Kiw6GQOhQhEHNoTg38SjakViNVSDsFRia8SAPXh+ys/9sf+2VF7R78Qab9ngM3EwjiHiAWTwqKfO4xzrcu+8RcqvN54cf81FhE32vv7ckCTTlGu+O0p7NRYF7EIO4tBWkhWFA4mt3Oh9Rer3CmV+fKNG3D8KRF9c7O9Pdq7c+5EebLGZaU4VBySIc9pVJSmiqf5eCyqXuO1KKRzNze62wCI/q8EAC68snTRGlwaZ3p5qk0VwIgZt5jp+g+3HzxSBXALcP8C1BKaSaNKHwoAAAAASUVORK5CYII=',
  },
  {
    id: 'jupiter',
    r: 94,
    startAngle: 3.6,
    speed: 0.12,
    color: 'rgba(245, 200, 140,',
    dw: 24,
    dh: 24,
    spriteSrc:
      'data:image/png;base64,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',
  },
  {
    id: 'saturn',
    r: 118,
    startAngle: 0.4,
    speed: 0.07,
    color: 'rgba(245, 225, 180,',
    dw: 34,
    dh: 22,
    spriteSrc:
      'data:image/png;base64,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',
  },
];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error(`Failed to load image within timeout: ${url.slice(0, 40)}`));
    }, 15000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Failed to load image: ${url.slice(0, 40)}`));
    };
    img.src = url;
  });
}

export async function loadKevinPixelMotion(
  assetUrl: string,
): Promise<KevinPixelMotion> {
  const baseImg = await loadImage(assetUrl);
  if (baseImg.naturalWidth !== WIDTH || baseImg.naturalHeight !== HEIGHT) {
    throw new Error(
      `Kevin V10 source must be ${WIDTH}x${HEIGHT}, got ${baseImg.naturalWidth}x${baseImg.naturalHeight}`,
    );
  }

  // Optional clean galaxy dish plate for dynamic movement frames
  const cleanPlateImg = await loadImage(
    assetUrl.replace('kevin-station.png', 'kevin-clean-plate.png'),
  ).catch(() => null);

  // Pre-load the 6 celestial body sprites
  const loadedSprites = await Promise.all(
    PLANETS.map(async (p) => ({
      ...p,
      image: await loadImage(p.spriteSrc),
    })),
  );

  // Base canvas containing the master rest pose
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = WIDTH;
  baseCanvas.height = HEIGHT;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) throw new Error('2D context unavailable for Kevin base canvas');
  baseCtx.drawImage(baseImg, 0, 0);

  // Clean plate canvas for motion
  const cleanPlateCanvas = document.createElement('canvas');
  cleanPlateCanvas.width = WIDTH;
  cleanPlateCanvas.height = HEIGHT;
  const cleanPlateCtx = cleanPlateCanvas.getContext('2d');
  if (cleanPlateCtx) {
    if (cleanPlateImg) {
      cleanPlateCtx.drawImage(cleanPlateImg, 0, 0);
    } else {
      cleanPlateCtx.drawImage(baseImg, 0, 0);
    }
  }

  // Runtime animation composite frame canvas
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = WIDTH;
  frameCanvas.height = HEIGHT;
  const frameCtx = frameCanvas.getContext('2d');
  if (!frameCtx) throw new Error('2D context unavailable for Kevin frame canvas');

  // Metadata audit
  const layerAudit: readonly KevinMotionLayerAudit[] = [
    {
      id: 'holographic_sun',
      kind: 'authored-static',
      z: 10,
    },
    {
      id: 'concentric_laser_orbits',
      kind: 'generated-static',
      z: 20,
      primitiveCount: 0,
    },
    ...PLANETS.map((p, idx): KevinMotionLayerAudit => ({
      id: p.id,
      kind: 'planet-dynamic',
      z: 100 + idx,
      orbitRadius: p.r,
      orbitPeriodSec: (Math.PI * 2) / p.speed,
    })),
  ];

  // Dummy ownership snapshot for inspector compatibility
  const dummyOwners: KevinPixelOwnerDefinition[] = [
    {
      id: 'kevin_station_base',
      parentId: null,
      category: 'map-base',
      subpart: 'table',
      dynamic: false,
      z: 0,
    },
  ];
  const totalPixels = WIDTH * HEIGHT;
  const dummyPrimary = new Uint16Array(totalPixels);
  const dummyOffsets = new Uint32Array(totalPixels + 1);
  const dummyStack = new Uint16Array(totalPixels);
  const dummyMask = new Uint8Array(totalPixels);

  return {
    width: WIDTH,
    height: HEIGHT,
    restDiffPixels: 0,
    layerAudit,

    buildPixelOwnership(
      timeSec: number,
      working: boolean,
    ): KevinPixelOwnershipSnapshot {
      return {
        width: WIDTH,
        height: HEIGHT,
        timeSec,
        working,
        owners: dummyOwners,
        primaryOwner: dummyPrimary,
        stackOffsets: dummyOffsets,
        stackOwnerIndices: dummyStack,
        mapMask: dummyMask,
      };
    },

    render(timeSec: number, working: boolean): HTMLCanvasElement {
      if (!working || timeSec === 0) {
        return baseCanvas;
      }

      frameCtx.clearRect(0, 0, WIDTH, HEIGHT);
      frameCtx.drawImage(cleanPlateCanvas, 0, 0);

      const speedMult = 1.35;

      // Strict polygon design boundary
      frameCtx.save();
      frameCtx.beginPath();
      frameCtx.moveTo(POLY_PERFECT[0]![0], POLY_PERFECT[0]![1]);
      for (let i = 1; i < POLY_PERFECT.length; i++) {
        frameCtx.lineTo(POLY_PERFECT[i]![0], POLY_PERFECT[i]![1]);
      }
      frameCtx.closePath();
      frameCtx.clip();

      // 1. Draw subtle cometary motion trail along orbital paths
      const trailLen = 0.35;
      const trailSteps = 8;
      for (const p of loadedSprites) {
        const theta = p.startAngle + p.speed * timeSec * speedMult;
        for (let s = 0; s < trailSteps; s++) {
          const frac = (s + 1) / trailSteps;
          const tt = theta - (1.0 - frac) * trailLen;
          const tx = DISH_CX + Math.cos(tt) * p.r;
          const ty = DISH_CY + Math.sin(tt) * (p.r * ORBIT_Y_RATIO);
          frameCtx.fillStyle = p.color + (frac * 0.42).toFixed(3) + ')';
          frameCtx.fillRect(Math.round(tx), Math.round(ty), 1, 1);
        }
      }

      // 2. Compute 3D positions
      const states = loadedSprites.map((p) => {
        const theta = p.startAngle + p.speed * timeSec * speedMult;
        const gx = DISH_CX + Math.cos(theta) * p.r;
        const gy = DISH_CY + Math.sin(theta) * (p.r * ORBIT_Y_RATIO);
        const normDepth = (gy - DISH_CY) / DISH_RY;
        const scale = 1.0 + normDepth * 0.12;

        return {
          ...p,
          gx,
          gy,
          depth: gy,
          scale,
        };
      });

      // Sort back-to-front (depth = gy)
      states.sort((a, b) => a.depth - b.depth);

      // Render bodies behind the Sun (gy < DISH_CY)
      for (const s of states) {
        if (s.depth < DISH_CY) {
          const iw = Math.round(s.dw * s.scale);
          const ih = Math.round(s.dh * s.scale);
          frameCtx.drawImage(
            s.image,
            Math.round(s.gx - iw / 2),
            Math.round(s.gy - ih / 2),
            iw,
            ih,
          );
        }
      }

      // Volumetric breathing solar corona in the center
      const sunBreath = 0.5 + 0.5 * Math.sin(timeSec * 2.8);
      const sunGlow = frameCtx.createRadialGradient(
        DISH_CX,
        DISH_CY,
        2,
        DISH_CX,
        DISH_CY,
        18 + sunBreath * 3,
      );
      sunGlow.addColorStop(0, 'rgba(255, 255, 240, 0.40)');
      sunGlow.addColorStop(0.3, 'rgba(255, 220, 110, ' + (0.25 + sunBreath * 0.08).toFixed(3) + ')');
      sunGlow.addColorStop(0.7, 'rgba(255, 140, 30, ' + (0.10 + sunBreath * 0.05).toFixed(3) + ')');
      sunGlow.addColorStop(1, 'rgba(255, 80, 0, 0)');
      frameCtx.fillStyle = sunGlow;
      frameCtx.beginPath();
      frameCtx.ellipse(
        DISH_CX,
        DISH_CY,
        20 + sunBreath * 2,
        10 + sunBreath * 1.5,
        0,
        0,
        Math.PI * 2,
      );
      frameCtx.fill();

      // Render bodies in front of the Sun (gy >= DISH_CY)
      for (const s of states) {
        if (s.depth >= DISH_CY) {
          const iw = Math.round(s.dw * s.scale);
          const ih = Math.round(s.dh * s.scale);
          frameCtx.drawImage(
            s.image,
            Math.round(s.gx - iw / 2),
            Math.round(s.gy - ih / 2),
            iw,
            ih,
          );
        }
      }

      frameCtx.restore();

      return frameCanvas;
    },
  };
}
