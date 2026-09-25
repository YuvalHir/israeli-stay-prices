-- Anonymous daily counters for key actions (no user id, no IP, no place): one row per day per event.
CREATE TABLE IF NOT EXISTS event_counts (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);
