/** One native-pixel compositor shared by the live room and HTML scene editor. */
export const PIXEL_SCENE_MANIFEST = 'themes/ductor-space-lab/pixel-scene/scene.json';

export interface StarshipPixelSceneLayer {
  id: string;
  source: { x: number; y: number; w: number; h: number };
  x: number; y: number; z: number;
  scaleX: number; scaleY: number; rotation: number;
  opacity: number; visible: boolean;
  tint?: string; tintMix?: number;
  asset: string;
  group?: string;
  working?: {
    kind: 'light-column' | 'console';
    amplitude?: number;
    speed: number;
    phase: number;
    intensity: number;
  };
}
export interface StarshipPixelSceneManifest {
  format: string; version: number;
  width: number; height: number;
  layers: StarshipPixelSceneLayer[];
  [key: string]: unknown;
}
type Surface = HTMLCanvasElement | OffscreenCanvas;
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
interface Prepared {
  layer: StarshipPixelSceneLayer;
  original: Surface;
  sprite: Surface;
  effect: Surface;
  backing?: Surface;
  light?: Surface;
  tintKey?: string;
}
export interface StarshipPixelScene {
  readonly width: number;
  readonly height: number;
  readonly artwork: Surface;
  readonly nativeArtwork: Surface;
  readonly manifest: StarshipPixelSceneManifest;
  /** Composite every layer in native space, respecting the same z-order in both states. */
  render(timeSec: number, alecWorking: boolean): Surface;
}

const cache = new Map<string, Promise<StarshipPixelScene>>();
function canvas(w: number, h: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function context(c: Surface): Context {
  const ctx = c.getContext('2d') as Context | null;
  if (!ctx) throw new Error('Pixel scene requires a 2D canvas');
  return ctx;
}
function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    const timer = setTimeout(() => { i.onload = i.onerror = null; reject(new Error(`Image timed out: ${url}`)); }, 15000);
    i.onload = () => { clearTimeout(timer); resolve(i); };
    i.onerror = () => { clearTimeout(timer); reject(new Error(`Image failed: ${url}`)); };
    i.src = url;
  });
}
export function resolvePixelSceneUrl(path: string, base = document.baseURI): string {
  return new URL(path, base).href;
}
function validate(m: StarshipPixelSceneManifest): void {
  if (m.format !== 'space-lab-pixel-layers' || m.width !== 1926 || m.height !== 816 || !Array.isArray(m.layers) || !m.layers.length || m.layers.length > 300) {
    throw new Error('Invalid Space Lab scene manifest');
  }
  const ids = new Set<string>();
  for (const l of m.layers) {
    if (!l.id || ids.has(l.id) || !l.source || !/^(layers\/[\w.-]+\.png)$/.test(l.asset)) throw new Error(`Invalid layer: ${l.id}`);
    ids.add(l.id);
    if (![l.x,l.y,l.z,l.scaleX,l.scaleY,l.rotation,l.opacity,l.source.x,l.source.y,l.source.w,l.source.h].every(Number.isFinite) ||
        !Number.isInteger(l.source.w) || !Number.isInteger(l.source.h) || l.source.w < 1 || l.source.h < 1 || l.source.w > m.width || l.source.h > m.height ||
        l.scaleX <= 0 || l.scaleY <= 0 || l.opacity < 0 || l.opacity > 1 || typeof l.visible !== 'boolean') throw new Error(`Invalid transform: ${l.id}`);
    if (l.tint !== undefined && !/^#[\da-f]{6}$/i.test(l.tint)) throw new Error(`Invalid tint: ${l.id}`);
    if (l.tintMix !== undefined && (!Number.isFinite(l.tintMix) || l.tintMix < 0 || l.tintMix > 1)) throw new Error(`Invalid tint mix: ${l.id}`);
    if (l.working && (!['console','light-column'].includes(l.working.kind) || ![l.working.speed,l.working.phase,l.working.intensity,l.working.amplitude ?? 0].every(Number.isFinite))) throw new Error(`Invalid working effect: ${l.id}`);
  }
}

/** Separate luminous RGB residual from a row-wise estimated backing, never move an opaque crop.
 * This is an approximation of hidden pixels, not recovered ground truth. Idle uses the original.
 */
function splitLight(p: Prepared): void {
  const { w, h } = p.layer.source;
  const source = context(p.sprite).getImageData(0, 0, w, h);
  const backing = context(p.sprite).getImageData(0, 0, w, h);
  const light = context(p.sprite).getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const left = y * w * 4, right = (y * w + w - 1) * 4;
    const cyan = Math.max(0, Math.min(1, (Math.min(source.data[i+1],source.data[i+2]) - source.data[i] * 0.35 - 30) / 100));
    for (let c = 0; c < 3; c++) {
      const across = x / Math.max(1,w-1);
      const estimate = source.data[left+c]*(1-across) + source.data[right+c]*across;
      const residual = Math.round(Math.max(0, source.data[i+c] - estimate) * cyan);
      backing.data[i+c] = source.data[i+c] - residual;
      light.data[i+c] = residual;
    }
    // Black RGB has zero contribution under additive blending; original alpha keeps ownership.
  }
  p.backing = canvas(w,h); context(p.backing).putImageData(backing,0,0);
  p.light = canvas(w,h); context(p.light).putImageData(light,0,0);
}

function refreshTint(p: Prepared): void {
  const l = p.layer, key = `${l.tint}:${l.tintMix}:${l.working?.kind}`;
  if (p.tintKey === key) return;
  const {w,h} = l.source, ctx = context(p.sprite);
  ctx.clearRect(0,0,w,h); ctx.drawImage(p.original,0,0);
  if (l.tint && l.tintMix) {
    const data = ctx.getImageData(0,0,w,h), rgb = [1,3,5].map(i => parseInt(l.tint!.slice(i,i+2),16));
    for (let i=0;i<data.data.length;i+=4) for(let c=0;c<3;c++) data.data[i+c] = Math.round(data.data[i+c]*(1-l.tintMix)+rgb[c]*l.tintMix);
    ctx.putImageData(data,0,0);
  }
  if (l.working?.kind === 'light-column') splitLight(p);
  p.tintKey = key;
}

function drawPrepared(ctx: Context, p: Prepared, time: number, working: boolean): void {
  const l = p.layer, effect = l.working;
  if (!l.visible || !l.opacity) return;
  refreshTint(p);
  const {w,h} = l.source;
  ctx.save(); ctx.translate(l.x,l.y); ctx.rotate(l.rotation*Math.PI/180); ctx.scale(l.scaleX,l.scaleY); ctx.globalAlpha=l.opacity;
  if (!working || !effect) ctx.drawImage(p.sprite,0,0);
  else if (effect.kind === 'light-column' && p.backing && p.light) {
    ctx.drawImage(p.backing,0,0);
    ctx.globalCompositeOperation='lighter';
    const offset = Math.sin(time*effect.speed+effect.phase)*(effect.amplitude ?? 8);
    ctx.globalAlpha=l.opacity*(0.85+0.15*Math.sin(time*effect.speed+effect.phase));
    ctx.drawImage(p.light,0,offset);
  } else {
    // Modify the layer's source pixels in its own local coordinates, not stage coordinates.
    const e = context(p.effect); e.clearRect(0,0,w,h); e.drawImage(p.sprite,0,0);
    const pixels = e.getImageData(0,0,w,h), d=pixels.data;
    const scan = ((time*effect.speed+effect.phase)%1+1)%1;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const i=(y*w+x)*4;
      if(!d[i+3]) continue;
      const cyan = Math.max(0,Math.min(1,(Math.min(d[i+1],d[i+2])-d[i]*0.55-16)/70));
      const amber = Math.max(0,Math.min(1,(d[i]-d[i+2]-35)/100));
      const distance=Math.abs(x/w-scan);
      const sweep=Math.max(0,1-Math.min(distance,1-distance)/0.16);
      const pulse=0.5+0.5*Math.sin(time*3+effect.phase+x/w*5);
      const amount=Math.min(0.9,effect.intensity*(0.18+pulse*0.25+sweep*0.6));
      for(let c=0;c<3;c++) {
        const target=cyan >= amber ? [95,235,255][c] : [255,190,70][c];
        d[i+c]=Math.round(d[i+c]+(target-d[i+c])*Math.max(cyan,amber)*amount);
      }
    }
    e.putImageData(pixels,0,0); ctx.drawImage(p.effect,0,0);
  }
  ctx.restore();
}

async function build(url: string, manifest: StarshipPixelSceneManifest): Promise<StarshipPixelScene> {
  validate(manifest);
  const prepared = await Promise.all(manifest.layers.map(async layer => {
    const img = await image(new URL(layer.asset,url).href);
    const {w,h} = layer.source;
    if(img.naturalWidth!==w || img.naturalHeight!==h) throw new Error(`PNG size mismatch: ${layer.id}`);
    const original=canvas(w,h); context(original).drawImage(img,0,0);
    return {layer,original,sprite:canvas(w,h),effect:canvas(w,h)} as Prepared;
  }));
  const nativeArtwork=canvas(manifest.width,manifest.height), ctx=context(nativeArtwork);
  // Existing glass/occlusion samplers use 1600×678 source coordinates.
  const artwork=canvas(1600,678), world=context(artwork);
  let lastKey='';
  const render=(timeSec:number,working:boolean): Surface => {
    // 24 fps effect updates; agents retain their normal frame rate. Edits invalidate the cache.
    const tick=working?Math.floor(timeSec*24)/24:0;
    const key=JSON.stringify([working,tick,manifest.layers]);
    if(key===lastKey) return artwork;
    ctx.clearRect(0,0,manifest.width,manifest.height);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    for(const p of [...prepared].sort((a,b)=>a.layer.z-b.layer.z)) drawPrepared(ctx,p,tick,working);
    world.clearRect(0,0,1600,678); world.imageSmoothingEnabled=true; world.imageSmoothingQuality='high';
    world.drawImage(nativeArtwork,0,0,1600,678);
    lastKey=key; return artwork;
  };
  const scene={width:manifest.width,height:manifest.height,artwork,nativeArtwork,manifest,render}; render(0,false); return scene;
}

/** Reject visibly and evict failed loads so a retry can recover. */
export function loadStarshipPixelScene(manifestUrl: string): Promise<StarshipPixelScene> {
  const url=resolvePixelSceneUrl(manifestUrl);
  const old=cache.get(url); if(old) return old;
  const pending=fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(15000)}).then(async response=>{
    if(!response.ok) throw new Error(`Scene HTTP ${response.status}: ${url}`);
    // response.url also handles redirects and subpath deployments correctly.
    return build(response.url || url,await response.json() as StarshipPixelSceneManifest);
  }).catch((error:unknown)=>{cache.delete(url); throw error;});
  cache.set(url,pending); return pending;
}
