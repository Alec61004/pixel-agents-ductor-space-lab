# Space Lab pixel scene

The branch runtime now assembles the lossless layer scene before drawing agents. The
source image is 1926×816 and is byte-identical to the original photonic room. The
stage scales the assembled canvas to the simulation's 1600×678 world.

Edit only `webview-ui/public/assets/themes/ductor-space-lab/pixel-scene/scene.json`
for object transforms:

- `x`, `y`: integer top-left anchors in the source image.
- `z`: draw order.
- `scaleX`, `scaleY`, `rotation`, `opacity`, `visible`: raster transforms.
- `tint`, `tintMix`: per-layer color blend.
- `layers/*.png`: the cropped RGBA pixels for each addressable layer.

The loader renders the layers once to a native canvas and `drawStage` then scales
that canvas alongside the existing live crew simulation. The old photonic-room image
remains a fallback if the manifest or a layer cannot load.

Layer boundaries preserve every source pixel at rest, but they are ownership masks
traced by hand. Moving a layer cannot reconstruct background that was hidden behind
it. If a moved object also changes an interaction point, walkable area, or occlusion,
update the corresponding TypeScript scene manifest and workstation constants too.

The standalone editor and its offline verification report are in the companion
Library bundle. The repo integration intentionally keeps only the runtime source of
truth and its pixel layers.
