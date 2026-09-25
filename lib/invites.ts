import { randomToken } from './auth';

export const INVITE_COOKIE = 'sp_inv';
type DB = { prepare(q: string): any };

/** A code is usable when it exists, is unused, not revoked, and its inviter isn't banned. */
export async function validInvite(DB: DB, code: string | undefined | null) {
  if (!code || !/^[A-Za-z0-9_-]{6,40}$/.test(code)) return null;
  return await DB.prepare(`SELECT i.code, i.inviter_id, u.name AS inviter_name FROM invites i JOIN users u ON u.id = i.inviter_id
    WHERE i.code = ? AND i.used_by IS NULL AND i.revoked = 0 AND u.banned = 0`).bind(code).first() as { code: string; inviter_id: string; inviter_name: string | null } | null;
}

/** My links and how many I have left. Used/revoked links still count against the quota. */
export async function inviteState(DB: DB, userId: string, isAdmin: boolean) {
  const [{ results }, q, c] = await Promise.all([
    DB.prepare(`SELECT i.code, i.created_at, i.used_at, i.revoked, u.name AS used_name FROM invites i LEFT JOIN users u ON u.id = i.used_by
      WHERE i.inviter_id = ? ORDER BY i.created_at DESC LIMIT 200`).bind(userId).all(),
    DB.prepare('SELECT invite_quota FROM users WHERE id = ?').bind(userId).first() as Promise<{ invite_quota: number } | null>,
    DB.prepare('SELECT COUNT(*) AS n FROM invites WHERE inviter_id = ? AND (revoked = 0 OR used_by IS NOT NULL)').bind(userId).first() as Promise<{ n: number } | null>,
  ]);
  const quota = isAdmin ? 1000 : (q?.invite_quota ?? 10);
  const invites = (results as any[]).map(r => ({ code: r.code, created_at: r.created_at, used: !!r.used_at, revoked: !!r.revoked, used_name: r.used_name ? String(r.used_name).split(' ')[0] : null }));
  const counted = c?.n ?? 0;
  return { invites, quota, left: Math.max(0, quota - counted), unlimited: isAdmin };
}

export const newInviteCode = () => randomToken(9).replace(/[^A-Za-z0-9]/g, '').slice(0, 10) || randomToken(6);
