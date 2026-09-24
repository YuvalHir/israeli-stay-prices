-- Anonymous place views per browser session (3 free before login).
CREATE TABLE anon_views (
  anon_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (anon_id, place_id)
);
-- Searches with prices. Each report or like earns 5; each area search spends 1.
CREATE TABLE searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat REAL NOT NULL, lon REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_searches_user ON searches(user_id, created_at);
