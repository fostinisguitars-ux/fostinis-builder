# Automated Fostinis workshop

The public workshop is `/atelier.html?view=workshop-tour`. It remains linked from the homepage showroom preview, atelier navigation, footer, and the full showroom workshop wall/button.

Version 67 removes the chisel, router, plane, and setup-tool inspection links, hotspots, tool navigation, and tool-picking raycasts. Decorative bench objects remain scenery. The sidebar contains only working top-wood and inlay/fretboard choices.

The 61-second illustrated build begins automatically when the renderer is ready and visible, unless reduced motion is preferred. Six stages show bookmatched top blanks, a moving routing cutter and chips along the current CAD body/pickup routes, neck fitting, separate fretboard/inlay/fret installation, an upright spray booth with extraction wall/light bars/spray passes and a progressive selected-finish reveal, then installation of bridge, each pickup, controls, six tuners, nut, rear covers, and six strings. The final geometry uses the same catalog parts and positions as the main showroom. It is a compressed illustration, not a live order status or a machining simulation.

Pause/play, replay, stage selection, previous/next, a scrubbable progress control, orbit, zoom, and light controls are available. Orbit/zoom pauses playback. Hidden tabs and an offscreen bench suspend the render clock and resume without skipping. Reduced motion starts in a still frame and stage selection shows a completed stage; Play and Replay are explicit motion opt-ins. Real workshop films pause the animation and load only on request.

Customers can preview six top woods, three inlay options, and three fretboards. **Add these choices to my design** applies only those fields and preserves every other specification, nickname, and custom request/upload. Price remains reviewed in the builder. Custom artwork still uses the existing special-request/upload field.

Original CAD geometry is independently cloned. Owned geometry/materials/textures, the renderer, shadow map, controls, observers, and iframes are disposed on close; shared showroom resources are retained. A single visible animation frame loop owns the clock, with no interval or background animation timer. A context loss shows the retained workshop photo and keeps material choices and archive films usable.

`node scripts/check-workshop.mjs` verifies clock boundaries/pause/replay/seeking, routes on all three actual body models, spray particles, complete assembly equivalence against production geometry across model/inlay/pickup layouts, independent geometry, retained local assets, preserved custom requests, and removal of tool-inspection UI. The production build verifies bundling. Visual WebGL/browser QA requires the browser-control skill, unavailable in this managed environment.
