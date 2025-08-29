-- ========================================
-- SAFE DATABASE PERFORMANCE INDEXES
-- ========================================
-- This version checks for column existence before creating indexes

-- ========================================
-- CORE INDEXES (ESSENTIAL)
-- ========================================

-- 1. Primary query pattern: Get leads by brand_id, ordered by created_at
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_created 
ON retention_harbor(brand_id, created_at DESC);

-- 2. Intent filtering: Get leads with intent scores for a brand
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_intent 
ON retention_harbor(brand_id, intent) 
WHERE intent IS NOT NULL;

-- 3. Lead status filtering: Get leads by status
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_status 
ON retention_harbor(brand_id, status);

-- 4. Recent leads query optimization (90 days)
CREATE INDEX IF NOT EXISTS idx_retention_harbor_recent 
ON retention_harbor(brand_id, created_at DESC, intent) 
WHERE created_at >= NOW() - INTERVAL '90 days';

-- ========================================
-- CONDITIONAL INDEXES (Check columns exist)
-- ========================================

-- Check if email_account_id column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'retention_harbor' 
        AND column_name = 'email_account_id'
    ) THEN
        -- 5. Email account filtering: Get leads by email_account_id
        CREATE INDEX IF NOT EXISTS idx_retention_harbor_email_account 
        ON retention_harbor(email_account_id);
        
        RAISE NOTICE 'Created index on email_account_id';
    ELSE
        RAISE NOTICE 'Skipped email_account_id index - column does not exist';
    END IF;
END $$;

-- Check if campaign_id column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'retention_harbor' 
        AND column_name = 'campaign_id'
    ) THEN
        -- 6. Campaign filtering: Get leads by campaign
        CREATE INDEX IF NOT EXISTS idx_retention_harbor_campaign 
        ON retention_harbor(brand_id, campaign_id);
        
        RAISE NOTICE 'Created index on campaign_id';
    ELSE
        RAISE NOTICE 'Skipped campaign_id index - column does not exist';
    END IF;
END $$;

-- Check if lead_email column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'retention_harbor' 
        AND column_name = 'lead_email'
    ) THEN
        -- 7. Lead email lookup (for polling/upserts)
        CREATE INDEX IF NOT EXISTS idx_retention_harbor_email_lookup 
        ON retention_harbor(brand_id, lead_email);
        
        RAISE NOTICE 'Created index on lead_email';
    ELSE
        RAISE NOTICE 'Skipped lead_email index - column does not exist';
    END IF;
END $$;

-- Check if last_reply_time column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'retention_harbor' 
        AND column_name = 'last_reply_time'
    ) THEN
        -- 8. Last reply time for polling
        CREATE INDEX IF NOT EXISTS idx_retention_harbor_last_reply 
        ON retention_harbor(brand_id, last_reply_time DESC) 
        WHERE last_reply_time IS NOT NULL;
        
        RAISE NOTICE 'Created index on last_reply_time';
    ELSE
        RAISE NOTICE 'Skipped last_reply_time index - column does not exist';
    END IF;
END $$;

-- ========================================
-- API_SETTINGS TABLE INDEXES
-- ========================================

-- Check if api_settings table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'api_settings'
    ) THEN
        -- 9. Brand API settings lookup
        CREATE INDEX IF NOT EXISTS idx_api_settings_brand 
        ON api_settings(brand_id);
        
        -- Check if account_id column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'api_settings' 
            AND column_name = 'account_id'
        ) THEN
            -- 10. Account ID lookup
            CREATE INDEX IF NOT EXISTS idx_api_settings_account 
            ON api_settings(account_id);
            
            RAISE NOTICE 'Created api_settings indexes';
        END IF;
        
    ELSE
        RAISE NOTICE 'Skipped api_settings indexes - table does not exist';
    END IF;
END $$;

-- ========================================
-- PROCESSING_QUEUE TABLE INDEXES
-- ========================================

-- Check if processing_queue table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'processing_queue'
    ) THEN
        -- 11. Queue processing: Get pending tasks by brand
        CREATE INDEX IF NOT EXISTS idx_processing_queue_pending 
        ON processing_queue(brand_id, status, created_at) 
        WHERE status = 'pending';

        -- 12. Queue status lookup
        CREATE INDEX IF NOT EXISTS idx_processing_queue_status 
        ON processing_queue(status, created_at);
        
        RAISE NOTICE 'Created processing_queue indexes';
    ELSE
        RAISE NOTICE 'Skipped processing_queue indexes - table does not exist';
    END IF;
END $$;

-- ========================================
-- PROFILES TABLE INDEXES
-- ========================================

-- Check if profiles table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'profiles'
    ) THEN
        -- Check if brand_id column exists in profiles
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' 
            AND column_name = 'brand_id'
        ) THEN
            -- 13. User profile brand lookup
            CREATE INDEX IF NOT EXISTS idx_profiles_brand 
            ON profiles(brand_id);
            
            RAISE NOTICE 'Created profiles brand index';
        END IF;
    ELSE
        RAISE NOTICE 'Skipped profiles indexes - table does not exist';
    END IF;
END $$;

-- ========================================
-- OPTIONAL TABLE INDEXES
-- ========================================

-- AI_BATCHES table (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'ai_batches'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_ai_batches_status 
        ON ai_batches(brand_id, status, created_at);
        
        RAISE NOTICE 'Created ai_batches indexes';
    ELSE
        RAISE NOTICE 'Skipped ai_batches indexes - table does not exist';
    END IF;
END $$;

-- BACKFILL_PROGRESS table (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'backfill_progress'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_backfill_progress_resume 
        ON backfill_progress(brand_id, status, updated_at) 
        WHERE status = 'running';
        
        RAISE NOTICE 'Created backfill_progress indexes';
    ELSE
        RAISE NOTICE 'Skipped backfill_progress indexes - table does not exist';
    END IF;
END $$;

-- DRAFT_RESPONSES table (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'draft_responses'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_draft_responses_lead 
        ON draft_responses(lead_id, updated_at DESC);
        
        RAISE NOTICE 'Created draft_responses indexes';
    ELSE
        RAISE NOTICE 'Skipped draft_responses indexes - table does not exist';
    END IF;
END $$;

-- ========================================
-- ANALYZE TABLES
-- ========================================

-- Analyze the main table to update statistics
ANALYZE retention_harbor;

-- Analyze other tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_settings') THEN
        ANALYZE api_settings;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'processing_queue') THEN
        ANALYZE processing_queue;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        ANALYZE profiles;
    END IF;
END $$;

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Database indexing completed successfully!';
    RAISE NOTICE '🚀 Your database performance has been optimized';
    RAISE NOTICE '📊 Check the notices above to see which indexes were created';
END $$;



