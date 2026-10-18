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
const DISH_CX = 309.5;
const DISH_CY = 66.0;
const ORBIT_Y_RATIO = 51.0 / 138.0; // 0.3695

interface PlanetConfig {
  id: string;
  r: number;
  startAngle: number;
  speed: number;
  floatZ: number;
  spriteSrc: string;
}

const PLANETS: readonly PlanetConfig[] = [
  {
    id: 'mercury',
    r: 25,
    startAngle: 4.40,
    speed: 0.65,
    floatZ: 4,
    spriteSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAB4ElEQVR4nO2UvW/TQBjG3/fOHykmHw54qVIJhaHFFBiCmJgaxMzi/A+IiYENyfGGYMzKzOA/oEu3bmyIoaJSxAJNQk0S9+z6gyQ+5CqWKqEGE0ACKT/ppDv57nmee313ACtW/A/gvP0dOOdo2zbNxqZpkrT9cZOs32g0xKeGsXbucy4zzGOCiNx89mS9vrn1nDG2M3ZP5PH45N3hh48vdvf23pomEMuCZJHOwjRZad687qxv1Ov7qlp+XKvVNmVJulZRy4/Uq8X927q+k5oYhkGXNmq3b57tRlgrtKtq5TpjfhzFUXJJUXgURt8QiCQWxA4AiLZtL70jRGzNdF2X/NOgSaiQeB4THcchsixjknApCAIex/ENVVG20kCL9H76IzVNI8PhSJxMphhGMQRBCL1+H8IwhMl0Bh7zUS4WC1m4i3SEBR6cc5MgWtG9xvZ7SukGIp34/qnU6w1Sk+ngyzEJo8gplSuH8zXJMkbQah2cJXQ91xoORw+rVVXyPZ+PXBeOjgbCsfMVBCpY3W6XAUB6GGYXaeW54Wl5k2bz/gM+g5dhGN1hzCPD0fiTQOirz/1+J5sDv8u5FwAVRbl1pVS6q2na5V8Im5/0niD+oEnzrsclH1Sclyo90itW/KN8B+yWvj1gG2GQAAAAAElFTkSuQmCC',
  },
  {
    id: 'venus',
    r: 43,
    startAngle: 2.70,
    speed: 0.35,
    floatZ: 5,
    spriteSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADEklEQVR4nO2UzWsUZxzHv88zu4lJ2oTUpEteGkkRCTkVCuJNTxKQQMEu0kIhPbS39CL0VJgs9C568h/wYHIQK4g9VQUrKNEGbIymttm8mWRfZudlZ3bmefnJbJe6B9lNiCkK+4WBeWaG3/fze37feYCWWmrpfRYBjAjs/zemWYOI+Os1MdM8mQAOGIaIGKuzmJ6eaDfN7zvrvzFN/Ae2G7G9mTOK75/dvfQViL62bHfcdsvJQsnLrm4Wbtye/+vyrVsPnBgik4F+awBUnTPh3vUfPxgZOHIl9fFHk1IRHNdHyfZQsFysbxXx+MnfS38sZr/89beFP03T5JlMRr8lAJPPzADfTaZ+GRrqO2NbnhBS8TCSzC2HsGyPtnO2XtssJH9/uLR2f2H5+MpKbpuxav2GELy5+azBWEZPne4/NzScOhOFSrS1JZPc4IbWmkspuIiEIYVMatJRT3fnJ92dHTOMgdLpdNMGefP+09W5K+gpLZWO08+4AcNIgPMEGOPx7wipNUQoEkJIAtHZ3t7enrm5OdVsl3nj7hEHT1+8ON1eqYTHSpbDXc9nnufD9yuohBGiSCH2lFIjUro6Fq2p73C38WmtTEOARPMdAKRM8FDohF+JqkZKK4ShgB+EcLwKbLtcDaTrVVByfJJKs7a2Q8ndAPBGL+M5xmk+f/5CUHLK60EoKQgj8gMBzw9hu0EcQOQtB7mig52cRTt5G1pTGUljtVZmfyE8VftmdT13bWvHYjt5RxdLHkpOANuNOw5QLJWRLzrIbuSVWw4YB+4sLma3avWpYZNoJkL19Jn5YeLD3r7UfKqv56iQKgojmfSDiNmuj1zBoRfZLbWylksopSUDnVh68fJRDUDtDwDx8frvoTL97cR4V9ehm10d7UfiALpegLzl0sbLIssXXUilBTfwzdPnm1cBGM3Mdw1QD/H52MjA4HD/T2EkvvD8cNDzAgSVyGac3SXSPy//s/1gt+Z7VgxRt+we7O/5bHQ0dXxsbGSg7nlsfqBi6XT6TSYxHN9zMewDpO7SzdLeUkstvbN6BYhsuneZZ9o2AAAAAElFTkSuQmCC',
  },
  {
    id: 'earth',
    r: 66,
    startAngle: 1.85,
    speed: 0.22,
    floatZ: 7,
    spriteSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAYAAACoYAD2AAAFN0lEQVR4nO2XWWwbRRjH/zO767VjJ7aTYCdN4txNj9D2hVIhSIMESIUiFahT9QVEeShSxSEVId7cPCHggb6AokZqkSiqFKNWReF6gCiiqEVF9EybkMY56lx2Eyfxru317s4gOwn0AQnn4JDwT1rtSLM789tvv/lmF8iTJ0+ePHnuh3NOAoEAzRwACP4zZKR6esQ/7fN3CUvC/yL+LmG5KRAgzuOekxcjjdcufVrJ+f3ia4vs6l9JgFO0E4ZtH9Seev/xQ1OadY86dauu2BhzXFcbtLHR6fH41EhvmTV2qvuzjkv8j/n4PyIZCHDa3k5YxYEzb7y+f2v7Y81lzpeOD4DLcRxk72FM80IrbsHErICBgUEk5iMdjsh3RycnJxOrEV1xvvj9XUJGsPJg8MPyMt/xHfVeZ+f5YWNiSmfeIpnbJcp9JMT31k6zt/ZVGs8+ZGcPFNNXFc+jX6GkqRAIkJUGh65UMBhsM498dOE1p6v8zakpRX+nM8R/6k+LNVua6WZrPxF5nOhUJmNjIQrDEFserKJPVk+nqwvCu+1O90mgnS2Jrr9kZpVmBH8eGvI115a+q8ZTpkW2i6K1mPiqG9Gw2YGB8ms46ytCT60dn1vGcSU2ANHqhK12u0UpjuqSfWG/xblx36IohHWXbG1tzV6rJslhTgvtC4rBS9xussHrQVWtF66qcUSNECIixQzVMSeY+GK4BxfCl7FgqDAtBRQWhRM5fXRpyJzzUlyBpJnJJcbYMyPhOU6JQG02GTbZCmcZMElD2Olqgq+gBlfCN3FHDWE2MYcvIz0QEoCRTlPAJIC5U3Y21WjzAyNLQcpEde2RzOwkhBBuf+W8Z0E1a+6G7xEKRkzTgK4lkZIAZT6EpyofQVvD03h50/Ooc/jAdBPEBJKpJEzDIFw3GAixcMq2LA2dU27mJEmOHcsO5is/V3T2xmjBzTBATAXxaARz6gyiChCPpSFwjriqwi0UYodrE5jOsqIwOFjaBEsbnPPMM3P3uksu43HoyaszZ9JK2ThoxUaoFhExUcJEOI35e1sxORdBOqViXlHgJHZIJoWR0sFSBsykATNlQqSUiJRl6mXOeZmbZHt7djAl1DIt6vEpV+lpFHi7ecrhxlxSRXQihJnpDbg4WI/Z+AxMTUUqoYKnWFYuK6loYGlOC2WZlbgsgyuRzHXhcH+XXwi2Hda3v93WC8lWb5XPM4Ok6Xz0CTDtHkhCwQ8jFNoUQ2OJijvREWhqHDxpwIjr0OMpUyBWahGFgbpKb3841J/zzpPz6g4GF89GTO8gzDikSzYUyBexq24bEhMz+PHXEGaTGr65ZeJ7KwUsVhC6GYIxACM2D1NjzCY7BIkIJ3p7ew1gtwhkzuuZk8Gg6ff7hb7Oc5c9o+qJHRNE3DIUTW8V+vHcw3bs2VkEYqqg+hzSM3eRujuC1JgOJewGiRHdBUGygNyoqijtWJy3N1PS/pYPDIJAgOzt7rYaJdLXDiHVQoqqjcbmViKaCj39bYiMjM/CQjL5N88NNcoJZaZLTkgy0aYlufTx0dHB27nWx9VKLt/DS5qaCuuLpU7CzAOkeDvqvS70DU2zq7cnucBVmFpcKLAApW4L0urML5rGXozFYn0rFVyt5O+imUZDQ8ULCUM6wkT3LhGmLa4mAWZmiiFzOiw3RZ76ZHh49GMA2moE1yKZvZdzgJBFWZ/PV0skqckqyyVc4IpVloauXb7et9y/WsF1we/Pfs2Qv6gga/opW88/Ogr4CXZHCDwejmAwE8HlI0+ePHny/N/5DRHlcUJ+fVXfAAAAAElFTkSuQmCC',
  },
  {
    id: 'mars',
    r: 88,
    startAngle: 5.25,
    speed: 0.15,
    floatZ: 6,
    spriteSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAhCAYAAABX5MJvAAAC3klEQVR4nO2Wv4sUWRDHv/Vez8zeiqwKs4KJBh6HgmBkcMlwCiIXmE2ysXBgeJdcNk7oP2BwJmaCgnCYGAg6BoKwBorr3iYieNwus+7Oj52entf9qkpebwtqMDvn7iLCfKGh6Vdd9emqevUamGqqqaYaL/ra9+7U66Z6uk3rr+d1qd3O/TRbLQag2G81GjDj1uuA3ddMaAOGmpBw/+rqxUvJibPn+7DH+r1u5/XLF88eLS3ff/im02sApoltuz2FaDRgmk3Ik8snT4uYm2TMz2osVAUpC972HRbb8duVbvrHk7XevZCRuwDvGYQWGXj864+nBkwtVlQTzzxXgR6MDDFE1xKPlW4WPV9PsNJPFv7pjG5PmpGx9f2oazlILXqf6q0NJ9V3cZqBYCNjI2vJWmOiijXRrCU+XLE6Q+bmoRkcLwB2jLGjwZ06bCjDg8V/LySMc+8Gqc8EpUwArwovQCYKDuEItmTAsyVzYJZKv00aY0eDaruWl2yQ0MWtVDRhzYOGa8SC2AviTDDwAicKUZACag2dL1zwriHW51v5vncqRxMW4k8ABpmg6xibjtFxjL5jxCzkWIigR2o1RMXcGNt7wWisltrbDlKWvkJVEUqgSFigaVhSJD5ACDYco+cYw4xhDQ0ft8C0DaC7bsygVOSpgVLwxyoY5lnwaCcea0PGapJhfcRoJ5lkqlomsxiMaxMMrx0hrrXymlI32brfz/xq2SLKRDhkIpQgQPw3zLAWe6zGqW6MPCwR2cj/Fd6fn2CMTzQn6sXg+f3M/OXImL/DM8fqYy+06Zg2ncfmyEvHeapYsiXC9eWe+7P4SNmziVkvQBZOHl6IyNywhLmO81gderwf+bxHyobwQ0TXl7s5gC0A9iYTX4L8NFc5cWR25srQRL/EHlUnshVl6fMy8a2Vzuhp4Xf/TtP6Z41GqDcaZWPMVzX7bmVq29v700wGuP99jH/rH6Oppprq+9AHcSuSpPQtc08AAAAASUVORK5CYII=',
  },
  {
    id: 'jupiter',
    r: 110,
    startAngle: 3.50,
    speed: 0.08,
    floatZ: 8,
    spriteSrc: 'data:image/png;base64,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',
  },
  {
    id: 'saturn',
    r: 128,
    startAngle: 0.20,
    speed: 0.05,
    floatZ: 7,
    spriteSrc: 'data:image/png;base64,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',
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

  // Pre-load the 6 celestial body sprites
  const loadedSprites = await Promise.all(
    PLANETS.map(async (p) => ({
      ...p,
      image: await loadImage(p.spriteSrc),
    })),
  );

  // Base canvas containing the clean table, glowing concentric orbits, and central Sun
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = WIDTH;
  baseCanvas.height = HEIGHT;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) throw new Error('2D context unavailable for Kevin base canvas');
  baseCtx.drawImage(baseImg, 0, 0);

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
      primitiveCount: 6,
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
      frameCtx.clearRect(0, 0, WIDTH, HEIGHT);
      frameCtx.drawImage(baseCanvas, 0, 0);

      const speedMult = working ? 1.4 : 1.0;

      // Compute 3D positions of all 6 orbiting planets
      const states = loadedSprites.map((p) => {
        const theta = p.startAngle + p.speed * timeSec * speedMult;
        const gx = DISH_CX + Math.cos(theta) * p.r;
        const gy = DISH_CY + Math.sin(theta) * (p.r * ORBIT_Y_RATIO);
        const normDepth = (gy - DISH_CY) / 51.0;
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

      // Render bodies behind the Sun (gy < DISH_CY - 10)
      const sunY = DISH_CY - 10;
      for (const s of states) {
        if (s.depth < sunY) {
          const iw = Math.round(s.image.naturalWidth * s.scale);
          const ih = Math.round(s.image.naturalHeight * s.scale);
          frameCtx.drawImage(
            s.image,
            Math.round(s.gx - iw / 2),
            Math.round(s.gy - ih / 2),
            iw,
            ih,
          );
        }
      }

      // Subtle organic breathing glow on the central Sun
      const sunBreath = 0.5 + 0.5 * Math.sin(timeSec * 2.5);
      const sunGlow = frameCtx.createRadialGradient(
        DISH_CX,
        sunY,
        4,
        DISH_CX,
        sunY,
        22,
      );
      sunGlow.addColorStop(0, 'rgba(255, 245, 180, ' + (0.28 + sunBreath * 0.10).toFixed(3) + ')');
      sunGlow.addColorStop(0.5, 'rgba(255, 175, 45, ' + (0.12 + sunBreath * 0.06).toFixed(3) + ')');
      sunGlow.addColorStop(1, 'rgba(255, 95, 0, 0)');
      frameCtx.fillStyle = sunGlow;
      frameCtx.beginPath();
      frameCtx.arc(DISH_CX, sunY, 22, 0, Math.PI * 2);
      frameCtx.fill();

      // Render bodies in front of the Sun (gy >= DISH_CY - 10)
      for (const s of states) {
        if (s.depth >= sunY) {
          const iw = Math.round(s.image.naturalWidth * s.scale);
          const ih = Math.round(s.image.naturalHeight * s.scale);
          frameCtx.drawImage(
            s.image,
            Math.round(s.gx - iw / 2),
            Math.round(s.gy - ih / 2),
            iw,
            ih,
          );
        }
      }

      return frameCanvas;
    },
  };
}
