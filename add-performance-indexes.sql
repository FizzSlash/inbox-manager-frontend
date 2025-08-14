-- ====================================================================
-- CRITICAL PERFORMANCE INDEXES FOR PRODUCTION
-- Run this to optimize database performance for scaling
-- ====================================================================

-- Check current indexes before adding new ones
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- === LEADS TABLE INDEXES (Most Critical) ===

-- 1. Brand + Created Date (for lead listing with pagination)
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_created 
ON retention_harbor (brand_id, created_at DESC);

-- 2. Brand + Status (for inbox/CRM filtering)  
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_status
ON retention_harbor (brand_id, status);

-- 3. Email lookup (for deduplication and search)
CREATE INDEX IF NOT EXISTS idx_retention_harbor_email
ON retention_harbor (lead_email);

-- 4. Brand + Email (for duplicate checking within brand)
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_email
ON retention_harbor (brand_id, lead_email);

-- 5. Intent score filtering (for high-intent lead queries)
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_intent
ON retention_harbor (brand_id, intent DESC) WHERE intent IS NOT NULL;

-- 6. Stage filtering for CRM
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_stage
ON retention_harbor (brand_id, stage) WHERE stage IS NOT NULL;

-- === BRANDS TABLE INDEXES ===

-- 7. Trial expiration queries (already exists, but verify)
CREATE INDEX IF NOT EXISTS idx_brands_trial_expiration 
ON brands (trial_ends_at) WHERE subscription_plan = 'trial';

-- 8. Billing cycle queries
CREATE INDEX IF NOT EXISTS idx_brands_billing_cycle
ON brands (billing_cycle_start, subscription_plan);

-- 9. Stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_brands_stripe_customer
ON brands (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- === PROFILES TABLE INDEXES ===

-- 10. Brand lookup (for RLS policies) 
CREATE INDEX IF NOT EXISTS idx_profiles_brand_id
ON profiles (brand_id);

-- 11. User ID lookup (for auth)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id  
ON profiles (id);

-- === BACKFILL PROGRESS INDEXES ===

-- 12. Brand + Status (for checking running backfills)
CREATE INDEX IF NOT EXISTS idx_backfill_progress_brand_status
ON backfill_progress (brand_id, status);

-- 13. Updated timestamp (for stuck backfill detection)
CREATE INDEX IF NOT EXISTS idx_backfill_progress_updated
ON backfill_progress (updated_at DESC);

-- === UPGRADE ATTEMPTS INDEXES ===

-- 14. Brand + Status (for tracking upgrade attempts)
CREATE INDEX IF NOT EXISTS idx_upgrade_attempts_brand_status
ON upgrade_attempts (brand_id, status);

-- 15. Stripe session lookup
CREATE INDEX IF NOT EXISTS idx_upgrade_attempts_stripe_session
ON upgrade_attempts (stripe_session_id);

-- === COMPOSITE INDEXES FOR COMPLEX QUERIES ===

-- 16. Brand + Created + Status (for filtered lead listing)
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_created_status
ON retention_harbor (brand_id, created_at DESC, status);

-- 17. Brand + Status + Stage (for CRM board queries)  
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_status_stage
ON retention_harbor (brand_id, status, stage) WHERE status = 'CRM';

-- Verify all indexes were created
SELECT 
  'INDEX CREATION COMPLETE' as status,
  count(*) as total_indexes
FROM pg_indexes 
WHERE schemaname = 'public';

-- Show table sizes for monitoring
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;