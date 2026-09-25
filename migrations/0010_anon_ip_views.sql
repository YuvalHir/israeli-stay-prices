-- Free views per network per day, so clearing cookies doesn't reset the 3 free views.
-- ip_hash is an HMAC of the IP and the day (keyed with a server secret); the raw IP is never stored. Rows are deleted after 2 days.
CREATE TABLE IF NOT EXISTS anon_ip_views (
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  place_id TEXT NOT NULL,
  PRIMARY KEY (ip_hash, day, place_id)
);
CREATE INDEX IF NOT EXISTS idx_anon_ip_views_day ON anon_ip_views(day);
