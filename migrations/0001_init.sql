-- Users signed in with Google
CREATE TABLE users (
  id TEXT PRIMARY KEY,            -- Google "sub"
  email TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,            -- random token (cookie value is its SHA-256 source)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- What someone paid for one night
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,         -- e.g. osm-N-123456, or manual-<name>
  place_name TEXT NOT NULL,
  place_kind TEXT,
  lat REAL, lon REAL,
  area TEXT,
  price REAL NOT NULL CHECK (price > 0),
  currency TEXT NOT NULL CHECK (currency IN ('NPR','USD','ILS')),
  room TEXT NOT NULL CHECK (room IN ('dorm','private')),
  nights INTEGER NOT NULL DEFAULT 1,
  stay_month TEXT NOT NULL,       -- YYYY-MM
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reports_place ON reports(place_id);
CREATE INDEX idx_reports_user ON reports(user_id);

-- Which places a user has unlocked (the 3-free-views gate)
CREATE TABLE place_views (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, place_id)
);
