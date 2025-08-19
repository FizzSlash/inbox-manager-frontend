-- ====================================================================
-- URGENT DATABASE FIXES - Run these in your Supabase SQL Editor
-- ====================================================================

-- 1. FIX RETENTION_HARBOR: Link all leads to your brand
UPDATE retention_harbor 
SET brand_id = 'bb6c8504-dcd2-49f6-81d9-e05f8859f652'
WHERE brand_id IS NULL;

-- Verify the fix worked
SELECT 
  COUNT(*) as total_leads,
  COUNT(CASE WHEN brand_id IS NOT NULL THEN 1 END) as leads_with_brand,
  COUNT(CASE WHEN brand_id IS NULL THEN 1 END) as leads_without_brand
FROM retention_harbor;

-- 2. CHECK if api_settings has the right structure
INSERT INTO api_settings (brand_id, esp_type, api_key, sender_email, sender_name) 
VALUES ('bb6c8504-dcd2-49f6-81d9-e05f8859f652', 'sendgrid', 'your-api-key-here', 'your-email@domain.com', 'Your Name')
ON CONFLICT (brand_id) DO UPDATE SET
  esp_type = EXCLUDED.esp_type,
  updated_at = NOW();

-- 3. Check retention_harbor table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'retention_harbor' 
ORDER BY ordinal_position;

-- 4. Add any missing essential columns to retention_harbor (if needed)
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS lead_email TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'INBOX';
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS opened BOOLEAN DEFAULT true;

-- 5. Update RLS policies to allow proper access (if needed)
-- This might be blocking your data access
DROP POLICY IF EXISTS "Users can view own brand retention_harbor" ON retention_harbor;
CREATE POLICY "Users can view own brand retention_harbor" ON retention_harbor
  FOR ALL USING (
    brand_id IN (
      SELECT brand_id FROM profiles WHERE id = auth.uid()
    )
  );

SELECT 'Database fixes applied! ✅' as status;