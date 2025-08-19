SELECT 
  id, 
  name, 
  billing_cycle_start, 
  subscription_plan, 
  created_at,
  trial_started_at,
  trial_ends_at
FROM brands 
WHERE subscription_plan != 'trial'
ORDER BY created_at DESC;