-- Add missing attempts column to processing_queue table
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
