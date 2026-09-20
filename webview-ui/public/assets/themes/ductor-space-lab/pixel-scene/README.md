# Editable source layers

43 PNG layers plus `scene.json`, in native 1926×816 coordinates.

Use `/pixel-scene-editor.html` in the app's dev server or built site to preview
Idle/Working and change layer properties. This page shares the live app renderer.
Export its JSON and replace this manifest, then rebuild/reload. The Alec command
bay group is tied to the `command-chair` anchor, so routing and occlusion follow
the same native translation when the app loads the manifest.

`x/y`, scale, rotation, z, tint and per-layer `working` settings are editable.
The normalized live-app artwork is 1600×678; group metadata maps native
translations into that same simulation coordinate system.

Idle is pixel-exact. Moving light uses an estimated backing and a luminous-only
residual, not an opaque moving crop. It is not a reconstruction of hidden scenery.
See `docs/ductor-space-lab-pixel-scene.md` for the contract, limits and browser test.
