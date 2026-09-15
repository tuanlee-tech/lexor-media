-- Existing D1 databases only: apply once, before the worker patch is deployed.
-- Manual drag order overrides date order. NULL means automatic date order.
ALTER TABLE media_items ADD COLUMN manual_order INTEGER DEFAULT NULL;
