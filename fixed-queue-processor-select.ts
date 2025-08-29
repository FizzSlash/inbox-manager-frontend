// In your queue processor, replace the SELECT * with specific columns:

// REPLACE THIS:
const { data: tasks, error: tasksError } = await supabase
  .from('processing_queue')
  .select('*')
  .in('status', ['pending', 'processing'])
  .order('priority', { ascending: false })
  .order('created_at', { ascending: true })
  .limit(1000);

// WITH THIS:
const { data: tasks, error: tasksError } = await supabase
  .from('processing_queue')
  .select('id, task_type, payload, status, priority, brand_id, lead_id, batch_id, created_at')
  .in('status', ['pending', 'processing'])
  .order('priority', { ascending: false })
  .order('created_at', { ascending: true })
  .limit(1000);
