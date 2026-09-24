-- Any ISO currency (not only NPR/USD/ILS), plus the country where the stay was.
CREATE TABLE reports_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  place_kind TEXT,
  lat REAL, lon REAL,
  area TEXT,
  country TEXT,
  price REAL NOT NULL CHECK (price > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  room TEXT NOT NULL CHECK (room IN ('dorm','private')),
  nights INTEGER NOT NULL DEFAULT 1,
  stay_month TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO reports_new (id, user_id, place_id, place_name, place_kind, lat, lon, area, price, currency, room, nights, stay_month, note, created_at)
  SELECT id, user_id, place_id, place_name, place_kind, lat, lon, area, price, currency, room, nights, stay_month, note, created_at FROM reports;
DROP TABLE reports;
ALTER TABLE reports_new RENAME TO reports;
CREATE INDEX idx_reports_place ON reports(place_id);
CREATE INDEX idx_reports_user ON reports(user_id);

-- Admins
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
-- Admins are promoted on login from the ADMIN_EMAILS secret (comma-separated).
