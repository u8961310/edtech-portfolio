CREATE TABLE IF NOT EXISTS visits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  day          TEXT    NOT NULL,
  path         TEXT    NOT NULL,
  source_type  TEXT    NOT NULL,
  org_name     TEXT,
  ptr_domain   TEXT,
  asn          INTEGER,
  as_org       TEXT,
  visitor_key  TEXT    NOT NULL,
  created_at   TEXT    NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_dedup
  ON visits(day, path, visitor_key);

CREATE TABLE IF NOT EXISTS org_cache (
  ip24        TEXT PRIMARY KEY,
  org_name    TEXT,
  org_name_en TEXT,
  net_block   TEXT,
  fetched_at  TEXT NOT NULL
);
