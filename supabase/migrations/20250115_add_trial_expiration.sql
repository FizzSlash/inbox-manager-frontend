-- FIXED: Brand creation with trials (UUID compatible)

-- 1. Add trial columns
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- 2. Drop the old function first, then create the FIXED version
DROP FUNCTION IF EXISTS create_brand_for_user(UUID, TEXT);

-- Create the FIXED brand creation function - returns UUID not INTEGER
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
    leads_used_this_month,
    max_leads_per_month,
    billing_cycle_start,
    price
  ) VALUES (
    gen_random_uuid(),  -- Generate new UUID for the brand
    'INSERT HERE',
    'trial',
    NOW(),
    NOW() + INTERVAL '7 days',
    0,
    50,
    CURRENT_DATE,
    0
  )
  RETURNING id INTO new_brand_id;
  
  RETURN new_brand_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Function to extend trial (for you to use) - FIXED to use UUID
CREATE OR REPLACE FUNCTION extend_trial(brand_id_param UUID, days_to_add INTEGER DEFAULT 7)
RETURNS VOID AS $$
BEGIN
  UPDATE brands 
  SET trial_ends_at = GREATEST(NOW(), trial_ends_at) + (days_to_add || ' days')::INTERVAL
  WHERE id = brand_id_param AND subscription_plan = 'trial';
END;
$$ LANGUAGE plpgsql;

-- 4. Function to initialize brand trial - FIXED to use UUID
CREATE OR REPLACE FUNCTION initialize_brand_trial(brand_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE brands 
  SET trial_started_at = NOW(), trial_ends_at = NOW() + INTERVAL '7 days'
  WHERE id = brand_id_param;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to check if trial is expired - FIXED to use UUID
CREATE OR REPLACE FUNCTION is_trial_expired(brand_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  expiry_date TIMESTAMPTZ;
  current_plan TEXT;
BEGIN
  SELECT trial_ends_at, subscription_plan 
  INTO expiry_date, current_plan
  FROM brands 
  WHERE id = brand_id_param;
  
  -- If not on trial, never expired
  IF current_plan != 'trial' THEN
    RETURN FALSE;
  END IF;
  
  -- If no expiry date, treat as not expired
  IF expiry_date IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN expiry_date < NOW();
END;
$$ LANGUAGE plpgsql;

-- 6. Enhanced sync_plan_limits function to handle trials
CREATE OR REPLACE FUNCTION sync_plan_limits()
RETURNS TRIGGER AS $$
BEGIN
  -- Set default limits based on subscription plan
  CASE NEW.subscription_plan
    WHEN 'trial' THEN
      NEW.max_leads_per_month := 50;
      NEW.price := 0;
    WHEN 'starter' THEN
      NEW.max_leads_per_month := 300;
      NEW.price := 50;
    WHEN 'professional' THEN
      NEW.max_leads_per_month := 1000;
      NEW.price := 150;
    WHEN 'god' THEN
      NEW.max_leads_per_month := 999999;
      NEW.price := 500;
    ELSE
      NEW.max_leads_per_month := 50; -- Default to trial limits
      NEW.price := 0;
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS sync_plan_limits_trigger ON brands;
CREATE TRIGGER sync_plan_limits_trigger
  BEFORE INSERT OR UPDATE OF subscription_plan ON brands
  FOR EACH ROW EXECUTE FUNCTION sync_plan_limits();

-- 8. Add index for trial expiration queries
CREATE INDEX IF NOT EXISTS idx_brands_trial_expiration ON brands(trial_ends_at) WHERE subscription_plan = 'trial';

-- 9. Add RLS policies for brands table
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see brands they belong to
CREATE POLICY "Users can view their own brands" ON brands
  FOR SELECT USING (
    id IN (
      SELECT brand_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Service role can do everything (for functions)
CREATE POLICY "Service role can manage all brands" ON brands
  FOR ALL USING (auth.role() = 'service_role');

-- 10. Create view for easy trial status checking
CREATE OR REPLACE VIEW brand_trial_status AS
SELECT 
  b.id,
  b.name,
  b.subscription_plan,
  b.trial_started_at,
  b.trial_ends_at,
  b.max_leads_per_month,
  b.leads_used_this_month,
  CASE 
    WHEN b.subscription_plan != 'trial' THEN 'active_paid'
    WHEN b.trial_ends_at IS NULL THEN 'trial_active'
    WHEN b.trial_ends_at > NOW() THEN 'trial_active'
    ELSE 'trial_expired'
  END as status,
  CASE 
    WHEN b.subscription_plan != 'trial' THEN NULL
    WHEN b.trial_ends_at IS NULL THEN NULL
    WHEN b.trial_ends_at > NOW() THEN EXTRACT(days FROM (b.trial_ends_at - NOW()))
    ELSE 0
  END as days_remaining,
  (b.trial_ends_at < NOW() AND b.subscription_plan = 'trial') as is_trial_expired
FROM brands b;

-- 11. Test the function
SELECT create_brand_for_user('550e8400-e29b-41d4-a716-446655440000', 'test@example.com');