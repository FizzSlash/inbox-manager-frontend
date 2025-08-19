-- ====================================================================
-- FIX CRITICAL DATABASE ISSUES
-- ====================================================================

-- 1. UPDATE retention_harbor to link all leads to the correct brand
UPDATE retention_harbor 
SET brand_id = 'bb6c8504-dcd2-49f6-81d9-e05f8859f652'
WHERE brand_id IS NULL;

-- 2. Verify the update worked
SELECT 
  COUNT(*) as total_leads,
  COUNT(CASE WHEN brand_id IS NOT NULL THEN 1 END) as leads_with_brand_id,
  COUNT(CASE WHEN brand_id IS NULL THEN 1 END) as leads_without_brand_id
FROM retention_harbor;

-- 3. Check if we need to add any missing columns to retention_harbor
-- (Run this to see what columns are actually there)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'retention_harbor' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check api_settings structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'api_settings' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'Critical database issues should now be fixed! ✅' as status;