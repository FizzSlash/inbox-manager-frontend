import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stripe webhook signature verification
async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const elements = signature.split(',');
    const signatureElements: { [key: string]: string } = {};
    
    for (const element of elements) {
      const [key, value] = element.split('=');
      signatureElements[key] = value;
    }
    
    const timestamp = signatureElements['t'];
    const v1 = signatureElements['v1'];
    
    if (!timestamp || !v1) {
      return false;
    }
    
    const payload = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature_bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const signature_hex = Array.from(new Uint8Array(signature_bytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return signature_hex === v1;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🎯 Stripe webhook received');
    
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    if (!signature || !webhookSecret) {
      console.error('❌ Missing signature or webhook secret');
      return new Response('Missing signature', { status: 400, headers: corsHeaders });
    }

    // Verify webhook signature
    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return new Response('Invalid signature', { status: 400, headers: corsHeaders });
    }

    const event = JSON.parse(body);
    console.log('✅ Verified Stripe webhook event:', event.type);

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const brandId = session.metadata?.brand_id;
        const plan = session.metadata?.plan;
        
        if (!brandId || !plan) {
          console.error('❌ Missing brand_id or plan in metadata');
          break;
        }

        console.log(`🎉 Payment successful for brand ${brandId}, upgrading to ${plan}`);

        // Update upgrade attempt status
        const { error: updateError } = await supabase.rpc('update_upgrade_status', {
          session_id: session.id,
          new_status: 'completed'
        });

        if (updateError) {
          console.error('❌ Failed to update upgrade attempt:', updateError);
        }

        // Update brand to paid plan
        const { error: brandError } = await supabase
          .from('brands')
          .update({
            subscription_plan: plan,
            trial_status: 'none',
            trial_started_at: null,
            trial_ends_at: null,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription
          })
          .eq('id', brandId);

        if (brandError) {
          console.error('❌ Failed to update brand:', brandError);
        } else {
          console.log('✅ Brand upgraded successfully');
        }
        
        break;
      }

      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        
        console.log(`❌ Payment failed/expired for session ${session.id}`);

        // Update upgrade attempt status
        const { error: updateError } = await supabase.rpc('update_upgrade_status', {
          session_id: session.id,
          new_status: event.type === 'checkout.session.expired' ? 'expired' : 'failed'
        });

        if (updateError) {
          console.error('❌ Failed to update upgrade attempt:', updateError);
        }
        
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        console.log(`🔄 Subscription cancelled: ${subscription.id}`);

        // Find and downgrade the brand
        const { error: downgradeError } = await supabase
          .from('brands')
          .update({
            subscription_plan: 'trial',
            trial_status: 'expired', // Expired trial, must upgrade
            stripe_subscription_id: null
          })
          .eq('stripe_subscription_id', subscription.id);

        if (downgradeError) {
          console.error('❌ Failed to downgrade brand:', downgradeError);
        } else {
          console.log('✅ Brand downgraded due to subscription cancellation');
        }
        
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        
        console.log(`⚠️ Payment failed for subscription: ${subscriptionId}`);

        // Mark brand as having payment issues (but don't downgrade immediately)
        const { error: updateError } = await supabase
          .from('brands')
          .update({
            // Could add a payment_status column to track this
            // payment_status: 'failed'
          })
          .eq('stripe_subscription_id', subscriptionId);

        if (updateError) {
          console.error('❌ Failed to update brand payment status:', updateError);
        }
        
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});