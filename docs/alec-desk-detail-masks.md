# Alec desk detail masks

The command-desk PNG contains surrounding pixels. Its alpha is NOT a safe
animation boundary. Working effects now require named `details` polygons in
scene.json. Missing polygons disable the effect rather than affecting the crop.

Scope: central desk behind Alec's chair only. Three shell outlines are reference
regions (animate=false). Twelve control/trim/lamp regions and four separate
column tips/shafts are addressable by ID. Detached holograms have no working
effect and are excluded from the command group. Chair, floor and left station
are excluded from these masks.

Polygon coordinates are relative to each layer's top-left, before rotation or
scale. IDs, labels, polygon vertices and animate flags are editable in scene.json.
The editor's boundary checkbox displays these exact runtime polygons.
Green outlines mark shell reference regions; yellow outlines mark enabled
effect regions. No guide is drawn into the live app.

Light motion is clipped back into its own detail mask; partial-edge mask pixels
keep original RGB. This deliberately sacrifices large travel rather than
inventing backing pixels beyond the allowed region.

These are conservative manually traced regions, not exact semantic cutouts or
reconstructed hidden surfaces. The image assets and idle composition are intact.

Verification: browser test compares both working frames against idle and
independently tests every changed native pixel against enabled polygons:
zero changes outside the allowed detail regions; idle RGBA equals the reference.
This verifies the source compositor, not every unrelated ambient app overlay.
