-- ====================================================================
-- 5. VIEWS AND TRIGGERS
-- Creates the brand_trial_status view and sync_plan_limits trigger
-- ====================================================================

-- Create the brand_trial_status view
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

-- Create trigger for sync_plan_limits
DROP TRIGGER IF EXISTS sync_plan_limits_trigger ON brands;
CREATE TRIGGER sync_plan_limits_trigger
  BEFORE INSERT OR UPDATE OF subscription_plan ON brands
  FOR EACH ROW EXECUTE FUNCTION sync_plan_limits();

-- Test the view
DO $$
DECLARE
  view_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO view_count FROM brand_trial_status;
  RAISE NOTICE 'brand_trial_status view working - found % records', view_count;
END $$;

SELECT 'Views and triggers created successfully! ✅' as status;