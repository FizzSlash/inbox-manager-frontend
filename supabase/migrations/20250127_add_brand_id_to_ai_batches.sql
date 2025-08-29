-- Add brand_id column to ai_batches table for proper filtering
ALTER TABLE ai_batches ADD COLUMN IF NOT EXISTS brand_id UUID;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ai_batches_brand_id ON ai_batches(brand_id);
