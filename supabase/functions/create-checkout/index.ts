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

    // Plan configurations with your actual Stripe Price IDs
    const planConfigs: Record<string, { priceId: string; amount: number; name: string }> = {
      starter: {
        priceId: Deno.env.get('STRIPE_STARTER_PRICE_ID') ?? 'price_1QSPexEHdl3eQT0h1J6cXZ8Y',
        amount: 29700, // $297
        name: 'Starter Plan'
      },
      professional: {
        priceId: Deno.env.get('STRIPE_PROFESSIONAL_PRICE_ID') ?? 'price_1QSPf2EHdl3eQT0hYhG5fH9N',
        amount: 49700, // $497
        name: 'Professional Plan'
      },
      god: {
        priceId: Deno.env.get('STRIPE_ENTERPRISE_PRICE_ID') ?? 'price_1QSPf6EHdl3eQT0hMnP4rK2L',
        amount: 99700, // $997
        name: 'Enterprise Plan'
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
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('email, brands!inner(name)')
      .eq('brand_id', brandId)
      .single();

    const userEmail = profileData?.email;
    const brandName = profileData?.brands?.name !== 'INSERT HERE' ? profileData?.brands?.name : undefined;
    
    console.log('🔍 Found user email:', userEmail);
    console.log('🔍 Brand name:', brandName);

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