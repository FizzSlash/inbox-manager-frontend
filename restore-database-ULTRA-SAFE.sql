-- ====================================================================
-- ULTRA-SAFE DATABASE RESTORATION SCRIPT
-- Handles type mismatches and all edge cases
-- ====================================================================

-- ===== STEP 1: SAFELY ADD COLUMNS TO BRANDS TABLE =====
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

-- ===== STEP 2: SAFELY CREATE ENUM TYPE =====
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

-- ===== STEP 3: SAFELY ADD TRIAL_STATUS COLUMN =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'trial_status') THEN
    ALTER TABLE brands ADD COLUMN trial_status trial_status_type DEFAULT 'none';
    RAISE NOTICE 'Added trial_status column to brands';
  ELSE
    RAISE NOTICE 'trial_status column already exists in brands';
  END IF;
END $$;

-- ===== STEP 4: SAFELY CREATE UPGRADE_ATTEMPTS TABLE =====
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

-- ===== STEP 5: SAFELY ADD INDEXES =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_upgrade_attempts_brand_id') THEN
    CREATE INDEX idx_upgrade_attempts_brand_id ON upgrade_attempts(brand_id);
    RAISE NOTICE 'Created idx_upgrade_attempts_brand_id index';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_upgrade_attempts_stripe_session') THEN
    CREATE INDEX idx_upgrade_attempts_stripe_session ON upgrade_attempts(stripe_session_id);
    RAISE NOTICE 'Created idx_upgrade_attempts_stripe_session index';
  END IF;
END $$;

-- ===== STEP 6: CHECK BRANDS TABLE ID TYPE =====
DO $$
DECLARE
  brands_id_type TEXT;
BEGIN
  -- Get the data type of brands.id column
  SELECT data_type INTO brands_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'brands' AND column_name = 'id';
  
  RAISE NOTICE 'brands.id column type is: %', brands_id_type;
END $$;

-- ===== STEP 7: SAFELY ADD ALL RETENTION_HARBOR COLUMNS =====
DO $$
DECLARE
  brands_id_type TEXT;
  brand_id_column_type TEXT;
  columns_to_add TEXT[][] := ARRAY[
    ['lead_email', 'TEXT'],
    ['lead_category', 'TEXT'],
    ['first_name', 'TEXT'],
    ['last_name', 'TEXT'],
    ['website', 'TEXT'],
    ['custom_field', 'TEXT'],
    ['subject', 'TEXT'],
    ['email_message_body', 'TEXT'],
    ['created_at_lead', 'TIMESTAMPTZ'],
    ['intent', 'INTEGER DEFAULT 1'],
    ['stage', 'TEXT'],
    ['campaign_ID', 'INTEGER'],
    ['lead_ID', 'INTEGER'],
    ['role', 'TEXT'],
    ['company_data', 'TEXT'],
    ['personal_linkedin_url', 'TEXT'],
    ['business_linkedin_url', 'TEXT'],
    ['phone', 'TEXT'],
    ['status', 'TEXT DEFAULT ''INBOX'''],
    ['notes', 'TEXT'],
    ['call_booked', 'BOOLEAN DEFAULT false'],
    ['deal_size', 'DECIMAL DEFAULT 0'],
    ['closed', 'BOOLEAN DEFAULT false'],
    ['email_account_id', 'TEXT'],
    ['source_api_key', 'TEXT'],
    ['parsed_convo', 'JSONB'],
    ['opened', 'BOOLEAN DEFAULT false']
  ];
  col_info TEXT[];
BEGIN
  -- Get the data type of brands.id to match it
  SELECT data_type INTO brands_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'brands' AND column_name = 'id';

  -- Determine the correct type for brand_id based on brands.id type
  IF brands_id_type = 'uuid' THEN
    brand_id_column_type := 'UUID';
  ELSE
    brand_id_column_type := 'TEXT';
  END IF;

  RAISE NOTICE 'Will create brand_id column as type: %', brand_id_column_type;

  -- Add brand_id column with matching type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'brand_id') THEN
    EXECUTE format('ALTER TABLE retention_harbor ADD COLUMN brand_id %s', brand_id_column_type);
    RAISE NOTICE 'Added brand_id column to retention_harbor as %', brand_id_column_type;
  ELSE
    RAISE NOTICE 'brand_id column already exists in retention_harbor';
  END IF;

  -- Add all other columns
  FOREACH col_info SLICE 1 IN ARRAY columns_to_add
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = col_info[1]) THEN
      EXECUTE format('ALTER TABLE retention_harbor ADD COLUMN %I %s', col_info[1], col_info[2]);
      RAISE NOTICE 'Added column % to retention_harbor', col_info[1];
    ELSE
      RAISE NOTICE 'Column % already exists in retention_harbor', col_info[1];
    END IF;
  END LOOP;
END $$;

-- ===== STEP 8: SAFELY ADD FOREIGN KEY CONSTRAINT ONLY IF TYPES MATCH =====
DO $$
DECLARE
  brands_id_type TEXT;
  retention_brand_id_type TEXT;
BEGIN
  -- Get both column types
  SELECT data_type INTO brands_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'brands' AND column_name = 'id';
  
  SELECT data_type INTO retention_brand_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'retention_harbor' AND column_name = 'brand_id';

  RAISE NOTICE 'brands.id type: %, retention_harbor.brand_id type: %', brands_id_type, retention_brand_id_type;

  -- Only add foreign key if types are compatible
  IF brands_id_type = retention_brand_id_type THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'retention_harbor_brand_id_fkey' 
      AND table_name = 'retention_harbor'
    ) THEN
      ALTER TABLE retention_harbor ADD CONSTRAINT retention_harbor_brand_id_fkey 
      FOREIGN KEY (brand_id) REFERENCES brands(id);
      RAISE NOTICE 'Added foreign key constraint for brand_id';
    ELSE
      RAISE NOTICE 'Foreign key constraint already exists for brand_id';
    END IF;
  ELSE
    RAISE NOTICE 'SKIPPING foreign key constraint - type mismatch: % vs %', brands_id_type, retention_brand_id_type;
  END IF;
END $$;

-- ===== STEP 9: SAFELY CLEAN DUPLICATES AND ADD UNIQUE CONSTRAINT =====
DO $$
BEGIN
  -- Only clean duplicates if lead_email column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'lead_email') THEN
    -- Clean up duplicates
    WITH duplicates AS (
      SELECT 
        lead_email,
        array_agg(id ORDER BY created_at DESC) as ids
      FROM retention_harbor 
      WHERE lead_email IS NOT NULL
      GROUP BY lead_email 
      HAVING COUNT(*) > 1
    )
    DELETE FROM retention_harbor 
    WHERE id IN (
      SELECT unnest(ids[2:]) 
      FROM duplicates
    );
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'unique_lead_email' 
      AND table_name = 'retention_harbor'
    ) THEN
      ALTER TABLE retention_harbor ADD CONSTRAINT unique_lead_email UNIQUE (lead_email);
      RAISE NOTICE 'Added unique constraint for lead_email';
    ELSE
      RAISE NOTICE 'Unique constraint already exists for lead_email';
    END IF;
  END IF;
END $$;

-- ===== STEP 10: SAFELY ADD MORE INDEXES =====
DO $$
DECLARE
  indexes_to_create TEXT[][] := ARRAY[
    ['idx_retention_harbor_lead_email', 'retention_harbor', 'lead_email'],
    ['idx_retention_harbor_brand_id', 'retention_harbor', 'brand_id'],
    ['idx_retention_harbor_status', 'retention_harbor', 'status'],
    ['idx_brands_trial_status', 'brands', 'trial_status'],
    ['idx_profiles_brand_id', 'profiles', 'brand_id']
  ];
  idx_info TEXT[];
BEGIN
  FOREACH idx_info SLICE 1 IN ARRAY indexes_to_create
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = idx_info[1]) THEN
      -- Check if the column exists before creating index
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = idx_info[2] AND column_name = idx_info[3]) THEN
        EXECUTE format('CREATE INDEX %I ON %I (%I)', idx_info[1], idx_info[2], idx_info[3]);
        RAISE NOTICE 'Created index %', idx_info[1];
      ELSE
        RAISE NOTICE 'Skipped index % - column % does not exist in table %', idx_info[1], idx_info[3], idx_info[2];
      END IF;
    ELSE
      RAISE NOTICE 'Index % already exists', idx_info[1];
    END IF;
  END LOOP;
END $$;

-- ===== STEP 11: SAFELY CREATE/REPLACE FUNCTIONS =====
-- Drop existing functions (safe to do)
DROP FUNCTION IF EXISTS create_brand_for_user(UUID, TEXT);
DROP FUNCTION IF EXISTS extend_trial(UUID, INTEGER);
DROP FUNCTION IF EXISTS bulk_expire_trials(UUID[]);
DROP FUNCTION IF EXISTS bulk_activate_trials(UUID[], INTEGER);
DROP FUNCTION IF EXISTS set_trial_status(UUID, trial_status_type);
DROP FUNCTION IF EXISTS update_upgrade_status(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS sync_plan_limits();

-- Create brand creation function
CREATE OR REPLACE FUNCTION create_brand_for_user(user_id UUID, user_email TEXT)
RETURNS UUID AS $$
DECLARE
  new_brand_id UUID;
BEGIN
  INSERT INTO brands (
    id,
    name, 
    subscription_plan, 
    trial_started_at, 
    trial_ends_at,
    trial_status,
    leads_used_this_month,
    max_leads_per_month,
    billing_cycle_start,
    price
  ) VALUES (
    gen_random_uuid(),
    'INSERT HERE',
    'trial',
    NOW(),
    NOW() + INTERVAL '7 days',
    'active'::trial_status_type,
    0,
    50,
    CURRENT_DATE,
    0
  )
  RETURNING id INTO new_brand_id;
  
  RETURN new_brand_id;
END;
$$ LANGUAGE plpgsql;

-- Create trial management functions
CREATE OR REPLACE FUNCTION extend_trial(brand_id_param UUID, days_to_add INTEGER DEFAULT 7)
RETURNS VOID AS $$
BEGIN
  UPDATE brands 
  SET 
    trial_ends_at = GREATEST(NOW(), trial_ends_at) + (days_to_add || ' days')::INTERVAL,
    trial_status = 'active'::trial_status_type
  WHERE id = brand_id_param AND subscription_plan = 'trial';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bulk_expire_trials(brand_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE brands 
  SET trial_status = 'expired'::trial_status_type
  WHERE id = ANY(brand_ids) 
    AND subscription_plan = 'trial';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bulk_activate_trials(brand_ids UUID[], extra_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE brands 
  SET 
    trial_ends_at = NOW() + (extra_days || ' days')::INTERVAL,
    trial_status = 'active'::trial_status_type
  WHERE id = ANY(brand_ids) 
    AND subscription_plan = 'trial';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_trial_status(brand_id_param UUID, status_param trial_status_type)
RETURNS VOID AS $$
BEGIN
  UPDATE brands 
  SET trial_status = status_param
  WHERE id = brand_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_upgrade_status(
  session_id TEXT,
  new_status TEXT,
  new_plan TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE upgrade_attempts 
  SET 
    status = new_status,
    updated_at = NOW(),
    plan = COALESCE(new_plan, plan)
  WHERE stripe_session_id = session_id;
END;
$$ LANGUAGE plpgsql;

-- Create sync_plan_limits function and trigger
CREATE OR REPLACE FUNCTION sync_plan_limits()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.subscription_plan
    WHEN 'trial' THEN
      NEW.max_leads_per_month := 50;
      NEW.price := 0;
      IF NEW.trial_status IS NULL THEN
        NEW.trial_status := 'active'::trial_status_type;
      END IF;
    WHEN 'starter' THEN
      NEW.max_leads_per_month := 300;
      NEW.price := 50;
      NEW.trial_status := 'none'::trial_status_type;
      NEW.trial_started_at := NULL;
      NEW.trial_ends_at := NULL;
    WHEN 'professional' THEN
      NEW.max_leads_per_month := 1000;
      NEW.price := 150;
      NEW.trial_status := 'none'::trial_status_type;
      NEW.trial_started_at := NULL;
      NEW.trial_ends_at := NULL;
    WHEN 'god' THEN
      NEW.max_leads_per_month := 999999;
      NEW.price := 500;
      NEW.trial_status := 'none'::trial_status_type;
      NEW.trial_started_at := NULL;
      NEW.trial_ends_at := NULL;
    ELSE
      NEW.max_leads_per_month := 50;
      NEW.price := 0;
      NEW.trial_status := 'none'::trial_status_type;
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===== STEP 12: SAFELY CREATE TRIGGER =====
DROP TRIGGER IF EXISTS sync_plan_limits_trigger ON brands;
CREATE TRIGGER sync_plan_limits_trigger
  BEFORE INSERT OR UPDATE OF subscription_plan ON brands
  FOR EACH ROW EXECUTE FUNCTION sync_plan_limits();

-- ===== STEP 13: SAFELY CREATE VIEW =====
CREATE OR REPLACE VIEW brand_trial_status AS
SELECT 
  b.id,
  b.name,
  b.subscription_plan,
  b.trial_started_at,
  b.trial_ends_at,
  b.trial_status,
  b.max_leads_per_month,
  b.leads_used_this_month,
  CASE 
    WHEN b.subscription_plan != 'trial' THEN 'active_paid'
    WHEN b.trial_status = 'expired' THEN 'trial_expired'
    WHEN b.trial_status = 'active' THEN 'trial_active'
    ELSE 'trial_inactive'
  END as status,
  CASE 
    WHEN b.subscription_plan != 'trial' THEN NULL
    WHEN b.trial_ends_at IS NULL THEN NULL
    WHEN b.trial_ends_at > NOW() THEN EXTRACT(days FROM (b.trial_ends_at - NOW()))
    ELSE 0
  END as days_remaining,
  (b.trial_status = 'expired') as is_trial_expired
FROM brands b;

-- ===== STEP 14: ENABLE RLS (SAFELY) =====
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_harbor ENABLE ROW LEVEL SECURITY;

-- Only enable RLS on upgrade_attempts if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') THEN
    ALTER TABLE upgrade_attempts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ===== STEP 15: SAFELY CREATE RLS POLICIES =====
-- Drop existing policies (safe)
DROP POLICY IF EXISTS "Users can view their own brands" ON brands;
DROP POLICY IF EXISTS "Service role can manage all brands" ON brands;
DROP POLICY IF EXISTS "Users can view their own upgrade attempts" ON upgrade_attempts;
DROP POLICY IF EXISTS "Service role can manage upgrade attempts" ON upgrade_attempts;
DROP POLICY IF EXISTS "Users can view their leads" ON retention_harbor;
DROP POLICY IF EXISTS "Service role can manage leads" ON retention_harbor;

-- Create policies
CREATE POLICY "Users can view their own brands" ON brands
  FOR SELECT USING (
    id IN (SELECT brand_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Service role can manage all brands" ON brands
  FOR ALL USING (auth.role() = 'service_role');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upgrade_attempts') THEN
    EXECUTE 'CREATE POLICY "Users can view their own upgrade attempts" ON upgrade_attempts
      FOR SELECT USING (
        brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid())
      )';
    
    EXECUTE 'CREATE POLICY "Service role can manage upgrade attempts" ON upgrade_attempts
      FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

CREATE POLICY "Users can view their leads" ON retention_harbor
  FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Service role can manage leads" ON retention_harbor
  FOR ALL USING (auth.role() = 'service_role');

-- ===== STEP 16: UPDATE EXISTING DATA (SAFELY) =====
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
  END IF;

  -- Update opened column if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'opened') THEN
    UPDATE retention_harbor SET opened = false WHERE opened IS NULL;
  END IF;
END $$;

-- ===== FINAL SUCCESS MESSAGE =====
SELECT 'ULTRA-SAFE DATABASE RESTORATION COMPLETE! ✅ All tables, functions, views, and policies are now up to date. Type mismatches handled safely.' as status;