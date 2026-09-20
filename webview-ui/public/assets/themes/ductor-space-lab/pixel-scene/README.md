# Lossless pixel scene runtime

This directory is the runtime counterpart of the standalone layer editor.

- `scene.json` is the source of truth for object coordinates.
- `layers/*.png` are cropped RGBA pixel layers cut from the original 1926×816 image.
- `scene-reference.png` is the byte-identical source image used to verify the split.
- `src/ductor/starshipPixelScene.ts` loads and assembles the layers once, then the stage scales the assembled canvas to 1600×678.
- `src/ductor/starshipSimulation.ts` accepts the assembled scene before drawing agents and overlays.

Layer coordinates are top-left anchors in source pixels. Edit `x` and `y` for exact movement; `z` changes draw order; `scaleX`, `scaleY`, `rotation`, `opacity`, `visible`, `tint`, and `tintMix` are also supported. The original scene remains pixel-identical while every layer is at its authored transform.

The cut boundaries are hand-traced ownership masks. They preserve every source pixel but cannot reveal background that was hidden behind an object after it is moved. The editor bundle and verification report remain in the Library for offline editing and exact reconstruction checks.


The four Alec column layers support `motion: { axis, amplitude, speed, phase, activeWhen }`. Their repair layers remain underneath at the original slot; this keeps the source editable while animated movement reveals a filled desk surface.
