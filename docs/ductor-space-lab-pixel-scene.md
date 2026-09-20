# Agent editing contract

## Coordinates and ownership

- Native canvas: 1926×816. Origin top-left, X right, Y down; units pixels.
- `source` is immutable crop metadata; `x,y` are the destination top-left anchor.
- `rotation` in degrees about that anchor; `scaleX,scaleY` then transform local pixels.
- Default masks partition the source; drawing all layers reconstructs the reference.
- No original full image is drawn underneath. Moving pixels leaves real transparent gaps.
- Regions are manually traced, not exact semantic instance segmentation.
- A group is only a movement convenience. It is not a hierarchy; inspect member IDs.

## Edit source with no browser

Edit `scene.json` (`layers` array). Example: find `alec-column-center`, increase its `x`
by 20. Leave `source.x` unchanged. Run `node assemble.cjs` to refresh the embedded HTML.
The column PNG really moves. If other pixels of its glow belong to nearby layers,
refine those masks first instead of claiming the whole glow moves automatically.

Set `tint` to `#ffb060` and `tintMix` to `0.3` for a 30% RGB blend; use `1` for solid RGB.
Use `group` to identify related pieces. Main specimen tank parts share `specimen-tank`;
the four command light columns share `alec-columns`.

Use `layers/*.png` for exact alpha-mask refinements or artwork edits. Dimensions must
match `source.w/h`. For new imagery, create a separate PNG and a new unique layer ID.
Keep a copy of original PNGs and retain `scene-reference.png` for truthful comparison.

## Browser API

After `window.editor.ready`:

```js
const l = lab.layer('alec-column-center');
lab.set(l.id, { x: l.x + 20, tint: '#ffb060', tintMix: 0.3 });
editor.refresh();
lab.setGroup('specimen-tank', 15, 0); // move all member pieces together
editor.refresh();
const report = lab.verify(); // compares actual layer render, never a source shortcut
const project = lab.exportProject(); // serializable, contains all current layer PNGs
```

API edits do not automatically enter the UI undo stack; retain `lab.exportProject()`
before a batch, and `await lab.load(snapshot)` to restore. Call `editor.refresh()` after.

```js
// Read/write EXACT local pixel coordinates in an existing layer.
const rgba = lab.pixel('alec-column-center', 2, 2);
lab.paint('alec-column-center', 2, 2, [255, 160, 80, 255]);
editor.refresh();
```

```js
// Split existing source pixels into another addressable layer, without duplication.
// The source layer must be visible, unrotated, unscaled, untinted, at its source position.
const src = lab.layer('alec-column-center').source;
lab.split('alec-column-center', [
  [src.x+2, src.y+2], [src.x+3, src.y+2],
  [src.x+3, src.y+3], [src.x+2, src.y+3]
], 'my-one-pixel-detail', 'Một pixel riêng');
editor.refresh();
```

## Reuse in Ductor repo (not applied here)

Render layers on a native offscreen 1926×816 canvas, then draw that surface once in the
existing 1600×678 room coordinate system. Use `SpaceLab.toRepoPoint(x,y)` for anchors:
`repoX = x * 1600/1926`, `repoY = y * 678/816`. Inverse is `x * 1926/1600`, `y * 816/678`.
Avoid rounding during coordinate conversion; rounding belongs at the final raster boundary.
Keep live agent state and poses outside this editor. Moving scenery requires updating
associated interaction anchors, walkability and occlusion; the PNG renderer alone cannot
infer those dependencies. This ZIP does not provide automatic natural-language execution.

## Validation boundaries

`build.cjs` validates decoded PNG RGBA equality at rest. `verify.cjs` additionally checks
browser compositing, movement without ghost copies, tint, 1-pixel split and edit, JSON
round trip, undo, zoom and offline file loading. Check included verification reports for
what actually ran. Do not call a script's existence a passing test.
