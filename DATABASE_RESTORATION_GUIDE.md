# 🔧 Database Restoration Guide

This guide helps you restore your Supabase database from your August 13th backup to the current expected state.

## 📋 What's Missing After Your Restore

After restoring to August 13th 2pm, your database is missing several critical updates that your current application code expects:

### Missing Tables:
- `upgrade_attempts` - Tracks Stripe checkout sessions

### Missing Columns on `brands`:
- `trial_started_at` - When trial began  
- `trial_ends_at` - When trial expires
- `trial_status` - Enum: 'active', 'expired', 'none'
- `stripe_customer_id` - Stripe customer reference
- `stripe_subscription_id` - Stripe subscription reference

### Missing Columns on `retention_harbor`:  
- `opened` - Boolean for email opened status
- `intent` - Intent score (1-10)
- `brand_id` - Links leads to brands
- `email_account_id` - Email account reference
- `parsed_convo` - JSONB conversation data

### Missing Database Objects:
- `trial_status_type` ENUM
- `create_brand_for_user()` function (UUID version)
- `extend_trial()` function  
- `bulk_expire_trials()` function
- `bulk_activate_trials()` function
- `brand_trial_status` view
- `sync_plan_limits` trigger
- Row Level Security policies

## 🚀 How to Restore

### Step 1: Run the Main Restoration Script
```bash
# Copy the SQL and run it in your Supabase SQL Editor:
restore-database-to-current.sql
```

This script will:
- ✅ Add all missing columns
- ✅ Create the upgrade_attempts table  
- ✅ Create all missing functions
- ✅ Set up the brand_trial_status view
- ✅ Configure Row Level Security
- ✅ Update existing data with proper trial statuses

### Step 2: Test the Restoration
```bash
# Run this to verify everything worked:
test-database-restoration.sql
```

This will show ✅/❌ for each component and test the functions.

### Step 3: Clean Up Test Data
```bash  
# Remove any test data created during verification:
cleanup-test-data.sql
```

## 🔍 What Each Function Does

### Core Functions:
- **`create_brand_for_user(user_id, email)`** - Creates new brand with 7-day trial
- **`extend_trial(brand_id, days)`** - Extends trial by X days  
- **`bulk_expire_trials(brand_ids[])`** - Expire multiple trials at once
- **`bulk_activate_trials(brand_ids[], days)`** - Activate/extend multiple trials

### Views:
- **`brand_trial_status`** - Easy trial status checking with calculated fields

### Triggers:
- **`sync_plan_limits`** - Auto-sets lead limits when subscription plan changes

## 💾 Expected Database State After Restoration

### brands table:
```sql
Column                    Type                 
---------                -------              
id                       UUID                 
name                     TEXT                 
subscription_plan        TEXT                 
trial_started_at         TIMESTAMPTZ         
trial_ends_at            TIMESTAMPTZ         
trial_status             trial_status_type   
stripe_customer_id       TEXT                
stripe_subscription_id   TEXT                
max_leads_per_month      INTEGER             
leads_used_this_month    INTEGER             
price                    DECIMAL             
```

### Trial Status Flow:
1. **New User** → `trial_status = 'active'`, 7 days
2. **Trial Expires** → `trial_status = 'expired'` (locked modal)
3. **User Pays** → `trial_status = 'none'`, `subscription_plan = 'professional'`

## 🎯 Integration with Current App

Your current application expects:

### Frontend (React):
- `checkTrialStatus()` reads `trial_status` column
- `TrialExpiredModal` shows when `trial_status === 'expired'`
- Stripe integration uses `upgrade_attempts` table

### Backend (Edge Functions):
- `create-checkout` creates Stripe sessions
- `stripe-webhook` processes payments → updates `brands` table
- `process-lead-webhook` stores leads in `retention_harbor`

### Authentication Flow:
1. User signs up → `create_brand_for_user()` called
2. Creates brand with `trial_status = 'active'`  
3. After 7 days → trial expires → modal locks
4. User pays → webhook unlocks access

## ✅ Verification Checklist

After running the restoration:

- [ ] All tables exist (brands, upgrade_attempts, retention_harbor)
- [ ] All columns exist on brands table
- [ ] trial_status_type enum created
- [ ] All functions created successfully
- [ ] brand_trial_status view works
- [ ] RLS policies enabled
- [ ] Existing data updated with trial_status
- [ ] Test brand creation works

## 🆘 If Something Goes Wrong

If any part of the restoration fails:

1. **Check the error message** - PostgreSQL will tell you exactly what's wrong
2. **Run sections individually** - Copy/paste parts of the script  
3. **Check existing data** - Some columns might already exist
4. **Drop and recreate** - For functions, use `DROP FUNCTION IF EXISTS` first

## 📊 Current vs Expected Schema

**What you have now (Aug 13th):**
- Basic `brands` table without trial system
- `retention_harbor` without newer lead tracking columns  
- No Stripe integration tables
- Missing trial management functions

**What you'll have after restoration:**
- Full trial system with enum status tracking
- Stripe payment integration ready
- Lead management with email tracking
- Bulk trial management tools
- Automated plan limit synchronization

Your application will work perfectly with the restored database! 🎉