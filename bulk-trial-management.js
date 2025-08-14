const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xajedwcurzdgzrlnrcqi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhamVkd2N1cnpkZ3pybG5yY3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5ODYwMTgsImV4cCI6MjA2MjU2MjAxOH0.lXFmMWHLpwGVZo2VWbtmAZFaiPnLAm1sZkBXpik2mpY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function showTrialStatus() {
  console.log('📊 Current Trial Status Summary:\n');
  
  const { data: trials, error } = await supabase
    .from('brands')
    .select('id, name, subscription_plan, trial_status, trial_ends_at')
    .eq('subscription_plan', 'trial')
    .order('trial_ends_at', { ascending: true });
    
  if (error) {
    console.error('❌ Error fetching trials:', error);
    return;
  }
  
  console.table(trials);
  
  // Show count by status
  const statusCounts = trials.reduce((acc, trial) => {
    acc[trial.trial_status] = (acc[trial.trial_status] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📈 Status Breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  return trials;
}

async function bulkExpireTrials(brandIds) {
  console.log(`\n⚠️ Expiring ${brandIds.length} trials...`);
  
  const { data: result, error } = await supabase.rpc('bulk_expire_trials', {
    brand_ids: brandIds
  });
  
  if (error) {
    console.error('❌ Error expiring trials:', error);
  } else {
    console.log(`✅ Expired ${result} trials successfully!`);
  }
}

async function bulkActivateTrials(brandIds, extraDays = 7) {
  console.log(`\n✅ Activating ${brandIds.length} trials with ${extraDays} days...`);
  
  const { data: result, error } = await supabase.rpc('bulk_activate_trials', {
    brand_ids: brandIds,
    extra_days: extraDays
  });
  
  if (error) {
    console.error('❌ Error activating trials:', error);
  } else {
    console.log(`✅ Activated ${result} trials successfully!`);
  }
}

async function setTrialStatus(brandId, status) {
  console.log(`\n🎯 Setting trial ${brandId} to "${status}"...`);
  
  const { error } = await supabase.rpc('set_trial_status', {
    brand_id_param: brandId,
    status: status
  });
  
  if (error) {
    console.error('❌ Error setting trial status:', error);
  } else {
    console.log(`✅ Trial status updated to "${status}"!`);
  }
}

async function autoExpireTrials() {
  console.log('\n🤖 Running auto-expire based on dates...');
  
  const { data: result, error } = await supabase.rpc('auto_expire_trials');
  
  if (error) {
    console.error('❌ Error auto-expiring:', error);
  } else {
    console.log(`✅ Auto-expired ${result} trials!`);
  }
}

// Main function
async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  try {
    switch (command) {
      case 'status':
        await showTrialStatus();
        break;
        
      case 'expire':
        if (args.length === 0) {
          console.log('❌ Usage: node bulk-trial-management.js expire <brand_id1> <brand_id2> ...');
          return;
        }
        await bulkExpireTrials(args);
        break;
        
      case 'activate':
        if (args.length === 0) {
          console.log('❌ Usage: node bulk-trial-management.js activate <brand_id1> <brand_id2> [days]');
          return;
        }
        const days = parseInt(args[args.length - 1]) || 7;
        const brandIds = isNaN(parseInt(args[args.length - 1])) ? args : args.slice(0, -1);
        await bulkActivateTrials(brandIds, days);
        break;
        
      case 'set':
        if (args.length !== 2) {
          console.log('❌ Usage: node bulk-trial-management.js set <brand_id> <active|expired|none>');
          return;
        }
        await setTrialStatus(args[0], args[1]);
        break;
        
      case 'auto-expire':
        await autoExpireTrials();
        break;
        
      default:
        console.log('🎯 Bulk Trial Management Tool\n');
        console.log('Usage:');
        console.log('  node bulk-trial-management.js status                    # Show all trials');
        console.log('  node bulk-trial-management.js expire <id1> <id2>        # Expire specific trials');
        console.log('  node bulk-trial-management.js activate <id1> <id2> [14] # Activate trials (with days)');
        console.log('  node bulk-trial-management.js set <id> <status>         # Set specific status');
        console.log('  node bulk-trial-management.js auto-expire               # Auto-expire based on dates');
        console.log('');
        console.log('Examples:');
        console.log('  node bulk-trial-management.js status');
        console.log('  node bulk-trial-management.js expire uuid1 uuid2');
        console.log('  node bulk-trial-management.js activate uuid1 uuid2 14');
        console.log('  node bulk-trial-management.js set uuid1 expired');
        await showTrialStatus();
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

main();