-- Add missing max_attempts column to processing_queue table
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;
