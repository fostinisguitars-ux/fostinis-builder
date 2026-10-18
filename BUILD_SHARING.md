# Build sharing and saved guitars

The review page includes a guitar nickname, **Share your build**, and **Save / resume builds**. **Saved builds** is also available in the persistent builder dock.

The share gallery captures the current Three.js model, materials, and appointments from the front, back, and a true 45-degree camera. Each JPEG includes Fostinis Guitars, the nickname, and a short finish/pickup/hardware summary. TikTok uses 1080 × 1920 images; other destinations use 1080 × 1350. Text and email messages include the visible All Appointments list. Private build notes never enter sharing links, captions, or photos.

Customers use the native file-sharing menu when supported. They choose the destination and finish posting in that app. Downloads, a three-photo ZIP, copyable captions, direct text/email links, and platform links provide fallbacks. The site does not automatically upload to a customer's social accounts. Direct mailto/SMS links cannot attach image files, so they contain a link opening the three-view gallery.

Shared links contain a versioned, validated configuration and nickname. Opening one does not overwrite browser saves until **Save as my build** is chosen. The field order in share-core.mjs is a versioned wire format: do not reorder it or encode mutable catalog indexes.

Current progress automatically saves to `fostinis-showroom-v4`, including a nickname and notes per model. Named snapshots use `fostinis-saved-builds-v1` (20 versions). Saving and restoring preserves the other model's working copies. Local storage belongs to this browser and site origin; it is not account-backed cloud storage. Customers can download JSON backups (including notes), import them on another device, and resume. Previously exported schema-9 build sheets also import. Failed storage writes surface an error and leave a current-build download available.

Source UI and sharing logic live in `src/sharing`. After editing markup, styles, or configurator bridges, run:

```sh
node scripts/sync-build-sharing.mjs
node scripts/build-showroom-360.mjs
node --test scripts/check-build-sharing.mjs scripts/check-sharing-flow.mjs scripts/check-assembled-preview.mjs lib/commerce/commerce.test.mjs
```

The automated checks exercise the actual shipped controller and inline state logic, shared-link round trips, storage/backup migration, destination content, failures, and all camera bounds using the real CAD files. DOM/canvas adapters are not a substitute for device testing of native share sheets. The deployment environment did not provide browser QA. Social destinations and installed-app support remain device-dependent.
