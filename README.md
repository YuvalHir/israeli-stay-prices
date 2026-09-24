# מחיר ללילה · כמה ישראלים שילמו ללילה?

**Live:** https://israeli-stay-prices.hyuval1511.workers.dev

אפליקציה (PWA) שבה מטיילים ישראלים משתפים כמה באמת שילמו ללילה במלון, הוסטל, גסטהאוס או טי-האוס, בכל העולם. מוצאים את המקומות סביבך על מפה, רואים מה אחרים שילמו במטבע המקומי, ומדרגים דיווחים (👍 שילמתי אותו דבר / 👎 שילמתי יותר). 3 מקומות חינם, ואחרי דיווח אחד הכל פתוח.

A Hebrew, mobile-first PWA where Israeli travellers share what they paid per night for lodging worldwide. Open source, free-tier only.

## Stack
- Next.js 16 on Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare)
- Cloudflare D1 (`migrations/`)
- Sign in with Google (OAuth 2.0 + PKCE), sessions in D1
- OpenStreetMap: Photon / Nominatim + Leaflet map, no API keys

## Run your own
```bash
npm install
npx wrangler login
npx wrangler d1 create stay-prices        # put the id in wrangler.jsonc
npm run db:migrate:remote
```
Google OAuth client (console.cloud.google.com/auth/clients, type "Web application"):
- Redirect URI: `https://<your-worker>/api/auth/callback`
- Put the client ID in `wrangler.jsonc` → `vars.GOOGLE_CLIENT_ID`, set `APP_URL`
- `npx wrangler secret put GOOGLE_CLIENT_SECRET`
- Optional: `npx wrangler secret put ADMIN_EMAILS` (comma-separated admin emails)
- Set the consent screen's publishing status to "In production"

Deploy: `npm run deploy`, or push to `main` with a `CLOUDFLARE_API_TOKEN` repo secret (Workers Scripts Edit, D1 Edit, Account Settings Read) and let GitHub Actions deploy. If you fork, change `CLOUDFLARE_ACCOUNT_ID` in `.github/workflows/deploy.yml`.

Local: copy `.dev.vars.example` to `.dev.vars`, `npm run db:migrate:local`, `npm run preview`.

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md) (works for Claude Code, Codex, Cursor, Copilot and humans).

## Privacy
Prices are shown without the reporter's name or email. Your location is only used for the map search and is never stored.

## License
[MIT](./LICENSE)
