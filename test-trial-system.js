// ====================================================================
// TRIAL SYSTEM FRONTEND TEST SCRIPT
// Run this in your browser console on the app to test trial functionality
// ====================================================================

console.log('🧪 Starting Trial System Tests...');

// Test 1: Check if trial status is loading
async function testTrialStatusLoading() {
  console.log('\n📋 Test 1: Trial Status Loading');
  
  const { supabase } = window;
  if (!supabase) {
    console.error('❌ Supabase client not found');
    return false;
  }
  
  try {
    // Get current user's brand_id
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ User not authenticated:', userError);
      return false;
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Get user's profile and brand_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('brand_id')
      .eq('id', user.id)
      .single();
      
    if (profileError || !profile) {
      console.error('❌ Profile not found:', profileError);
      return false;
    }
    
    console.log('✅ Profile found, brand_id:', profile.brand_id);
    
    // Test brand_trial_status view
    const { data: trialStatus, error: trialError } = await supabase
      .from('brand_trial_status')
      .select('*')
      .eq('id', profile.brand_id)
      .single();
      
    if (trialError) {
      console.error('❌ Trial status check failed:', trialError);
      return false;
    }
    
    console.log('✅ Trial status loaded:', trialStatus);
    return true;
    
  } catch (error) {
    console.error('❌ Trial status test failed:', error);
    return false;
  }
}

// Test 2: Check if brand creation function works
async function testBrandCreation() {
  console.log('\n🏢 Test 2: Brand Creation Function');
  
  const { supabase } = window;
  
  try {
    // Test with dummy UUID (this will create and immediately delete a test brand)
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';
    const testEmail = 'test@example.com';
    
    const { data: brandId, error } = await supabase.rpc('create_brand_for_user', {
      user_id: testUserId,
      user_email: testEmail
    });
    
    if (error) {
      console.error('❌ Brand creation failed:', error);
      return false;
    }
    
    console.log('✅ Brand creation works! Test brand ID:', brandId);
    
    // Clean up test brand
    const { error: deleteError } = await supabase
      .from('brands')
      .delete()
      .eq('id', brandId);
      
    if (deleteError) {
      console.warn('⚠️ Could not clean up test brand:', deleteError);
    } else {
      console.log('✅ Test brand cleaned up');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Brand creation test failed:', error);
    return false;
  }
}

// Test 3: Check if trial expiry function works
async function testTrialExpiryFunction() {
  console.log('\n⏰ Test 3: Trial Expiry Function');
  
  const { supabase } = window;
  
  try {
    // Get current user's brand_id
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('brand_id')
      .eq('id', user.id)
      .single();
    
    if (!profile?.brand_id) {
      console.error('❌ No brand_id found for user');
      return false;
    }
    
    // Test is_trial_expired function
    const { data: isExpired, error } = await supabase.rpc('is_trial_expired', {
      brand_id_param: profile.brand_id
    });
    
    if (error) {
      console.error('❌ Trial expiry check failed:', error);
      return false;
    }
    
    console.log('✅ Trial expiry function works! Is expired:', isExpired);
    return true;
    
  } catch (error) {
    console.error('❌ Trial expiry test failed:', error);
    return false;
  }
}

// Test 4: Check Stripe checkout creation
async function testStripeCheckout() {
  console.log('\n💳 Test 4: Stripe Checkout Creation');
  
  const { supabase } = window;
  
  try {
    // Get current user's brand_id
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('brand_id')
      .eq('id', user.id)
      .single();
    
    if (!profile?.brand_id) {
      console.error('❌ No brand_id found for user');
      return false;
    }
    
    // Test checkout creation (don't actually redirect)
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        plan: 'professional',
        brandId: profile.brand_id
      }
    });
    
    if (error) {
      console.error('❌ Stripe checkout creation failed:', error);
      return false;
    }
    
    if (data?.checkoutUrl) {
      console.log('✅ Stripe checkout creation works! URL:', data.checkoutUrl);
      return true;
    } else {
      console.error('❌ No checkout URL returned:', data);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Stripe checkout test failed:', error);
    return false;
  }
}

// Test 5: Check lead data access
async function testLeadDataAccess() {
  console.log('\n📧 Test 5: Lead Data Access');
  
  const { supabase } = window;
  
  try {
    // Get current user's brand_id
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('brand_id')
      .eq('id', user.id)
      .single();
    
    if (!profile?.brand_id) {
      console.error('❌ No brand_id found for user');
      return false;
    }
    
    // Test retention_harbor access
    const { data: leads, error } = await supabase
      .from('retention_harbor')
      .select('id, lead_email, brand_id, status')
      .eq('brand_id', profile.brand_id)
      .limit(5);
    
    if (error) {
      console.error('❌ Lead data access failed:', error);
      return false;
    }
    
    console.log('✅ Lead data access works! Found', leads?.length || 0, 'leads');
    if (leads?.length > 0) {
      console.log('Sample lead:', leads[0]);
    }
    return true;
    
  } catch (error) {
    console.error('❌ Lead data access test failed:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running Comprehensive Trial System Tests...\n');
  
  const tests = [
    { name: 'Trial Status Loading', fn: testTrialStatusLoading },
    { name: 'Brand Creation Function', fn: testBrandCreation },
    { name: 'Trial Expiry Function', fn: testTrialExpiryFunction },
    { name: 'Stripe Checkout Creation', fn: testStripeCheckout },
    { name: 'Lead Data Access', fn: testLeadDataAccess }
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passedTests++;
      }
    } catch (error) {
      console.error(`❌ ${test.name} failed with exception:`, error);
    }
  }
  
  console.log(`\n📊 Test Results: ${passedTests}/${tests.length} tests passed`);
  
  if (passedTests === tests.length) {
    console.log('🎉 ALL TESTS PASSED! Your trial system is working correctly.');
  } else if (passedTests >= tests.length - 1) {
    console.log('⚠️ MOSTLY WORKING - Minor issues detected.');
  } else {
    console.log('❌ MAJOR ISSUES - Multiple tests failed. Check database restoration.');
  }
  
  return passedTests === tests.length;
}

// Auto-run tests if this script is executed directly
if (typeof window !== 'undefined' && window.supabase) {
  runAllTests();
} else {
  console.log('ℹ️ To run tests, copy this entire script into your browser console while on the app.');
}