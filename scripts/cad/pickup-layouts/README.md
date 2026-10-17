# Supplemental pickup-layout geometry

Six `*_pickup_fills.glb` files contain only supplemental top-surface meshes. All original CAD assets remain unchanged, verified by SHA-256 in `verification.json`.

Each GLB contains six named meshes, all in **metres**, with material name **top**:

- `neck_full`: fills the original neck humbucker opening up to the existing neck-pocket joint.
- `neck_single`: fills the original neck humbucker margins, leaving a 78 × 19 mm opening with 3 mm corners.
- `bridge_single`: same treatment at the bridge humbucker position.
- `control_1`: fills the unused control bore near (108, −100) mm.
- `control_3`: fills the unused control bore near (106, −153) mm, or Matadaur's original shaped recess near (108, −153).
- `switch`: fills the original selector bore near (86.63, −79.37) mm.

## Integration

Load the file matching the original body model/bridge variant. Clone its scene, scale it by **1000** inside the existing millimetre guitar group (the same transform used for body CAD), and show only these meshes:

| Layout | Active patch meshes |
|---|---|
| HH | None |
| H | neck_full, control_1, control_3, switch |
| HSH | control_1 |
| HSS / SSH (neck S, middle S, bridge H) | neck_single, control_1 |
| HS (neck S, bridge H) | neck_single, control_1, control_3 |
| SSS | neck_single, bridge_single, control_1 |
| SS | neck_single, bridge_single, control_1, control_3 |

Reuse the **same top material** as the original body, or call `woodMaterial(F,state,'top',model)`. Apply `configureUV(mesh,'top')` using mesh-local metre positions. Do not re-center or independently translate the patches: their coordinates are already absolute in the original body coordinate system. The wood shader uses the same positions for its burst calculation.

All meshes are initially present in the asset: set visibility before adding it to the visible guitar group. HH should not add the patch asset at all. Updating the displayed group automatically makes assembled captures and exports include the same geometry.

## Continuity and limits

The neck opening is extracted from the actual neck-pocket/top boundary. In particular, Sphyx and Matadaur have curved upper neck-routing edges, so these are not flat bridge templates. Every extracted boundary vertex and its top normal is preserved; interior horizontal strips interpolate between the original left and right surface, retaining those boundary normals and absolute-position wood UVs. This reconstructs the localized missing surface, not a new CAD manufacturing solid.

Serialized output has 36 meshes / 223,696 triangles across all six files. All positions/normals are finite, all normals unit length, and no top triangles face backward. Original assets are unchanged. UV disagreement with the existing configureUV expression before it is reapplied is at most 3.88e-8.

The Matadaur `control_3` source boundary contains a tiny projected undercut with two slightly downward normals. Its patch preserves all boundary points and normals, but uses a localized interpolated interior and has a projected-area discrepancy of 0.003912 mm² out of 475.75 mm². Other patches have projected-area discrepancy below 2e-10 mm². This is explicitly recorded in verification.json, rather than claiming exact recovery of the unavailable body STEP surface.

## Killswitch

`killswitch-placement.json` now contains two placements per model. The `vacantPot` placement centers the switch in the original bridge-volume recess (pot index 1), which is unused by every current two- or three-control layout. It uses the actual bore center, reconstructed center surface and interpolated normal. The visible rim clears the carved dish, and all 64 footprint samples remain over the existing rear control cover. The `control_1` wood patch is hidden while the switch occupies that recess and restored when the switch is removed.

Only the four-control HH layout uses the existing separate position at (126, −126) mm, since every pot recess is occupied. Its 7.5 mm-radius footprint was sampled at 64 angles and fits inside both the front top and existing rear control cover on all three models. No original body geometry is edited.

Set the button group's position to `positionMm`; rotate its local +Z axis onto `normal` with `Quaternion.setFromUnitVectors`. Place the bottom of its mounting bezel at local z = 0. A small embedded seating depth is appropriate to avoid floating above the carved cap.

## Reproduce

- `node scripts/cad/pickup-layouts/build-pickup-fills.mjs`
- `node scripts/cad/pickup-layouts/compress-pickup-fills.mjs` (lossless encoding; verifies every decoded triangle, position, normal and UV)
- `node scripts/cad/pickup-layouts/check-pickup-fills.mjs`
- `node scripts/cad/pickup-layouts/killswitch-placement.mjs`

Run these commands from the repository root. They read the original CAD assets, write supplemental GLBs to public/assets/cad/pickup-layouts, and keep placement and verification data in scripts/cad/pickup-layouts.
