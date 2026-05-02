# Austerveil Architecture & Design

Next.js migration of the public Wix site for [austerveil-ad.com](https://github.com/nannitrautt-lang/austerveil-ad.com), ready to deploy on Vercel.

The rebuilt site is data-driven from `data/site-data.json` and renders the migrated pages through Next.js App Router static routes. Captured public media used by the new site lives under `public/wix-assets`.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- `npm run dev` starts the local Next.js development server.
- `npm run build` creates a production build.
- `npm run start` starts the production server.
- `npm run lint` runs Next.js linting.
- `npm run typecheck` runs TypeScript without emitting files.

## Migration Utilities

- `scripts/dump-public-site.mjs` captures public pages and assets from the existing Wix site.
- `scripts/build-site-data.mjs` converts the dump into route data and public assets for the Next.js rebuild.
