# Bridge geometry correction — version 46

The Gotoh 510, Hipshot Contour and EverTune previously loaded the complete Floyd-routed body. The Floyd bridge also used a solid 94 × 73 mm rectangular box as its baseplate.

## Correction

- Retain the existing body, neck, heel, headstock, scale reference and rear access covers. Fixed and Tune-o-matic body geometry is unchanged.
- For Gotoh, Contour and EverTune, reuse the **original standard body's carved top**, cutting only the selected bridge's opening. Source positions and normals are interpolated at cut edges; all other top triangles are retained. There is no flat overlay or approximate wood patch.
- Preserve the existing absolute CAD UV mapping and wood shader, so the restored top uses the same grain, color and burst as its surroundings.
- Retain the existing hidden internal/rear cavity meshes and spring covers. Add opaque walls at the dedicated front opening. These are visualization meshes, not a replacement set of manufacturing rout templates.
- Give the Gotoh and Contour separate baseplate outlines and block dimensions. The Gotoh block opening includes a small display clearance around the published 64 mm block; Gotoh does not specify this clearance in its part drawing.
- Replace the Floyd slab with a shaped 3.5 mm plate, side cutaways, a narrower folded fine-tuner rack, and projecting lock screws. The catalog’s 1000 Series Pro uses a shorter, lower rack, 90.81 mm front width, 66.67 mm rear rack and 10.67 mm pitch. The original-family plate uses the manufacturer drawing's 91.7 mm width and 67.3 mm rear rack.
- Preserve the nominal saddle reference and 647.7 mm scale. Hardware remains a visual representation: these models are not machining or intonation setup instructions.
- Include the routing family in the body update key, so Gotoh → Floyd → Contour → fixed transitions rebuild the appropriate top. The existing async revision guard rejects stale loads. The same scene continues to supply the showroom, detail view and completed-build PNG.

## Primary references

- Gotoh 510TS-FE1: https://g-gotoh.com/images/pdf/510TS-FE1-Dim.pdf
- Hipshot Contour dimensions and route: https://docs.hipshotproducts.com/42100.PDF
- Floyd Original dimensions: https://cdn.shopify.com/s/files/1/1711/6239/files/FR_Original_Schematics_2021.pdf?v=1629814484
- Floyd Original routing: https://cdn.shopify.com/s/files/1/1711/6239/files/FR_Original_Routing_Diagrams_MM_Packet.pdf?10199693857680416961=
- German Floyd Pro routing (comparison only): https://cdn.shopify.com/s/files/1/1711/6239/files/FR_Pro_Routing_in_MM.pdf?10199693857680416961=
- 1000 Series Pro dimensions: https://cdn.shopify.com/s/files/1/1711/6239/files/FRTP1000_Dimensions.pdf?18431975728071674932=
- EverTune guidance on filling previous tremolo pockets: https://www.evertune.com/resources/bridge_buying_guide.php

## Verification

`node --test scripts/check-bridge-geometry.mjs scripts/check-assembled-preview.mjs`

Tests decode the production GLBs; check cut area, restored carved heights, wood UVs, rear cover preservation, actual Floyd plate cutaways/rack, selection transitions and unchanged scale; and fit front/back assembled cameras to every model/bridge combination.

`node scripts/check-showroom-360.mjs`

Checks all production CAD assets, original Oryx heel correction, body construction, all hardware builds and route connections. Additional existing electronics and builder navigation checks protect the recent changes.

Offline top and oblique mesh diagnostics inspect the actual corrected geometry. Live browser visual QA is unavailable in this managed session because the required browser capability is absent; no browser screenshot is represented as verified.
