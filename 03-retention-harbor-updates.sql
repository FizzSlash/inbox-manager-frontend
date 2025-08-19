-- ====================================================================
-- 3. RETENTION HARBOR TABLE UPDATES
-- Adds all missing columns for lead management
-- ====================================================================

-- Check brands.id column type first
DO $$
DECLARE
  brands_id_type TEXT;
BEGIN
  -- Get the data type of brands.id column
  SELECT data_type INTO brands_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'brands' AND column_name = 'id';
  
  RAISE NOTICE 'brands.id column type is: %', brands_id_type;
END $$;

-- Add all retention_harbor columns
DO $$
DECLARE
  brands_id_type TEXT;
  brand_id_column_type TEXT;
  columns_to_add TEXT[][] := ARRAY[
    ['lead_email', 'TEXT'],
    ['lead_category', 'TEXT'],
    ['first_name', 'TEXT'],
    ['last_name', 'TEXT'],
    ['website', 'TEXT'],
    ['custom_field', 'TEXT'],
    ['subject', 'TEXT'],
    ['email_message_body', 'TEXT'],
    ['created_at_lead', 'TIMESTAMPTZ'],
    ['intent', 'INTEGER DEFAULT 1'],
    ['stage', 'TEXT'],
    ['campaign_ID', 'INTEGER'],
    ['lead_ID', 'INTEGER'],
    ['role', 'TEXT'],
    ['company_data', 'TEXT'],
    ['personal_linkedin_url', 'TEXT'],
    ['business_linkedin_url', 'TEXT'],
    ['phone', 'TEXT'],
    ['status', 'TEXT DEFAULT ''INBOX'''],
    ['notes', 'TEXT'],
    ['call_booked', 'BOOLEAN DEFAULT false'],
    ['deal_size', 'DECIMAL DEFAULT 0'],
    ['closed', 'BOOLEAN DEFAULT false'],
    ['email_account_id', 'TEXT'],
    ['source_api_key', 'TEXT'],
    ['parsed_convo', 'JSONB'],
    ['opened', 'BOOLEAN DEFAULT false']
  ];
  col_info TEXT[];
BEGIN
  -- Get the data type of brands.id to match it
  SELECT data_type INTO brands_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'brands' AND column_name = 'id';

  -- Determine the correct type for brand_id based on brands.id type
  IF brands_id_type = 'uuid' THEN
    brand_id_column_type := 'UUID';
  ELSE
    brand_id_column_type := 'TEXT';
  END IF;

  RAISE NOTICE 'Will create brand_id column as type: %', brand_id_column_type;

  -- Add brand_id column with matching type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'brand_id') THEN
    EXECUTE format('ALTER TABLE retention_harbor ADD COLUMN brand_id %s', brand_id_column_type);
    RAISE NOTICE 'Added brand_id column to retention_harbor as %', brand_id_column_type;
  ELSE
    RAISE NOTICE 'brand_id column already exists in retention_harbor';
  END IF;

  -- Add all other columns
  FOREACH col_info SLICE 1 IN ARRAY columns_to_add
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = col_info[1]) THEN
      EXECUTE format('ALTER TABLE retention_harbor ADD COLUMN %I %s', col_info[1], col_info[2]);
      RAISE NOTICE 'Added column % to retention_harbor', col_info[1];
    ELSE
      RAISE NOTICE 'Column % already exists in retention_harbor', col_info[1];
    END IF;
  END LOOP;
END $$;

-- Add foreign key constraint only if types match
DO $$
DECLARE
  brands_id_type TEXT;
  retention_brand_id_type TEXT;
BEGIN
  -- Get both column types
  SELECT data_type INTO brands_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'brands' AND column_name = 'id';
  
  SELECT data_type INTO retention_brand_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'retention_harbor' AND column_name = 'brand_id';

  RAISE NOTICE 'brands.id type: %, retention_harbor.brand_id type: %', brands_id_type, retention_brand_id_type;

  -- Only add foreign key if types are compatible
  IF brands_id_type = retention_brand_id_type THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'retention_harbor_brand_id_fkey' 
      AND table_name = 'retention_harbor'
    ) THEN
      ALTER TABLE retention_harbor ADD CONSTRAINT retention_harbor_brand_id_fkey 
      FOREIGN KEY (brand_id) REFERENCES brands(id);
      RAISE NOTICE 'Added foreign key constraint for brand_id';
    ELSE
      RAISE NOTICE 'Foreign key constraint already exists for brand_id';
    END IF;
  ELSE
    RAISE NOTICE 'SKIPPING foreign key constraint - type mismatch: % vs %', brands_id_type, retention_brand_id_type;
    RAISE NOTICE 'You may need to convert one of the columns to match types';
  END IF;
END $$;

-- Clean duplicates and add unique constraint for lead_email
DO $$
BEGIN
  -- Only clean duplicates if lead_email column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'lead_email') THEN
    -- Clean up duplicates
    WITH duplicates AS (
      SELECT 
        lead_email,
        array_agg(id ORDER BY created_at DESC) as ids
      FROM retention_harbor 
      WHERE lead_email IS NOT NULL
      GROUP BY lead_email 
      HAVING COUNT(*) > 1
    )
    DELETE FROM retention_harbor 
    WHERE id IN (
      SELECT unnest(ids[2:]) 
      FROM duplicates
    );
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'unique_lead_email' 
      AND table_name = 'retention_harbor'
    ) THEN
      ALTER TABLE retention_harbor ADD CONSTRAINT unique_lead_email UNIQUE (lead_email);
      RAISE NOTICE 'Added unique constraint for lead_email';
    ELSE
      RAISE NOTICE 'Unique constraint already exists for lead_email';
    END IF;
  END IF;
END $$;

-- Add indexes
DO $$
DECLARE
  indexes_to_create TEXT[][] := ARRAY[
    ['idx_retention_harbor_lead_email', 'retention_harbor', 'lead_email'],
    ['idx_retention_harbor_brand_id', 'retention_harbor', 'brand_id'],
    ['idx_retention_harbor_status', 'retention_harbor', 'status']
  ];
  idx_info TEXT[];
BEGIN
  FOREACH idx_info SLICE 1 IN ARRAY indexes_to_create
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = idx_info[1]) THEN
      -- Check if the column exists before creating index
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = idx_info[2] AND column_name = idx_info[3]) THEN
        EXECUTE format('CREATE INDEX %I ON %I (%I)', idx_info[1], idx_info[2], idx_info[3]);
        RAISE NOTICE 'Created index %', idx_info[1];
      ELSE
        RAISE NOTICE 'Skipped index % - column % does not exist in table %', idx_info[1], idx_info[3], idx_info[2];
      END IF;
    ELSE
      RAISE NOTICE 'Index % already exists', idx_info[1];
    END IF;
  END LOOP;
END $$;

-- Enable RLS
ALTER TABLE retention_harbor ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their leads" ON retention_harbor;
DROP POLICY IF EXISTS "Service role can manage leads" ON retention_harbor;

CREATE POLICY "Users can view their leads" ON retention_harbor
  FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Service role can manage leads" ON retention_harbor
  FOR ALL USING (auth.role() = 'service_role');

-- Update existing data
DO $$
BEGIN
  -- Update opened column if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_harbor' AND column_name = 'opened') THEN
    UPDATE retention_harbor SET opened = false WHERE opened IS NULL;
    RAISE NOTICE 'Updated existing leads with opened = false';
  END IF;
END $$;

SELECT 'Retention Harbor table updates complete! ✅' as status;