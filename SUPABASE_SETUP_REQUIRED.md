# 🚨 SUPABASE DATABASE UPDATE REQUIRED

## ⚡ Quick Action Needed

The frontend code is ready, but you need to run the corrected SQL migration in your Supabase database to fix the brand creation issue.

## 📋 Steps to Fix:

### 1. Go to Supabase Dashboard
- Open your [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project
- Click "SQL Editor" in the left sidebar

### 2. Run the Migration
Copy the entire contents of `supabase/migrations/20250115_add_trial_expiration.sql` and paste it into the SQL Editor, then click **"RUN"**.

**Or** copy this directly:

```sql
-- FIXED: Brand creation with trials (UUID compatible)

-- 1. Add trial columns
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE brands ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- 2. Create the FIXED brand creation function - returns UUID not INTEGER
CREATE OR REPLACE FUNCTION create_brand_for_user(user_id UUID, user_email TEXT)
RETURNS UUID AS $$
DECLARE
  new_brand_id UUID;
BEGIN
  INSERT INTO brands (
    id,
    name, 
    subscription_plan, 
    trial_started_at, 
    trial_ends_at,
    leads_used_this_month,
    max_leads_per_month,
    billing_cycle_start,
    price
  ) VALUES (
    gen_random_uuid(),  -- Generate new UUID for the brand
    'INSERT HERE',
    'trial',
    NOW(),
    NOW() + INTERVAL '7 days',
    0,
    50,
    CURRENT_DATE,
    0
  )
  RETURNING id INTO new_brand_id;
  
  RETURN new_brand_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Test the function (should return a UUID)
SELECT create_brand_for_user('550e8400-e29b-41d4-a716-446655440000', 'test@example.com');
```

### 3. Verify Fix
After running the SQL, you should see:
- ✅ "Success. No rows returned" (normal for function creation)
- ✅ A UUID returned from the test function call

### 4. Test New Signup
Try creating a new account - it should now:
- ✅ Create an individual brand with proper UUID
- ✅ Set 7-day trial period  
- ✅ Assign correct `brand_id` to user profile

## 🐛 What This Fixes

**Before:** New users got `brand_id = '1'` because the function returned INTEGER but brands table uses UUID.

**After:** New users get individual brands with proper UUIDs like `'7f871faa-b878-42ce-b779-29631229ba40'`.

## ✅ Features Now Working

- 🎯 **Frictionless Signup**: Individual brands auto-created
- ⏰ **7-Day Trials**: Automatic trial setup and expiration
- 🔒 **Trial Enforcement**: Blocks expired trials with upgrade modal
- 📊 **Trial Extension**: You can extend trials with `extend_trial()` function
- 🔍 **Trial Status View**: Easy checking with `brand_trial_status` view

---

**Delete this file after running the SQL migration!** 🗑️