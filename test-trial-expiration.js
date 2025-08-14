const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xajedwcurzdgzrlnrcqi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhamVkd2N1cnpkZ3pybG5yY3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5ODYwMTgsImV4cCI6MjA2MjU2MjAxOH0.lXFmMWHLpwGVZo2VWbtmAZFaiPnLAm1sZkBXpik2mpY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTrialExpiration() {
  console.log('🧪 Testing Trial Expiration Modal...\n');
  
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
  
  // Option 1: Set trial_status to EXPIRED (much cleaner!)
  console.log('\n⏰ Setting trial_status to EXPIRED...');
  const { error: expireError } = await supabase
    .from('brands')
    .update({ 
      trial_status: 'expired'
    })
    .eq('id', testBrand.id);
    
  if (expireError) {
    console.error('❌ Error setting expiration:', expireError);
    return;
  }
  
  console.log('✅ Trial set to EXPIRED!');
  console.log('\n🚀 Now refresh your app and the modal should appear!');
  console.log('💡 The modal will be UN-CLOSABLE since trial is expired.');
  
  // Show instructions to reset
  console.log('\n📝 To reset the trial later, run this script again or use SQL:');
  console.log(`UPDATE brands SET trial_status = 'active' WHERE id = '${testBrand.id}';`);
  
  console.log('\n🎯 BULK MANAGEMENT EXAMPLES:');
  console.log('  Expire multiple trials:   SELECT bulk_expire_trials(ARRAY[\'uuid1\', \'uuid2\']);');
  console.log('  Activate multiple trials: SELECT bulk_activate_trials(ARRAY[\'uuid1\', \'uuid2\'], 14);');
  console.log('  Manual override:          SELECT set_trial_status(\'uuid\', \'expired\');');
}

// Also provide option to reset trials
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
} else {
  testTrialExpiration();
}

console.log('\n📖 Usage:');
console.log('  node test-trial-expiration.js       # Set trial_status to "expired" to test modal');
console.log('  node test-trial-expiration.js reset # Reset trial_status to "active" with 7 days');