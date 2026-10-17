# Supplied CAD → showroom

Source: the owner's six body STEP files in Archive.zip and `6 String Neck for Matadaur, Sphyx.step`, received 2026-10-16. Original manufacturing files are not served by the website.

All CAD coordinates are millimeters. Conversion uses a rigid -90° neck rotation and translation only, then exports meters for glTF. The browser applies one consistent millimeter-to-meter transform to the assembly. No guitar is stretched to match a reference photograph.

Oryx uses the shared neck. Its heel underside is extended 50.755429402 mm toward the higher single-cut joint, derived from the difference in the supplied pocket endpoints. The extension is clipped to the original neck planform. The headstock, tuner holes, top surface and overall bounds are retained. Body pockets are cut to the neck's unchanged width; the neck is never squeezed into a narrower pocket.

`neck_joint.py` constructs a continuous exterior heel before restoring the original internal truss-rod channel. The previous extension copied an open rod slot and the lowered tenon top into the visible heel, causing a center split and a horizontal slit. The pocket now also spans the rod-slot footprint, preventing a thin body fin inside the joint. `check-joint.py` checks 12 heel cross-sections and the former split locations in the actual CAD solid.

`fit-report.json` records validity and zero remaining solid intersection for all six body variants. Negative differences between independently integrated B-spline volumes are not usable measurements of added material; the Sphyx result was separately checked with Boolean differences (zero added material, 101.381365 mm³ removed).

The renderer uses the CAD body shells, carved tops, control positions, neck, headstock angle and tuner hole positions. Hardware is a dimensional visual representation based on the existing catalog; those meshes are not manufacturer CAD or machining drawings. The supplied standard/tremolo routings determine the body variant, while hardware options retain their established pricing and selection behavior.

The neck pickup and its matching rounded CAD recess move 9.12499976 mm toward the fretboard on all three models. The actual pickup-to-board clearance is 3.175 mm (⅛ inch) for open coils and 2.175 mm for covered/active pickups; the mounting frame has 0.675 mm clearance. `assembly-layout.json` is shared by the CAD adjustment and hardware renderer. `align-pickups.py` fills the former routing and cuts the translated routing, checking that changes stay inside that area and that the neck does not intersect the body. The nut, fret positions and bridge are not translated: the 647.7 mm / 25.5-inch scale is retained. The fretboard is now a closed radiused solid, including the previously missing end grain and underside.

The owner's revised side construction is **31.75 mm / 1¼ inch total**: 25.4 mm / 1 inch of body wood beneath a 6.35 mm / ¼ inch exposed maple cap edge. The carved crown rises above that side measurement. This applies to all three models and both standard/tremolo variants, independently of finish and hardware selections. The original belly relief is retained, so local thickness at that relief is less than the nominal side thickness.

`body-construction.json` is the shared dimensional source for CAD conversion and rear hardware placement. `slim-body.py` removes an internal slice directly beneath the cap and translates the original rear section forward; it does not scale the body, top, neck, or rear contours. It then recuts the unchanged neck envelope. `construction-report.json` records six valid closed solids, zero neck interference, and unchanged cap geometry. The new maple edge is a separate mesh material, split at the exact cap-edge/glue planes. It remains natural maple for every dye, solid, burst, and back-wood selection; it follows the cap's chosen sheen.

Rebuild using Python with CadQuery/OpenCascade, NumPy and Matplotlib:

1. Extract the six body STEP files into a working directory. Copy the neck to `matadaur-sphyx-neck.step` there.
2. `python scripts/cad/fit-neck.py /absolute/working-directory`
3. `python scripts/cad/slim-body.py /absolute/working-directory`
4. `python scripts/cad/align-pickups.py /absolute/working-directory`
5. `python scripts/cad/clean-heel.py /absolute/working-directory/aligned`, then `python scripts/cad/check-joint.py /absolute/working-directory/aligned`
6. Copy the fit, construction, pickup alignment, heel cleanup and joint validation reports into `scripts/cad/`.
7. `python scripts/cad/export-web.py /absolute/working-directory/aligned public/assets/cad`
8. `node scripts/compress-cad.mjs`
   Then `node scripts/repair-oryx-neck.mjs /absolute/working-directory/matadaur-sphyx-neck.step`.
   This final Oryx-only operation also losslessly compresses and validates its output.
9. `node scripts/check-neck-clearance.mjs` and `node scripts/check-showroom-360.mjs`
10. `npm run build:showroom`

The 0.07 mm tessellation uses analytical surface normals. Compression reorders and losslessly encodes floating-point geometry without quantizing or simplifying it. Surface finishes are separate materials for top, sides/back, neck and front headstock. The existing finish library retains its hardware-free swatches.

UI: drag/touch orbit, pinch/wheel zoom, keyboard arrows and +/- controls, all-three/selected/front/back cameras, raycast guitar selection, and automatic rear-headstock focus on tuner changes. Only visible views render, draw calls are merged by hardware material, and resolution is capped on dense displays. Standard 2D views remain available if WebGL initialization fails.

Verification: CAD validity and interference checks; independent front/back/heel/headstock geometry renders; Three.js loader/compression/geometry checks; pricing regression tests; production build. Browser interaction QA was unavailable in this environment.

### October 16 Oryx shaft seam correction

The rigid heel extension ended at y=289.327388272 mm with a 0.74 mm radial
step. `smooth-oryx-neck.py` replaces only the exterior shaft skin between
y=230 mm and that cutoff. A quintic blend returns the extended profile to
the original shaft with zero first and second blend derivatives at both ends.
The retained mesh supplies the exact boundary rings, and both sides share
continuous shading normals. The unchanged position-based UV mapping keeps
the mahogany grain continuous. No body, shared neck, hardware, material,
camera, or room geometry is changed.

`repair-oryx-neck.mjs` runs this on the freshly exported Oryx GLB, preserves
the separate headstock primitive, and validates the decoded compressed result
before replacing the asset. `check-oryx-surface.py` independently checks
topology, winding, original heel/headstock triangles, exact overall bounds,
and radial/normal continuity across both patch boundaries at 181 angles.
The report is retained in `oryx-neck-surface-report.json`. The 647.7 mm scale
and original heel below the repaired shaft are unchanged. Repeat the repair
after a fresh CAD export; an already repaired asset is intentionally rejected.
