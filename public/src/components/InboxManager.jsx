import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Send, Edit3, Clock, Mail, User, MessageSquare, ChevronDown, ChevronRight, X, TrendingUp, Calendar, ExternalLink, BarChart3, Users, AlertCircle, CheckCircle, Timer, Zap, Target, DollarSign, Activity } from 'lucide-react';

const InboxManager = () => {
  // State for leads from API
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch leads from API
  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('https://leads-api-nu.vercel.app/api/retention-harbor');
      if (!response.ok) throw new Error('Failed to fetch leads');
      
      const data = await response.json();
      
      // Transform the data to match the expected format
      const transformedLeads = (data.leads || []).map(lead => {
        // Parse conversation data from email_message_body
        let conversation = [];
        try {
          if (lead.email_message_body) {
            const parsedConversation = JSON.parse(lead.email_message_body);
            conversation = parsedConversation.map((msg, index) => {
              const prevMsg = parsedConversation[index - 1];
              let responseTime = undefined;
              
              if (msg.type === 'REPLY' && prevMsg && prevMsg.type === 'SENT') {
                const timeDiff = new Date(msg.time) - new Date(prevMsg.time);
                responseTime = timeDiff / (1000 * 60 * 60); // Convert to hours
              }

              return {
                from: msg.from || '',
                to: msg.to || '',
                type: msg.type || 'SENT',
                time: msg.time || new Date().toISOString(),
                content: extractTextFromHTML(msg.email_body || ''),
                opened: (msg.open_count || 0) > 0,
                clicked: (msg.click_count || 0) > 0,
                response_time: responseTime
              };
            });
          }
        } catch (e) {
          console.error('Error parsing conversation for lead', lead.id, e);
          conversation = [];
        }

        // Calculate metrics from conversation
        const replies = conversation.filter(m => m.type === 'REPLY');
        const sent = conversation.filter(m => m.type === 'SENT');
        
        // Calculate average response time
        const responseTimes = conversation
          .filter(m => m.response_time !== undefined)
          .map(m => m.response_time);
        const avgResponseTime = responseTimes.length > 0 
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
          : 0;

        // Calculate engagement score
        let engagementScore = 0;
        if (sent.length > 0) {
          engagementScore += Math.min((replies.length / sent.length) * 60, 60);
          if (avgResponseTime < 1) engagementScore += 40;
          else if (avgResponseTime < 4) engagementScore += 30;
          else if (avgResponseTime < 24) engagementScore += 20;
          else if (avgResponseTime < 72) engagementScore += 10;
        }
        engagementScore = Math.round(Math.min(engagementScore, 100));

        // Calculate intent score based on conversation content
        const allText = conversation.map(m => m.content.toLowerCase()).join(' ');
        let intentScore = 1 + Math.min(replies.length * 2, 6);
        const positiveKeywords = ['interested', 'yes', 'sure', 'sounds good', 'let me know', 'call', 'meeting', 'schedule'];
        intentScore += positiveKeywords.filter(keyword => allText.includes(keyword)).length;
        if (allText.includes('price') || allText.includes('cost')) intentScore += 1;
        if (allText.includes('sample') || allText.includes('example')) intentScore += 1;
        intentScore = Math.min(intentScore, 10);

        return {
          id: lead.id,
          created_at: lead.created_at,
          updated_at: lead.created_at,
          email: lead.lead_email,
          first_name: lead.first_name || 'Unknown',
          last_name: lead.last_name || '',
          website: lead.website || lead.lead_email?.split('@')[1] || '',
          content_brief: `Email marketing campaign for ${lead.lead_category || 'business'}`,
          subject: conversation.length > 0 ? conversation[0].subject || `Campaign for ${lead.first_name || 'Lead'}` : `Campaign for ${lead.first_name || 'Lead'}`,
          email_message_body: lead.email_message_body,
          intent: intentScore,
          created_at_best: lead.created_at,
          response_time_avg: avgResponseTime,
          engagement_score: engagementScore,
          deal_value_estimate: engagementScore > 80 ? 36000 : engagementScore > 60 ? 24000 : 18000,
          tags: ['live-data', lead.lead_category ? `category-${lead.lead_category}` : 'uncategorized', replies.length > 0 ? 'has-replies' : 'no-replies'].filter(Boolean),
          conversation: conversation
        };
      });
      
      setLeads(transformedLeads);
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to extract text from HTML
  const extractTextFromHTML = (html) => {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const [selectedLead, setSelectedLead] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [filterBy, setFilterBy] = useState('all');
  const [responseFilter, setResponseFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftResponse, setDraftResponse] = useState('');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);

  // Available stages for dropdown
  const availableStages = [
    'initial-outreach',
    'engaged', 
    'pricing-discussion',
    'samples-requested',
    'call-scheduled',
    'considering',
    'stalled',
    'no-response',
    'rejected',
    'active'
  ];

  // Update lead stage
  const updateLeadStage = (leadId, newStage) => {
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === leadId 
          ? { ...lead, stage: newStage }
          : lead
      )
    );
  };

  // Get response urgency level
  const getResponseUrgency = (lead) => {
    const lastMessage = lead.conversation[lead.conversation.length - 1];
    const isHighMediumIntent = lead.intent >= 4;
    const theyRepliedLast = lastMessage.type === 'REPLY';
    const weRepliedLast = lastMessage.type === 'SENT';
    const daysSinceLastMessage = (new Date() - new Date(lastMessage.time)) / (1000 * 60 * 60 * 24);
    
    // NEEDS RESPONSE: High/medium intent + they replied last
    if (isHighMediumIntent && theyRepliedLast) {
      if (daysSinceLastMessage >= 2) return 'urgent-response';  // 2+ days = URGENT
      return 'needs-response';  // Same day/1 day = normal priority
    }
    
    // NEEDS FOLLOWUP: We replied last + no response for 3+ days
    if (weRepliedLast && daysSinceLastMessage >= 3) {
      return 'needs-followup';
    }
    
    return 'none';
  };

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const totalLeads = leads.length;
    const highIntentLeads = leads.filter(lead => lead.intent >= 7).length;
    const avgResponseTime = leads.reduce((sum, lead) => sum + lead.response_time_avg, 0) / totalLeads;
    const avgEngagement = leads.reduce((sum, lead) => sum + lead.engagement_score, 0) / totalLeads;
    
    const urgentResponse = leads.filter(lead => getResponseUrgency(lead) === 'urgent-response').length;
    const needsResponse = leads.filter(lead => getResponseUrgency(lead) === 'needs-response').length;
    const needsFollowup = leads.filter(lead => getResponseUrgency(lead) === 'needs-followup').length;

    return {
      totalLeads,
      highIntentLeads,
      avgResponseTime,
      avgEngagement,
      urgentResponse,
      needsResponse,
      needsFollowup
    };
  }, [leads]);

  // Get intent color and label
  const getIntentStyle = (intent) => {
    if (intent >= 7) return { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800', label: 'High Intent' };
    if (intent >= 4) return { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800', label: 'Medium Intent' };
    return { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800', label: 'Low Intent' };
  };

  // Get engagement color
  const getEngagementColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Filter and sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let filtered = leads;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(lead => 
        lead.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply intent filter
    if (filterBy !== 'all') {
      const intentRange = {
        'high': (intent) => intent >= 7,
        'medium': (intent) => intent >= 4 && intent <= 6,
        'low': (intent) => intent <= 3
      };
      filtered = filtered.filter(lead => intentRange[filterBy](lead.intent));
    }

    // Apply date filter (based on last response from them)
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(lead => {
        const lastResponseDate = getLastResponseFromThem(lead.conversation);
        if (!lastResponseDate) return dateFilter === 'no-response'; // Show in "no response" filter
        
        const responseDate = new Date(lastResponseDate);
        const responseDateOnly = new Date(responseDate.getFullYear(), responseDate.getMonth(), responseDate.getDate());
        
        switch (dateFilter) {
          case 'today':
            return responseDateOnly.getTime() === today.getTime();
          case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return responseDateOnly.getTime() === yesterday.getTime();
          case 'this-week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return responseDate >= weekAgo;
          case 'this-month':
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            return responseDate >= monthStart;
          case 'last-30-days':
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return responseDate >= thirtyDaysAgo;
          case 'no-response':
            return false; // Already handled above
          case 'custom':
            if (!customStartDate && !customEndDate) return true;
            const start = customStartDate ? new Date(customStartDate + 'T00:00:00') : new Date('1970-01-01');
            const end = customEndDate ? new Date(customEndDate + 'T23:59:59') : new Date();
            return responseDate >= start && responseDate <= end;
          default:
            return true;
        }
      });
    }

    // Apply response filter
    if (responseFilter !== 'all') {
      filtered = filtered.filter(lead => getResponseUrgency(lead) === responseFilter);
    }

    // Apply sorting
    if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at_best) - new Date(a.created_at_best));
    } else if (sortBy === 'intent') {
      filtered.sort((a, b) => b.intent - a.intent);
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
    } else if (sortBy === 'engagement') {
      filtered.sort((a, b) => b.engagement_score - a.engagement_score);
    } else if (sortBy === 'deal_value') {
      filtered.sort((a, b) => b.deal_value_estimate - a.deal_value_estimate);
    } else if (sortBy === 'response_time') {
      filtered.sort((a, b) => a.response_time_avg - b.response_time_avg);
    } else if (sortBy === 'urgent_replies') {
      // Sort by urgency: urgent first, then needs-response, then needs-followup, then others
      filtered.sort((a, b) => {
        const urgencyA = getResponseUrgency(a);
        const urgencyB = getResponseUrgency(b);
        
        const urgencyOrder = { 'urgent-response': 4, 'needs-response': 3, 'needs-followup': 2, 'none': 1 };
        const scoreA = urgencyOrder[urgencyA] || 0;
        const scoreB = urgencyOrder[urgencyB] || 0;
        
        if (scoreA !== scoreB) return scoreB - scoreA; // Urgent first
        
        // Secondary sort by intent for same urgency level
        return b.intent - a.intent;
      });
    }

    return filtered;
  }, [leads, searchQuery, filterBy, responseFilter, dateFilter, customStartDate, customEndDate, sortBy]);

  // Auto-calculate engagement score
  const calculateEngagementScore = (conversation) => {
    const replies = conversation.filter(m => m.type === 'REPLY').length;
    const sent = conversation.filter(m => m.type === 'SENT').length;
    if (sent === 0) return 0;
    
    let score = 0;
    
    // Response rate (60 points max)
    score += Math.min((replies / sent) * 60, 60);
    
    // Response speed bonus (40 points max)
    const avgResponse = conversation
      .filter(m => m.response_time)
      .reduce((sum, m) => sum + m.response_time, 0) / Math.max(replies, 1);
    
    if (avgResponse < 1) score += 40;      // Under 1 hour = 40 points
    else if (avgResponse < 4) score += 30;  // Under 4 hours = 30 points  
    else if (avgResponse < 24) score += 20; // Under 1 day = 20 points
    else if (avgResponse < 72) score += 10; // Under 3 days = 10 points
    
    return Math.round(Math.min(score, 100));
  };

  // Get last response date from them (last REPLY message)
  const getLastResponseFromThem = (conversation) => {
    const replies = conversation.filter(msg => msg.type === 'REPLY');
    if (replies.length === 0) return null;
    return replies[replies.length - 1].time;
  };

  // Check if lead needs reply (they replied last)
  const checkNeedsReply = (conversation) => {
    const lastMessage = conversation[conversation.length - 1];
    return lastMessage.type === 'REPLY';
  };

  // Auto-generate tags based on conversation
  const generateAutoTags = (conversation, lead) => {
    const tags = [...lead.tags]; // Keep existing manual tags
    const lastMessage = conversation[conversation.length - 1];
    const isHighMediumIntent = lead.intent >= 4;
    const theyRepliedLast = lastMessage.type === 'REPLY';
    const daysSinceReply = (new Date() - new Date(lastMessage.time)) / (1000 * 60 * 60 * 24);
    
    // Remove any existing priority tags first
    const cleanTags = tags.filter(tag => !['needs-reply', 'urgent-reply'].includes(tag));
    
    // Add priority tags for high/medium intent leads only
    if (isHighMediumIntent && theyRepliedLast) {
      if (daysSinceReply >= 2) {
        cleanTags.unshift('urgent-reply'); // VERY urgent - 2+ days
      } else {
        cleanTags.unshift('needs-reply'); // Normal priority - same day/1 day
      }
    }
    
    return cleanTags;
  };

  // Detect conversation stage
  const detectConversationStage = (conversation) => {
    const allText = conversation.map(m => m.content.toLowerCase()).join(' ');
    const replies = conversation.filter(m => m.type === 'REPLY');
    const lastMessage = conversation[conversation.length - 1];
    const daysSinceLastMessage = (new Date() - new Date(lastMessage.time)) / (1000 * 60 * 60 * 24);
    
    // No replies yet
    if (replies.length === 0) {
      if (daysSinceLastMessage > 7) return 'no-response';
      return 'initial-outreach';
    }
    
    // Has replies - analyze content and timing
    if (allText.includes('not interested') || allText.includes('no thanks')) {
      return 'rejected';
    }
    
    if (allText.includes('price') || allText.includes('cost') || allText.includes('budget')) {
      return 'pricing-discussion';
    }
    
    if (allText.includes('sample') || allText.includes('example') || allText.includes('portfolio')) {
      return 'samples-requested';
    }
    
    if (allText.includes('call') || allText.includes('meeting') || allText.includes('schedule')) {
      return 'call-scheduled';
    }
    
    if (allText.includes('think about') || allText.includes('discuss with team') || allText.includes('get back')) {
      return 'considering';
    }
    
    // Check for stalled conversations
    if (daysSinceLastMessage > 7) {
      return 'stalled';
    }
    
    // Active conversation with positive engagement
    if (replies.length > 0 && (allText.includes('interested') || allText.includes('yes') || allText.includes('sure'))) {
      return 'engaged';
    }
    
    return 'active';
  };

  // Get stage styling
  const getStageStyle = (stage) => {
    const styles = {
      'initial-outreach': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Initial Outreach' },
      'engaged': { bg: 'bg-green-100', text: 'text-green-800', label: 'Engaged' },
      'pricing-discussion': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Pricing Discussion' },
      'samples-requested': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Samples Requested' },
      'call-scheduled': { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Call Scheduled' },
      'considering': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Considering' },
      'stalled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Stalled' },
      'no-response': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'No Response' },
      'rejected': { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
      'active': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Active' }
    };
    return styles[stage] || styles['active'];
  };

  // Calculate deal value estimate
  const estimateDealValue = (lead) => {
    const baseValue = 3000; // Base monthly rate
    let multiplier = 6; // Default 6 months
    
    // Adjust based on engagement and conversation content
    if (lead.engagement_score > 80) multiplier = 12; // High engagement = annual deal
    else if (lead.engagement_score > 60) multiplier = 8; // Medium engagement = 8 months
    else if (lead.engagement_score < 30) multiplier = 3; // Low engagement = 3 months
    
    // Content-based adjustments
    const allText = lead.conversation.map(m => m.content.toLowerCase()).join(' ');
    if (allText.includes('annual') || allText.includes('year')) multiplier = 12;
    if (allText.includes('3000') || allText.includes('$3,000')) multiplier = 12; // They saw the price and didn't object
    
    return baseValue * multiplier;
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // Format response time
  const formatResponseTime = (hours) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  // Handle draft generation
  const generateDraft = async () => {
    if (!selectedLead) {
      console.error('No lead selected');
      return;
    }

    setIsGeneratingDraft(true);
    console.log('Generating draft for lead:', selectedLead);
    
    try {
      // Convert only essential data to URL parameters for GET request
      const params = new URLSearchParams();
      
      // Essential lead data only (to avoid URL length limits)
      params.append('id', selectedLead.id);
      params.append('email', selectedLead.email);
      params.append('first_name', selectedLead.first_name);
      params.append('last_name', selectedLead.last_name);
      params.append('subject', selectedLead.subject);
      params.append('intent', selectedLead.intent);
      params.append('engagement_score', selectedLead.engagement_score);
      params.append('urgency', getResponseUrgency(selectedLead));
      
      // Last message info (most important for context)
      const lastMessage = selectedLead.conversation[selectedLead.conversation.length - 1];
      params.append('last_message_type', lastMessage?.type || '');
      params.append('last_message_content', (lastMessage?.content || '').substring(0, 200)); // Limit to 200 chars
      params.append('reply_count', selectedLead.conversation.filter(msg => msg.type === 'REPLY').length);
      params.append('days_since_last_message', Math.floor((new Date() - new Date(lastMessage?.time)) / (1000 * 60 * 60 * 24)));
      
      // Optional fields (if available)
      if (selectedLead.website) params.append('website', selectedLead.website);
      if (selectedLead.campaign_id) params.append('campaign_id', selectedLead.campaign_id);

      console.log('Sending data to local API endpoint');

      const payload = {
        // Essential lead data
        id: selectedLead.id,
        email: selectedLead.email,
        first_name: selectedLead.first_name,
        last_name: selectedLead.last_name,
        subject: selectedLead.subject,
        intent: selectedLead.intent,
        engagement_score: selectedLead.engagement_score,
        urgency: getResponseUrgency(selectedLead),
        
        // Last message info
        last_message_type: selectedLead.conversation[selectedLead.conversation.length - 1]?.type || '',
        last_message_content: selectedLead.conversation[selectedLead.conversation.length - 1]?.content || '',
        reply_count: selectedLead.conversation.filter(msg => msg.type === 'REPLY').length,
        days_since_last_message: Math.floor((new Date() - new Date(selectedLead.conversation[selectedLead.conversation.length - 1]?.time)) / (1000 * 60 * 60 * 24)),
        
        // Full conversation for complete context
        conversation: selectedLead.conversation,
        
        // Optional fields
        website: selectedLead.website,
        campaign_id: selectedLead.campaign_id,
        content_brief: selectedLead.content_brief
      };

      const response = await fetch('https://reidsickels.app.n8n.cloud/webhook-test/8021dcee-ebfd-4cd0-a424-49d7eeb5b66b', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.draft) {
        setDraftResponse(data.draft);
        console.log('Draft set successfully');
      } else {
        console.log('No draft in response, using fallback');
        setDraftResponse(`Hi ${selectedLead.first_name},\n\nThank you for your message.\n\nBest regards`);
      }
    } catch (error) {
      console.error('Error generating draft:', error);
      console.error(`Error generating draft: ${error.message}`);
      // Fallback draft
      setDraftResponse(`Hi ${selectedLead.first_name},\n\nThank you for your message.\n\nBest regards`);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  // Handle send message
  const sendMessage = async () => {
    if (!draftResponse.trim()) return;
    
    setIsSending(true);
    try {
      // Simulate API call to send message
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Message sent successfully!');
      setDraftResponse('');
      setSelectedLead(null);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading leads: {error}</p>
          <button 
            onClick={fetchLeads}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Lead List */}
      <div className="w-1/2 bg-white border-r border-gray-200 flex flex-col">
        {/* Header with Metrics */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Inbox Manager</h1>
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showMetrics ? 'Hide' : 'Show'} Metrics
            </button>
          </div>

          {/* Dashboard Metrics */}
          {showMetrics && (
            <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="flex items-center gap-1 mb-1">
                  <AlertCircle className="w-3 h-3 text-red-600" />
                  <span className="text-red-600 font-medium">🚨 URGENT</span>
                </div>
                <div className="text-lg font-bold text-red-900">{dashboardMetrics.urgentResponse}</div>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="flex items-center gap-1 mb-1">
                  <Users className="w-3 h-3 text-orange-600" />
                  <span className="text-orange-600 font-medium">⚡ NEEDS RESPONSE</span>
                </div>
                <div className="text-lg font-bold text-orange-900">{dashboardMetrics.needsResponse}</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="flex items-center gap-1 mb-1">
                  <Target className="w-3 h-3 text-yellow-600" />
                  <span className="text-yellow-600 font-medium">📞 NEEDS FOLLOWUP</span>
                </div>
                <div className="text-lg font-bold text-yellow-900">{dashboardMetrics.needsFollowup}</div>
              </div>
            </div>
          )}
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search leads, tags, emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Enhanced Filters and Sort */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="recent">Most Recent</option>
                <option value="intent">Intent Score</option>
                <option value="engagement">Engagement</option>
                <option value="response_time">Response Time</option>
                <option value="name">Name</option>
              </select>
              
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Intent</option>
                <option value="high">High Intent (7-10)</option>
                <option value="medium">Medium Intent (4-6)</option>
                <option value="low">Low Intent (1-3)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lead List */}
        <div className="flex-1 overflow-y-auto">
          {filteredAndSortedLeads.map((lead) => {
            const intentStyle = getIntentStyle(lead.intent);
            const lastMessage = lead.conversation[lead.conversation.length - 1];
            const urgency = getResponseUrgency(lead);
            const displayTags = generateAutoTags(lead.conversation, lead);
            
            // Get the response badge for top of card
            const getResponseBadge = () => {
              if (urgency === 'urgent-response') {
                return (
                  <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse mb-2">
                    🚨 URGENT NEEDS RESPONSE
                  </div>
                );
              } else if (urgency === 'needs-response') {
                return (
                  <div className="bg-red-400 text-white px-3 py-1 rounded-full text-xs font-medium mb-2">
                    ⚡ NEEDS RESPONSE
                  </div>
                );
              } else if (urgency === 'needs-followup') {
                return (
                  <div className="bg-red-300 text-red-800 px-3 py-1 rounded-full text-xs font-medium mb-2">
                    📞 NEEDS FOLLOWUP
                  </div>
                );
              }
              return null;
            };
            
            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedLead?.id === lead.id ? 'bg-blue-50 border-blue-200' : ''
                } ${intentStyle.bg} ${intentStyle.border} border-l-4 relative`}
              >
                {/* Response Badge at Top */}
                {getResponseBadge()}
                
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`text-gray-900 ${urgency !== 'none' ? 'font-bold' : 'font-medium'}`}>
                    {lead.first_name} {lead.last_name}
                    {urgency !== 'none' && <span className="ml-2 text-red-600 text-sm">●</span>}
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-1 text-xs rounded-full ${intentStyle.bg} ${intentStyle.text}`}>
                      {lead.intent}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-1">{lead.email}</p>
                <p className={`text-sm text-gray-800 mb-2 ${urgency !== 'none' ? 'font-bold' : 'font-medium'}`}>
                  {lead.subject}
                </p>
                
                {/* Enhanced metadata */}
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  <span className={`font-medium ${getEngagementColor(lead.engagement_score)}`}>
                    {lead.engagement_score}% engagement
                  </span>
                  <span className="text-blue-600">
                    {lead.conversation.filter(m => m.type === 'REPLY').length} replies
                  </span>
                  {urgency !== 'none' && (
                    <span className="text-red-600 font-bold">
                      {Math.floor((new Date() - new Date(lastMessage.time)) / (1000 * 60 * 60 * 24))} days
                    </span>
                  )}
                </div>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {displayTags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                  {displayTags.length > 2 && (
                    <span className="text-xs text-gray-500">+{displayTags.length - 2}</span>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTime(lead.created_at_best)}
                    </div>
                    <div className="flex items-center">
                      <Timer className="w-3 h-3 mr-1" />
                      {formatResponseTime(lead.response_time_avg)} avg
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">
                      {lead.conversation.length} messages
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content - Lead Details */}
      <div className="flex-1 flex flex-col">
        {selectedLead ? (
          <>
            {/* Lead Header */}
            <div className="p-6 bg-white border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {selectedLead.first_name} {selectedLead.last_name}
                  </h2>
                  <p className="text-gray-600 mt-1">{selectedLead.email}</p>
                  {selectedLead.website && (
                    <p className="text-blue-600 text-sm mt-1">
                      <a href={`https://${selectedLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-800">
                        {selectedLead.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {(() => {
                    const intentStyle = getIntentStyle(selectedLead.intent);
                    return (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${intentStyle.bg} ${intentStyle.text}`}>
                        {intentStyle.label} ({selectedLead.intent}/10)
                      </span>
                    );
                  })()}
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Lead Information */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Lead Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Subject:</span>
                      <p className="font-medium">{selectedLead.subject}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Website:</span>
                      <p className="font-medium">
                        {selectedLead.website ? (
                          <a href={`https://${selectedLead.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            {selectedLead.website}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Reply Count:</span>
                      <p className="font-medium">{selectedLead.conversation.filter(m => m.type === 'REPLY').length}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Last Activity:</span>
                      <p className="font-medium">{formatTime(selectedLead.updated_at)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Conversation Stage:</span>
                      <div className="mt-1">
                        {(() => {
                          const stage = detectConversationStage(selectedLead.conversation);
                          const stageStyle = getStageStyle(stage);
                          return (
                            <span className={`px-2 py-1 text-xs rounded-full ${stageStyle.bg} ${stageStyle.text}`}>
                              {stageStyle.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Brief:</span>
                      <p className="font-medium">{selectedLead.content_brief}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Tags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {generateAutoTags(selectedLead.conversation, selectedLead).map(tag => (
                          <span key={tag} className={`text-xs px-2 py-1 rounded-full ${
                            tag === 'needs-reply' 
                              ? 'bg-red-100 text-red-800 font-medium' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {tag === 'needs-reply' ? '⚡ NEEDS REPLY' : tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Engagement Metrics */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Engagement Metrics
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getEngagementColor(selectedLead.engagement_score)}`}>
                        {selectedLead.engagement_score}%
                      </div>
                      <div className="text-gray-500">Engagement Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatResponseTime(selectedLead.response_time_avg)}
                      </div>
                      <div className="text-gray-500">Avg Response Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedLead.conversation.filter(msg => msg.type === 'REPLY').length}/{selectedLead.conversation.filter(msg => msg.type === 'SENT').length}
                      </div>
                      <div className="text-gray-500">Reply Rate</div>
                    </div>
                  </div>
                </div>

                {/* Conversation History */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Conversation History ({selectedLead.conversation.length} messages)
                  </h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {selectedLead.conversation.map((message, index) => (
                      <div key={index} className={`p-4 rounded-lg ${
                        message.type === 'SENT' ? 'bg-blue-50 border-l-4 border-blue-400' : 'bg-gray-50 border-l-4 border-gray-400'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-sm">
                            <span className={`font-medium ${message.type === 'SENT' ? 'text-blue-800' : 'text-gray-800'}`}>
                              {message.type === 'SENT' ? 'Outbound' : 'Reply'} 
                            </span>
                            <span className="text-gray-500 ml-2">
                              {formatTime(message.time)}
                            </span>
                            {message.response_time && (
                              <span className="text-green-600 ml-2 text-xs">
                                • {formatResponseTime(message.response_time)} response
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              message.type === 'SENT' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {message.type}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Response Section */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    Compose Response
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={generateDraft}
                        disabled={isGeneratingDraft}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        {isGeneratingDraft ? 'Generating...' : 'Generate Smart Draft'}
                      </button>
                    </div>

                    <textarea
                      value={draftResponse}
                      onChange={(e) => setDraftResponse(e.target.value)}
                      placeholder="Generated draft will appear here, or write your own response..."
                      className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />

                    <div className="flex justify-end">
                      <button
                        onClick={sendMessage}
                        disabled={!draftResponse.trim() || isSending}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        {isSending ? 'Sending...' : 'Send Message'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">Select a lead to view details</p>
              <p className="text-sm">Choose a lead from the inbox to see their conversation history and respond</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InboxManager;
