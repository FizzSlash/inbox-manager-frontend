-- Check if Stripe fields are populated for the professional user
SELECT 
  id, 
  name, 
  subscription_plan,
  stripe_customer_id,
  stripe_subscription_id,
  CASE 
    WHEN stripe_customer_id IS NULL THEN 'MISSING'
    ELSE 'Present'
  END as customer_id_status,
  CASE 
    WHEN stripe_subscription_id IS NULL THEN 'MISSING' 
    ELSE 'Present'
  END as subscription_id_status
FROM brands 
WHERE id = '5dab1d71-3bae-4c22-988d-d5961b2c7db2';