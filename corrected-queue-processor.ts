import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Queue processor started with COMPLETE BATCHES API');
    const startTime = Date.now();
    
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

    // Check for completed batches first
    await checkCompletedBatches(supabase);

    // ✅ FIX: Get tasks directly from processing_queue table instead of RPC
    const { data: tasks, error: tasksError } = await supabase
      .from('processing_queue')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1000);

    if (tasksError) {
      console.error('❌ Failed to get tasks from queue:', tasksError.message);
      return new Response(JSON.stringify({ error: tasksError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!tasks || tasks.length === 0) {
      console.log('📭 No tasks in queue');
      return new Response(JSON.stringify({
        success: true, processed: 0, message: 'No tasks in queue'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Processing ${tasks.length} tasks using COMPLETE BATCHES API`);
    
    let processed = 0;
    let failed = 0;
    const aiTasks = tasks.filter((task) => task.task_type === 'ai_intent');
    const otherTasks = tasks.filter((task) => task.task_type !== 'ai_intent');

    // Process non-AI tasks normally
    if (otherTasks.length > 0) {
      console.log(`🚀 Processing ${otherTasks.length} non-AI tasks`);
      for (const task of otherTasks) {
        try {
          await processTask(supabase, task);
          // ✅ FIX: Update status directly instead of RPC
          await supabase.from('processing_queue')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', task.id);
          processed++;
        } catch (error) {
          console.error(`❌ Task ${task.id} failed:`, error.message);
          // ✅ FIX: Update status directly instead of RPC
          await supabase.from('processing_queue')
            .update({ 
              status: 'failed', 
              error_message: error.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', task.id);
          failed++;
        }
      }
    }

    // 🚀 COMPLETE BATCHES API: Submit batch and store for later retrieval
    if (aiTasks.length > 0) {
      console.log(`🤖 Processing ${aiTasks.length} AI tasks using COMPLETE BATCHES API`);
      try {
        // Create batch requests
        const batchRequests = aiTasks.map((task, index) => ({
          custom_id: (task.lead_id && task.lead_id !== 'null' && task.lead_id !== null && !isNaN(parseInt(task.lead_id))) 
            ? `lead_${task.lead_id}` 
            : `task_${task.id}_${index}`,
          params: {
            model: "claude-3-5-haiku-20241022",
            max_tokens: 10,
            messages: [{ role: "user", content: task.payload.prompt }]
          }
        }));

        // Submit batch to Anthropic
        const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
        const batchResponse = await fetch('https://api.anthropic.com/v1/messages/batches', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({ requests: batchRequests })
        });

        if (!batchResponse.ok) {
          const errorText = await batchResponse.text();
          throw new Error(`Batch creation failed: ${batchResponse.status} - ${errorText}`);
        }

        const batch = await batchResponse.json();
        console.log(`✅ Batch ${batch.id} created with ${batchRequests.length} requests`);

        // Store batch info for later retrieval
        const { error: batchStoreError } = await supabase.from('ai_batches').insert({
          batch_id: batch.id,
          status: 'processing',
          task_ids: aiTasks.map((t) => t.id),
          lead_ids: aiTasks.map((t) => t.lead_id),
          brand_id: aiTasks[0]?.brand_id, // ✅ ADD: Include brand_id
          created_at: new Date().toISOString()
        });

        if (batchStoreError) {
          console.error('❌ Failed to store batch info:', batchStoreError);
        }

        // Mark tasks as processing (not completed yet)
        for (const task of aiTasks) {
          await supabase.from('processing_queue').update({
            status: 'processing',
            batch_id: batch.id,
            started_at: new Date().toISOString()
          }).eq('id', task.id);
          processed++;
        }

        console.log(`🚀 All ${aiTasks.length} AI tasks submitted to batch processing`);
      } catch (error) {
        console.error('❌ Batch processing failed:', error.message);
        // Mark all AI tasks as failed
        for (const task of aiTasks) {
          // ✅ FIX: Update status directly instead of RPC
          await supabase.from('processing_queue')
            .update({ 
              status: 'failed', 
              error_message: error.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', task.id);
          failed++;
        }
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`🏁 Queue processing completed: ${processed} success, ${failed} failed in ${processingTime}ms`);

    return new Response(JSON.stringify({
      success: true, processed, failed, processing_time_ms: processingTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Queue processor error:', error.message);
    return new Response(JSON.stringify({ error: error.message, success: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Check for completed batches and retrieve results
async function checkCompletedBatches(supabase) {
  try {
    console.log('🔍 Checking for completed batches...');
    
    const { data: processingBatches, error: batchError } = await supabase
      .from('ai_batches')
      .select('*')
      .eq('status', 'processing');

    if (batchError) {
      console.error('❌ Failed to get processing batches:', batchError);
      return;
    }

    if (!processingBatches || processingBatches.length === 0) {
      console.log('📭 No processing batches to check');
      return;
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    for (const batchRecord of processingBatches) {
      try {
        // Check batch status with Anthropic
        const statusResponse = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchRecord.batch_id}`, {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
        });

        if (!statusResponse.ok) {
          console.error(`❌ Failed to check batch ${batchRecord.batch_id} status`);
          continue;
        }

        const batchStatus = await statusResponse.json();
        console.log(`📊 Batch ${batchRecord.batch_id} status: ${batchStatus.processing_status}`);

        if (batchStatus.processing_status === 'ended') {
          console.log(`🎉 Batch ${batchRecord.batch_id} completed! Retrieving results...`);
          
          // Get batch results
          const resultsResponse = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchRecord.batch_id}/results`, {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            }
          });

          if (resultsResponse.ok) {
            const resultsText = await resultsResponse.text();
            const results = resultsText.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
            console.log(`📥 Retrieved ${results.length} results from batch ${batchRecord.batch_id}`);

            // Process results and update leads
            for (const result of results) {
              const leadId = parseInt(result.custom_id.replace('lead_', ''));
              let intentScore = null; // ✅ FIX: Default to null instead of 5
              
              if (result.result && result.result.type === 'succeeded') {
                const aiResponse = result.result.message.content[0].text.trim();
                const score = parseInt(aiResponse.replace(/[^\d]/g, ''));
                if (!isNaN(score) && score >= 1 && score <= 10) {
                  intentScore = score;
                }
                console.log(`🎯 Lead ${leadId}: AI score ${intentScore} (from: "${aiResponse}")`);
              } else {
                console.log(`⚠️ Lead ${leadId}: Using default score (batch result failed)`);
              }

              // Update lead with intent score
              await supabase.from('retention_harbor').update({
                intent: intentScore,
                processed: true
              }).eq('id', leadId);
            }

            // ✅ FIX: Mark all tasks in this batch as completed
            if (batchRecord.task_ids && batchRecord.task_ids.length > 0) {
              await supabase.from('processing_queue')
                .update({ 
                  status: 'completed',
                  completed_at: new Date().toISOString()
                })
                .in('id', batchRecord.task_ids);
            }

            // Mark batch as completed
            await supabase.from('ai_batches').update({
              status: 'completed',
              completed_at: new Date().toISOString()
            }).eq('batch_id', batchRecord.batch_id);

            console.log(`✅ Batch ${batchRecord.batch_id} results processed and leads updated`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing batch ${batchRecord.batch_id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Error checking completed batches:', error.message);
  }
}

async function processTask(supabase, task) {
  const { task_type, payload, lead_id, brand_id } = task;
  console.log(`🔧 Processing task ${task.id}: ${task_type}`);
  
  switch (task_type) {
    case 'ai_intent':
      await processAIIntent(supabase, payload, lead_id);
      break;
    case 'plan_check':
      await processPlanCheck(supabase, payload, brand_id);
      break;
    case 'conversation_parse':
      await processConversationParse(supabase, payload, lead_id);
      break;
    case 'lead_sync':
      await processLeadSync(supabase, payload, brand_id);
      break;
    default:
      throw new Error(`Unknown task type: ${task_type}`);
  }
}

async function processAIIntent(supabase, payload, leadId) {
  console.log(`🧪 [LEAD ${leadId}] AI Intent processing (fallback)`);
  const { data, error } = await supabase.from('retention_harbor').update({
    intent: null, // ✅ FIX: Default to null instead of 5
    processed: true
  }).eq('id', leadId);
  if (error) throw error;
}

async function processPlanCheck(supabase, payload, brandId) {
  const { check_type } = payload;
  if (check_type === 'monthly_reset') {
    const { error } = await supabase.rpc('reset_monthly_lead_counters');
    if (error) {
      throw new Error(`Failed to reset monthly counters: ${error.message}`);
    }
    console.log('🔄 Monthly lead counters reset');
  }
}

async function processConversationParse(supabase, payload, leadId) {
  const { conversation_history } = payload;
  try {
    const parsedData = {
      total_messages: conversation_history.length,
      last_message_time: conversation_history[conversation_history.length - 1]?.time,
      has_replies: conversation_history.some((msg) => msg.type === 'REPLY'),
      reply_count: conversation_history.filter((msg) => msg.type === 'REPLY').length,
      message_types: conversation_history.map((msg) => msg.type),
      parsed_at: new Date().toISOString()
    };
    
    await supabase.from('retention_harbor').update({
      parsed_convo: JSON.stringify(parsedData),
      processed: true
    }).eq('id', leadId);
    
    console.log(`📊 Conversation parsed for lead ${leadId}`);
  } catch (error) {
    throw new Error(`Failed to parse conversation: ${error.message}`);
  }
}

async function processLeadSync(supabase, payload, brandId) {
  const { sync_type } = payload;
  if (sync_type === 'count_sync') {
    const { error } = await supabase.rpc('sync_lead_counts_for_brand', {
      brand_uuid: brandId
    });
    if (error) {
      throw new Error(`Failed to sync lead counts: ${error.message}`);
    }
    console.log(`📊 Lead count synced for brand ${brandId}`);
  }
}
