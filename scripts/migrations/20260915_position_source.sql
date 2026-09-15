-- Which feed relayed each position. NULL on rows written before this landed.
-- Idempotent: safe to apply on every deploy/startup.

ALTER TABLE vessel_positions ADD COLUMN IF NOT EXISTS source TEXT;
