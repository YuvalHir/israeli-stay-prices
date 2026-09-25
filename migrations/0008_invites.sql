-- Invite-only sign-up. Every user can create up to invite_quota single-use links; admins are unlimited.
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  inviter_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_by TEXT REFERENCES users(id),
  used_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS invites_inviter ON invites(inviter_id);
ALTER TABLE users ADD COLUMN invited_by TEXT;
ALTER TABLE users ADD COLUMN invite_quota INTEGER NOT NULL DEFAULT 10;
