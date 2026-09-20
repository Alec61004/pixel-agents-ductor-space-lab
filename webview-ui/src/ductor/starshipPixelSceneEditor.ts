import { getPixelSceneGroupDelta, loadStarshipPixelScene, PIXEL_SCENE_MANIFEST } from './starshipPixelScene.js';
import type { StarshipPixelScene, StarshipPixelSceneManifest } from './starshipPixelScene.js';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = el<HTMLDivElement>('status');
const canvas = el<HTMLCanvasElement>('scene');
const ctx = canvas.getContext('2d')!;
const select = el<HTMLSelectElement>('layer');
const groupSelect = el<HTMLSelectElement>('group');
const undoButton = el<HTMLButtonElement>('undo');
const redoButton = el<HTMLButtonElement>('redo');
const fields = ['x','y','scaleX','scaleY','rotation','z','tint','tintMix','amplitude','speed'] as const;
type Snapshot = Pick<StarshipPixelSceneManifest, 'layers' | 'groups'>;
let working = false, paused = false, time = 0, last = performance.now();
let crop: {x:number;y:number;w:number;h:number} | undefined;

const clone = (scene: {manifest: StarshipPixelSceneManifest}): Snapshot => structuredClone({layers: scene.manifest.layers, groups: scene.manifest.groups});
function apply(scene: {manifest: StarshipPixelSceneManifest}, state: Snapshot): void {
  const saved = new Map(state.layers.map(layer => [layer.id, layer]));
  for (const layer of scene.manifest.layers) { const next = saved.get(layer.id); if (next) Object.assign(layer, structuredClone(next)); }
  scene.manifest.groups = structuredClone(state.groups);
}

async function start() {
  const scene = await loadStarshipPixelScene(`${import.meta.env?.BASE_URL ?? './'}assets/${PIXEL_SCENE_MANIFEST}`);
  const originals = clone(scene), undoStack: Snapshot[] = [], redoStack: Snapshot[] = [];
  const selected = () => scene.manifest.layers.find(layer => layer.id === select.value)!;
  const selectedGroup = () => scene.manifest.groups?.[groupSelect.value];
  const history = () => { undoButton.disabled = !undoStack.length; redoButton.disabled = !redoStack.length; };
  const checkpoint = () => { undoStack.push(clone(scene)); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0; history(); };
  const refresh = () => {
    const layer = selected();
    for (const key of fields) {
      const input = el<HTMLInputElement>(key), effect = key === 'amplitude' || key === 'speed';
      input.value = String(effect ? layer.working?.[key] ?? 0 : layer[key] ?? input.value);
      input.disabled = effect && (!layer.working || (key === 'amplitude' && layer.working.kind !== 'light-column'));
    }
    groupSelect.value = layer.group && scene.manifest.groups?.[layer.group] ? layer.group : '';
  };
  const refreshOptions = () => {
    const previous = select.value;
    select.replaceChildren(...scene.manifest.layers.map(layer => new Option(layer.id, layer.id)));
    select.value = scene.manifest.layers.some(layer => layer.id === previous) ? previous : scene.manifest.layers[0]?.id ?? '';
    groupSelect.replaceChildren(new Option('Không chọn nhóm', ''));
    for (const id of Object.keys(scene.manifest.groups ?? {})) groupSelect.add(new Option(id, id));
    refresh();
  };
  const message = (mode: string) => { status.dataset.error = 'false'; status.textContent = `${scene.manifest.layers.length} layers đã tải · ${mode} · renderer dùng chung với app`; };
  const setMode = (active: boolean) => { working = active; time = 0; el('idle').setAttribute('aria-pressed', String(!active)); el('working').setAttribute('aria-pressed', String(active)); message(active ? 'WORKING' : 'IDLE'); };
  function drawAnchor(): void {
    if (!el<HTMLInputElement>('anchors').checked) return;
    const group = scene.manifest.groups?.['alec-command-bay']; if (!group) return;
    const delta = getPixelSceneGroupDelta(scene.manifest, group.id);
    const nativeX = (552 + delta.x) * scene.manifest.width / 1600, nativeY = (450 + delta.y) * scene.manifest.height / 678;
    const sx = crop ? canvas.width / crop.w : 1, sy = crop ? canvas.height / crop.h : 1;
    const px = crop ? (nativeX - crop.x) * sx : nativeX, py = crop ? (nativeY - crop.y) * sy : nativeY;
    ctx.save(); ctx.strokeStyle = '#ffd166'; ctx.fillStyle = '#ffd166'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px - 12, py); ctx.lineTo(px + 12, py); ctx.moveTo(px, py - 12); ctx.lineTo(px, py + 12); ctx.stroke();
    ctx.font = 'bold 14px system-ui'; ctx.fillText('Alec interaction', px + 10, py - 10); ctx.restore();
  }
  for (const layer of scene.manifest.layers) select.add(new Option(layer.id, layer.id));
  for (const id of Object.keys(scene.manifest.groups ?? {})) groupSelect.add(new Option(id, id));
  select.value = 'command-desk'; refresh();
  select.onchange = refresh;
  groupSelect.onchange = () => { const group = selectedGroup(); if (group) select.value = group.anchorLayer; refresh(); };
  for (const key of fields) el<HTMLInputElement>(key).onchange = () => {
    const input = el<HTMLInputElement>(key), layer = selected(); if (!input.checkValidity()) { refresh(); return; }
    checkpoint();
    if (key === 'tint') layer.tint = input.value;
    else { const value = Number(input.value); if (!Number.isFinite(value)) { refresh(); return; } if (key === 'amplitude' || key === 'speed') { if (layer.working) layer.working[key] = value; } else layer[key] = value; }
  };
  el('moveGroup').onclick = () => { const group = selectedGroup(); if (!group) return; const dx = Number(el<HTMLInputElement>('groupDx').value) || 0, dy = Number(el<HTMLInputElement>('groupDy').value) || 0; if (!dx && !dy) return; checkpoint(); for (const layer of scene.manifest.layers) if (group.layerIds.includes(layer.id)) { layer.x += dx; layer.y += dy; } el<HTMLInputElement>('groupDx').value = ''; el<HTMLInputElement>('groupDy').value = ''; refresh(); message(working ? 'WORKING · đã dời nhóm' : 'IDLE · đã dời nhóm'); };
  el('idle').onclick = () => setMode(false); el('working').onclick = () => setMode(true); setMode(false);
  el('pause').onclick = () => { paused = !paused; el('pause').textContent = paused ? 'Tiếp tục' : 'Tạm dừng'; };
  el('focus').onclick = () => { crop = {x:340,y:265,w:680,h:320}; canvas.width = 1360; canvas.height = 640; };
  el('all').onclick = () => { crop = undefined; canvas.width = 1926; canvas.height = 816; };
  el('reset').onclick = () => { checkpoint(); const layer = originals.layers.find(item => item.id === select.value); if (layer) Object.assign(selected(), structuredClone(layer)); refresh(); };
  undoButton.onclick = () => { const state = undoStack.pop(); if (!state) return; redoStack.push(clone(scene)); apply(scene, state); refresh(); history(); };
  redoButton.onclick = () => { const state = redoStack.pop(); if (!state) return; undoStack.push(clone(scene)); apply(scene, state); refresh(); history(); };
  el<HTMLInputElement>('import').onchange = async event => { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; try { const incoming = JSON.parse(await file.text()) as StarshipPixelSceneManifest; if (!Array.isArray(incoming.layers) || incoming.layers.length !== scene.manifest.layers.length || incoming.layers.some(layer => !scene.manifest.layers.some(current => current.id === layer.id))) throw new Error('Manifest phải giữ nguyên danh sách layer gốc.'); checkpoint(); apply(scene, {layers: incoming.layers, groups: incoming.groups}); refreshOptions(); message('IDLE · đã nhập manifest'); } catch (error) { status.dataset.error = 'true'; status.textContent = `Không nhập được scene.json: ${String(error)}`; } };
  el('save').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(scene.manifest, null, 2) + '\n'], {type:'application/json'})); const a = document.createElement('a'); a.href = url; a.download = 'scene.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  function frame(now: number) { if (!paused) time += Math.min((now - last) / 1000, 0.1); last = now; scene.render(time, working); ctx.clearRect(0, 0, canvas.width, canvas.height); if (crop) ctx.drawImage(scene.nativeArtwork, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height); else ctx.drawImage(scene.nativeArtwork, 0, 0); drawAnchor(); requestAnimationFrame(frame); }
  history(); requestAnimationFrame(frame);
}
void start().catch((error: unknown) => { status.dataset.error = 'true'; status.textContent = `Không tải được scene: ${String(error)}`; console.error(error); });
