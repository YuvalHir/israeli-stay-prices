-- Votes on a report: 1 = "I paid the same", -1 = "I paid more".
CREATE TABLE report_votes (
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK (vote IN (1, -1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (report_id, user_id)
);
CREATE INDEX idx_votes_report ON report_votes(report_id);
