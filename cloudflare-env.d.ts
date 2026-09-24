// Regenerate with `npm run cf-typegen` after editing wrangler.jsonc.
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APP_URL: string;
  ADMIN_EMAILS?: string;
}
