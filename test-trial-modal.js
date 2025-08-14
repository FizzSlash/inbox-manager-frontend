const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xajedwcurzdgzrlnrcqi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhamVkd2N1cnpkZ3pybG5yY3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5ODYwMTgsImV4cCI6MjA2MjU2MjAxOH0.lXFmMWHLpwGVZo2VWbtmAZFaiPnLAm1sZkBXpik2mpY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTrialModal() {
  console.log('🧪 Testing Trial Modal...\n');
  
  // Get current trial brands
  const { data: trials, error } = await supabase
    .from('brands')
    .select('*')
    .eq('subscription_plan', 'trial');
    
  if (error) {
    console.error('❌ Error fetching trials:', error);
    return;
  }
  
  console.log('📋 Current trial brands:');
  console.table(trials.slice(0, 3));
  
  if (trials.length === 0) {
    console.log('⚠️ No trial brands found. Create a new account first.');
    return;
  }
  
  const testBrand = trials[trials.length - 1]; // Use the newest trial
  console.log(`\n🎯 Using brand: ${testBrand.id} (${testBrand.name})`);
  
  return testBrand;
}

async function expireTrial() {
  const brand = await testTrialModal();
  if (!brand) return;
  
  console.log('\n⏰ Setting trial_status to EXPIRED...');
  const { error } = await supabase
    .from('brands')
    .update({ trial_status: 'expired' })
    .eq('id', brand.id);
    
  if (error) {
    console.error('❌ Error expiring trial:', error);
  } else {
    console.log('✅ Trial set to EXPIRED!');
    console.log('\n🚀 Now refresh your app - the modal should:');
    console.log('  ✅ Appear immediately (locked)');
    console.log('  ✅ Show no X button (cannot close)');
    console.log('  ✅ Display all 3 pricing tiers');
    console.log('  ✅ Highlight current plan (Trial - 50 leads)');
    console.log('  ✅ Professional marked "Most Popular"');
    console.log('  ✅ Show loading states when upgrading');
    console.log('  ✅ Stay open if upgrade fails');
  }
}

async function resetTrial() {
  console.log('🔄 Resetting all trials to active status...\n');
  
  const { error } = await supabase
    .from('brands')
    .update({ 
      trial_status: 'active',
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
    .eq('subscription_plan', 'trial');
    
  if (error) {
    console.error('❌ Error resetting trials:', error);
  } else {
    console.log('✅ All trials reset to active status with 7 days!');
  }
}

// Check command line argument
const command = process.argv[2];

if (command === 'reset') {
  resetTrial();
} else if (command === 'expire') {
  expireTrial();
} else {
  console.log('🎯 Trial Modal Testing Tool\n');
  console.log('Usage:');
  console.log('  node test-trial-modal.js expire # Set trial_status to "expired" to test locked modal');
  console.log('  node test-trial-modal.js reset  # Reset trial_status to "active" with 7 days');
  console.log('');
  console.log('Test Flow:');
  console.log('  1. node test-trial-modal.js expire');
  console.log('  2. Refresh your app and test the locked modal');
  console.log('  3. Try clicking upgrade buttons (should show loading states)');
  console.log('  4. node test-trial-modal.js reset');
  
  // Show current status by default
  testTrialModal();
}