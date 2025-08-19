-- ====================================================================
-- DISCOVER COMPLETE DATABASE STRUCTURE
-- This will show ALL your tables, columns, types, and more
-- ====================================================================

-- 1. SHOW ALL TABLES IN PUBLIC SCHEMA
SELECT '=== ALL TABLES IN PUBLIC SCHEMA ===' as section;

SELECT 
  table_name,
  table_type,
  CASE 
    WHEN table_name LIKE '%brand%' THEN '🏢 Brand Related'
    WHEN table_name LIKE '%user%' OR table_name LIKE '%profile%' OR table_name LIKE '%auth%' THEN '👤 User Related'
    WHEN table_name LIKE '%lead%' OR table_name LIKE '%retention%' OR table_name LIKE '%harbor%' THEN '📧 Lead Related'
    WHEN table_name LIKE '%trial%' OR table_name LIKE '%subscription%' OR table_name LIKE '%plan%' THEN '⏰ Trial/Subscription'
    WHEN table_name LIKE '%stripe%' OR table_name LIKE '%payment%' OR table_name LIKE '%upgrade%' THEN '💳 Payment Related'
    WHEN table_name LIKE '%api%' OR table_name LIKE '%setting%' THEN '⚙️ Settings/Config'
    WHEN table_name LIKE '%crm%' OR table_name LIKE '%stage%' THEN '📊 CRM Related'
    ELSE '📋 Other'
  END as category
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY 
  CASE 
    WHEN table_name LIKE '%brand%' THEN 1
    WHEN table_name LIKE '%user%' OR table_name LIKE '%profile%' THEN 2
    WHEN table_name LIKE '%lead%' OR table_name LIKE '%retention%' THEN 3
    ELSE 4
  END,
  table_name;

-- 2. SHOW ALL VIEWS
SELECT '=== ALL VIEWS ===' as section;

SELECT table_name as view_name
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. DETAILED COLUMN INFO FOR EACH TABLE
SELECT '=== DETAILED COLUMN INFORMATION ===' as section;

SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  CASE 
    WHEN c.column_name LIKE '%brand%' THEN '🏢'
    WHEN c.column_name LIKE '%user%' OR c.column_name LIKE '%profile%' THEN '👤'
    WHEN c.column_name LIKE '%trial%' THEN '⏰'
    WHEN c.column_name LIKE '%stripe%' OR c.column_name LIKE '%payment%' THEN '💳'
    WHEN c.column_name LIKE '%lead%' OR c.column_name LIKE '%email%' THEN '📧'
    WHEN c.column_name LIKE '%created%' OR c.column_name LIKE '%updated%' THEN '📅'
    WHEN c.column_name LIKE '%id' THEN '🔑'
    ELSE '📋'
  END as icon
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
  AND c.table_schema = 'public'
ORDER BY 
  CASE 
    WHEN t.table_name LIKE '%brand%' THEN 1
    WHEN t.table_name LIKE '%profile%' THEN 2
    WHEN t.table_name LIKE '%retention%' OR t.table_name LIKE '%lead%' THEN 3
    ELSE 4
  END,
  t.table_name, 
  c.ordinal_position;

-- 4. SHOW ALL CUSTOM TYPES/ENUMS
SELECT '=== CUSTOM TYPES AND ENUMS ===' as section;

SELECT 
  t.typname as type_name,
  t.typtype as type_category,
  CASE t.typtype
    WHEN 'e' THEN 'ENUM'
    WHEN 'c' THEN 'COMPOSITE'
    WHEN 'b' THEN 'BASE'
    ELSE 'OTHER'
  END as type_description
FROM pg_type t
WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND t.typtype IN ('e', 'c')
ORDER BY t.typname;

-- Show enum values
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder as sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY t.typname, e.enumsortorder;

-- 5. SHOW ALL FUNCTIONS/PROCEDURES
SELECT '=== CUSTOM FUNCTIONS ===' as section;

SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  CASE 
    WHEN p.proname LIKE '%brand%' THEN '🏢 Brand Related'
    WHEN p.proname LIKE '%trial%' THEN '⏰ Trial Related'
    WHEN p.proname LIKE '%user%' OR p.proname LIKE '%profile%' THEN '👤 User Related'
    WHEN p.proname LIKE '%stripe%' OR p.proname LIKE '%payment%' OR p.proname LIKE '%upgrade%' THEN '💳 Payment Related'
    WHEN p.proname LIKE '%crm%' THEN '📊 CRM Related'
    ELSE '📋 Other'
  END as category
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'  -- functions only, not procedures
ORDER BY 
  CASE 
    WHEN p.proname LIKE '%brand%' THEN 1
    WHEN p.proname LIKE '%trial%' THEN 2
    WHEN p.proname LIKE '%user%' THEN 3
    ELSE 4
  END,
  p.proname;

-- 6. SHOW FOREIGN KEY RELATIONSHIPS
SELECT '=== FOREIGN KEY RELATIONSHIPS ===' as section;

SELECT
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name as to_table,
  ccu.column_name as to_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 7. SHOW INDEXES
SELECT '=== INDEXES ===' as section;

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 8. ROW COUNTS FOR EACH TABLE
SELECT '=== TABLE ROW COUNTS ===' as section;

-- This will show how much data you have in each table
SELECT 
  table_name,
  (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
  SELECT 
    table_name,
    query_to_xml(format('SELECT count(*) as cnt FROM %I.%I', 'public', table_name), false, true, '') as xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
) t
ORDER BY row_count DESC;

-- 9. IDENTIFY POTENTIAL MAIN TABLES
SELECT '=== ANALYSIS: POTENTIAL MAIN TABLES ===' as section;

SELECT 
  'Based on naming patterns, these appear to be your main tables:' as analysis;

SELECT 
  table_name,
  CASE 
    WHEN table_name LIKE '%brand%' THEN '🏢 Likely your BRANDS table (multi-tenancy)'
    WHEN table_name LIKE '%profile%' OR table_name LIKE '%user%' THEN '👤 Likely your USERS/PROFILES table'
    WHEN table_name LIKE '%retention%' OR table_name LIKE '%harbor%' OR table_name LIKE '%lead%' THEN '📧 Likely your LEADS table'
    WHEN table_name LIKE '%upgrade%' OR table_name LIKE '%attempt%' THEN '💳 Likely your PAYMENT TRACKING table'
    WHEN table_name LIKE '%api%' AND table_name LIKE '%setting%' THEN '⚙️ Likely your API SETTINGS table'
    ELSE '❓ Purpose unclear'
  END as likely_purpose
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND (
    table_name LIKE '%brand%' OR 
    table_name LIKE '%profile%' OR 
    table_name LIKE '%user%' OR
    table_name LIKE '%retention%' OR 
    table_name LIKE '%harbor%' OR 
    table_name LIKE '%lead%' OR
    table_name LIKE '%upgrade%' OR
    table_name LIKE '%api%setting%'
  )
ORDER BY table_name;

SELECT 'DATABASE DISCOVERY COMPLETE! 🎉' as final_status;