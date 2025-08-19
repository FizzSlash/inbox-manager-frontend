-- ====================================================================
-- SIMPLE DATABASE CHECK - Run this first to see basic status
-- ====================================================================

-- 1. Check if brands table exists and basic structure
SELECT 'Step 1: Checking brands table...' as status;

SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'brands' AND table_schema = 'public';

-- 2. Show brands table columns
SELECT 'Step 2: Brands table columns...' as status;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'brands' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if specific trial columns exist
SELECT 'Step 3: Trial column checks...' as status;

SELECT 
  CASE WHEN COUNT(*) > 0 THEN 'trial_started_at ✅ EXISTS' ELSE 'trial_started_at ❌ MISSING' END as trial_started_check
FROM information_schema.columns 
WHERE table_name = 'brands' AND column_name = 'trial_started_at';

SELECT 
  CASE WHEN COUNT(*) > 0 THEN 'trial_ends_at ✅ EXISTS' ELSE 'trial_ends_at ❌ MISSING' END as trial_ends_check
FROM information_schema.columns 
WHERE table_name = 'brands' AND column_name = 'trial_ends_at';

SELECT 
  CASE WHEN COUNT(*) > 0 THEN 'trial_status ✅ EXISTS' ELSE 'trial_status ❌ MISSING' END as trial_status_check
FROM information_schema.columns 
WHERE table_name = 'brands' AND column_name = 'trial_status';

-- 4. Check retention_harbor table
SELECT 'Step 4: Checking retention_harbor table...' as status;

SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'retention_harbor' AND table_schema = 'public';

-- 5. Check upgrade_attempts table
SELECT 'Step 5: Checking upgrade_attempts table...' as status;

SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'upgrade_attempts' AND table_schema = 'public';

-- 6. Check trial_status_type enum
SELECT 'Step 6: Checking trial_status_type enum...' as status;

SELECT typname, typtype 
FROM pg_type 
WHERE typname = 'trial_status_type';

-- 7. Show current brand data (first 3 rows)
SELECT 'Step 7: Current brand data...' as status;

SELECT id, name, subscription_plan, created_at
FROM brands 
ORDER BY created_at DESC 
LIMIT 3;

-- 8. Check profiles table
SELECT 'Step 8: Checking profiles table...' as status;

SELECT COUNT(*) as total_profiles,
       COUNT(brand_id) as profiles_with_brand_id
FROM profiles;

SELECT 'BASIC CHECK COMPLETE' as final_status;