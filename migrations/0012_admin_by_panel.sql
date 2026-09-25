-- Admins granted from the admin panel (kept across logins). Admins from ADMIN_EMAILS are re-synced on every login.
ALTER TABLE users ADD COLUMN admin_by_panel INTEGER NOT NULL DEFAULT 0;
