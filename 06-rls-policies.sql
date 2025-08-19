-- ====================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- Sets up security policies for all tables
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first (safe)
DROP POLICY IF EXISTS "Users can view their own brands" ON brands;
DROP POLICY IF EXISTS "Service role can manage all brands" ON brands;

-- Create RLS policies for brands table
CREATE POLICY "Users can view their own brands" ON brands
  FOR SELECT USING (
    id IN (SELECT brand_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Service role can manage all brands" ON brands
  FOR ALL USING (auth.role() = 'service_role');

-- Add index to support the RLS policy
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_brand_id') THEN
    -- Check if profiles table and brand_id column exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'brand_id') THEN
      CREATE INDEX idx_profiles_brand_id ON profiles(brand_id);
      RAISE NOTICE 'Created idx_profiles_brand_id index';
    ELSE
      RAISE NOTICE 'Skipped idx_profiles_brand_id index - profiles table or brand_id column not found';
    END IF;
  ELSE
    RAISE NOTICE 'idx_profiles_brand_id index already exists';
  END IF;
END $$;

SELECT 'RLS policies setup complete! ✅' as status;