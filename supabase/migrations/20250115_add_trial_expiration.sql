-- Add trial expiration and proper brand management
-- This migration fixes the hardcoded brand_id issue and adds trial expiration

-- 1. Add trial expiration tracking
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');
ALTER TABLE brands ADD COLUMN IF NOT EXISTS is_trial_expired BOOLEAN GENERATED ALWAYS AS (
  subscription_plan = 'trial' AND trial_ends_at < NOW()
) STORED;

-- 2. Add user-specific brand creation function
CREATE OR REPLACE FUNCTION create_brand_for_user(user_id UUID, user_email TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_brand_id INTEGER;
BEGIN
  -- Create a new brand for the user
  INSERT INTO brands (
    name, 
    subscription_plan, 
    trial_started_at, 
    trial_ends_at,
    leads_used_this_month,
    max_leads_per_month,
    billing_cycle_start,
    price
  ) VALUES (
    'INSERT HERE', -- Placeholder name for new brands
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

-- 3. Helper function to initialize trial for existing brands  
CREATE OR REPLACE FUNCTION initialize_brand_trial(brand_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Set trial dates for existing brands if not already set
  UPDATE brands 
  SET 
    trial_started_at = COALESCE(trial_started_at, NOW()),
    trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '7 days')
  WHERE id = brand_id_param;
END;
$$ LANGUAGE plpgsql;

-- 3. Function to check if trial is expired
CREATE OR REPLACE FUNCTION is_trial_expired(brand_id_param INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT 
    (subscription_plan = 'trial' AND trial_ends_at < NOW())
  INTO result
  FROM brands 
  WHERE id = brand_id_param;
  
  RETURN COALESCE(result, TRUE); -- Default to expired if brand not found
END;
$$ LANGUAGE plpgsql;

-- 4. Function to extend trial (for testing or customer service)
CREATE OR REPLACE FUNCTION extend_trial(brand_id_param INTEGER, days_to_add INTEGER DEFAULT 7)
RETURNS VOID AS $$
BEGIN
  UPDATE brands 
  SET trial_ends_at = GREATEST(NOW(), trial_ends_at) + (days_to_add || ' days')::INTERVAL
  WHERE id = brand_id_param AND subscription_plan = 'trial';
END;
$$ LANGUAGE plpgsql;

-- 5. Update sync_plan_limits to handle trial periods
CREATE OR REPLACE FUNCTION sync_plan_limits()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set max_leads_per_month and price based on plan
  CASE NEW.subscription_plan
    WHEN 'trial' THEN
      NEW.max_leads_per_month := 50;
      NEW.price := 0;
      -- Set trial period if not already set
      IF NEW.trial_started_at IS NULL THEN
        NEW.trial_started_at := NOW();
        NEW.trial_ends_at := NOW() + INTERVAL '7 days';
      END IF;
    WHEN 'professional' THEN
      NEW.max_leads_per_month := 500;
      NEW.price := 297;
    WHEN 'enterprise' THEN
      NEW.max_leads_per_month := 2000;
      NEW.price := 597;
    WHEN 'agency' THEN
      NEW.max_leads_per_month := 99999;
      NEW.price := 997;
    WHEN 'god' THEN
      NEW.max_leads_per_month := 999999;
      NEW.price := 1997;
    ELSE
      NEW.max_leads_per_month := 50;
      NEW.price := 0;
  END CASE;

  -- Log the change for debugging
  RAISE NOTICE 'Plan changed to % - Max leads: %, Price: %, Trial ends: %', 
    NEW.subscription_plan, NEW.max_leads_per_month, NEW.price, NEW.trial_ends_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create index for better performance on trial checks
CREATE INDEX IF NOT EXISTS idx_brands_trial_expiration 
ON brands (subscription_plan, trial_ends_at) 
WHERE subscription_plan = 'trial';

-- 7. Add RLS policy for brands (users can only see their own brand)
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own brand" ON brands;
CREATE POLICY "Users can view their own brand" 
ON brands FOR SELECT 
USING (
  id IN (
    SELECT profiles.brand_id 
    FROM profiles 
    WHERE profiles.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own brand" ON brands;
CREATE POLICY "Users can update their own brand" 
ON brands FOR UPDATE 
USING (
  id IN (
    SELECT profiles.brand_id 
    FROM profiles 
    WHERE profiles.id = auth.uid()
  )
);

-- 8. Add helpful view for trial status
CREATE OR REPLACE VIEW brand_trial_status AS
SELECT 
  b.id,
  b.name,
  b.subscription_plan,
  b.trial_started_at,
  b.trial_ends_at,
  b.is_trial_expired,
  b.leads_used_this_month,
  b.max_leads_per_month,
  CASE 
    WHEN b.subscription_plan != 'trial' THEN 'active_paid'
    WHEN b.trial_ends_at > NOW() THEN 'trial_active'
    ELSE 'trial_expired'
  END as status,
  CASE 
    WHEN b.subscription_plan = 'trial' AND b.trial_ends_at > NOW() THEN
      EXTRACT(DAYS FROM (b.trial_ends_at - NOW()))::INTEGER
    ELSE 0
  END as days_remaining
FROM brands b;

-- Grant access to the view
GRANT SELECT ON brand_trial_status TO authenticated;