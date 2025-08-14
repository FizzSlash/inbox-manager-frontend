-- Comprehensive database state checker
-- Run this BEFORE and AFTER restoration to compare

SELECT '=== DATABASE STATE REPORT ===' as report_section;

-- 1. Show all tables
SELECT 'TABLES IN DATABASE:' as section;
SELECT schemaname, tablename as table_name
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Show all views  
SELECT 'VIEWS IN DATABASE:' as section;
SELECT schemaname, viewname as view_name
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- 3. Show all custom functions
SELECT 'CUSTOM FUNCTIONS:' as section;
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as returns
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND prokind = 'f'
ORDER BY proname;

-- 4. Show all enum types
SELECT 'ENUM TYPES:' as section;
SELECT 
  t.typname as enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY t.typname
ORDER BY t.typname;

-- 5. Show brands table structure
SELECT 'BRANDS TABLE STRUCTURE:' as section;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'brands'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Show retention_harbor table structure  
SELECT 'RETENTION_HARBOR TABLE STRUCTURE:' as section;
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'retention_harbor'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Show upgrade_attempts table structure (if exists)
SELECT 'UPGRADE_ATTEMPTS TABLE STRUCTURE:' as section;
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') 
    THEN 'TABLE EXISTS'
    ELSE 'TABLE DOES NOT EXIST'
  END as table_status;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'upgrade_attempts'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. Show current brand data
SELECT 'CURRENT BRANDS DATA:' as section;
SELECT 
  id,
  name,
  subscription_plan,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_status')
    THEN trial_status::text
    ELSE 'NO TRIAL_STATUS COLUMN'
  END as trial_status,
  created_at
FROM brands
ORDER BY created_at DESC
LIMIT 5;

-- 9. Show RLS status
SELECT 'ROW LEVEL SECURITY STATUS:' as section;
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('brands', 'upgrade_attempts', 'retention_harbor')
ORDER BY tablename;

-- 10. Show triggers
SELECT 'TRIGGERS:' as section;
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

SELECT '=== END OF REPORT ===' as report_section;