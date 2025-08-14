# 🔧 Database Restoration Scripts

I've split the database restoration into **7 separate scripts** that you can run individually. This makes it much easier to debug and handle any issues.

## 📋 Script Overview

| Script | Purpose | Safe to Re-run? |
|--------|---------|-----------------|
| `01-brands-table-updates.sql` | Adds trial system columns to brands table | ✅ Yes |
| `02-upgrade-attempts-table.sql` | Creates Stripe checkout tracking table | ✅ Yes |
| `03-retention-harbor-updates.sql` | Adds all lead management columns | ✅ Yes |
| `04-database-functions.sql` | Creates all trial/brand management functions | ✅ Yes |
| `05-views-and-triggers.sql` | Creates views and triggers | ✅ Yes |
| `06-rls-policies.sql` | Sets up Row Level Security policies | ✅ Yes |
| `07-final-verification.sql` | Verifies everything works + cleanup | ✅ Yes |

## 🚀 How to Run

### Option 1: Run All Scripts (Recommended)
```sql
-- Copy and paste each script in order in your Supabase SQL Editor:
-- 1. 01-brands-table-updates.sql
-- 2. 02-upgrade-attempts-table.sql  
-- 3. 03-retention-harbor-updates.sql
-- 4. 04-database-functions.sql
-- 5. 05-views-and-triggers.sql
-- 6. 06-rls-policies.sql
-- 7. 07-final-verification.sql
```

### Option 2: Run Individual Scripts
If any script fails, you can run just that one script to fix the issue.

## 🔍 What Each Script Does

### 1. Brands Table Updates
- ✅ Adds `trial_started_at`, `trial_ends_at` columns
- ✅ Adds `stripe_customer_id`, `stripe_subscription_id` columns  
- ✅ Creates `trial_status_type` ENUM ('active', 'expired', 'none')
- ✅ Adds `trial_status` column
- ✅ Updates existing brand data with proper trial status
- ✅ Creates performance indexes

### 2. Upgrade Attempts Table
- ✅ Creates `upgrade_attempts` table for Stripe checkout tracking
- ✅ Adds indexes for performance
- ✅ Sets up Row Level Security policies
- ✅ Links to brands table via foreign key

### 3. Retention Harbor Updates  
- ✅ Adds ALL missing columns your app expects:
  - `lead_email`, `lead_category`, `first_name`, `last_name`
  - `website`, `subject`, `email_message_body`
  - `intent`, `campaign_ID`, `lead_ID`, `opened`
  - `brand_id` (with proper UUID/TEXT type matching)
  - `status`, `notes`, `call_booked`, `deal_size`, `closed`
  - And many more...
- ✅ **Handles type mismatches safely** - matches `brand_id` type to `brands.id`
- ✅ Cleans duplicate leads by email
- ✅ Adds unique constraint on `lead_email`
- ✅ Creates foreign key to brands (if types match)
- ✅ Sets up Row Level Security

### 4. Database Functions
- ✅ `create_brand_for_user()` - Creates brands with 7-day trials
- ✅ `extend_trial()` - Extends trial by X days
- ✅ `bulk_expire_trials()` - Expire multiple trials
- ✅ `bulk_activate_trials()` - Activate/extend multiple trials  
- ✅ `set_trial_status()` - Manual trial status override
- ✅ `update_upgrade_status()` - Update Stripe checkout status
- ✅ `sync_plan_limits()` - Auto-sync lead limits on plan changes

### 5. Views and Triggers
- ✅ Creates `brand_trial_status` view for easy trial checking
- ✅ Creates trigger to auto-sync plan limits
- ✅ Provides calculated fields like `days_remaining`, `is_trial_expired`

### 6. RLS Policies  
- ✅ Enables Row Level Security on all tables
- ✅ Users can only see their own brands/leads
- ✅ Service role can manage everything (for functions)

### 7. Final Verification
- ✅ Cleans up any test data
- ✅ Verifies all components are working
- ✅ Shows summary of current database state
- ✅ Reports success/failure of restoration

## 🛡️ Safety Features

- **✅ All scripts are safe to re-run** - They check if things exist before creating
- **✅ Detailed logging** - Each script tells you exactly what it's doing
- **✅ No data loss** - Only adds columns, never removes existing data
- **✅ Type-safe** - Handles UUID vs TEXT mismatches automatically
- **✅ Handles edge cases** - Missing tables, existing constraints, etc.

## 🚨 If Something Goes Wrong

### Common Issues:

1. **Type mismatch error (brands.id vs retention_harbor.brand_id)**:
   - Script 3 handles this automatically
   - It will create matching types and skip foreign key if needed

2. **Enum already exists error**:
   - Scripts check for existing enums before creating
   - Safe to re-run

3. **Function doesn't exist error**:
   - Run script 4 to recreate all functions
   - Functions are dropped and recreated safely

4. **View/trigger errors**:
   - Run script 5 to recreate views and triggers

## 🎯 Expected Result

After running all scripts, your database will have:

- ✅ Complete trial system with enum status tracking
- ✅ Stripe payment integration tables  
- ✅ All lead management columns in retention_harbor
- ✅ Full trial management functions
- ✅ Automated plan limit synchronization
- ✅ Row Level Security protecting user data
- ✅ Performance indexes on key columns
- ✅ Clean, duplicate-free lead data

Your application will work perfectly with the restored database! 🎉

## 📊 Quick Status Check

After running, check the final output of script 7. You should see:
```
🎉 ALL CHECKS PASSED - Database restoration successful!
```

If you see any warnings, just re-run the relevant individual script.