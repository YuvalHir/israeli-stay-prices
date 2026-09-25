import { NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { EVENTS, countEvent, type EventName } from '@/lib/events';

// Counts only. Stores the day and the event name, nothing about who sent it.
const CLIENT: EventName[] = ['area_view', 'place_view', 'search_pick', 'report_open', 'sleep_tap', 'share', 'login_open', 'gmap_open', 'install'];

export async function POST(req: NextRequest) {
  const name = (await req.text()).trim().slice(0, 32) as EventName;
  if (name in EVENTS && CLIENT.includes(name)) { const { DB } = await env(); await countEvent(DB, name); }
  return new Response(null, { status: 204 });
}
