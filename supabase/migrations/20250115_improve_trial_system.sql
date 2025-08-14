-- IMPROVED: Better trial management with explicit status column

-- 1. Add trial_status enum type
CREATE TYPE trial_status_type AS ENUM ('active', 'expired', 'none');

-- 2. Add trial_status column to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_status trial_status_type DEFAULT 'none';

-- 3. Clean up trial dates for non-trial plans and set proper trial_status
UPDATE brands 
SET 
  trial_started_at = NULL,
  trial_ends_at = NULL,
  trial_status = 'none'
WHERE subscription_plan != 'trial';

-- 4. Set trial_status for existing trial plans
UPDATE brands 
SET trial_status = CASE 
  WHEN trial_ends_at IS NULL THEN 'active'
  WHEN trial_ends_at > NOW() THEN 'active'
  ELSE 'expired'
END
WHERE subscription_plan = 'trial';

-- 5. Update the brand creation function to set trial_status
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
    'active',
    0,
    50,
    CURRENT_DATE,
    0
  )
  RETURNING id INTO new_brand_id;
  
  RETURN new_brand_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to bulk expire trials (for easy management)
CREATE OR REPLACE FUNCTION bulk_expire_trials(brand_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE brands 
  SET trial_status = 'expired'
  WHERE id = ANY(brand_ids) 
    AND subscription_plan = 'trial';
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to bulk extend/activate trials
CREATE OR REPLACE FUNCTION bulk_activate_trials(brand_ids UUID[], extra_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE brands 
  SET 
    trial_status = 'active',
    trial_ends_at = CASE 
      WHEN trial_ends_at IS NULL THEN NOW() + (extra_days || ' days')::INTERVAL
      WHEN trial_ends_at < NOW() THEN NOW() + (extra_days || ' days')::INTERVAL
      ELSE trial_ends_at + (extra_days || ' days')::INTERVAL
    END
  WHERE id = ANY(brand_ids) 
    AND subscription_plan = 'trial';
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 8. Updated extend_trial function to use trial_status
CREATE OR REPLACE FUNCTION extend_trial(brand_id_param UUID, days_to_add INTEGER DEFAULT 7)
RETURNS VOID AS $$
BEGIN
  UPDATE brands 
  SET 
    trial_status = 'active',
    trial_ends_at = GREATEST(NOW(), trial_ends_at) + (days_to_add || ' days')::INTERVAL
  WHERE id = brand_id_param AND subscription_plan = 'trial';
END;
$$ LANGUAGE plpgsql;

-- 9. Function to manually set trial status (your override control)
CREATE OR REPLACE FUNCTION set_trial_status(brand_id_param UUID, status trial_status_type)
RETURNS VOID AS $$
BEGIN
  UPDATE brands 
  SET trial_status = status
  WHERE id = brand_id_param;
END;
$$ LANGUAGE plpgsql;

-- 10. Updated sync_plan_limits trigger to handle trial_status
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
        NEW.trial_status := 'active';
      END IF;
    WHEN 'starter' THEN
      NEW.max_leads_per_month := 300;
      NEW.price := 50;
      NEW.trial_status := 'none';
      NEW.trial_started_at := NULL;
      NEW.trial_ends_at := NULL;
    WHEN 'professional' THEN
      NEW.max_leads_per_month := 1000;
      NEW.price := 150;
      NEW.trial_status := 'none';
      NEW.trial_started_at := NULL;
      NEW.trial_ends_at := NULL;
    WHEN 'god' THEN
      NEW.max_leads_per_month := 999999;
      NEW.price := 500;
      NEW.trial_status := 'none';
      NEW.trial_started_at := NULL;
      NEW.trial_ends_at := NULL;
    ELSE
      NEW.max_leads_per_month := 50;
      NEW.price := 0;
      NEW.trial_status := 'none';
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Updated brand_trial_status view to use trial_status column
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

-- 12. Trigger to auto-expire trials based on date (optional background job)
CREATE OR REPLACE FUNCTION auto_expire_trials()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE brands 
  SET trial_status = 'expired'
  WHERE subscription_plan = 'trial' 
    AND trial_status = 'active'
    AND trial_ends_at < NOW();
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- 13. Show current trial status summary
SELECT 
  subscription_plan,
  trial_status,
  COUNT(*) as count
FROM brands 
GROUP BY subscription_plan, trial_status
ORDER BY subscription_plan, trial_status;