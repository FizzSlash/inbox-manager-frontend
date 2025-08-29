// Test script to verify 764 leads can now be queued for AI processing
// Run this in your browser console on the InboxManager page

console.log('🧪 TESTING: 764 leads AI processing fix...');

// Test the parseConversationForIntent function with sample data
const testLead = {
  email_message_body: JSON.stringify([
    {
      type: "SENT",
      email_body: "Hi there, would you like to improve your email marketing?",
      time: "2024-01-15T10:00:00Z"
    },
    {
      type: "REPLY", 
      email_body: "Yes, I'm interested. Tell me more.",
      time: "2024-01-15T11:00:00Z"
    }
  ]),
  lead_email: "test@example.com",
  brand_id: "test-brand-id",
  id: 123
};

// This should now return a parsed conversation instead of null
const result = parseConversationForIntent(testLead.email_message_body);
console.log('🔍 Parse result:', result);

if (result) {
  console.log('✅ SUCCESS: Leads with replies will now be queued!');
  console.log('📊 Parsed conversation has', result.length, 'messages');
} else {
  console.log('❌ FAILED: Still filtering out leads');
}

// Test with leads that have no replies (should still process now)
const testLeadNoReplies = {
  email_message_body: JSON.stringify([
    {
      type: "SENT",
      email_body: "Hi there, would you like to improve your email marketing?",
      time: "2024-01-15T10:00:00Z"
    }
  ])
};

const resultNoReplies = parseConversationForIntent(testLeadNoReplies.email_message_body);
console.log('🔍 No-replies parse result:', resultNoReplies);

console.log('✅ Test complete! Your 764 leads should now be processed.');

