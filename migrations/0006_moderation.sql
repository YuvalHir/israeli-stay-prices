-- Admin moderation: hide a report without deleting it, and block a user from reporting/voting.
ALTER TABLE reports ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_reports_created ON reports(created_at);
