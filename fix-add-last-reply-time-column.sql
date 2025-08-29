-- Add missing last_reply_time column to retention_harbor table
-- This column is used by the polling system to track when leads were last updated

ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS last_reply_time TIMESTAMPTZ;

-- Add an index for performance when filtering by timestamp
CREATE INDEX IF NOT EXISTS idx_retention_harbor_last_reply_time ON retention_harbor(last_reply_time);

-- Add an index for the polling system's brand_id + created_at query
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_created ON retention_harbor(brand_id, created_at);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'retention_harbor' 
AND column_name IN ('last_reply_time', 'created_at_lead')
ORDER BY column_name;

