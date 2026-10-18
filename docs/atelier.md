# Fostinis Atelier

The new entry is `/atelier.html`; the root page and static index lead to the same experience. Existing model, finish, hardware, review, and payment routes remain available.

## Customer experience

- The homepage includes a showroom preview immediately after the hero, with guitar, lounge, and cabinet-wall camera buttons. The preview and header entry open `/showroom.html` at the top, before the builder. The existing room canvas is reused and loads as the preview approaches the viewport; data-saving visitors can activate it explicitly. The original room artwork and guitar images remain a clickable fallback if WebGL is unavailable. The full showroom retains its drag, zoom, lighting, and instrument controls.
- `?view=materials`: six representative wood appearances on rotatable, bookmatched blanks; unfinished, satin, and gloss surfaces; adjustable light. These are illustrations, not physical inventory. Burl uses the existing generated illustrative texture.
- `?view=collection`: up to 20 named configurations, private cross-device access links, individual design links, comparison, friend voting, JSON import/export, and real configured thumbnails where WebGL is available. Existing browser backups remain compatible.
- The reveal uses the existing scene's three configured views. A silent 12-second film can be downloaded as MP4 or WebM when supported; leaving the tab stops recording. Browsers without recording can still preview and use the existing photo exports.
- `?view=sound`: performances, reviews, and workshop films from the official channel. The playroom also features the three instrument demos, separately from manufacturer references and synthesized playing.
- `?view=craft`: actual Fostinis close-up photography and original build footage.
- `?view=commission`: current server-calculated build price, saved specification, setup discussion, existing checkout, and personal review requests.
- `?view=circle`: genuine archive artist videos, approved submissions, event listings, and interest registration. No invented members, reviews, events, or build capacity.
- `?view=journal#access=...`: a private design record, actual workshop updates, serial when assigned, and downloadable instrument record. Completed or delivered instruments show the passport label.

## Workshop operation

Open `/atelier.html?view=workshop` and sign in with the ChatGPT account that owns the site. Authorization checks trusted Sites identity headers against the server-side owner email setting. Never place this setting or authentication headers in client code.

The desk lists design reviews, Circle interest, and stories. Open a request to read its message/configuration, open an email draft, mark its status, add private journal updates with a photo/video, or approve/remove a public story. Only verified paid website order IDs may be linked to a journal or owner story; the workshop must confirm the customer and configuration match. Add actual event dates and update current build-time guidance in the sidebar.

This release stores requests but does not send automated email. Customers receive and can copy their private journal link immediately. Collection/journal links grant access to their holder and must be kept private. Individual public design links and comparison links exclude private build notes. Public stories exclude contact emails and private notes and require submission consent plus owner approval.

The existing Stripe flow still charges the full order amount and uses the existing payment settings and terms. No deposit or new payment policy is introduced. A design-review request is not an order or production reservation.

## Implementation and verification

`src/atelier` contains the customer UI, reveal, wood sample renderer, and verified video catalog. `lib/atelier/service.mjs` implements the API; `db/schema.ts` and appended migration `0004_dark_jocasta.sql` define persistent records. `scripts/sync-atelier.mjs` installs the shared script and creates the atelier/index entries during prebuild. Sites applies the migration on deployment.

The existing commerce/electronics/wood/navigation suite and 10 new SQLite-backed atelier tests pass (46 tests total). New tests cover private capabilities, concurrent saves, owner authorization, moderation, journals, voting, input validation, and no accidental order creation. TypeScript checks and the production build pass. Interactive browser/phone rendering, WebGL behavior, actual video playback, and browser-specific film download remain unverified because the required browser-control skill is unavailable in this environment.

YouTube metadata was verified on 2026-10-18. The catalog does not identify every current pickup, selector position, or split-coil state. These videos must not be labeled as calibrated sound samples for every selectable build. See `lib/atelier/video-provenance.json` for source details.
