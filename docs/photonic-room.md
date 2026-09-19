# Photonic room

The active bridge uses a dark navy hull, restrained cyan systems lighting and warm amber practicals. Room V3 preserves the approved command desk, star map, specimen stations, QA basin and exterior composition while separating painted structure from runtime animation.

## Editing

- Artwork: `webview-ui/public/assets/themes/ductor-space-lab/photonic-room-v3.webp`.
- Room normalisation, fixture coordinates and ambient motion: `webview-ui/src/ductor/starshipLivingRoom.ts`.
- Command desk, seated pose anchors and contact timing: `starshipComputerBay.ts`.
- Exterior masks, accretion flow and moving spacecraft: `starshipExterior.ts`.
- Material depth and local practical-light pulses: `starshipSceneV2.ts`.
- Shared interface colors: `starshipPhotonicTheme.ts`.

All room coordinates are 1600×678. The 1926×816 artwork is downsampled once at high quality and cached before texture sampling. Character sprites remain nearest-neighbour rendered so their pixel edges stay intact.

## Layer ownership

- Room V3 contains the hull, windows, cables, fixtures and static star field, but no baked spacecraft.
- `starshipExterior.ts` draws one instance of each of the three spacecraft silhouettes, parallax stars and the animated black-hole flow inside clipped windows.
- `starshipSceneV2.ts` adds only material depth, practical-light pulses and active station reflections; it does not redraw structural seams or power rails.
- `starshipLivingRoom.ts` adds bubbles, sparse moving energy packets, the overhead star lattice and role-specific activity. It does not paint a second idle scanner or duplicate floor bloom.
- The browser-wide fallback star layer is cleared after Room V3 loads, preventing stars from appearing over the hull, floor and consoles.

## Art direction and provenance

Room V3 was created with built-in imagegen as a precise edit of Room V2. The edit removed only the three static spacecraft embedded in the windows and preserved the room layout, black hole, moon, lighting, instruments and specimen tanks. The production asset is a versioned WebP rather than an overwrite of an approved source.

Final edit prompt direction: remove the three baked spacecraft silhouettes from the left and right windows; reconstruct only the surrounding star field and nebula; preserve every other pixel-art structure, fixture, color relationship and composition; add no text, crew or replacement objects.

References previously consulted for alien interior forms (not imported assets):

- https://briyu.artstation.com/projects/w85RO9
- https://arifcreations.artstation.com/projects/yJANx5
- https://robertsspaceindustries.com/comm-link/transmission/17222-Alpha-37-Flyable-Ships

Validation covers asset header and aspect ratio, room cache behavior, unique moving spacecraft, balanced canvas save/restore calls, active/offline 1600×678 scene renders, TypeScript/build checks and the Vercel preview deployment.

## Room V3 color pass

Built-in imagegen edited V3 lighting and materials while retaining station geometry: neutral blue-gray titanium, readable midtones, restrained ice-blue systems, champagne practicals and pale sage specimen glass. The exact edit direction was to preserve all silhouettes and positions, soften saturated cyan/orange bloom, and retain the indigo exterior with its warm accretion disk. The renderer no longer adds a global contrast/saturation boost or rectangular navy glazes. Frame-local planet exploration remains on the current glass.
