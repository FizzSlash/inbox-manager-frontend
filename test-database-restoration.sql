-- Test script to verify database restoration worked correctly

-- 1. Check that all required tables exist
SELECT 'Testing table existence...' as test_phase;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brands') THEN '✅'
    ELSE '❌'
  END as brands_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') THEN '✅'
    ELSE '❌'
  END as upgrade_attempts_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'retention_harbor') THEN '✅'
    ELSE '❌'
  END as retention_harbor_table;

-- 2. Check that brands table has all required columns
SELECT 'Testing brands table columns...' as test_phase;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_status') THEN '✅'
    ELSE '❌'
  END as trial_status_column,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_started_at') THEN '✅'
    ELSE '❌'
  END as trial_started_at_column,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'stripe_customer_id') THEN '✅'
    ELSE '❌'
  END as stripe_customer_id_column;

-- 3. Check that enum type exists
SELECT 'Testing enum type...' as test_phase;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trial_status_type') THEN '✅'
    ELSE '❌'
  END as trial_status_enum_exists;

-- 4. Check that functions exist
SELECT 'Testing functions...' as test_phase;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_brand_for_user') THEN '✅'
    ELSE '❌'
  END as create_brand_function,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'extend_trial') THEN '✅'
    ELSE '❌'
  END as extend_trial_function,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bulk_expire_trials') THEN '✅'
    ELSE '❌'
  END as bulk_expire_function;

-- 5. Check that view exists
SELECT 'Testing view...' as test_phase;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'brand_trial_status') THEN '✅'
    ELSE '❌'
  END as brand_trial_status_view;

-- 6. Test the create_brand_for_user function
SELECT 'Testing brand creation function...' as test_phase;

SELECT create_brand_for_user('550e8400-e29b-41d4-a716-446655440000', 'test@example.com') as test_brand_id;

-- 7. Show current brands and their trial status
SELECT 'Current brands status:' as info;

SELECT 
  id,
  name,
  subscription_plan,
  trial_status,
  trial_started_at,
  trial_ends_at,
  max_leads_per_month
FROM brands
ORDER BY created_at DESC
LIMIT 5;

-- 8. Test the view
SELECT 'Testing brand_trial_status view:' as info;

SELECT 
  id,
  subscription_plan,
  trial_status,
  status,
  days_remaining,
  is_trial_expired
FROM brand_trial_status
LIMIT 3;

SELECT 'Database restoration test complete! ✅' as final_status;