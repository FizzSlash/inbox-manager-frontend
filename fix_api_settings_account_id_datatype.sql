-- Fix api_settings.account_id column data type from bigint to UUID
-- This fixes the webhook processor error: "Invalid input syntax for type bigint"

-- First, check current data type and any existing data
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'api_settings' AND column_name = 'account_id';

-- Show existing data to understand the current state
SELECT account_id, brand_id, esp_provider 
FROM api_settings 
LIMIT 10;

-- Option 1: If the column is currently bigint but contains UUID strings, convert it
ALTER TABLE api_settings 
ALTER COLUMN account_id TYPE UUID USING account_id::text::UUID;

-- Option 2: If the above fails because data isn't valid UUIDs, you might need to:
-- ALTER TABLE api_settings ALTER COLUMN account_id TYPE TEXT;
-- Then clean up the data and convert to UUID later

-- Verify the change
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'api_settings' AND column_name = 'account_id';

-- Optional: Add a check constraint to ensure only valid UUIDs
ALTER TABLE api_settings 
ADD CONSTRAINT api_settings_account_id_uuid_check 
CHECK (account_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

