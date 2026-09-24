import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { anonId, anonViewsLeft, creditState } from '@/lib/gate';

export async function GET() {
  const user = await currentUser();
  const { DB } = await env();
  if (!user) return NextResponse.json({ user: null, anonLeft: await anonViewsLeft(DB, await anonId()) });
  const c = await creditState(DB, user.id, !!user.is_admin);
  return NextResponse.json({ user: { name: user.name, email: user.email }, isAdmin: !!user.is_admin, ...c });
}
