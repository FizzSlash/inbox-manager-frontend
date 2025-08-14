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

    // Plan configurations
    const planConfigs: Record<string, { priceId: string; amount: number; name: string }> = {
      starter: {
        priceId: Deno.env.get('STRIPE_STARTER_PRICE_ID') ?? 'price_starter_placeholder',
        amount: 29700, // $297
        name: 'Starter Plan'
      },
      professional: {
        priceId: Deno.env.get('STRIPE_PROFESSIONAL_PRICE_ID') ?? 'price_professional_placeholder',
        amount: 49700, // $497
        name: 'Professional Plan'
      },
      god: {
        priceId: Deno.env.get('STRIPE_ENTERPRISE_PRICE_ID') ?? 'price_enterprise_placeholder',
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

    const checkoutData = {
      mode: 'subscription',
      line_items: [
        {
          price: selectedPlan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.get('origin') || 'http://localhost:3000'}?upgrade=success&plan=${plan}`,
      cancel_url: `${req.headers.get('origin') || 'http://localhost:3000'}?upgrade=cancelled`,
      metadata: {
        brand_id: brandId,
        plan: plan
      }
    };

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': checkoutData.mode,
        'line_items[0][price]': selectedPlan.priceId,
        'line_items[0][quantity]': '1',
        'success_url': checkoutData.success_url,
        'cancel_url': checkoutData.cancel_url,
        'metadata[brand_id]': brandId,
        'metadata[plan]': plan,
      }).toString(),
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