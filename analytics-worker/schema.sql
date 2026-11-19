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
  device_key   TEXT,                 -- 瀏覽器隨機編號的 SALT 雜湊；2026-11-19 前的資料為 NULL
  created_at   TEXT    NOT NULL
);

-- 同一 IP 底下不同裝置要分開記（教室共用 NAT），所以去重鍵要含 device_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_dedup_dev
  ON visits(day, path, visitor_key, COALESCE(device_key, ''));

CREATE TABLE IF NOT EXISTS org_cache (
  ip24        TEXT PRIMARY KEY,
  org_name    TEXT,
  org_name_en TEXT,
  net_block   TEXT,
  fetched_at  TEXT NOT NULL
);
