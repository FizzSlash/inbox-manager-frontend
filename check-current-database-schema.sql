-- ====================================================================
-- COMPLETE DATABASE SCHEMA CHECKER
-- Run this in your Supabase SQL Editor to see everything you currently have
-- ====================================================================

SELECT '=== CURRENT DATABASE ANALYSIS ===' as section;

-- 1. Show all tables
SELECT 'TABLES IN YOUR DATABASE:' as info;
SELECT 
  schemaname,
  tablename as table_name,
  tableowner as owner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Show all views
SELECT 'VIEWS IN YOUR DATABASE:' as info;
SELECT 
  schemaname,
  viewname as view_name
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- 3. Show all custom enum types
SELECT 'ENUM TYPES:' as info;
SELECT 
  t.typname as enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY t.typname
ORDER BY t.typname;

-- 4. Show all custom functions
SELECT 'CUSTOM FUNCTIONS:' as info;
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as returns
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND prokind = 'f'
ORDER BY proname;

-- 5. DETAILED table structures for key tables
SELECT 'BRANDS TABLE STRUCTURE:' as info;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'brands' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'RETENTION_HARBOR TABLE STRUCTURE:' as info;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'retention_harbor' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'PROFILES TABLE STRUCTURE:' as info;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Check for expected tables from your app
SELECT 'MISSING TABLES CHECK:' as info;
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brands') THEN '✅ brands' ELSE '❌ brands' END as brands,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN '✅ profiles' ELSE '❌ profiles' END as profiles,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'retention_harbor') THEN '✅ retention_harbor' ELSE '❌ retention_harbor' END as retention_harbor,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'navvii_ai_settings') THEN '✅ navvii_ai_settings' ELSE '❌ navvii_ai_settings' END as navvii_ai_settings,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_settings') THEN '✅ api_settings' ELSE '❌ api_settings' END as api_settings,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') THEN '✅ upgrade_attempts' ELSE '❌ upgrade_attempts' END as upgrade_attempts,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_settings') THEN '✅ crm_settings' ELSE '❌ crm_settings' END as crm_settings;

-- 7. Check for expected columns in key tables
SELECT 'BRANDS TABLE COLUMNS CHECK:' as info;
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_started_at') THEN '✅ trial_started_at' ELSE '❌ trial_started_at' END as trial_started_at,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_ends_at') THEN '✅ trial_ends_at' ELSE '❌ trial_ends_at' END as trial_ends_at,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_status') THEN '✅ trial_status' ELSE '❌ trial_status' END as trial_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'stripe_customer_id') THEN '✅ stripe_customer_id' ELSE '❌ stripe_customer_id' END as stripe_customer_id;

SELECT 'RETENTION_HARBOR COLUMNS CHECK:' as info;
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'lead_email') THEN '✅ lead_email' ELSE '❌ lead_email' END as lead_email,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'brand_id') THEN '✅ brand_id' ELSE '❌ brand_id' END as brand_id,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'status') THEN '✅ status' ELSE '❌ status' END as status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'opened') THEN '✅ opened' ELSE '❌ opened' END as opened,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'intent') THEN '✅ intent' ELSE '❌ intent' END as intent;

-- 8. Show constraints and indexes
SELECT 'TABLE CONSTRAINTS:' as info;
SELECT 
  table_name,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name IN ('brands', 'retention_harbor', 'profiles', 'navvii_ai_settings', 'api_settings', 'upgrade_attempts', 'crm_settings')
ORDER BY table_name, constraint_type;

-- 9. Show RLS status
SELECT 'ROW LEVEL SECURITY STATUS:' as info;
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  hasindices as has_indexes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 10. Sample data counts
SELECT 'DATA COUNTS:' as info;
DO $$
DECLARE
  rec record;
  query text;
  count_result int;
BEGIN
  FOR rec IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('brands', 'retention_harbor', 'profiles', 'navvii_ai_settings', 'api_settings', 'upgrade_attempts')
  LOOP
    query := 'SELECT COUNT(*) FROM ' || rec.tablename;
    EXECUTE query INTO count_result;
    RAISE NOTICE '%: % rows', rec.tablename, count_result;
  END LOOP;
END $$;

SELECT '=== ANALYSIS COMPLETE ===' as section;