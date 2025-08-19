-- ====================================================================
-- 4. DATABASE FUNCTIONS
-- Creates all trial management and utility functions
-- ====================================================================

-- Drop existing functions (safe to do - will be recreated)
DROP FUNCTION IF EXISTS create_brand_for_user(UUID, TEXT);
DROP FUNCTION IF EXISTS extend_trial(UUID, INTEGER);
DROP FUNCTION IF EXISTS bulk_expire_trials(UUID[]);
DROP FUNCTION IF EXISTS bulk_activate_trials(UUID[], INTEGER);
DROP FUNCTION IF EXISTS set_trial_status(UUID, trial_status_type);
DROP FUNCTION IF EXISTS update_upgrade_status(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS sync_plan_limits();

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

-- Test the main function
DO $$
DECLARE
  test_brand_id UUID;
BEGIN
  -- Test create_brand_for_user function
  SELECT create_brand_for_user('550e8400-e29b-41d4-a716-446655440000', 'test@example.com') INTO test_brand_id;
  
  -- Clean up test data
  DELETE FROM brands WHERE id = test_brand_id;
  
  RAISE NOTICE 'All functions tested successfully!';
END $$;

SELECT 'Database functions created successfully! ✅' as status;