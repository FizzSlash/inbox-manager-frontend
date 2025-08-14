-- Create upgrade_attempts table for tracking Stripe checkout sessions

CREATE TABLE IF NOT EXISTS upgrade_attempts (
  id SERIAL PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_upgrade_attempts_brand_id ON upgrade_attempts(brand_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_attempts_stripe_session ON upgrade_attempts(stripe_session_id);

-- Add RLS for security
ALTER TABLE upgrade_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own upgrade attempts
CREATE POLICY "Users can view their own upgrade attempts" ON upgrade_attempts
  FOR SELECT USING (
    brand_id IN (
      SELECT brand_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Service role can manage all upgrade attempts (for functions)
CREATE POLICY "Service role can manage upgrade attempts" ON upgrade_attempts
  FOR ALL USING (auth.role() = 'service_role');

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