-- ====================================================================
-- 2. UPGRADE ATTEMPTS TABLE
-- Creates table for tracking Stripe checkout sessions
-- ====================================================================

-- Create upgrade_attempts table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') THEN
    CREATE TABLE upgrade_attempts (
      id SERIAL PRIMARY KEY,
      brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      plan TEXT NOT NULL,
      stripe_session_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'initiated',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    RAISE NOTICE 'Created upgrade_attempts table';
  ELSE
    RAISE NOTICE 'upgrade_attempts table already exists';
  END IF;
END $$;

-- Add indexes for performance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_upgrade_attempts_brand_id') THEN
    CREATE INDEX idx_upgrade_attempts_brand_id ON upgrade_attempts(brand_id);
    RAISE NOTICE 'Created idx_upgrade_attempts_brand_id index';
  ELSE
    RAISE NOTICE 'idx_upgrade_attempts_brand_id index already exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_upgrade_attempts_stripe_session') THEN
    CREATE INDEX idx_upgrade_attempts_stripe_session ON upgrade_attempts(stripe_session_id);
    RAISE NOTICE 'Created idx_upgrade_attempts_stripe_session index';
  ELSE
    RAISE NOTICE 'idx_upgrade_attempts_stripe_session index already exists';
  END IF;
END $$;

-- Enable RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') THEN
    ALTER TABLE upgrade_attempts ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on upgrade_attempts table';
  END IF;
END $$;

-- Create RLS policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view their own upgrade attempts" ON upgrade_attempts;
    DROP POLICY IF EXISTS "Service role can manage upgrade attempts" ON upgrade_attempts;
    
    -- Create new policies
    EXECUTE 'CREATE POLICY "Users can view their own upgrade attempts" ON upgrade_attempts
      FOR SELECT USING (
        brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid())
      )';
    
    EXECUTE 'CREATE POLICY "Service role can manage upgrade attempts" ON upgrade_attempts
      FOR ALL USING (auth.role() = ''service_role'')';
      
    RAISE NOTICE 'Created RLS policies for upgrade_attempts';
  END IF;
END $$;

SELECT 'Upgrade attempts table setup complete! ✅' as status;