# Fostinis Guitars

Complete website source, 3D guitar models, textures, images, finish controls, pricing, and checkout backend.

The live application is hosted with Sites / Cloudflare Workers. The production domain is `fostinisguitars.com`; the original live origin is `https://fostinis-design-review.bouncybow11.chatgpt.site`.

## Project layout

- `public/`: all customer-facing pages and assets, including the interactive 3D showroom.
- `src/`: showroom geometry, materials, camera controls, and faded-burst rendering.
- `lib/commerce/`: server-authoritative prices, checkout, order verification, and origin configuration.
- `app/`: application entry point and commerce API route.
- `scripts/`: builds, route synchronization, CAD tools, and checks.
- `drizzle/`: database migrations, when present.

## Development

Use Node.js 24 or later. Run `npm ci`, then `npm run dev`.

Before building after changes:

```sh
node scripts/sync-faded-burst.mjs
node scripts/sync-commerce-pricing.mjs
node scripts/sync-showroom-360.mjs
npm run build
```

Check finish and payment behavior:

```sh
node scripts/check-faded-burst.mjs
node --test lib/commerce/commerce.test.mjs
```

## Production

This application needs a Worker-compatible server and a D1 database. GitHub stores the complete project; GitHub Pages cannot run its checkout backend. Keep production payment keys and webhook secrets in the hosting environment, never in Git. `.env.example` lists configuration names without values. Retain signed webhook verification and server-side price calculation.

The import workflow verifies SHA-256 for every asset against `site-transfer-manifest.json`. Original repository history remains available for recovery. Internal merchant setup notes, live environment values, and temporary credentials are excluded from this source export.
