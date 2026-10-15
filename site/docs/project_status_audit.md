# Wallpy Site Status Audit

Date: 2026-02-11
Scope: codebase review + `docs/*.md` review

## Implemented (working baseline)

- Next.js app scaffold with main routes:
  - `/` homepage (`app/page.js`)
  - `/gallery` (`app/gallery/page.js`)
  - `/upload` multi-step upload flow (`app/upload/page.js`)
  - `/packs/[slug]` pack details (`app/packs/[slug]/page.js`)
  - `/profile/[username]` public profile (`app/profile/[username]/page.jsx`)
- Supabase auth pages and components:
  - login/signup/forgot/update password pages under `app/auth/*`
  - auth UI components in `components/auth/*`
  - middleware-based session refresh (`middleware.js`, `lib/supabase/middleware.js`)
- Pack creation API flow exists:
  - create/list packs (`app/api/packs/route.js`)
  - generate presigned S3 upload URLs (`app/api/upload/presign/route.js`)
- Upload builder UX exists for all 3 pack types:
  - daypack/weekpack/album builders in `components/upload/*`
  - schedule TOML generation using `@iarna/toml`
  - ZIP generation (`lib/upload/zip-utils.js`)
- Gallery data is DB-backed through `/api/packs` (`components/gallery/GalleryGrid.jsx`).
- Lint status: clean (`npm run lint` passes).

## Broken (high-confidence issues)

- `lib/data/index.js` exports symbols that do not exist in target files.
  - Examples: `getPackBySlug`, `getPopularPacks`, `updateUser`, etc. are exported but not defined in `lib/data/packs.js` / `lib/data/users.js`.
  - This will break any consumer importing those exports.
- Navbar links to `/docs`, but this route does not exist in the Next app (`components/navbar.jsx`).
- Docs links inside `docs/intro.md` and `docs/installation.md` reference pages not present in this repo (`/docs/configuration`, `/docs/gallery`, `/docs/troubleshooting`, `/docs/custom-packs`).
- Gallery pagination logic is incorrect:
  - `totalPages` is derived from current page length, not total DB count (`components/gallery/GalleryGrid.jsx`), so pagination is effectively broken for multi-page datasets.
- Category filters do not map to API filtering:
  - UI categories are theme tags (`nature`, `anime`, etc.) but API filter logic only applies `pack_type` (`daypack|weekpack|album`) in `components/gallery/GalleryGrid.jsx`.
- Schema mismatch with runtime code:
  - Code uses `packs.pack_type` and `favourites` table, but `lib/database/schema.sql` does not define `pack_type` on `packs` and does not define `favourites`.

## Incomplete (partially built)

- Upload page is not protected at route level:
  - docs describe protected routes, but `/upload` is publicly accessible and only fails at API submit if unauthenticated.
- Signup/profile flow is incomplete for `users` table consistency:
  - UI signup uses `supabase.auth.signUp` directly (`components/auth/multi-step-sign-up.jsx`) but does not create a `users` row in this app layer.
  - Multiple features read `users` table profile data (`components/navbar.jsx`, profile pages).
- Install section on homepage is stubbed and disabled:
  - component is minimal (`components/homepage/InstallSection.jsx`) and commented out in `app/page.js`.
- Gallery "rating" sort is placeholder only (`rating: 0` hardcoded in `components/gallery/GalleryGrid.jsx`).
- `FileUploader` advertises ZIP support but upload pipeline treats wallpacks as image-driven and ignores uploaded ZIP files in pack assembly (`components/upload/FileUploader.jsx`, `app/upload/page.js`, `lib/upload/zip-utils.js`).
- `docs/authentication.md` documents `POST /api/auth/signup`, but this route does not exist.

## Not Implemented Yet (based on docs + current app)

- Public docs experience inside this Next app (`/docs` route and docs pages).
- End-to-end moderation workflow:
  - schema references moderation fields/tables, but no moderation UI/routes in `app/`.
- Download tracking integration from pack detail page:
  - download helper library exists (`lib/data/downloads.js`), but pack detail page currently links directly to ZIP without recording download events.
- Complete data access layer promised by `lib/data/index.js` export surface is not implemented.

## Environment/Build Note

- Production build was not validated due local runtime/tooling issue (not app logic):
  - `npm run build` failed in this environment (Next/SWC cache permissions first, then Node 24 regex crash).
  - Lint is green, but build/runtime verification should be rerun in a supported Node/Next environment.

## Suggested Next Fix Order

1. Fix `lib/data/index.js` exports to match real functions.
2. Fix gallery filtering/pagination API contract (include total count from backend).
3. Add/restore docs routes or remove broken `/docs` links.
4. Align DB schema file with code (`pack_type`, `favourites`, any required constraints).
5. Enforce auth guard on `/upload` route (or clear UX warning before step flow).
6. Decide ZIP upload product behavior: remove ZIP from UI or support full ZIP ingestion path.
