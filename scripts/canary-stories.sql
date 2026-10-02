-- Immutable evidence snapshots for shared investigation stories.
-- Apply as the database owner after scripts/canary-schema.sql.
CREATE TABLE IF NOT EXISTS canary.investigation_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  region VARCHAR(24) NOT NULL CHECK (region IN ('hormuz', 'suez', 'babel_mandeb', 'gulf_of_aden')),
  claim_id VARCHAR(40) NOT NULL CHECK (claim_id IN ('hormuz-stopped', 'suez-disruption', 'regional-activity')),
  comparison_window VARCHAR(4) NOT NULL CHECK (comparison_window IN ('24h', '7d')),
  claim_text VARCHAR(180) NOT NULL,
  annotation VARCHAR(500) NOT NULL DEFAULT '',
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object' AND octet_length(snapshot::text) <= 131072)
);

CREATE INDEX IF NOT EXISTS idx_canary_investigation_stories_created
  ON canary.investigation_stories(created_at DESC);

ALTER TABLE canary.investigation_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS canary_story_read ON canary.investigation_stories;
CREATE POLICY canary_story_read ON canary.investigation_stories
  FOR SELECT TO straits_canary USING (true);
DROP POLICY IF EXISTS canary_story_insert ON canary.investigation_stories;
CREATE POLICY canary_story_insert ON canary.investigation_stories
  FOR INSERT TO straits_canary WITH CHECK (true);

REVOKE ALL ON canary.investigation_stories FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON canary.investigation_stories FROM straits_canary;
GRANT SELECT, INSERT ON canary.investigation_stories TO straits_canary;
