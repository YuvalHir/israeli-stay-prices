import { NextRequest, NextResponse } from 'next/server';
// Country of the visitor from Cloudflare (IP based). Used only as a fallback when GPS is off.
export async function GET(req: NextRequest) {
  const c = req.headers.get('cf-ipcountry');
  return NextResponse.json({ country: c && /^[A-Z]{2}$/.test(c) ? c : null });
}
