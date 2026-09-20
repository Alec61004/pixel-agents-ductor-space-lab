# Pixel scene and HTML editor

Open `/pixel-scene-editor.html` on the same dev server or built site. The editor is
a Vite multi-page entry, not an iframe inside the live-agent screen. It imports
the **same** `starshipPixelScene.ts` module and loads the **same** `scene.json` as
`StarshipLab`. It has Idle/Working, pause, desk zoom, numeric transforms, tint,
motion controls, group movement, undo/redo, JSON import/export and anchor preview.
No GitHub writes occur in the editor.

Export JSON, review its diff, then replace:
`webview-ui/public/assets/themes/ductor-space-lab/pixel-scene/scene.json`.
Rebuild/reload the app to apply the saved manifest. The standalone earlier ZIP is
not automatically updated by changes made in this repo.

## Coordinate contract

- Source and layer anchors use 1926×816 native pixels, origin top-left.
- `source` describes the immutable PNG crop; `x/y` are destination anchors.
- Rotation is in degrees about that anchor. `scaleX/scaleY` act locally.
- All static and animated pixels are composited in native space in manifest z-order.
- Only after composition is the result normalized to **1600×678**. Existing
  chair/glass/occlusion samplers require this size; do not pass them native artwork.
- The editor uses `nativeArtwork`. The app uses `render(time, active)`/`artwork`.
- The `alec-command-bay` group is anchored to `command-chair`. Its native delta is
  converted to the 1600×678 world and applied to Alec's approach point,
  interaction point, display bounds, occlusion and seated pose at scene load.
  Moving that group in the editor keeps the agent aligned after the exported
  manifest is installed.

## Alec working state

`drawStage` passes the existing seated/working predicate and `commandTime` into the
source compositor. Review also counts as working; idle, offline and walking to
the station do not. Other crew behavior is unchanged.

Seven layers have editable `working` metadata:

- `command-desk`, `hologram-left`, `hologram-right`: `kind: console`, with a
  source-pixel light sweep/pulse. Changes are restricted to the layer alpha and
  bright cyan/amber pixels. No stage-space rail or duplicate screens are drawn.
- Four `alec-column-*` layers: `kind: light-column`, `amplitude` in native pixels,
  `speed` in radians/second, and `phase` in radians. A luminous RGB residual moves
  additively; the opaque rectangular crop itself never moves.
- For `console`, `speed` is sweeps/second, `phase` is a sweep offset, `intensity`
  controls the color response. The effect is regenerated in local layer space.

Idle uses untouched source sprites and is byte-exact at native resolution. Working
columns use row-edge interpolation to estimate pixels hidden by the light. This
is **not** recovered ground-truth background or semantic segmentation. Ambient
glow outside the crop remains baked. Do not claim arbitrary movement is lossless.
The four former `alec-column-repair-*` PNG files are obsolete and removed; old
fixed-coordinate command-rail overlays are removed as well.

Effects update at 24 fps; agents retain their animation loop. Failed manifest or
PNG loads reject, evict the failed cache entry, and are reported by `StarshipLab`
in the console and bridge log before it shows the static fallback. A retry can
recover. Relative URLs are resolved against `document.baseURI` and layer URLs
against the fetched manifest's absolute URL.

## Verification

Browser regression script: `webview-ui/test/browser/starshipPixelScene.browser.cjs`.
Requires Node supporting `node:module.stripTypeScriptTypes` (tested Node 24),
`playwright`, and the existing `pngjs` dependency. Install Playwright in your test
environment and its Chromium browser; run from `webview-ui`:

```sh
node test/browser/starshipPixelScene.browser.cjs
```

Optionally set `PIXEL_SCENE_BROWSER` to a local Chromium executable and
`SCENE_QA_OUTPUT` to a result directory. Default results go to `.tmp/pixel-scene-qa`
at repo root. The script intercepts asset requests locally, runs the real renderer
and HTML editor, and checks relative/subpath URLs, idle equality, active-frame
differences, alpha coverage, return to idle, moved-layer alignment, failure/retry,
JSON export, mobile overflow and the real `drawStage` state handoff.

Recorded local Chromium result: idle RGBA exact; 65,959 changed pixels in working
frame vs idle; 65,006 changed pixels across two working frames; zero transparent
pixels and zero JS errors. Targeted strict TypeScript compilation also passes for
the edited app/renderer/editor modules and their dependency graph. These checks
do not establish that a deployed production site has pulled this branch.
