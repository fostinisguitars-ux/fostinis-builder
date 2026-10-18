# Interactive Fostinis workshop

The public workshop is `/atelier.html?view=workshop-tour`. It is linked from the homepage showroom preview, atelier navigation, and footer. In the full showroom, the workshop wall behind the guitars and **Enter the interactive workshop** open the same experience in a dialog.

The six-stage illustrated sequence shows representative timber blanks, the actual model's shaped body, its neck, fretboard/inlays, selected finish, and assembled appointments. The customer can select stages, run/pause a guided sequence, orbit/zoom, move the light, and inspect six tabletop stations: woods, inlays, chisels, router, surface materials/hand plane, and setup tools. Original CAD geometry is copied before inspection; existing showroom objects and saved configurations are not modified by previewing stages.

Customers can preview the current catalog's six top woods, three inlay patterns, and three fretboard appearances. **Add these choices to my design** applies only those three fields to the current guitar and retains all other specifications, the nickname, and custom requests/uploads. Updated price is reviewed in the builder. Custom artwork uses the existing inlay special-request/upload field; the workshop does not invent a new priced custom-inlay option.

The build sequence is expressly illustrative, separate from an actual customer's private production journal. The retained Matadaur and Torn & Tattered workshop films are embedded only on request, with their existing credits. No new tools/finish-process brands, physical inventory guarantees, or production-time promises were introduced.

Implementation: `src/workshop` owns the UI, stage/selection rules, real 3D tool objects, and workbench renderer. `FostinisShowroom.createWorkshopView` waits for the current configured geometry before cloning it. Rendering runs on changes, during short part-placement transitions, and only while visible. Playback pauses when hidden or scrolled away. Dialog close disposes its renderer, owned geometry/materials/textures, controls, observers, and video iframes. Shared showroom textures/materials are retained.

`node scripts/check-workshop.mjs` checks phase visibility, all six tool raycasts and retained assets, geometry/draw budgets, independent copies of all body models and both necks, preservation of unrelated options/custom requests, and escaped page content. Production build checks bundling and all shared route entries. Browser/WebGL visual QA requires the browser-control skill, which is unavailable in the current managed environment.
