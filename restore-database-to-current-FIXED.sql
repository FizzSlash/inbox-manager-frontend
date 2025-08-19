-- ====================================================================
-- COMPLETE DATABASE RESTORATION SCRIPT (FIXED)
-- Brings database to current state expected by the application
-- Run this after August 13th 2pm restore point
-- ====================================================================

-- ===== 1. BRANDS TABLE UPDATES =====
-- Add missing trial system columns
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Create trial status enum type
CREATE TYPE IF NOT EXISTS trial_status_type AS ENUM ('active', 'expired', 'none');

-- Add trial_status column
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_status trial_status_type DEFAULT 'none';

-- ===== 2. UPGRADE ATTEMPTS TABLE =====
-- Create table for tracking Stripe checkout sessions
CREATE TABLE IF NOT EXISTS upgrade_attempts (
  id SERIAL PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_upgrade_attempts_brand_id ON upgrade_attempts(brand_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_attempts_stripe_session ON upgrade_attempts(stripe_session_id);

-- ===== 3. RETENTION_HARBOR TABLE UPDATES =====
-- Add missing columns if they don't exist (CORRECT column names from application)
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS lead_email TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS lead_category TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS custom_field TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS email_message_body TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS created_at_lead TIMESTAMPTZ;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS intent INTEGER DEFAULT 1;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS campaign_ID INTEGER;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS lead_ID INTEGER;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS company_data TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS personal_linkedin_url TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS business_linkedin_url TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'INBOX';
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS call_booked BOOLEAN DEFAULT false;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS deal_size DECIMAL DEFAULT 0;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS closed BOOLEAN DEFAULT false;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS email_account_id TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS source_api_key TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS parsed_convo JSONB;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS opened BOOLEAN DEFAULT false;

-- Clean up existing duplicates BEFORE adding constraint
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

-- Add unique constraint (WITHOUT IF NOT EXISTS - not supported)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_lead_email' 
    AND table_name = 'retention_harbor'
  ) THEN
    ALTER TABLE retention_harbor ADD CONSTRAINT unique_lead_email UNIQUE (lead_email);
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_retention_harbor_lead_email ON retention_harbor (lead_email);
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_id ON retention_harbor (brand_id);
CREATE INDEX IF NOT EXISTS idx_retention_harbor_status ON retention_harbor (status);

-- ===== 4. DATABASE FUNCTIONS =====

-- Drop existing functions to allow updates
DROP FUNCTION IF EXISTS create_brand_for_user(UUID, TEXT);
DROP FUNCTION IF EXISTS extend_trial(UUID, INTEGER);
DROP FUNCTION IF EXISTS bulk_expire_trials(UUID[]);
DROP FUNCTION IF EXISTS bulk_activate_trials(UUID[], INTEGER);
DROP FUNCTION IF EXISTS set_trial_status(UUID, trial_status_type);
DROP FUNCTION IF EXISTS update_upgrade_status(TEXT, TEXT, TEXT);

-- Create brand creation function (returns UUID)
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

-- Function to extend trial
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

-- Function to bulk expire trials
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

-- Function to bulk extend/activate trials
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

-- Function to set trial status manually
CREATE OR REPLACE FUNCTION set_trial_status(brand_id_param UUID, status_param trial_status_type)
RETURNS VOID AS $$
BEGIN
  UPDATE brands 
  SET trial_status = status_param
  WHERE id = brand_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to update upgrade attempt status
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

-- Enhanced sync_plan_limits function
CREATE OR REPLACE FUNCTION sync_plan_limits()
RETURNS TRIGGER AS $$
BEGIN
  -- Set default limits and trial status based on subscription plan
  CASE NEW.subscription_plan
    WHEN 'trial' THEN
      NEW.max_leads_per_month := 50;
      NEW.price := 0;
      -- Keep existing trial_status if set, otherwise default to 'active'
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

-- ===== 5. TRIGGERS =====
-- Create trigger for sync_plan_limits
DROP TRIGGER IF EXISTS sync_plan_limits_trigger ON brands;
CREATE TRIGGER sync_plan_limits_trigger
  BEFORE INSERT OR UPDATE OF subscription_plan ON brands
  FOR EACH ROW EXECUTE FUNCTION sync_plan_limits();

-- ===== 6. VIEWS =====
-- Create brand_trial_status view
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

-- ===== 7. ROW LEVEL SECURITY (RLS) =====
-- Enable RLS on tables
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE upgrade_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_harbor ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own brands" ON brands;
DROP POLICY IF EXISTS "Service role can manage all brands" ON brands;
DROP POLICY IF EXISTS "Users can view their own upgrade attempts" ON upgrade_attempts;
DROP POLICY IF EXISTS "Service role can manage upgrade attempts" ON upgrade_attempts;
DROP POLICY IF EXISTS "Users can view their leads" ON retention_harbor;
DROP POLICY IF EXISTS "Service role can manage leads" ON retention_harbor;

-- Create RLS policies for brands
CREATE POLICY "Users can view their own brands" ON brands
  FOR SELECT USING (
    id IN (
      SELECT brand_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all brands" ON brands
  FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for upgrade_attempts
CREATE POLICY "Users can view their own upgrade attempts" ON upgrade_attempts
  FOR SELECT USING (
    brand_id IN (
      SELECT brand_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage upgrade attempts" ON upgrade_attempts
  FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for retention_harbor (leads)
CREATE POLICY "Users can view their leads" ON retention_harbor
  FOR SELECT USING (
    brand_id IN (
      SELECT brand_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage leads" ON retention_harbor
  FOR ALL USING (auth.role() = 'service_role');

-- ===== 8. UPDATE EXISTING DATA =====
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

-- Set default opened=false for existing leads
UPDATE retention_harbor SET opened = false WHERE opened IS NULL;

-- ===== 9. INDEXES FOR PERFORMANCE =====
CREATE INDEX IF NOT EXISTS idx_brands_trial_expiration ON brands(trial_ends_at) WHERE subscription_plan = 'trial';
CREATE INDEX IF NOT EXISTS idx_brands_trial_status ON brands(trial_status);
CREATE INDEX IF NOT EXISTS idx_profiles_brand_id ON profiles(brand_id);

-- ===== COMPLETION MESSAGE =====
SELECT 'Database restoration complete! All tables, functions, views, and policies are now up to date.' as status;