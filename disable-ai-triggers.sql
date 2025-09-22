-- EMERGENCY: Disable all AI processing triggers
-- Run this in Supabase SQL Editor to stop hourly Claude usage

-- 1. Clear all pending AI tasks
UPDATE processing_queue 
SET status = 'cancelled' 
WHERE status IN ('pending', 'processing') 
  AND task_type = 'ai_intent';

-- 2. Check what was cleared
SELECT 
  'Tasks cancelled' as action,
  COUNT(*) as count
FROM processing_queue 
WHERE status = 'cancelled' 
  AND task_type = 'ai_intent'
  AND updated_at > NOW() - INTERVAL '1 minute';

-- 3. See remaining active tasks
SELECT 
  status,
  task_type,
  COUNT(*) as count
FROM processing_queue 
GROUP BY status, task_type
ORDER BY status, task_type;

-- 4. Check what's been calling the AI recently
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as ai_tasks_created,
  COUNT(DISTINCT brand_id) as brands_affected
FROM processing_queue 
WHERE task_type = 'ai_intent'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;