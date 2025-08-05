-- Add unique constraint to prevent duplicate leads by email
-- This will ensure both the Edge Function and backlog process can't create duplicates

-- First, clean up any existing duplicates (keep the most recent one)
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

-- Now add the unique constraint
ALTER TABLE retention_harbor 
ADD CONSTRAINT unique_lead_email UNIQUE (lead_email);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_retention_harbor_lead_email 
ON retention_harbor (lead_email); 