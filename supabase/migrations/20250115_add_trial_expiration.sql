-- Simple brand creation with trials

-- 1. Add trial columns
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- 2. Create the brand creation function
CREATE OR REPLACE FUNCTION create_brand_for_user(user_id UUID, user_email TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_brand_id INTEGER;
BEGIN
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

-- 3. Function to extend trial (for you to use)
CREATE OR REPLACE FUNCTION extend_trial(brand_id_param INTEGER, days_to_add INTEGER DEFAULT 7)
RETURNS VOID AS $$
BEGIN
  UPDATE brands 
  SET trial_ends_at = GREATEST(NOW(), trial_ends_at) + (days_to_add || ' days')::INTERVAL
  WHERE id = brand_id_param AND subscription_plan = 'trial';
END;
$$ LANGUAGE plpgsql;