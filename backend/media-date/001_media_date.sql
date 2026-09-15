-- Existing D1 databases only: apply once, before the worker patch is deployed.
-- Existing rows intentionally remain undated; do not backfill from created_at.
ALTER TABLE media_items ADD COLUMN media_date TEXT DEFAULT NULL;
