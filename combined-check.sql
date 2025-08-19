-- ====================================================================
-- COMBINED DATABASE CHECK - Single query to show everything
-- ====================================================================

-- Check brands table columns
SELECT 
  'BRANDS_TABLE' as check_type,
  column_name as name,
  data_type as type,
  is_nullable as nullable,
  column_default as default_value
FROM information_schema.columns 
WHERE table_name = 'brands' AND table_schema = 'public'

UNION ALL

-- Check profiles table columns  
SELECT 
  'PROFILES_TABLE' as check_type,
  column_name as name,
  data_type as type,
  is_nullable as nullable,
  column_default as default_value
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public'

UNION ALL

-- Check retention_harbor critical columns
SELECT 
  'RETENTION_HARBOR_TABLE' as check_type,
  column_name as name,
  data_type as type,
  is_nullable as nullable,
  column_default as default_value
FROM information_schema.columns 
WHERE table_name = 'retention_harbor' AND table_schema = 'public'
  AND column_name IN ('id', 'brand_id', 'lead_email', 'status', 'opened', 'intent', 'first_name', 'last_name')

UNION ALL

-- Check upgrade_attempts table columns
SELECT 
  'UPGRADE_ATTEMPTS_TABLE' as check_type,
  column_name as name,
  data_type as type,
  is_nullable as nullable,
  column_default as default_value
FROM information_schema.columns 
WHERE table_name = 'upgrade_attempts' AND table_schema = 'public'

ORDER BY check_type, name;