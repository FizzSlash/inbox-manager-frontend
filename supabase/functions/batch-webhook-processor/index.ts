import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// In-memory batch collector (will be replaced with Redis in production)
let leadBatch = [];
let batchTimer = null;
const BATCH_SIZE = 50;
const BATCH_TIMEOUT = 30000; // 30 seconds

// Encryption/decryption utilities (copied from original)
const decryptApiKey = (encryptedKey, brandId) => {
  try {
    if (!encryptedKey || encryptedKey === 'NULL' || encryptedKey === 'null') {
      return '';
    }
    return encryptedKey || '';
  } catch (error) {
    console.error('❌ API key decryption failed:', error);
    return encryptedKey || '';
  }
};

// Extract text content from HTML (like polling system)
const extractTextFromHTML = (html) => {
  if (!html) return '';
  
  try {
    // Basic HTML tag removal (server-side compatible)
    return html
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim(); // Remove leading/trailing whitespace
  } catch (error) {
    console.log('⚠️ Failed to extract text from HTML:', error.message);
    return html;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 Batch webhook received:', req.method, req.url);
    const webhookData = await req.json();
    console.log('📦 Webhook data received for batching');

    // Find the email field (SmartLead might use different field names)
    const leadEmail = webhookData.sl_lead_email || webhookData.lead_email || webhookData.email;
    if (!leadEmail) {
      throw new Error('No email field found in webhook payload. Available fields: ' + Object.keys(webhookData).join(', '));
    }

    // Extract account ID from webhook URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const accountId = pathParts[pathParts.length - 1];

    // Add to batch with timestamp
    leadBatch.push({
      ...webhookData,
      accountId,
      leadEmail,
      received_at: new Date().toISOString(),
      batch_id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    console.log(`📊 Lead added to batch. Current batch size: ${leadBatch.length}/${BATCH_SIZE}`);

    // Start batch timer if not running
    if (!batchTimer && leadBatch.length > 0) {
      console.log('⏰ Starting batch timer (30 seconds)');
      batchTimer = setTimeout(() => {
        processBatch();
      }, BATCH_TIMEOUT);
    }

    // Process immediately if batch is full
    if (leadBatch.length >= BATCH_SIZE) {
      console.log('📦 Batch size reached, processing immediately');
      processBatch();
    }

    // Return success immediately (< 100ms response time)
    return new Response(JSON.stringify({
      success: true,
      queued: true,
      batch_size: leadBatch.length,
      email: leadEmail
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Batch webhook error:', error.message);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Batch processor - processes leads in bulk
async function processBatch() {
  if (leadBatch.length === 0) return;

  const batch = [...leadBatch];
  leadBatch = []; // Clear for next batch

  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  console.log(`🚀 Processing batch of ${batch.length} leads`);
  const startTime = Date.now();

  // Initialize Supabase with service role
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }
      }
    }
  );

  // Group leads by account for efficient processing
  const leadsByAccount = new Map();
  for (const lead of batch) {
    if (!leadsByAccount.has(lead.accountId)) {
      leadsByAccount.set(lead.accountId, []);
    }
    leadsByAccount.get(lead.accountId).push(lead);
  }

  console.log(`📊 Processing ${leadsByAccount.size} accounts in batch`);

  // Process each account's leads
  for (const [accountId, accountLeads] of leadsByAccount) {
    try {
      await processAccountLeads(supabase, accountId, accountLeads);
    } catch (error) {
      console.error(`❌ Error processing account ${accountId}:`, error.message);
      // Continue processing other accounts even if one fails
    }
  }

  const processingTime = Date.now() - startTime;
  console.log(`✅ Batch processing completed in ${processingTime}ms`);
}

// Process all leads for a specific account
async function processAccountLeads(supabase, accountId, leads) {
  console.log(`🔍 Processing ${leads.length} leads for account ${accountId}`);

  // Look up brand_id and API key from api_settings (once per account)
  const { data: apiSettings, error: apiError } = await supabase
    .from('api_settings')
    .select('brand_id, esp_api_key, encrypted_smartlead_api_key')
    .eq('account_id', accountId) // ✅ FIXED: Use account_id instead of id
    .single();

  if (apiError || !apiSettings) {
    console.error(`❌ API settings not found for account ${accountId}:`, apiError?.message);
    return;
  }

  const brandId = apiSettings.brand_id;
  // Handle both column names for API key (backwards compatibility)
  const encryptedApiKey = apiSettings.encrypted_smartlead_api_key || apiSettings.esp_api_key;
  const apiKey = decryptApiKey(encryptedApiKey, brandId);

  // Check plan limits once per account
  const { data: brandData, error: brandError } = await supabase
    .from('brands')
    .select('subscription_plan, leads_used_this_month, max_leads_per_month')
    .eq('id', brandId)
    .single();

  if (brandError) {
    console.log(`⚠️ Could not check lead limits for brand ${brandId}:`, brandError.message);
  }

  const leadsToInsert = [];
  const tasksToQueue = [];

  // Process each lead in the account
  for (const webhookData of leads) {
    try {
      const processedLead = await prepareLead(supabase, webhookData, brandId, accountId, apiKey);
      if (processedLead) {
        leadsToInsert.push(processedLead.leadData);
        // Queue AI processing task
        tasksToQueue.push({
          task_type: 'ai_intent',
          payload: {
            lead_email: processedLead.leadData.lead_email,
            conversation_history: processedLead.conversationHistory,
            brand_id: brandId
          },
          priority: 1,
          brand_id: brandId
        });
      }
    } catch (error) {
      console.error(`❌ Error preparing lead ${webhookData.leadEmail}:`, error.message);
    }
  }

  // Check if we would exceed plan limits
  if (brandData && brandData.leads_used_this_month + leadsToInsert.length > brandData.max_leads_per_month) {
    const allowedLeads = Math.max(0, brandData.max_leads_per_month - brandData.leads_used_this_month);
    console.log(`🚨 Plan limit would be exceeded. Allowing ${allowedLeads}/${leadsToInsert.length} leads`);
    leadsToInsert.splice(allowedLeads); // Keep only allowed leads
    tasksToQueue.splice(allowedLeads); // Keep only corresponding tasks
  }

  if (leadsToInsert.length === 0) {
    console.log(`⚠️ No leads to insert for account ${accountId}`);
    return;
  }

  // Bulk insert leads (much faster than individual inserts)
  console.log(`💾 Bulk inserting ${leadsToInsert.length} leads`);
  const { data: insertedLeads, error: insertError } = await supabase
    .from('retention_harbor')
    .insert(leadsToInsert)
    .select('id, lead_email');

  if (insertError) {
    console.error(`❌ Bulk insert failed for account ${accountId}:`, insertError.message);
    return;
  }

  console.log(`✅ Successfully inserted ${insertedLeads?.length || 0} leads`);

  // Update lead IDs in queued tasks
  const leadEmailToId = new Map();
  for (const lead of insertedLeads || []) {
    leadEmailToId.set(lead.lead_email, lead.id);
  }

  for (const task of tasksToQueue) {
    task.lead_id = leadEmailToId.get(task.payload.lead_email);
  }

  // Bulk queue AI processing tasks
  if (tasksToQueue.length > 0) {
    console.log(`📝 Queuing ${tasksToQueue.length} AI processing tasks`);
    const { error: queueError } = await supabase
      .from('processing_queue')
      .insert(tasksToQueue);

    if (queueError) {
      console.error(`❌ Failed to queue AI tasks:`, queueError.message);
    }
  }

  // Update brand lead count
  if (insertedLeads?.length > 0) {
    try {
      await supabase.rpc('increment_lead_count', {
        brand_id_param: brandId,
        increment_by: insertedLeads.length
      });
      console.log(`📊 Updated lead count for brand ${brandId}`);
    } catch (error) {
      console.log(`⚠️ Failed to update lead count:`, error.message);
    }
  }
}

// Prepare lead data (extracted from original webhook logic)
async function prepareLead(supabase, webhookData, brandId, accountId, apiKey) {
  console.log(`🔍 Preparing lead ${webhookData.leadEmail} with full conversation data...`);

  // Get full lead data with conversation from Master Inbox API (like polling does)
  let fullLeadData = null;
  let conversationData = { history: [] };

  try {
    if (apiKey && webhookData.sl_email_lead_id) {
      console.log(`📥 Fetching full conversation from Master Inbox API for lead ${webhookData.sl_email_lead_id}...`);
      
      // Use Master Inbox API to get complete conversation data
      const response = await fetch(`https://server.smartlead.ai/api/v1/master-inbox/inbox-replies?api_key=${encodeURIComponent(apiKey)}&fetch_message_history=true`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          offset: 0,
          limit: 20,
          filters: {
            leadIds: [parseInt(webhookData.sl_email_lead_id)]
          },
          sortBy: "REPLY_TIME_DESC"
        })
      });

      if (response.ok) {
        const result = await response.json();
        const leads = result?.data || [];
        
        if (leads.length > 0) {
          fullLeadData = leads[0]; // Get the first (and should be only) lead
          console.log(`✅ Retrieved full conversation data for ${webhookData.leadEmail}`);
          
          // Transform email history to conversation format
          const emailHistory = fullLeadData.email_history || [];
          conversationData = {
            history: emailHistory.map(msg => ({
              from: msg.from || '',
              to: msg.to || '',
              cc: msg.cc || null,
              type: msg.type || 'SENT',
              time: msg.time || new Date().toISOString(),
              content: extractTextFromHTML(msg.email_body || ''),
              email_body: msg.email_body || '',
              subject: msg.subject || '',
              opened: (msg.open_count || 0) > 0,
              clicked: (msg.click_count || 0) > 0,
              stats_id: msg.stats_id || null,
              message_id: msg.message_id || null,
              email_seq_number: msg.email_seq_number || null
            }))
          };
        } else {
          console.log(`⚠️ No conversation data found for lead ${webhookData.sl_email_lead_id}`);
        }
      }
    }
  } catch (error) {
    console.log(`⚠️ Failed to fetch conversation from Master Inbox:`, error.message);
    // Fall back to basic webhook data
    conversationData = webhookData.conversation_data || { history: [] };
  }

  // Parse conversation for better processing
  let parsedConvo = null;
  try {
    if (conversationData.history && conversationData.history.length > 0) {
      parsedConvo = {
        total_messages: conversationData.history.length,
        last_message_time: conversationData.history[conversationData.history.length - 1]?.time,
        has_replies: conversationData.history.some(msg => msg.type === 'REPLY'),
        reply_count: conversationData.history.filter(msg => msg.type === 'REPLY').length
      };
    }
  } catch (error) {
    console.log(`⚠️ Failed to parse conversation:`, error.message);
  }

  // Get first message subject
  const firstMessage = conversationData.history?.[0];
  const subject = firstMessage?.subject || '';

  // Calculate last reply time from conversation
  const replyMessages = conversationData.history?.filter(msg => msg.type === 'REPLY') || [];
  const lastReplyTime = replyMessages.length > 0 
    ? replyMessages[replyMessages.length - 1].time 
    : null;

  // Prepare lead record with full Master Inbox data (like polling system)
  const leadRecord = {
    lead_email: webhookData.sl_lead_email || webhookData.lead_email || webhookData.email,
    lead_category: fullLeadData?.lead_category_id?.toString() || '1',
    first_name: fullLeadData?.lead_first_name || '',
    last_name: fullLeadData?.lead_last_name || '',
    website: fullLeadData?.lead_website || '',
    subject: subject,
    email_message_body: JSON.stringify(conversationData.history || []),
    created_at_lead: fullLeadData?.created_at || new Date().toISOString(),
    campaign_ID: webhookData.campaign_id,
    campaign_name: fullLeadData?.email_campaign_name || null,
    lead_ID: webhookData.sl_email_lead_id,
    source_api_key: webhookData.secret_key,
    intent: null,
    parsed_convo: parsedConvo ? JSON.stringify(parsedConvo) : null,
    brand_id: brandId,
    email_account_id: accountId,
    status: 'INBOX',
    opened: true, // Mark as opened like polling does
    processed: false, // Mark for queue processing
    last_reply_time: lastReplyTime,
    phone: fullLeadData?.lead_phone || null
  };

  return {
    leadData: leadRecord,
    conversationHistory: conversationData.history || []
  };
}

// Helper function to create enhanced increment function
async function createIncrementFunction(supabase) {
  try {
    await supabase.rpc('create_increment_function', {
      sql: `
        CREATE OR REPLACE FUNCTION increment_lead_count(brand_id_param INTEGER, increment_by INTEGER DEFAULT 1)
        RETURNS INTEGER AS $$
        DECLARE
          current_count INTEGER;
        BEGIN
          UPDATE brands 
          SET leads_used_this_month = leads_used_this_month + increment_by
          WHERE id = brand_id_param
          RETURNING leads_used_this_month INTO current_count;
          
          RETURN COALESCE(current_count, 0);
        END;
        $$ LANGUAGE plpgsql;
      `
    });
  } catch (error) {
    console.log('Function may already exist:', error.message);
  }
}
