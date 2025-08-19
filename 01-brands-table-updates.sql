-- ====================================================================
-- 1. BRANDS TABLE UPDATES
-- Adds trial system columns to existing brands table
-- ====================================================================

-- Add missing trial system columns
DO $$
BEGIN
  -- Add trial_started_at if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_started_at') THEN
    ALTER TABLE brands ADD COLUMN trial_started_at TIMESTAMPTZ;
    RAISE NOTICE 'Added trial_started_at column to brands';
  ELSE
    RAISE NOTICE 'trial_started_at column already exists in brands';
  END IF;

  -- Add trial_ends_at if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE brands ADD COLUMN trial_ends_at TIMESTAMPTZ;
    RAISE NOTICE 'Added trial_ends_at column to brands';
  ELSE
    RAISE NOTICE 'trial_ends_at column already exists in brands';
  END IF;

  -- Add stripe_customer_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE brands ADD COLUMN stripe_customer_id TEXT;
    RAISE NOTICE 'Added stripe_customer_id column to brands';
  ELSE
    RAISE NOTICE 'stripe_customer_id column already exists in brands';
  END IF;

  -- Add stripe_subscription_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE brands ADD COLUMN stripe_subscription_id TEXT;
    RAISE NOTICE 'Added stripe_subscription_id column to brands';
  ELSE
    RAISE NOTICE 'stripe_subscription_id column already exists in brands';
  END IF;
END $$;

-- Create trial status enum type
DO $$
BEGIN
  -- Check if the enum type exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trial_status_type') THEN
    CREATE TYPE trial_status_type AS ENUM ('active', 'expired', 'none');
    RAISE NOTICE 'Created trial_status_type enum';
  ELSE
    RAISE NOTICE 'trial_status_type enum already exists';
  END IF;
END $$;

-- Add trial_status column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_status') THEN
    ALTER TABLE brands ADD COLUMN trial_status trial_status_type DEFAULT 'none';
    RAISE NOTICE 'Added trial_status column to brands';
  ELSE
    RAISE NOTICE 'trial_status column already exists in brands';
  END IF;
END $$;

-- Add index for trial_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_brands_trial_status') THEN
    CREATE INDEX idx_brands_trial_status ON brands(trial_status);
    RAISE NOTICE 'Created idx_brands_trial_status index';
  ELSE
    RAISE NOTICE 'idx_brands_trial_status index already exists';
  END IF;
END $$;

-- Update existing data
DO $$
BEGIN
  -- Only update if trial_status column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_status') THEN
    -- Set proper trial_status for existing brands
    UPDATE brands 
    SET 
      trial_started_at = NULL,
      trial_ends_at = NULL,
      trial_status = 'none'::trial_status_type
    WHERE subscription_plan != 'trial';

    -- Set trial_status for existing trial plans
    UPDATE brands 
    SET trial_status = CASE 
      WHEN trial_ends_at IS NULL THEN 'active'::trial_status_type
      WHEN trial_ends_at > NOW() THEN 'active'::trial_status_type
      ELSE 'expired'::trial_status_type
    END
    WHERE subscription_plan = 'trial';
    
    RAISE NOTICE 'Updated existing brands with proper trial_status';
  END IF;
END $$;

SELECT 'Brands table updates complete! ✅' as status;