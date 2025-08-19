-- ====================================================================
-- 7. FINAL VERIFICATION & CLEANUP
-- Verifies everything is working and cleans up test data
-- ====================================================================

-- Clean up any test data that might have been created
DELETE FROM brands WHERE name = 'INSERT HERE' AND subscription_plan = 'trial' AND leads_used_this_month = 0;
DELETE FROM profiles WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Verification checks
DO $$
DECLARE
  brands_trial_columns_count INTEGER;
  retention_columns_count INTEGER;
  upgrade_table_exists BOOLEAN;
  functions_count INTEGER;
  view_exists BOOLEAN;
  enum_exists BOOLEAN;
BEGIN
  -- Check brands table has trial columns
  SELECT COUNT(*) INTO brands_trial_columns_count
  FROM information_schema.columns 
  WHERE table_name = 'brands' 
    AND column_name IN ('trial_started_at', 'trial_ends_at', 'trial_status', 'stripe_customer_id', 'stripe_subscription_id');

  -- Check retention_harbor has key columns
  SELECT COUNT(*) INTO retention_columns_count
  FROM information_schema.columns 
  WHERE table_name = 'retention_harbor' 
    AND column_name IN ('lead_email', 'brand_id', 'opened', 'intent', 'status');

  -- Check upgrade_attempts table exists
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') INTO upgrade_table_exists;

  -- Check functions exist
  SELECT COUNT(*) INTO functions_count
  FROM pg_proc 
  WHERE proname IN ('create_brand_for_user', 'extend_trial', 'bulk_expire_trials', 'set_trial_status');

  -- Check view exists
  SELECT EXISTS(SELECT 1 FROM information_schema.views WHERE table_name = 'brand_trial_status') INTO view_exists;

  -- Check enum exists
  SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'trial_status_type') INTO enum_exists;

  -- Report results
  RAISE NOTICE '=== DATABASE RESTORATION VERIFICATION ===';
  RAISE NOTICE 'Brands trial columns: % of 5', brands_trial_columns_count;
  RAISE NOTICE 'Retention harbor columns: % of 5', retention_columns_count;
  RAISE NOTICE 'Upgrade attempts table: %', upgrade_table_exists;
  RAISE NOTICE 'Trial functions: % of 4', functions_count;
  RAISE NOTICE 'Brand trial status view: %', view_exists;
  RAISE NOTICE 'Trial status enum: %', enum_exists;

  IF brands_trial_columns_count = 5 AND 
     retention_columns_count = 5 AND 
     upgrade_table_exists AND 
     functions_count = 4 AND 
     view_exists AND 
     enum_exists THEN
    RAISE NOTICE '🎉 ALL CHECKS PASSED - Database restoration successful!';
  ELSE
    RAISE NOTICE '⚠️  Some components may be missing - check individual scripts';
  END IF;
END $$;

-- Show current brand counts by plan
SELECT 
  subscription_plan,
  trial_status,
  COUNT(*) as count
FROM brands 
GROUP BY subscription_plan, trial_status
ORDER BY subscription_plan;

-- Show sample from brand_trial_status view
SELECT 
  subscription_plan,
  status,
  days_remaining,
  is_trial_expired,
  COUNT(*) as count
FROM brand_trial_status
GROUP BY subscription_plan, status, days_remaining, is_trial_expired
ORDER BY subscription_plan;

SELECT 'Database restoration verification complete! ✅' as status;