-- One route pack costs one existing search credit, with a unique saved entitlement.
CREATE TABLE IF NOT EXISTS offline_route_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_key TEXT NOT NULL,
  request_id TEXT NOT NULL,
  stops_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_offline_route_user ON offline_route_searches(user_id, created_at);
CREATE UNIQUE INDEX idx_offline_route_request ON offline_route_searches(user_id, request_id);
-- Offline report retries are idempotent. A report owns the same id.
ALTER TABLE reports ADD COLUMN client_report_id TEXT;
CREATE UNIQUE INDEX idx_reports_user_client_id ON reports(user_id, client_report_id) WHERE client_report_id IS NOT NULL;
