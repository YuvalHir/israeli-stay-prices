import { NextResponse } from 'next/server';

// Daily mid-market rates (USD base) from ExchangeRate-API's free open endpoint, cached for 6 hours.
// Attribution required: "Rates By Exchange Rate API" (shown in the footer).
export async function GET() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { cf: { cacheTtl: 21600, cacheEverything: true } } as RequestInit);
    const j = await r.json() as { result: string; rates: Record<string, number>; time_last_update_utc: string };
    if (j.result !== 'success') throw new Error('rates');
    return NextResponse.json({ base: 'USD', rates: j.rates, updated: j.time_last_update_utc },
      { headers: { 'Cache-Control': 'public, max-age=21600' } });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
