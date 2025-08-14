import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { plan, brandId } = await req.json();
    
    if (!plan || !brandId) {
      return new Response(
        JSON.stringify({ error: 'Plan and brandId are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Plan configurations - CHECK THESE AGAINST YOUR STRIPE DASHBOARD
    const planConfigs: Record<string, { priceId: string; amount: number; name: string }> = {
      professional: {
        priceId: Deno.env.get('STRIPE_PROFESSIONAL_PRICE_ID') ?? 'price_1Rsedv21FSFEi3xzpk5l8jzW',
        amount: 29700, // $297
        name: 'Core Plan'
      },
      enterprise: {
        priceId: Deno.env.get('STRIPE_ENTERPRISE_PRICE_ID') ?? 'price_1RsesG21FSFEi3xzzsf0UP3N',
        amount: 59700, // $597
        name: 'Scale Plan'
      },
      agency: {
        priceId: Deno.env.get('STRIPE_AGENCY_PRICE_ID') ?? 'price_1RvoP921FSFEi3xzbeIPaPtF',
        amount: 99700, // $997
        name: 'Agency+ Plan'
      }
    };

    const selectedPlan = planConfigs[plan];
    if (!selectedPlan) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan selected' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Stripe checkout session
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe configuration missing' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the user's email from the profiles table using brand_id
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('brand_id', brandId)
      .single();

    if (profileError) {
      console.log('❌ Profile lookup error:', profileError);
    }

    // Get brand data including existing subscription info
    const { data: brandData, error: brandError } = await supabaseClient
      .from('brands')
      .select('name, stripe_customer_id, stripe_subscription_id, subscription_plan')
      .eq('id', brandId)
      .single();

    if (brandError) {
      console.log('❌ Brand lookup error:', brandError);
    }

    const userEmail = profileData?.email;
    const brandName = brandData?.name !== 'INSERT HERE' ? brandData?.name : undefined;
    const existingCustomerId = brandData?.stripe_customer_id;
    const existingSubscriptionId = brandData?.stripe_subscription_id;
    const currentPlan = brandData?.subscription_plan;
    
    console.log('🔍 Found user email:', userEmail);
    console.log('🔍 Brand name:', brandName);
    console.log('🔍 Existing customer ID:', existingCustomerId);
    console.log('🔍 Existing subscription ID:', existingSubscriptionId);
    console.log('🔍 Current plan:', currentPlan);
    
    // Debug the subscription modification decision
    console.log('🎯 Subscription modification check:');
    console.log('  Has existing subscription ID:', !!existingSubscriptionId);
    console.log('  Current plan is not trial:', currentPlan !== 'trial');
    console.log('  Will modify subscription:', !!(existingSubscriptionId && currentPlan !== 'trial'));

    // Check if this is an upgrade from existing paid plan
    if (existingSubscriptionId && currentPlan !== 'trial') {
      console.log('🔄 Existing customer upgrading from paid plan - using subscription modification');
      
      // If using test/fake Stripe IDs, simulate proration instead of calling Stripe
      const isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production';
      const hasTestIds = existingSubscriptionId.startsWith('test_') || existingCustomerId.startsWith('test_');
      
      if (hasTestIds && (isDevelopment || existingSubscriptionId.includes('demo'))) {
        console.log('🧪 Test mode: Simulating proration without calling Stripe');
        
        // Simulate proration calculation
        const currentPlanPrice = currentPlan === 'professional' ? 297 : currentPlan === 'enterprise' ? 597 : 997;
        const newPlanPrice = selectedPlan.amount / 100;
        const daysIntoMonth = 15; // Simulated
        const daysInMonth = 30;
        const prorationAmount = Math.round(((newPlanPrice - currentPlanPrice) * (daysInMonth - daysIntoMonth)) / daysInMonth);
        
        console.log('💰 Simulated proration:');
        console.log('  Current plan price:', currentPlanPrice);
        console.log('  New plan price:', newPlanPrice);
        console.log('  Days remaining:', daysInMonth - daysIntoMonth);
        console.log('  Prorated charge:', prorationAmount);
        
        // Update database
        const { error: brandUpdateError } = await supabaseClient
          .from('brands')
          .update({ subscription_plan: plan })
          .eq('id', brandId);

        if (brandUpdateError) {
          console.error('❌ Failed to update brand in database:', brandUpdateError);
        }

        // Return simulated success
        return new Response(
          JSON.stringify({ 
            success: true,
            subscriptionUpdated: true,
            message: `Plan upgraded! Simulated prorated charge: $${prorationAmount}`,
            subscriptionId: existingSubscriptionId,
            prorationAmount: prorationAmount,
            testMode: true
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      try {
        // Get the existing subscription details
        const subResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${existingSubscriptionId}`, {
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
          },
        });

        if (!subResponse.ok) {
          throw new Error(`Failed to fetch subscription: ${subResponse.statusText}`);
        }

        const subscription = await subResponse.json();
        const subscriptionItemId = subscription.items.data[0].id;
        const currentPeriodEnd = subscription.current_period_end;
        const currentPeriodStart = subscription.current_period_start;
        
        console.log('📊 Subscription details:');
        console.log('  Current period start:', new Date(currentPeriodStart * 1000));
        console.log('  Current period end:', new Date(currentPeriodEnd * 1000));
        console.log('  Days remaining in cycle:', Math.ceil((currentPeriodEnd * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));

        // First, let's preview the proration to see what Stripe will charge
        const previewParams = new URLSearchParams({
          'subscription': existingSubscriptionId,
          'subscription_items[0][id]': subscriptionItemId,
          'subscription_items[0][price]': selectedPlan.priceId,
          'proration_behavior': 'create_prorations',
          'proration_date': Math.floor(Date.now() / 1000).toString(),
        });

        const previewResponse = await fetch(`https://api.stripe.com/v1/invoices/upcoming?${previewParams.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
          },
        });

        if (previewResponse.ok) {
          const previewInvoice = await previewResponse.json();
          console.log('💰 Proration preview:');
          console.log('  Total amount due:', previewInvoice.amount_due / 100, 'USD');
          console.log('  Line items:', previewInvoice.lines.data.map(item => ({
            description: item.description,
            amount: item.amount / 100,
            proration: item.proration
          })));
        }

        // Modify the subscription with proration
        const updateParams = new URLSearchParams({
          'items[0][id]': subscriptionItemId,
          'items[0][price]': selectedPlan.priceId,
          'proration_behavior': 'create_prorations', // This creates immediate proration
          'proration_date': Math.floor(Date.now() / 1000).toString(), // Prorate from now
          'billing_cycle_anchor': 'unchanged', // Keep same billing date
        });

        const updateResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${existingSubscriptionId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: updateParams.toString(),
        });

        if (!updateResponse.ok) {
          const error = await updateResponse.text();
          console.error('Stripe subscription update error:', error);
          throw new Error(`Subscription update failed: ${error}`);
        }

        const updatedSubscription = await updateResponse.json();
        console.log('✅ Subscription updated successfully:', updatedSubscription.id);

        // Update our database
        const { error: brandUpdateError } = await supabaseClient
          .from('brands')
          .update({
            subscription_plan: plan,
          })
          .eq('id', brandId);

        if (brandUpdateError) {
          console.error('❌ Failed to update brand in database:', brandUpdateError);
        } else {
          console.log('✅ Database updated successfully');
        }

        // Get the latest invoice to show actual charge
        let actualChargeAmount = null;
        try {
          const latestInvoiceResponse = await fetch(`https://api.stripe.com/v1/invoices?subscription=${existingSubscriptionId}&limit=1`, {
            headers: { 'Authorization': `Bearer ${stripeKey}` },
          });
          if (latestInvoiceResponse.ok) {
            const invoices = await latestInvoiceResponse.json();
            if (invoices.data.length > 0) {
              actualChargeAmount = invoices.data[0].amount_paid / 100;
              console.log('💳 Actual charge amount:', actualChargeAmount, 'USD');
            }
          }
        } catch (e) {
          console.log('⚠️ Could not fetch latest invoice:', e.message);
        }

        // Return success - no checkout needed
        return new Response(
          JSON.stringify({ 
            success: true,
            subscriptionUpdated: true,
            message: actualChargeAmount 
              ? `Plan upgraded! Prorated charge: $${actualChargeAmount}`
              : 'Subscription upgraded successfully with immediate proration',
            subscriptionId: updatedSubscription.id,
            prorationAmount: actualChargeAmount
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      } catch (error) {
        console.error('❌ Subscription modification failed:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to modify subscription. Please try again or contact support.',
            details: error.message
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }
    
    // Debug environment variables
    console.log('🔧 Environment check:');
    console.log('  STRIPE_SECRET_KEY exists:', !!Deno.env.get('STRIPE_SECRET_KEY'));
    console.log('  STRIPE_PROFESSIONAL_PRICE_ID:', Deno.env.get('STRIPE_PROFESSIONAL_PRICE_ID') || 'NOT SET');
    console.log('  STRIPE_ENTERPRISE_PRICE_ID:', Deno.env.get('STRIPE_ENTERPRISE_PRICE_ID') || 'NOT SET');
    console.log('  STRIPE_AGENCY_PRICE_ID:', Deno.env.get('STRIPE_AGENCY_PRICE_ID') || 'NOT SET');
    
    // Debug the plan selection
    console.log('🎯 Plan selection debug:');
    console.log('  Requested plan:', plan);
    console.log('  Selected config:', selectedPlan);
    console.log('  Price ID being used:', selectedPlan.priceId);

    const originUrl = req.headers.get('origin') || 'http://localhost:3000';
    
    const checkoutData = {
      mode: 'subscription',
      line_items: [
        {
          price: selectedPlan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${originUrl}/?upgrade=success&session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url: `${originUrl}/?upgrade=cancelled&plan=${plan}`,
      customer_email: userEmail,
      client_reference_id: brandId,
      metadata: {
        brand_id: brandId,
        plan: plan,
        brand_name: brandName || 'Inbox Manager User'
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      payment_method_types: ['card'],
      subscription_data: {
        metadata: {
          brand_id: brandId,
          plan: plan
        }
      }
    };

    const formParams = new URLSearchParams({
      'mode': checkoutData.mode,
      'line_items[0][price]': selectedPlan.priceId,
      'line_items[0][quantity]': '1',
      'success_url': checkoutData.success_url,
      'cancel_url': checkoutData.cancel_url,
      'client_reference_id': brandId,
      'metadata[brand_id]': brandId,
      'metadata[plan]': plan,
      'metadata[brand_name]': checkoutData.metadata.brand_name,
      'allow_promotion_codes': 'true',
      'billing_address_collection': 'required',
      'payment_method_types[0]': 'card',
      'subscription_data[metadata][brand_id]': brandId,
      'subscription_data[metadata][plan]': plan,
    });

    // Add customer email if available
    if (userEmail) {
      formParams.append('customer_email', userEmail);
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formParams.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Stripe error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create checkout session', details: error }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const session = await response.json();

    // Log the upgrade attempt
    const { error: logError } = await supabaseClient
      .from('upgrade_attempts')
      .insert([
        {
          brand_id: brandId,
          plan: plan,
          stripe_session_id: session.id,
          status: 'initiated',
          created_at: new Date().toISOString()
        }
      ]);

    if (logError) {
      console.warn('Failed to log upgrade attempt:', logError);
      // Don't fail the whole process for logging issues
    }

    return new Response(
      JSON.stringify({ 
        checkoutUrl: session.url,
        sessionId: session.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Create checkout error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});