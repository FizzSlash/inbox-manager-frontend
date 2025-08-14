const { createClient } = require('@supabase/supabase-js');

// Your Supabase config
const supabaseUrl = 'https://xajedwcurzdgzrlnrcqi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhamVkd2N1cnpkZ3pybG5yY3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5ODYwMTgsImV4cCI6MjA2MjU2MjAxOH0.lXFmMWHLpwGVZo2VWbtmAZFaiPnLAm1sZkBXpik2mpY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCreateCheckout() {
  console.log('🧪 Testing create-checkout function...\n');
  
  try {
    // Test with a real brand ID from your database
    const { data: brands } = await supabase
      .from('brands')
      .select('id')
      .eq('subscription_plan', 'trial')
      .limit(1);
      
    if (!brands || brands.length === 0) {
      console.log('❌ No trial brands found. Create a trial brand first.');
      return;
    }
    
    const testBrandId = brands[0].id;
    console.log('🎯 Testing with brand ID:', testBrandId);
    
    // Call the create-checkout function
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { 
        plan: 'professional', 
        brandId: testBrandId 
      }
    });
    
    if (error) {
      console.error('❌ Function error:', error);
      console.log('\n🔧 Possible issues:');
      console.log('1. Function not deployed: supabase functions deploy create-checkout');
      console.log('2. Missing environment variables in Supabase Dashboard');
      console.log('3. CORS issues with function configuration');
    } else {
      console.log('✅ Function works! Response:', data);
      if (data.checkoutUrl) {
        console.log('🎉 Checkout URL created successfully!');
        console.log('🔗 URL:', data.checkoutUrl);
      }
    }
    
  } catch (err) {
    console.error('💥 Test error:', err);
  }
}

async function checkEnvironment() {
  console.log('🔍 Checking function availability...\n');
  
  // Try to call a simple function to see if functions work at all
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { test: true }
    });
    
    console.log('📡 Function response:', { data, error });
    
    if (error && error.message.includes('not found')) {
      console.log('\n🚀 Need to deploy functions:');
      console.log('supabase functions deploy create-checkout');
      console.log('supabase functions deploy stripe-webhook');
    }
    
  } catch (err) {
    console.log('❌ Function call failed:', err.message);
  }
}

// Run tests
checkEnvironment().then(() => {
  setTimeout(testCreateCheckout, 1000);
});