-- ====================================================================
-- STEP-BY-STEP DATABASE CHECK
-- Run each query separately, one at a time
-- ====================================================================

-- QUERY 1: Show all tables (run this first)
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;