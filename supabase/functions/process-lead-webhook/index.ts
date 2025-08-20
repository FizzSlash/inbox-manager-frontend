// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ENCRYPTION_SALT = 'InboxManager_2024_Salt_Key';

// Decrypt API key using the same logic as frontend
const decryptApiKey = (encryptedKey: string): string => {
  try {
    if (!encryptedKey) return '';
    
    // Check if it looks like base64
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(encryptedKey)) {
      return encryptedKey; // Not base64, return as plain text
    }
    
    try {
      const decoded = atob(encryptedKey);
      if (decoded.includes(ENCRYPTION_SALT)) {
        return decoded.replace(ENCRYPTION_SALT, '');
      } else {
        return decoded; // No salt found, likely just base64 encoded
      }
    } catch (error) {
      console.warn('atob decoding failed for key:', error);
      return encryptedKey;
    }
  } catch (error) {
    console.error('Unexpected error in decryptApiKey:', error);
    return encryptedKey || '';
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🎯 Webhook received:', req.method, req.url)
    
    // Check if request has authorization (for logged-in users) or not (for webhooks)
    const authHeader = req.headers.get('Authorization')
    console.log('🔐 Request has auth header:', !!authHeader)
    
    const webhookData = await req.json()
    console.log('📦 Webhook data received:', JSON.stringify(webhookData, null, 2))
    
    // Extract account ID from webhook URL path
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const accountId = pathParts[pathParts.length - 1]
    console.log('🔑 Account ID extracted:', accountId)
    
    // Always use service role key for webhook processing (bypasses any JWT requirements)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          }
        }
      }
    )
    
    // Look up brand_id and API key from api_settings
    console.log('🔍 Looking up brand_id and API key for account:', accountId)
    const { data: apiSettings, error: apiError } = await supabase
      .from('api_settings')
      .select('brand_id, esp_api_key, esp_provider')
      .eq('account_id', accountId)
      .eq('esp_provider', 'smartlead')
      .single()
    
    if (apiError) {
      console.log('⚠️ API settings lookup failed:', apiError.message, '- using accountId as brandId')
    }
    
    const brandId = apiSettings?.brand_id || accountId
    const encryptedApiKey = apiSettings?.esp_api_key
    const decryptedApiKey = encryptedApiKey ? decryptApiKey(encryptedApiKey) : null
    const apiKeyToUse = decryptedApiKey || webhookData.secret_key
    
    console.log('🏢 Brand ID resolved:', brandId)
    console.log('🔑 Found encrypted API key:', !!encryptedApiKey)
    console.log('🔑 Decrypted successfully:', !!decryptedApiKey)
    console.log('🔑 Using API key from:', decryptedApiKey ? 'stored settings (decrypted)' : 'webhook')
    console.log('🔑 API key (first 20 chars):', apiKeyToUse?.substring(0, 20) + '...')
    
    // Get conversation history from SmartLead API
    console.log('🔍 Debug webhook fields:')
    console.log('  campaign_id:', webhookData.campaign_id)
    console.log('  sl_email_lead_id:', webhookData.sl_email_lead_id)  
    console.log('  secret_key:', webhookData.secret_key)
    
    const conversationUrl = `https://server.smartlead.ai/api/v1/campaigns/${webhookData.campaign_id}/leads/${webhookData.sl_email_lead_id}/message-history?api_key=${apiKeyToUse}`
    console.log('📞 Fetching conversation from SmartLead...')
    console.log('🔗 Full URL:', conversationUrl)
    
    // Initialize default values in case API calls fail
    let conversationData = { history: [] }
    let leadData = [{ lead_campaign_data: [{ lead_category_id: '1' }], first_name: '', last_name: '', website: '', created_at: new Date().toISOString() }]
    let intentScore = 5
    
    // Fetch conversation history with error handling
    try {
      const conversationResponse = await fetch(conversationUrl)
      if (conversationResponse.ok) {
        conversationData = await conversationResponse.json()
        console.log('💬 Conversation history received:', conversationData.history?.length || 0, 'messages')
      } else {
        console.log('⚠️ SmartLead conversation API failed:', conversationResponse.status, '- continuing with basic data')
      }
    } catch (error) {
      console.log('⚠️ SmartLead conversation fetch failed:', error.message, '- continuing with basic data')
    }
    
    // Get lead details from SmartLead API with error handling
    try {
      const leadUrl = `https://server.smartlead.ai/api/v1/leads/?api_key=${apiKeyToUse}&email=${webhookData.sl_lead_email}`
      console.log('👤 Fetching lead details from SmartLead...')
      
      const leadResponse = await fetch(leadUrl)
      if (leadResponse.ok) {
        leadData = await leadResponse.json()
        console.log('📋 Lead details received')
      } else {
        console.log('⚠️ SmartLead lead API failed:', leadResponse.status, '- using webhook data only')
      }
    } catch (error) {
      console.log('⚠️ SmartLead lead fetch failed:', error.message, '- using webhook data only')
    }
    
    // Process conversation for AI intent scoring and display
    const processedConversation = processConversationSummary(conversationData.history || [])
    console.log('🧠 Processing intent with AI...')
    intentScore = await processIntentWithAI(processedConversation.conversation || [])
    console.log('🧠 Intent score calculated:', intentScore)
    
    // Process conversation for display
    const displayConversation = processConversationForDisplay(conversationData.history || [])
    
    // Extract subject from first message if available
    const firstMessage = conversationData.history?.[0]
    const subject = firstMessage?.subject || ''
    
    // Prepare lead data for insertion (matching n8n workflow field mapping)
    const leadInsertData = {
      lead_email: webhookData.sl_lead_email,
      lead_category: leadData[0]?.lead_campaign_data?.[0]?.lead_category_id || '1',
      first_name: leadData[0]?.first_name || '',
      last_name: leadData[0]?.last_name || '',
      website: leadData[0]?.website || '',
      subject: subject,
      email_message_body: JSON.stringify(conversationData.history || []),
      created_at_lead: leadData[0]?.created_at || new Date().toISOString(),
      campaign_ID: webhookData.campaign_id,
      lead_ID: webhookData.sl_email_lead_id,
      source_api_key: webhookData.secret_key,
      intent: intentScore,
      parsed_convo: JSON.stringify(processedConversation), // Use full object with metadata (matches n8n format)
      brand_id: brandId,
      email_account_id: accountId,
      status: 'INBOX'
    }
    
    console.log('💾 Inserting/updating lead in database...')
    
    // Try to update existing lead first, then insert if not found (FIXED: per brand)
    const { data: existingLead } = await supabase
      .from('retention_harbor')
      .select('id')
      .eq('brand_id', brandId)
      .eq('lead_email', webhookData.sl_lead_email)
      .single()
    
    // CRITICAL: Check trial expiration before processing lead
    console.log('🚦 Checking trial status for brand:', brandId);
    
    const { data: trialCheck, error: trialError } = await supabase.rpc('is_trial_expired', { 
      brand_id_param: brandId 
    });
    
    if (trialError) {
      console.error('❌ Failed to check trial status:', trialError);
      // Continue processing - don't block on trial check errors
    } else if (trialCheck) {
      console.log('❌ TRIAL BLOCKED: Brand has expired trial, skipping lead processing');
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Trial expired - lead processing blocked',
          brandId: brandId
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('✅ Trial check passed, processing lead...');

    let insertedLead, insertError
    
    if (existingLead) {
      // Update existing lead (FIXED: per brand)
      console.log('📝 Updating existing lead:', existingLead.id)
      const { data, error } = await supabase
        .from('retention_harbor')
        .update(leadInsertData)
        .eq('id', existingLead.id)
        .select()
        .single()
      insertedLead = data
      insertError = error
    } else {
      // Insert new lead
      console.log('➕ Creating new lead')
      const { data, error } = await supabase
        .from('retention_harbor')
        .insert(leadInsertData)
        .select()
        .single()
      insertedLead = data
      insertError = error
    }
    
    if (insertError) {
      console.error('❌ Database insertion error:', insertError)
      throw insertError
    }
    
    console.log('✅ Lead successfully inserted with ID:', insertedLead?.id)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        leadId: insertedLead?.id,
        accountId: accountId,
        brandId: brandId,
        intentScore: intentScore,
        email: webhookData.sl_lead_email
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
    
  } catch (error) {
    console.error('💥 Webhook processing error:', error.message)
    console.error('Stack:', error.stack)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function processIntentWithAI(conversationHistory: any[]): Promise<number> {
  try {
    if (!conversationHistory || conversationHistory.length === 0) {
      return 5 // Default medium intent
    }
    
    // Create a lightweight summary for AI analysis
    const conversationSummary = conversationHistory.map(msg => {
      const cleanContent = (msg.email_body || '')
        .replace(/<[^>]*>/g, ' ')           // Remove HTML tags
        .replace(/\s+/g, ' ')              // Normalize whitespace
        .replace(/\r\n/g, '\n')            // Fix line breaks
        .trim()                            // Remove leading/trailing space
        .substring(0, 400)                 // Limit to 400 chars per message
     
      return {
        type: msg.type,                    // SENT or REPLY
        time: msg.time,                    // Timestamp
        from: msg.from,                    // Sender email
        content: cleanContent,             // Cleaned content
        subject: msg.subject || ''         // Subject line
      }
    })
    
    const prompt = `I run an email marketing agency and want to you classify intent based on conversation history. Just respond with a number.

Read the whole transcript and consider BOTH current engagement AND previous engagement patterns:

- If they had multiple replies but went quiet recently: Still consider HIGH intent (they were engaged)
- If they're currently active and engaged: HIGH intent  
- If they had some engagement but minimal: MEDIUM intent
- If they never engaged or clearly not interested: LOW intent

Scoring:
- Low intent: 1-3 (never engaged, clearly not interested)
- Medium intent: 4-7 (some engagement, lukewarm)  
- High intent: 7-10 (currently engaged OR was previously engaged with multiple replies)

Here is the message history. RESPOND WITH ONLY A NUMBER. If anything else is in the output, the entire prompt fails.

${JSON.stringify(conversationSummary)}`
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log('⚠️ AI request failed:', response.status, response.statusText)
      console.log('⚠️ AI error details:', errorText)
      console.log('⚠️ Using default intent score')
      return 5
    }
    
    const result = await response.json()
    const intentText = result.content[0].text.trim()
    const intentScore = parseInt(intentText)
    
    console.log('🤖 AI response:', intentText, '-> parsed as:', intentScore)
    
    return (intentScore >= 1 && intentScore <= 10) ? intentScore : 5
    
  } catch (error) {
    console.error('🤖 AI processing error:', error)
    return 5 // Default to medium intent on error
  }
}

function processConversationSummary(chatHistory: any[]): any {
  if (!chatHistory || !Array.isArray(chatHistory)) {
    return { conversation: [], message_count: 0, conversation_length: 0 }
  }
  
  // Extract only essential data for intent scoring (matching n8n logic)
  const conversationSummary = chatHistory.map(msg => {
    // Clean the HTML email body
    const cleanContent = (msg.email_body || '')
      .replace(/<[^>]*>/g, ' ')           // Remove HTML tags
      .replace(/\s+/g, ' ')              // Normalize whitespace
      .replace(/\r\n/g, '\n')            // Fix line breaks
      .trim()                            // Remove leading/trailing space
      .substring(0, 400)                 // Limit to 400 chars per message
   
    return {
      type: msg.type,                    // SENT or REPLY
      time: msg.time,                    // Timestamp
      from: msg.from,                    // Sender email
      content: cleanContent,             // Cleaned content
      subject: msg.subject || ''         // Subject line
    }
  })
  
  // Create the lightweight payload for intent analysis
  return {
    conversation: conversationSummary,   // Much smaller conversation data!
    message_count: conversationSummary.length,
    conversation_length: conversationSummary.reduce((total, msg) => total + msg.content.length, 0)
  }
}

function processConversationForDisplay(history: any[], leadEmail: string): any[] {
  if (!history || !Array.isArray(history)) return []
  
  return history.map(msg => {
    // Determine message type based on who sent it
    // If the message is from the lead's email, it's a REPLY
    // If the message is to the lead's email, it's SENT
    let messageType = 'UNKNOWN'
    
    if (msg.from && msg.from.toLowerCase().includes(leadEmail.toLowerCase())) {
      messageType = 'REPLY'  // Lead replied to us
    } else if (msg.to && msg.to.toLowerCase().includes(leadEmail.toLowerCase())) {
      messageType = 'SENT'   // We sent to the lead
    } else if (msg.type) {
      messageType = msg.type // Use existing type if available
    }
    
    return {
      type: messageType,
      time: msg.time || new Date().toISOString(),
      from: msg.from || '',
      to: msg.to || '',
      subject: msg.subject || '',
      email_body: msg.email_body || '',
      content: msg.email_body || '' // For display compatibility with your frontend
    }
  })
}
