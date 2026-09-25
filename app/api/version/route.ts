export const dynamic = 'force-dynamic';
/** Current deployed build, never cached. Old app copies compare against this and reload. */
export function GET() {
  return Response.json({ v: process.env.NEXT_PUBLIC_BUILD ?? '' }, { headers: { 'Cache-Control': 'no-store' } });
}
