import { loadStarshipPixelScene, PIXEL_SCENE_MANIFEST } from './starshipPixelScene.js';
import type { StarshipPixelSceneLayer } from './starshipPixelScene.js';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = element<HTMLDivElement>('status');
const canvas = element<HTMLCanvasElement>('scene');
const ctx = canvas.getContext('2d')!;
const select = element<HTMLSelectElement>('layer');
let working = false, paused = false, time = 0, last = performance.now();
let crop: {x:number;y:number;w:number;h:number} | undefined;
const fields = ['x','y','scaleX','scaleY','rotation','z','tint','tintMix','amplitude','speed'] as const;

async function start() {
  const base = import.meta.env?.BASE_URL ?? './';
  const scene = await loadStarshipPixelScene(`${base}assets/${PIXEL_SCENE_MANIFEST}`);
  const originals = structuredClone(scene.manifest.layers);
  for(const l of scene.manifest.layers) select.add(new Option(l.id,l.id));
  select.value = 'command-desk';
  const selected = () => scene.manifest.layers.find(l=>l.id===select.value)!;
  const refresh = () => {
    const l = selected();
    for(const key of fields) {
      const input = element<HTMLInputElement>(key);
      const effectField = key==='amplitude'||key==='speed';
      input.value = String(effectField ? l.working?.[key] ?? 0 : l[key] ?? input.value);
      input.disabled = effectField && (!l.working || (key==='amplitude' && l.working.kind!=='light-column'));
    }
  };
  select.onchange=refresh; refresh();
  for(const key of fields) element<HTMLInputElement>(key).onchange=()=>{
    const input=element<HTMLInputElement>(key), l=selected();
    if(!input.checkValidity()) {refresh();return;}
    if(key==='tint') l.tint=input.value;
    else {const n=Number(input.value); if(!Number.isFinite(n)) return;
      if(key==='amplitude'||key==='speed') {if(l.working)l.working[key]=n;}
      else l[key]=n;
    }
  };
  function mode(active:boolean) {
    working=active; time=0;
    element('idle').setAttribute('aria-pressed',String(!active));element('working').setAttribute('aria-pressed',String(active));
    status.textContent=`${scene.manifest.layers.length} layers đã tải · ${active?'WORKING':'IDLE'} · renderer dùng chung với app`;
  }
  element('idle').onclick=()=>mode(false);element('working').onclick=()=>mode(true);mode(false);
  element('pause').onclick=()=>{paused=!paused;element('pause').textContent=paused?'Tiếp tục':'Tạm dừng';};
  element('focus').onclick=()=>{crop={x:340,y:265,w:680,h:320};canvas.width=1360;canvas.height=640;};
  element('all').onclick=()=>{crop=undefined;canvas.width=1926;canvas.height=816;};
  element('reset').onclick=()=>{Object.assign(selected(),structuredClone(originals.find(l=>l.id===select.value) as StarshipPixelSceneLayer));refresh();};
  element('save').onclick=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(scene.manifest,null,2)+'\n'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='scene.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  function frame(now:number) {
    if(!paused) time+=Math.min((now-last)/1000,0.1);last=now;
    scene.render(time,working);ctx.clearRect(0,0,canvas.width,canvas.height);
    if(crop)ctx.drawImage(scene.nativeArtwork,crop.x,crop.y,crop.w,crop.h,0,0,canvas.width,canvas.height);
    else ctx.drawImage(scene.nativeArtwork,0,0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
void start().catch((error:unknown)=>{status.dataset.error='true';status.textContent=`Không tải được scene: ${String(error)}`;console.error(error);});
