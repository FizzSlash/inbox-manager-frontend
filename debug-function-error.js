const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xajedwcurzdgzrlnrcqi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhamVkd2N1cnpkZ3pybG5yY3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5ODYwMTgsImV4cCI6MjA2MjU2MjAxOH0.lXFmMWHLpwGVZo2VWbtmAZFaiPnLAm1sZkBXpik2mpY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugFunctionError() {
  console.log('🔍 Debugging create-checkout function error...\n');
  
  try {
    // Get a test brand
    const { data: brands } = await supabase
      .from('brands')  
      .select('id, name')
      .eq('subscription_plan', 'trial')
      .limit(1);
      
    if (!brands || brands.length === 0) {
      console.log('❌ No trial brands found');
      return;
    }
    
    const testBrandId = brands[0].id;
    console.log('🎯 Using brand ID:', testBrandId);
    
    // Make direct fetch to get detailed error
    const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        plan: 'professional',
        brandId: testBrandId
      })
    });
    
    const responseText = await response.text();
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('📡 Response body:', responseText);
    
    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        console.log('❌ Parsed error:', errorData);
        
        if (errorData.error === 'Stripe configuration missing') {
          console.log('\n🔧 SOLUTION: Set STRIPE_SECRET_KEY in Supabase environment variables');
        } else if (errorData.error === 'Invalid plan selected') {
          console.log('\n🔧 SOLUTION: Check plan name mapping in function');
        }
      } catch (parseError) {
        console.log('❌ Could not parse error response');
      }
    }
    
  } catch (err) {
    console.error('💥 Debug error:', err);
  }
}

debugFunctionError();