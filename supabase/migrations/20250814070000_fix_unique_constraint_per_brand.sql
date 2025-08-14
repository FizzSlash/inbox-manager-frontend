-- Fix unique constraint to be per brand instead of global
-- CRITICAL: This fixes multi-tenancy so different brands can have same email addresses

-- Step 1: Drop the broken global unique constraint
ALTER TABLE retention_harbor DROP CONSTRAINT IF EXISTS unique_lead_email;

-- Step 2: Add proper per-brand unique constraint
-- This allows the same email to exist in different brands
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_lead_email_per_brand' 
        AND table_name = 'retention_harbor'
    ) THEN
        ALTER TABLE retention_harbor 
        ADD CONSTRAINT unique_lead_email_per_brand UNIQUE (brand_id, lead_email);
        RAISE NOTICE '✅ Added unique constraint per brand';
    ELSE
        RAISE NOTICE '⚠️ Unique constraint per brand already exists';
    END IF;
END $$;

-- Step 3: Update index to be per-brand for performance
DROP INDEX IF EXISTS idx_retention_harbor_lead_email;
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_email 
ON retention_harbor (brand_id, lead_email);

-- Step 4: Add additional helpful indexes
CREATE INDEX IF NOT EXISTS idx_retention_harbor_brand_id 
ON retention_harbor (brand_id);

-- Verification query to test the fix
-- This should now work (same email in different brands):
/*
INSERT INTO retention_harbor (brand_id, lead_email, first_name) VALUES 
('brand-1', 'john@example.com', 'John Brand 1'),
('brand-2', 'john@example.com', 'John Brand 2');
*/

-- Log the fix
DO $$
BEGIN
    RAISE NOTICE '✅ CRITICAL FIX: Unique constraint now per brand_id + lead_email';
    RAISE NOTICE '✅ Different brands can now have same email addresses';
    RAISE NOTICE '✅ Multi-tenancy properly enforced';
END $$;