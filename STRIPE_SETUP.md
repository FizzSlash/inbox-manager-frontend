# 🚀 Stripe Integration Setup

## 🎯 **Quick Setup Steps**

### **1. Deploy Supabase Functions**
```bash
# Deploy both functions
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

### **2. Set Environment Variables in Supabase**
Go to **Supabase Dashboard** → **Settings** → **Edge Functions** → **Environment variables**

Add these variables:
```bash
# Stripe Keys (from your Stripe dashboard)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (create these in Stripe Dashboard → Products)
STRIPE_STARTER_PRICE_ID=price_1QSPexEHdl3eQT0h1J6cXZ8Y
STRIPE_PROFESSIONAL_PRICE_ID=price_1QSPf2EHdl3eQT0hYhG5fH9N  
STRIPE_ENTERPRISE_PRICE_ID=price_1QSPf6EHdl3eQT0hMnP4rK2L
```

### **3. Create Stripe Products & Prices**
In your **Stripe Dashboard**:

1. **Products** → **Add product**
2. Create 3 products:
   - **Starter**: $297/month, 300 leads
   - **Professional**: $497/month, 1,000 leads  
   - **Enterprise**: $997/month, unlimited leads
3. Copy the **Price IDs** to environment variables above

### **4. Setup Stripe Webhook**
1. **Stripe Dashboard** → **Developers** → **Webhooks**
2. **Add endpoint**: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. **Events to send**:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Webhook Secret** to environment variables

### **5. Run Database Migrations**
In **Supabase SQL Editor**, run:
```sql
-- 1. Trial system with explicit status
-- Copy content from: supabase/migrations/20250115_improve_trial_system.sql

-- 2. Upgrade attempts tracking
-- Copy content from: supabase/migrations/20250115_add_upgrade_attempts_table.sql
```

## 🧪 **Test The Integration**

### **Test Expired Trial Modal:**
```bash
node test-trial-modal.js expire  # Expire trial
# Refresh app → Locked modal should appear
# Click upgrade → Should redirect to Stripe checkout
# Complete payment → Should unlock app access
```

### **Test Payment Flow:**
1. **Expire trial** → Locked modal appears
2. **Click upgrade button** → Redirects to Stripe hosted checkout
3. **Complete test payment** → Webhook updates brand status  
4. **Return to app** → Modal unlocked, full access restored

## 🔒 **Security Features**
- ✅ **Webhook signature verification** 
- ✅ **Expired trials cannot escape modal**
- ✅ **Only successful payment unlocks access**
- ✅ **Proper metadata tracking for support**

## 📊 **What Each Function Does**

### **create-checkout**
- Creates Stripe checkout sessions
- Pre-fills customer email
- Tracks upgrade attempts
- Handles plan selection validation

### **stripe-webhook** 
- Processes payment success/failure
- Updates brand subscription status
- Handles subscription cancellations
- Manages trial → paid transitions

## ✅ **Success Indicators**
- ✅ Functions deploy without errors
- ✅ Environment variables set correctly  
- ✅ Stripe products created with proper pricing
- ✅ Webhook endpoint receives events
- ✅ Test payments complete successfully
- ✅ Brand status updates after payment

**After setup, your trial-to-paid conversion flow will be bulletproof!** 🎉