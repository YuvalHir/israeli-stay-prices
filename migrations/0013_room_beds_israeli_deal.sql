-- Existing reports have unknown bed count and were not marked as Israeli deals.
ALTER TABLE reports ADD COLUMN beds INTEGER CHECK (beds IS NULL OR (beds BETWEEN 1 AND 20));
ALTER TABLE reports ADD COLUMN israeli_deal INTEGER NOT NULL DEFAULT 0 CHECK (israeli_deal IN (0, 1));
-- A deal is a free bed with paid breakfast and dinner; zero is valid only for this deal.
-- The older price > 0 constraint requires a table rebuild to admit this case.
-- Preserve votes during the table rebuild: deleting old reports cascades to votes.
CREATE TABLE report_votes_backup AS SELECT report_id, user_id, vote, created_at FROM report_votes;
PRAGMA defer_foreign_keys=ON;
CREATE TABLE reports_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  place_kind TEXT,
  lat REAL, lon REAL,
  area TEXT,
  country TEXT,
  price REAL NOT NULL CHECK (price > 0 OR (price = 0 AND israeli_deal = 1)),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  room TEXT NOT NULL CHECK (room IN ('dorm','private')),
  nights INTEGER NOT NULL DEFAULT 1,
  stay_month TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  hidden INTEGER NOT NULL DEFAULT 0,
  beds INTEGER CHECK (beds IS NULL OR (beds BETWEEN 1 AND 20)),
  israeli_deal INTEGER NOT NULL DEFAULT 0 CHECK (israeli_deal IN (0, 1))
);
INSERT INTO reports_new (id,user_id,place_id,place_name,place_kind,lat,lon,area,country,price,currency,room,nights,stay_month,note,created_at,hidden,beds,israeli_deal)
SELECT id,user_id,place_id,place_name,place_kind,lat,lon,area,country,price,currency,room,nights,stay_month,note,created_at,hidden,beds,israeli_deal FROM reports;
DROP TABLE reports;
ALTER TABLE reports_new RENAME TO reports;
CREATE INDEX idx_reports_place ON reports(place_id);
CREATE INDEX idx_reports_user ON reports(user_id);
CREATE INDEX idx_reports_created ON reports(created_at);
INSERT INTO report_votes (report_id, user_id, vote, created_at)
SELECT report_id, user_id, vote, created_at FROM report_votes_backup;
DROP TABLE report_votes_backup;
