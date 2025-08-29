-- Create processing_queue table for AI intent analysis tasks
CREATE TABLE IF NOT EXISTS processing_queue (
  id BIGSERIAL PRIMARY KEY,
  task_type TEXT NOT NULL DEFAULT 'ai_intent',
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 1,
  brand_id UUID NOT NULL,
  lead_id BIGINT,
  batch_id TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_brand_id ON processing_queue(brand_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_task_type ON processing_queue(task_type);
CREATE INDEX IF NOT EXISTS idx_processing_queue_lead_id ON processing_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_batch_id ON processing_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_scheduled_for ON processing_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_processing_queue_priority_created ON processing_queue(priority DESC, created_at ASC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_processing_queue_updated_at 
    BEFORE UPDATE ON processing_queue 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
