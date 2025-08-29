-- Fix: Add missing get_next_tasks function for queue processor
-- This function is being called by the queue processor but doesn't exist

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

-- Also create the complete_task and fail_task functions that might be missing
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
