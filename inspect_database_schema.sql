-- ========================================
-- DATABASE SCHEMA INSPECTION
-- ========================================
-- Run this to see your actual table structure

-- 1. List all tables in your database
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Show all columns in retention_harbor table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'retention_harbor' 
ORDER BY ordinal_position;

-- 3. Show all columns in api_settings table (if it exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'api_settings' 
ORDER BY ordinal_position;

-- 4. Show all columns in processing_queue table (if it exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'processing_queue' 
ORDER BY ordinal_position;

-- 5. Show existing indexes on retention_harbor
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'retention_harbor'
ORDER BY indexname;
