-- Drop existing functions first
DROP FUNCTION IF EXISTS get_next_tasks(integer);
DROP FUNCTION IF EXISTS complete_task(bigint);
DROP FUNCTION IF EXISTS fail_task(bigint, text);

-- Drop and recreate processing_queue table with ALL expected columns
DROP TABLE IF EXISTS processing_queue CASCADE;

-- Create processing_queue table with all columns your system expects
CREATE TABLE processing_queue (
  id BIGSERIAL PRIMARY KEY,
  task_type TEXT NOT NULL DEFAULT 'ai_intent',
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 1,
  brand_id UUID NOT NULL,
  lead_id BIGINT,
  batch_id TEXT,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_brand_id ON processing_queue(brand_id);
CREATE INDEX idx_processing_queue_scheduled_for ON processing_queue(scheduled_for);
CREATE INDEX idx_processing_queue_priority_created ON processing_queue(priority DESC, created_at ASC);

-- Create the RPC functions your queue processor calls
CREATE OR REPLACE FUNCTION get_next_tasks(batch_size INTEGER DEFAULT 1000)
RETURNS SETOF processing_queue AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM processing_queue
  WHERE status IN ('pending', 'processing')
  ORDER BY priority DESC, created_at ASC
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a task
CREATE OR REPLACE FUNCTION complete_task(task_id_param BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE processing_queue 
  SET status = 'completed', 
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = task_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to fail a task
CREATE OR REPLACE FUNCTION fail_task(task_id_param BIGINT, error_msg TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE processing_queue 
  SET status = 'failed', 
      error_message = error_msg,
      updated_at = NOW()
  WHERE id = task_id_param;
END;
$$ LANGUAGE plpgsql;

-- Add brand_id column to ai_batches if it doesn't exist
ALTER TABLE ai_batches ADD COLUMN IF NOT EXISTS brand_id UUID;
