import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { test } from 'vitest';

import { loadStarshipImage } from '../src/ductor/starshipImageLoader.js';
import { createInitialCrew, drawAgent, STATE } from '../src/ductor/starshipSimulation.js';

const dimensions = { width: 960, height: 336 };

test('every role and travel direction selects complete frames, including the original-sheet fallback', () => {
  const atlas = PNG.sync.read(readFileSync(new URL('../public/assets/themes/ductor-space-lab/crew-walk.png', import.meta.url)));
  const original = PNG.sync.read(readFileSync(new URL('../public/assets/themes/ductor-space-lab/starship-sheet.png', import.meta.url)));
  for (const walk of [atlas, undefined]) {
    for (const agent of createInitialCrew()) {
      agent.state = STATE.MOVING;
      agent.reportedState = 'idle';
      for (const facing of [-1, 1, 'front', 'back'] as const) {
        agent.facing = facing;
        for (let frame = 0; frame < 4; frame++) {
          agent.animFrame = frame;
          const draws: any[][] = [];
          const ctx = new Proxy({
            drawImage: (...args: any[]) => draws.push(args),
            measureText: () => ({ width: 60 }),
          }, { get: (target, key) => (target as any)[key] ?? (() => {}) });
          drawAgent(ctx as unknown as CanvasRenderingContext2D, agent, original as unknown as HTMLImageElement, 0, undefined, walk as unknown as HTMLImageElement | undefined);
          const [image, sx, sy, width, height] = draws[0]!;
          assert.equal(image, walk ?? original);
          assert.ok(sx >= 0 && sy >= 0 && sx + width <= image.width && sy + height <= image.height);
          let torso = 0;
          let legs = 0;
          for (let y = Math.ceil(height * 0.3); y < height * 0.95; y++) {
            for (let x = 0; x < width; x++) {
              const alpha = image.data[(Math.floor(sy + y) * image.width + Math.floor(sx + x)) * 4 + 3];
              if (alpha < 128) continue;
              if (y < height * 0.65) torso++;
              else legs++;
            }
          }
          assert.ok(torso > 150 && legs > 150, `${agent.name} ${facing} frame ${frame}: incomplete sprite`);
        }
      }
    }
  }
});

test('corrupt PNGs never become ready, even when their header reports a size', async () => {
  const image = {
    src: '', complete: true, naturalWidth: 960, naturalHeight: 336,
    decode: async () => { throw new Error('broken PNG data stream'); },
  } as unknown as HTMLImageElement;
  assert.equal(await loadStarshipImage(image, '/crew-walk.png', dimensions), false);
});

test('a sprite becomes ready only after full decoding, with the expected atlas dimensions', async () => {
  let finish!: () => void;
  const decoded = new Promise<void>((resolve) => { finish = resolve; });
  const image = {
    src: '', naturalWidth: 960, naturalHeight: 336, decode: () => decoded,
  } as unknown as HTMLImageElement;
  let ready = false;
  const loading = loadStarshipImage(image, '/crew-walk.png?v=2', dimensions).then((value) => {
    ready = value;
  });
  await Promise.resolve();
  assert.equal(ready, false);
  finish();
  await loading;
  assert.equal(ready, true);
  assert.equal(image.src, '/crew-walk.png?v=2');
  assert.equal(await loadStarshipImage(image, '/wrong-layout.png', { width: 320, height: 336 }), false);
});

test('the shipped walk PNG decodes with valid CRCs and all 36 frames contain complete bodies', () => {
  const bytes = readFileSync(new URL('../public/assets/themes/ductor-space-lab/crew-walk.png', import.meta.url));
  // pngjs verifies every chunk CRC and inflates all pixels, catching truncated
  // binary uploads that a PNG header/dimension check cannot detect.
  const png = PNG.sync.read(bytes, { checkCRC: true });
  assert.equal(png.width, dimensions.width);
  assert.equal(png.height, dimensions.height);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      let minY = 112;
      let maxY = -1;
      let torso = 0;
      let legs = 0;
      for (let y = 0; y < 112; y++) {
        for (let x = 0; x < 80; x++) {
          const alpha = png.data[((row * 112 + y) * png.width + col * 80 + x) * 4 + 3];
          if (alpha < 128) continue;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          if (y >= 35 && y < 70) torso++;
          if (y >= 70) legs++;
        }
      }
      assert.ok(maxY - minY > 80 && torso > 200 && legs > 150, `incomplete body at row ${row}, frame ${col}`);
    }
  }
});
