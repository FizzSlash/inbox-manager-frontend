-- Fix billing cycle to enable proration testing
-- Set billing cycle to start 15 days ago (middle of current month)

UPDATE brands 
SET billing_cycle_start = CURRENT_DATE - INTERVAL '15 days'
WHERE id = '5dab1d71-3bae-4c22-988d-d5961b2c7db2'
  AND subscription_plan = 'professional';

-- Verify the change
SELECT 
  id, 
  name, 
  billing_cycle_start, 
  subscription_plan,
  CURRENT_DATE as today,
  CURRENT_DATE - billing_cycle_start as days_into_cycle
FROM brands 
WHERE id = '5dab1d71-3bae-4c22-988d-d5961b2c7db2';