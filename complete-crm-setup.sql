-- 🔧 COMPLETE CRM SETUP SQL
-- Run this entire script in Supabase SQL Editor

-- Step 1: Clean up any old CRM attempts
DROP TABLE IF EXISTS crm_stages CASCADE;
DROP TABLE IF EXISTS crm_pipeline_stages CASCADE;
DROP FUNCTION IF EXISTS get_crm_config(UUID);
DROP FUNCTION IF EXISTS update_crm_config(UUID, JSONB);

-- Remove any crm_stages column from brands table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'crm_stages') THEN
        ALTER TABLE brands DROP COLUMN crm_stages;
    END IF;
END $$;

-- Step 2: Create the CRM config table
CREATE TABLE IF NOT EXISTS crm_config (
    id SERIAL PRIMARY KEY,
    brand_id UUID NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
    stages JSONB NOT NULL DEFAULT '[
        {"id": "1", "name": "Interested", "color": "#6B7280", "order_position": 1},
        {"id": "2", "name": "Call Booked", "color": "#3B82F6", "order_position": 2},
        {"id": "3", "name": "Proposal Sent", "color": "#8B5CF6", "order_position": 3},
        {"id": "4", "name": "Follow Up", "color": "#F59E0B", "order_position": 4},
        {"id": "5", "name": "Closed Won", "color": "#10B981", "order_position": 5},
        {"id": "6", "name": "Closed Lost", "color": "#EF4444", "order_position": 6},
        {"id": "7", "name": "Nurture", "color": "#06B6D4", "order_position": 7}
    ]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_crm_config_brand_id ON crm_config(brand_id);

-- Step 3: Insert default CRM config for existing brands
INSERT INTO crm_config (brand_id)
SELECT b.id 
FROM brands b 
WHERE NOT EXISTS (
    SELECT 1 FROM crm_config c WHERE c.brand_id = b.id
)
ON CONFLICT (brand_id) DO NOTHING;

-- Step 4: Create the get_crm_config function (FIXED - no nested aggregates)
CREATE OR REPLACE FUNCTION get_crm_config(brand_uuid UUID)
RETURNS TABLE (
  stages JSONB,
  stage_lead_counts JSONB
) AS $$
DECLARE
  config_stages JSONB;
  stage_counts JSONB;
BEGIN
  -- Get or create config for brand
  SELECT c.stages INTO config_stages
  FROM crm_config c 
  WHERE c.brand_id = brand_uuid;
  
  -- If no config exists, create default one
  IF config_stages IS NULL THEN
    INSERT INTO crm_config (brand_id) VALUES (brand_uuid);
    SELECT c.stages INTO config_stages
    FROM crm_config c 
    WHERE c.brand_id = brand_uuid;
  END IF;
  
  -- Get lead counts per stage (fixed nested aggregate issue)
  WITH stage_counts_cte AS (
    SELECT 
      r.stage, 
      COUNT(r.id) as lead_count
    FROM retention_harbor r 
    WHERE r.brand_id = brand_uuid::text AND r.status = 'CRM'
    GROUP BY r.stage
  )
  SELECT jsonb_object_agg(stage, lead_count) INTO stage_counts
  FROM stage_counts_cte;
  
  -- Return stages config and lead counts
  RETURN QUERY SELECT config_stages, COALESCE(stage_counts, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create the update_crm_config function
CREATE OR REPLACE FUNCTION update_crm_config(brand_uuid UUID, new_stages JSONB)
RETURNS void AS $$
BEGIN
  INSERT INTO crm_config (brand_id, stages)
  VALUES (brand_uuid, new_stages)
  ON CONFLICT (brand_id) 
  DO UPDATE SET 
    stages = EXCLUDED.stages,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Step 6: Ensure retention_harbor has the stage column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'stage') THEN
        ALTER TABLE retention_harbor ADD COLUMN stage TEXT DEFAULT 'Interested';
    END IF;
END $$;

-- Step 7: Test the functions
SELECT 'CRM setup complete! Testing functions...' as status;

-- Test with a brand (replace with your actual brand ID if needed)
DO $$
DECLARE
    test_brand_id UUID;
BEGIN
    -- Get first brand for testing
    SELECT id INTO test_brand_id FROM brands LIMIT 1;
    
    IF test_brand_id IS NOT NULL THEN
        -- Test the get_crm_config function
        PERFORM get_crm_config(test_brand_id);
        RAISE NOTICE 'SUCCESS: get_crm_config function works!';
    ELSE
        RAISE NOTICE 'No brands found for testing, but functions are created.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error testing functions: %', SQLERRM;
END $$;

-- Final verification
SELECT 
    'CRM Config Table' as component,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_config') 
         THEN '✅ Created' 
         ELSE '❌ Missing' 
    END as status
UNION ALL
SELECT 
    'get_crm_config Function' as component,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_crm_config') 
         THEN '✅ Created' 
         ELSE '❌ Missing' 
    END as status
UNION ALL
SELECT 
    'update_crm_config Function' as component,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_crm_config') 
         THEN '✅ Created' 
         ELSE '❌ Missing' 
    END as status;