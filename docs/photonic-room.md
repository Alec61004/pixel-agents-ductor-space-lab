# Photonic room

The whole room now shares the command bay's dark teal materials and cyan energy lighting. Each area has a distinct silhouette: membrane airlock, honeycomb storage, rounded specimen vessels, overhead sensor lens, recessed QA basin and curved research ribbon. Repeated eye crystals and thorns were removed outside the approved command desk.

## Editing

- Artwork: `webview-ui/public/assets/themes/ductor-space-lab/photonic-room-v1.png`.
- Room asset normalisation, fixture coordinates and ambient motion: `webview-ui/src/ductor/starshipLivingRoom.ts`.
- Command desk, seated pose anchors and contact timing: `starshipComputerBay.ts`.
- Exterior masks and moving ships: `starshipExterior.ts`.
- Shared Home colors: `starshipPhotonicTheme.ts`.

All room coordinates are 1600×678. The loaded artwork is normalised and cached once before texture sampling. Geometry is drawn before crew; only Alec's chair shell is redrawn over its seated occupant. Missing room artwork falls back to the existing background and command bay.

Life-support bubbles, crystal filaments, neural culture pulses, moving spectra, the overhead star lattice and ambient conduits continue at rest. Command work speeds up the energy transfers; QA work speeds up the scanner; nearby crew energise the airlock. Kevin retains the approved eight-planet camera tour. Benjamin's standing anchor is in front of the new QA basin.

## Art direction and provenance

New artwork was created using built-in imagegen with the approved photonic bay as the reference. Three passes: extend its materials to the entire room while preserving station anchors; remove static spacecraft so moving sprites are not duplicated; replace repeated eye/crystal ornament with functionally distinct, quieter forms.

Final prompt direction: preserve the command desk, central chair, blue map, windows and room footprint; use a membrane door, honeycomb storage, smooth specimen collars, broad sensor beam, low QA basin and curved research glass; remove most pointed ornaments outside the main desk; no baked-in crew or spacecraft.

References consulted for alien interior forms (not imported assets):
- https://briyu.artstation.com/projects/w85RO9
- https://arifcreations.artstation.com/projects/yJANx5
- https://robertsspaceindustries.com/comm-link/transmission/17222-Alpha-37-Flyable-Ships

Validation: TypeScript check, 55 targeted tests, and scene renders at five points of the activity cycle. A legacy test that prohibited every ellipse was corrected to protect the approved star-map frame and clip; the restored planet tour intentionally contains physical planetary rings.
