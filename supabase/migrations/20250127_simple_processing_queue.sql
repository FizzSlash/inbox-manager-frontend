-- Drop and recreate with simple structure that matches your code
DROP TABLE IF EXISTS processing_queue CASCADE;

-- Simple processing_queue table with just what your code uses
CREATE TABLE processing_queue (
  id BIGSERIAL PRIMARY KEY,
  task_type TEXT NOT NULL DEFAULT 'ai_intent',
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 1,
  brand_id UUID NOT NULL,
  lead_id BIGINT,
  batch_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic indexes
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_brand_id ON processing_queue(brand_id);
