-- Cleanup script to remove test data after restoration testing

-- Remove test brand created by the test script
DELETE FROM brands 
WHERE name = 'INSERT HERE' 
  AND subscription_plan = 'trial'
  AND id IN (
    SELECT id FROM brands 
    WHERE name = 'INSERT HERE' 
    ORDER BY created_at DESC 
    LIMIT 1
  );

-- Remove any profiles connected to test users
DELETE FROM profiles 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

SELECT 'Test data cleanup complete! 🧹' as cleanup_status;