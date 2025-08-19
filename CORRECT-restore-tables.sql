-- ====================================================================
-- CORRECT TABLE RESTORATION - Based on your actual codebase
-- ====================================================================

-- 1. Add missing columns to BRANDS table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Create enum type (safe if already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trial_status_type') THEN
    CREATE TYPE trial_status_type AS ENUM ('active', 'expired', 'none');
  END IF;
END $$;

ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_status trial_status_type DEFAULT 'none';

-- 2. Create UPGRADE_ATTEMPTS table (this is the missing table!)
CREATE TABLE IF NOT EXISTS upgrade_attempts (
  id SERIAL PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add missing columns to RETENTION_HARBOR table (EXACT column names from your code)
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS lead_email TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS lead_category TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS email_message_body TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS created_at_lead TIMESTAMPTZ;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS campaign_ID INTEGER;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS lead_ID INTEGER;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS source_api_key TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS intent INTEGER;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS parsed_convo JSONB;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS email_account_id TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'INBOX';

-- CRM-specific columns (from your CRMManager code)
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS closed BOOLEAN DEFAULT false;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS deal_size DECIMAL DEFAULT 0;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS call_booked BOOLEAN DEFAULT false;

-- Additional columns from your backfill code
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS custom_field TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS company_data TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS personal_linkedin_url TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS business_linkedin_url TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE retention_harbor ADD COLUMN IF NOT EXISTS opened BOOLEAN DEFAULT true;

-- Add brand_id with correct type (check brands.id type first)
DO $$
DECLARE
  brands_id_type TEXT;
BEGIN
  SELECT data_type INTO brands_id_type FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'id';
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'brand_id') THEN
    IF brands_id_type = 'uuid' THEN
      ALTER TABLE retention_harbor ADD COLUMN brand_id UUID;
    ELSE
      ALTER TABLE retention_harbor ADD COLUMN brand_id TEXT;
    END IF;
  END IF;
END $$;

-- 4. Clean up duplicates and add unique constraint (from your migration)
WITH duplicates AS (
  SELECT lead_email, array_agg(id ORDER BY created_at DESC) as ids
  FROM retention_harbor 
  WHERE lead_email IS NOT NULL
  GROUP BY lead_email 
  HAVING COUNT(*) > 1
)
DELETE FROM retention_harbor 
WHERE id IN (SELECT unnest(ids[2:]) FROM duplicates);

-- Add unique constraint if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'unique_lead_email' AND table_name = 'retention_harbor') THEN
    ALTER TABLE retention_harbor ADD CONSTRAINT unique_lead_email UNIQUE (lead_email);
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_retention_harbor_lead_email ON retention_harbor (lead_email);

SELECT 'Tables restored with correct column names! ✅' as status;