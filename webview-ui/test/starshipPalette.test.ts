import assert from 'node:assert/strict';
import { test } from 'vitest';
import { gradeResearchRoom, prepareResearchPalette } from '../src/ductor/starshipPalette.js';

test('scenery grading preserves transparency and readable dark surfaces', () => {
  const pixels = new Uint8ClampedArray([40, 90, 100, 0, 18, 21, 25, 255]);
  const before = pixels.slice();
  gradeResearchRoom(pixels, 2, 1);
  assert.deepEqual(pixels.slice(0, 4), before.slice(0, 4));
  assert.equal(pixels[7], 255);
  const luminance = (p: Uint8ClampedArray) => p[4]! * 0.2126 + p[5]! * 0.7152 + p[6]! * 0.0722;
  assert.ok(luminance(pixels) >= luminance(before), 'dark metal should not be crushed');
});

test('power only raises workstation emission; it does not expose windows or hull', () => {
  const w = 160, h = 68;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const offset = (x: number, y: number) => (Math.floor(y / 678 * h) * w + Math.floor(x / 1600 * w)) * 4;
  const locations = [[550,350], [570,530], [1050,540], [1100,300], [200,580]];
  for (const [x,y] of locations) pixels.set([65,220,211,255], offset(x!,y!));
  const idle = pixels.slice(), active = pixels.slice();
  gradeResearchRoom(idle,w,h); gradeResearchRoom(active,w,h,true);
  for (let i = 0; i < locations.length; i++) {
    const [x,y] = locations[i]!; const p = offset(x!,y!);
    if (i < 3) assert.ok(active[p]! + active[p+1]! + active[p+2]! > idle[p]! + idle[p+1]! + idle[p+2]!);
    else assert.deepEqual(active.slice(p,p+4),idle.slice(p,p+4));
  }
  const command = offset(550,350), navigation = offset(570,530);
  assert.ok(idle[command+2]! > idle[command]!, 'command reads cool cyan');
  assert.ok(idle[navigation+2]! > idle[navigation]!, 'navigation reads cool blue');
});

test('non-readable custom artwork keeps its original pixels', () => {
  let writes = 0;
  const context = { getImageData() { throw new Error('tainted canvas'); }, putImageData() { writes++; } };
  assert.doesNotThrow(() => prepareResearchPalette({} as HTMLCanvasElement, context as unknown as CanvasRenderingContext2D));
  assert.equal(writes,0);
});
