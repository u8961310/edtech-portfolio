-- 2026-11-19：加不重複裝置數。對已存在的正式 D1 執行一次：
--   npx wrangler d1 execute edtech-analytics --remote --file=migrations/2026-11-19-device-key.sql
ALTER TABLE visits ADD COLUMN device_key TEXT;
DROP INDEX IF EXISTS idx_visits_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_dedup_dev
  ON visits(day, path, visitor_key, COALESCE(device_key, ''));
