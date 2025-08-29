-- Fix processing_queue table to match queue processor expectations
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

-- Update the existing migration to include all expected columns
-- (This handles any missing columns that the queue processor might need)

-- Create the missing RPC function that the queue processor is calling
CREATE OR REPLACE FUNCTION get_next_tasks(batch_size INTEGER DEFAULT 1000)
RETURNS TABLE (
  id BIGINT,
  task_type TEXT,
  payload JSONB,
  status TEXT,
  priority INTEGER,
  brand_id UUID,
  lead_id BIGINT,
  batch_id TEXT,
  error_message TEXT,
  retry_count INTEGER,
  max_retries INTEGER,
  attempts INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pq.id,
    pq.task_type,
    pq.payload,
    pq.status,
    pq.priority,
    pq.brand_id,
    pq.lead_id,
    pq.batch_id,
    pq.error_message,
    pq.retry_count,
    pq.max_retries,
    pq.attempts,
    pq.created_at,
    pq.updated_at,
    pq.scheduled_for,
    pq.started_at,
    pq.completed_at
  FROM processing_queue pq
  WHERE pq.status IN ('pending', 'processing')
  ORDER BY pq.priority DESC, pq.created_at ASC
  LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;
