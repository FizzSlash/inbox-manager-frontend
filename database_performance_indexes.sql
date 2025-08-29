-- ========================================
-- PRODUCTION DATABASE PERFORMANCE INDEXES
-- ========================================
-- Run these in your Supabase SQL editor to optimize query performance
-- These indexes will dramatically improve performance at scale

-- ========================================
-- RETENTION_HARBOR TABLE INDEXES
-- ========================================

-- 1. Primary query pattern: Get leads by brand_id, ordered by created_at
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_created 
ON retention_harbor(brand_id, created_at DESC);

-- 2. Intent filtering: Get leads with intent scores for a brand
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_intent 
ON retention_harbor(brand_id, intent) 
WHERE intent IS NOT NULL;

-- 3. Email account filtering: Get leads by email_account_id
CREATE INDEX IF NOT EXISTS idx_retention_harbor_email_account 
ON retention_harbor(email_account_id);

-- 4. Lead status filtering: Get leads by status
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_status 
ON retention_harbor(brand_id, status);

-- 5. Campaign filtering: Get leads by campaign (check if column exists first)
-- Note: Only create if campaign_id column exists in your table
-- CREATE INDEX IF NOT EXISTS idx_retention_harbor_campaign 
-- ON retention_harbor(brand_id, campaign_id);

-- 6. Recent leads query optimization
CREATE INDEX IF NOT EXISTS idx_retention_harbor_recent 
ON retention_harbor(brand_id, created_at DESC, intent) 
WHERE created_at >= NOW() - INTERVAL '90 days';

-- 7. Lead email lookup (for polling/upserts)
CREATE INDEX IF NOT EXISTS idx_retention_harbor_email_lookup 
ON retention_harbor(brand_id, lead_email);

-- 8. Last reply time for polling
CREATE INDEX IF NOT EXISTS idx_retention_harbor_last_reply 
ON retention_harbor(brand_id, last_reply_time DESC) 
WHERE last_reply_time IS NOT NULL;

-- ========================================
-- API_SETTINGS TABLE INDEXES
-- ========================================

-- 9. Brand API settings lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_api_settings_brand 
ON api_settings(brand_id);

-- 10. Account ID lookup for lead filtering
CREATE INDEX IF NOT EXISTS idx_api_settings_account 
ON api_settings(account_id);

-- 11. ESP provider filtering
CREATE INDEX IF NOT EXISTS idx_api_settings_esp 
ON api_settings(brand_id, esp_provider);

-- ========================================
-- PROCESSING_QUEUE TABLE INDEXES
-- ========================================

-- 12. Queue processing: Get pending tasks by brand
CREATE INDEX IF NOT EXISTS idx_processing_queue_pending 
ON processing_queue(brand_id, status, created_at) 
WHERE status = 'pending';

-- 13. Queue status lookup
CREATE INDEX IF NOT EXISTS idx_processing_queue_status 
ON processing_queue(status, created_at);

-- ========================================
-- BRANDS TABLE INDEXES
-- ========================================

-- 14. User profile brand lookup
CREATE INDEX IF NOT EXISTS idx_profiles_brand 
ON profiles(brand_id);

-- ========================================
-- AI_BATCHES TABLE INDEXES (if exists)
-- ========================================

-- 15. Batch processing status
CREATE INDEX IF NOT EXISTS idx_ai_batches_status 
ON ai_batches(brand_id, status, created_at);

-- ========================================
-- BACKFILL_PROGRESS TABLE INDEXES
-- ========================================

-- 16. Resume functionality: Get running backfills by brand
CREATE INDEX IF NOT EXISTS idx_backfill_progress_resume 
ON backfill_progress(brand_id, status, updated_at) 
WHERE status = 'running';

-- ========================================
-- DRAFT_RESPONSES TABLE INDEXES (if exists)
-- ========================================

-- 17. Draft lookup by lead
CREATE INDEX IF NOT EXISTS idx_draft_responses_lead 
ON draft_responses(lead_id, updated_at DESC);

-- ========================================
-- PERFORMANCE MONITORING QUERIES
-- ========================================

-- Query to check index usage (run after indexes are created)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_tup_read DESC;

-- Query to check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Query to find slow queries (if query stats are enabled)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%retention_harbor%'
ORDER BY mean_time DESC 
LIMIT 10;

-- ========================================
-- MAINTENANCE COMMANDS
-- ========================================

-- Analyze tables after creating indexes (helps query planner)
ANALYZE retention_harbor;
ANALYZE api_settings;
ANALYZE processing_queue;
ANALYZE profiles;
ANALYZE backfill_progress;

-- ========================================
-- NOTES FOR PRODUCTION
-- ========================================

/*
1. Run these indexes during low-traffic periods
2. Monitor index usage with the monitoring queries above
3. Drop unused indexes to save space:
   DROP INDEX IF EXISTS index_name;
4. Consider partitioning retention_harbor by brand_id if you have many brands
5. Set up automated VACUUM and ANALYZE for maintenance
6. Monitor disk space - indexes use additional storage
7. Test query performance before and after with EXPLAIN ANALYZE

Example performance test:
EXPLAIN ANALYZE 
SELECT * FROM retention_harbor 
WHERE brand_id = 'your-brand-id' 
ORDER BY created_at DESC 
LIMIT 100;
*/
