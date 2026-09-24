# AGENTS.md

Guide for AI coding agents (Claude Code, Codex, Cursor, Copilot, Gemini...) and humans working on this repo.

## What this is
"מחיר ללילה" - a Hebrew, RTL, mobile-first PWA where Israeli travellers share what they paid per night for lodging (hotels, hostels, guesthouses, tea houses) anywhere in the world. Places are found by location on a map.

Gate: a visitor can open 3 places per browser session (anon cookie). Then login. A signed-in user earns 5 "searches with prices" per report and per 👍 on someone else's report (👎 prompts a report; only the report counts). Each area search spends one; a search unlocks prices within 8 km for 12 hours. See lib/gate.ts.

## Stack
- Next.js 16 (App Router, React 19, TypeScript) running on Cloudflare Workers through `@opennextjs/cloudflare`
- Cloudflare D1 (SQLite) - binding `DB`, schema in `migrations/`
- Google Sign-In (OAuth 2.0 authorization code + PKCE), sessions stored in D1 (only the SHA-256 of the cookie token)
- OpenStreetMap: Photon for nearby lodging and reverse country lookup, Nominatim for search, Leaflet + OSM tiles for the map. No API keys.
- Deployed by GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`: runs D1 migrations, then `npm run deploy`.

## Layout
- `components/App.tsx` - the whole client UI (landing, onboarding, area/map list, place detail, report form, votes, share)
- `app/page.tsx` - home route, renders `App`
- `app/p/[key]/[[...slug]]/page.tsx` - server-rendered place page `/p/<osm-type>-<osm-id>/<slug>` (unique OSM id is the key, slug is cosmetic and redirects to canonical). Metadata, canonical, OG, schema.org JSON-LD. Never render prices on the server: they go through the gate in the browser.
- `app/sitemap.ts`, `app/robots.ts` - sitemap of places with reports; robots disallows `/api/` and `/admin`
- `app/admin/page.tsx` - admin panel (stats, reports, users)
- `app/api/*` - route handlers: `photos` (Wikimedia photos via OSM wikidata/commons tags, area fallback; hotlinked, never stored), `auth/{google,callback,me,logout}`, `reports` (GET counts / POST report), `views` (the 3-free-views gate + prices), `votes` (👍 paid the same / 👎 paid more), `rates` (daily FX from ExchangeRate-API, cached 6h, attribution required), `geo` (country from `cf-ipcountry`), `admin`
- `lib/` - `placeUrl.ts` (place keys/slugs/paths), `placeLookup.ts` (Nominatim lookup by OSM id, D1 fallback), `photos.ts` (Wikimedia), `auth.ts` (sessions, `currentUser`, `currentAdmin`), `places.ts` (OSM lookups, quick areas), `currency.ts` (country -> currency, flags, formatting), `gate.ts`, `env.ts`
- `components/StayMap.tsx` - Leaflet map, client-only (loaded with `next/dynamic`, `ssr: false`)
- `migrations/` - numbered D1 SQL migrations. Never edit an applied migration's behaviour; add a new file.

## Commands
```bash
npm install
npm run dev                 # Next dev server (no D1 bindings; use preview for full stack)
npm run db:migrate:local    # local D1
npm run preview             # build with OpenNext and run locally in workerd
npx next build              # type-check + build (run before every PR)
npm run deploy              # manual deploy (normally CI does this)
```
Local secrets: copy `.dev.vars.example` to `.dev.vars`.

## Conventions
- UI text is Hebrew and the page is `dir="rtl"`. Keep copy short and friendly. No em dashes.
- Mobile first: test at 390px width. Tap targets at least 44px.
- Design tokens are CSS variables at the top of `app/globals.css`. Reuse `.card`, `.btn`, `.chip`, `.seg` instead of new one-off styles.
- Never expose who reported a price (no name/email in public APIs). Admin API is the only place emails appear.
- Every API that changes data must call `currentUser()` (or `currentAdmin()` for admin) first.
- Currency codes are ISO 4217; country codes ISO 3166-1 alpha-2, uppercase.
- Keep the free tier: no paid services, no API keys in the client. No image hosting: photos are hotlinked from Wikimedia Commons with author + license shown.
- Respect OSM usage policies (attribution in the footer and map; no bulk scraping).

## Secrets and config (never commit)
- `GOOGLE_CLIENT_SECRET` - Worker secret
- `ADMIN_EMAILS` - Worker secret, comma-separated emails promoted to admin on login
- `CLOUDFLARE_API_TOKEN` - GitHub Actions secret used by the deploy workflow
- Public config lives in `wrangler.jsonc` `vars` (`APP_URL`, `GOOGLE_CLIENT_ID`).

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<optional scope>): <subject>

<optional body: what and why, wrapped at 72 chars>

<optional footer: BREAKING CHANGE: ..., Closes #12>
```

- Types: `feat` (new feature), `fix` (bug fix), `docs`, `style` (formatting, no logic change), `refactor`, `perf`, `test`, `build` (deps, bundling), `ci`, `chore`.
- Scopes are optional, for example `ui`, `api`, `gate`, `db`, `auth`, `admin`, `share`, `pwa`, `photos`.
- Subject: imperative mood ("add", not "added"), lowercase after the colon, no trailing period, max ~72 chars, in English.
- One logical change per commit. Put the reason in the body when it isn't obvious.
- Breaking changes: add `!` after the type (`feat(api)!: ...`) and a `BREAKING CHANGE:` footer.

Examples:
```
feat(photos): show Wikimedia photos for places with fallback to area photos
fix(gate): count a like as a report only on other users' reports
docs: document conventional commits
```

## Before you open a PR
1. `npx next build` passes (TypeScript clean).
2. New tables/columns come with a new migration in `migrations/`.
3. Check the change on a phone-sized screen in RTL.
4. Commit messages follow Conventional Commits (see above).
