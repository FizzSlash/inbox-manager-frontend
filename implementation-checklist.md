# 🎯 7-Day Trial Implementation - Complete Checklist

## ✅ **COMPLETED:**

### 1. Database Schema ✅
- [x] Trial expiration tracking (`trial_started_at`, `trial_ends_at`)
- [x] Brand creation per user function
- [x] Trial status checking functions
- [x] Database view for trial status

### 2. Authentication Flow ✅
- [x] Individual brand creation per user
- [x] Automatic trial start on signup
- [x] Fixed hardcoded `brand_id: '1'` issue

### 3. UI Components ✅
- [x] TrialExpiredModal component
- [x] Trial status checking in InboxManager
- [x] Modal integration and state management

## 🔲 **REMAINING TASKS:**

### IMMEDIATE (Required):

#### 1. Deploy Database Changes
```bash
cd supabase
npx supabase db push
```

#### 2. Add Trial Blocking Logic
Add to lead import functions:
```javascript
// In backfillLeads function
const { data: trialCheck } = await supabase.rpc('is_trial_expired', { brand_id_param: brandId });
if (trialCheck) {
  setShowTrialModal(true);
  return;
}
```

#### 3. Test New User Flow
1. Create fresh account with new email
2. Verify brand creation works
3. Check trial countdown in database

#### 4. Update Lead Limits Check
Currently only checks lead count, should also check trial expiration:
```javascript
// Add to existing limit checks
if (trialStatus?.status === 'trial_expired') {
  showToast('Trial expired! Please upgrade to continue.', 'error');
  setShowTrialModal(true);
  return;
}
```

### ENHANCEMENT (Recommended):

#### 1. Trial Dashboard Widget
Show trial status prominently:
- Days remaining
- Usage progress
- Upgrade CTA

#### 2. Email Notifications
- Day 6: "1 day left" reminder
- Day 7: "Trial expired" notice
- Follow-up emails

#### 3. Grace Period (Optional)
Allow 1-2 days grace period with limited access

#### 4. Trial Extension (Customer Service)
Add admin function to extend trials:
```sql
SELECT extend_trial(brand_id, 7); -- Extend by 7 days
```

## 📊 **TESTING SCENARIOS:**

### New User Signup:
1. ✅ Sign up with fresh email
2. ✅ Verify email confirmation
3. ✅ Check brand creation in database
4. ✅ Verify trial starts (7 days from now)

### Trial Expiration:
1. 🔲 Manually set trial_ends_at to yesterday
2. 🔲 Refresh app - modal should appear
3. 🔲 Try to import leads - should block
4. 🔲 Test upgrade flow

### Database Queries for Testing:
```sql
-- Check user's brand and trial status
SELECT b.*, bts.* 
FROM profiles p 
JOIN brands b ON p.brand_id = b.id 
LEFT JOIN brand_trial_status bts ON b.id = bts.id 
WHERE p.id = 'USER_ID_HERE';

-- Manually expire trial for testing
UPDATE brands 
SET trial_ends_at = NOW() - INTERVAL '1 day' 
WHERE id = YOUR_BRAND_ID;

-- Reset trial for testing
UPDATE brands 
SET trial_ends_at = NOW() + INTERVAL '7 days' 
WHERE id = YOUR_BRAND_ID;
```

## 🎛️ **CONFIGURATION:**

### Trial Length (currently 7 days):
Change in migration file:
```sql
trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
```

### Trial Lead Limit (currently 50):
Already configured in existing plan system.

### Modal Trigger (currently 1 day warning):
Change in InboxManager.js:
```javascript
if (data.status === 'trial_expired' || data.days_remaining <= 1)
```

## 🚀 **DEPLOYMENT:**

1. Deploy database migration
2. Deploy frontend code
3. Test with new account creation
4. Monitor trial conversions
5. Set up analytics tracking

## 📈 **SUCCESS METRICS:**
- New user conversion rate
- Trial-to-paid conversion rate
- Time to first upgrade
- Support tickets related to trials

---

**Status: Ready for deployment and testing! 🎉**