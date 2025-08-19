-- ====================================================================
-- COMPREHENSIVE DATABASE VERIFICATION SCRIPT
-- Run this in your Supabase SQL Editor to verify restoration
-- ====================================================================

-- ===== 1. CHECK BRANDS TABLE STRUCTURE =====
SELECT 'Checking brands table structure...' as step;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'brands' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===== 2. CHECK FOR CRITICAL COLUMNS =====
SELECT 'Checking for critical columns...' as step;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_started_at') 
    THEN '✅ trial_started_at exists' 
    ELSE '❌ trial_started_at MISSING' 
  END as trial_started_check,
  
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_ends_at') 
    THEN '✅ trial_ends_at exists' 
    ELSE '❌ trial_ends_at MISSING' 
  END as trial_ends_check,
  
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_status') 
    THEN '✅ trial_status exists' 
    ELSE '❌ trial_status MISSING' 
  END as trial_status_check,
  
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'stripe_customer_id') 
    THEN '✅ stripe_customer_id exists' 
    ELSE '❌ stripe_customer_id MISSING' 
  END as stripe_customer_check,
  
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'stripe_subscription_id') 
    THEN '✅ stripe_subscription_id exists' 
    ELSE '❌ stripe_subscription_id MISSING' 
  END as stripe_subscription_check;

-- ===== 3. CHECK UPGRADE_ATTEMPTS TABLE =====
SELECT 'Checking upgrade_attempts table...' as step;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') 
    THEN '✅ upgrade_attempts table exists' 
    ELSE '❌ upgrade_attempts table MISSING' 
  END as upgrade_attempts_check;

-- Show structure if it exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'upgrade_attempts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===== 4. CHECK TRIAL_STATUS_TYPE ENUM =====
SELECT 'Checking trial_status_type enum...' as step;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trial_status_type') 
    THEN '✅ trial_status_type enum exists' 
    ELSE '❌ trial_status_type enum MISSING' 
  END as enum_check;

-- Show enum values if it exists
SELECT enumlabel as trial_status_values
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'trial_status_type'
ORDER BY e.enumsortorder;

-- ===== 5. CHECK RETENTION_HARBOR COLUMNS =====
SELECT 'Checking retention_harbor critical columns...' as step;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'brand_id') 
    THEN '✅ brand_id exists' 
    ELSE '❌ brand_id MISSING' 
  END as brand_id_check,
  
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'lead_email') 
    THEN '✅ lead_email exists' 
    ELSE '❌ lead_email MISSING' 
  END as lead_email_check,
  
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'status') 
    THEN '✅ status exists' 
    ELSE '❌ status MISSING' 
  END as status_check,
  
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'opened') 
    THEN '✅ opened exists' 
    ELSE '❌ opened MISSING' 
  END as opened_check,
  
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'intent') 
    THEN '✅ intent exists' 
    ELSE '❌ intent MISSING' 
  END as intent_check;

-- ===== 6. CHECK CRITICAL FUNCTIONS =====
SELECT 'Checking database functions...' as step;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_brand_for_user') 
    THEN '✅ create_brand_for_user function exists' 
    ELSE '❌ create_brand_for_user function MISSING' 
  END as create_brand_check,
  
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'extend_trial') 
    THEN '✅ extend_trial function exists' 
    ELSE '❌ extend_trial function MISSING' 
  END as extend_trial_check,
  
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_trial_expired') 
    THEN '✅ is_trial_expired function exists' 
    ELSE '❌ is_trial_expired function MISSING' 
  END as trial_check_function,
  
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_upgrade_status') 
    THEN '✅ update_upgrade_status function exists' 
    ELSE '❌ update_upgrade_status function MISSING' 
  END as upgrade_status_check;

-- ===== 7. CHECK BRAND_TRIAL_STATUS VIEW =====
SELECT 'Checking brand_trial_status view...' as step;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'brand_trial_status') 
    THEN '✅ brand_trial_status view exists' 
    ELSE '❌ brand_trial_status view MISSING' 
  END as view_check;

-- ===== 8. TEST FUNCTION EXECUTION =====
SELECT 'Testing function execution...' as step;

-- Test create_brand_for_user function with dummy data
SELECT 'Testing create_brand_for_user function...' as test;
DO $$
DECLARE
  test_brand_id UUID;
BEGIN
  BEGIN
    SELECT create_brand_for_user('550e8400-e29b-41d4-a716-446655440000', 'test@example.com') INTO test_brand_id;
    RAISE NOTICE '✅ create_brand_for_user works - Created brand: %', test_brand_id;
    
    -- Clean up test data
    DELETE FROM brands WHERE id = test_brand_id;
    RAISE NOTICE '✅ Test brand cleaned up';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ create_brand_for_user failed: %', SQLERRM;
  END;
END $$;

-- ===== 9. CHECK CURRENT BRAND DATA =====
SELECT 'Checking current brand data...' as step;

SELECT 
  id,
  name,
  subscription_plan,
  trial_status,
  trial_started_at,
  trial_ends_at,
  max_leads_per_month,
  stripe_customer_id IS NOT NULL as has_stripe_customer
FROM brands
ORDER BY created_at DESC
LIMIT 5;

-- ===== 10. CHECK RETENTION_HARBOR DATA INTEGRITY =====
SELECT 'Checking retention_harbor data integrity...' as step;

SELECT 
  COUNT(*) as total_leads,
  COUNT(CASE WHEN brand_id IS NOT NULL THEN 1 END) as leads_with_brand,
  COUNT(CASE WHEN brand_id IS NULL THEN 1 END) as leads_without_brand,
  COUNT(CASE WHEN lead_email IS NOT NULL THEN 1 END) as leads_with_email,
  COUNT(DISTINCT brand_id) as unique_brands_with_leads
FROM retention_harbor;

-- ===== 11. CHECK PROFILES DATA =====
SELECT 'Checking profiles data...' as step;

SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN brand_id IS NOT NULL THEN 1 END) as profiles_with_brands,
  COUNT(CASE WHEN brand_id IS NULL THEN 1 END) as profiles_without_brands
FROM profiles;

-- ===== 12. TEST BRAND_TRIAL_STATUS VIEW =====
SELECT 'Testing brand_trial_status view...' as step;

SELECT 
  id,
  name,
  subscription_plan,
  status,
  days_remaining,
  is_trial_expired
FROM brand_trial_status
LIMIT 3;

-- ===== 13. CHECK RLS POLICIES =====
SELECT 'Checking Row Level Security policies...' as step;

SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('brands', 'retention_harbor', 'upgrade_attempts', 'profiles')
ORDER BY tablename, policyname;

-- ===== 14. FINAL VERIFICATION SUMMARY =====
SELECT 'FINAL VERIFICATION SUMMARY' as step;

WITH checks AS (
  SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_started_at') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_ends_at') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_status') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trial_status_type') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_brand_for_user') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'brand_trial_status') THEN 1 ELSE 0 END as passed_checks
)
SELECT 
  passed_checks || '/7 critical components' as components_status,
  CASE 
    WHEN passed_checks = 7 THEN '🎉 ALL CHECKS PASSED - Database restoration successful!'
    WHEN passed_checks >= 5 THEN '⚠️ MOSTLY WORKING - Minor issues to fix'
    WHEN passed_checks >= 3 THEN '❌ PARTIAL RESTORATION - Major issues remain'
    ELSE '💥 RESTORATION FAILED - Critical components missing'
  END as overall_status,
  CASE 
    WHEN passed_checks = 7 THEN 'Your database is ready! You can proceed with testing the application.'
    ELSE 'Some components are missing. Check the individual results above and re-run the missing restoration scripts.'
  END as next_steps
FROM checks;

SELECT 'Verification complete! Check the results above.' as final_message;