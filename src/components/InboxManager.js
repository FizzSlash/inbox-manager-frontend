import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Filter, Send, Edit3, Clock, Mail, User, MessageSquare, ChevronDown, ChevronRight, X, TrendingUp, Calendar, ExternalLink, BarChart3, Users, AlertCircle, CheckCircle, Timer, Zap, Target, DollarSign, Activity, Key, Brain, Database, Loader2, Save, Phone, Menu } from 'lucide-react';

// Mobile-responsive styles
const styles = {
  container: {
    padding: 'var(--container-padding)',
    maxWidth: '100%',
    overflowX: 'hidden',
    '--container-padding': 'calc(10px + (20 - 10) * ((100vw - 320px) / (768 - 320)))'
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--content-gap)',
    '--content-gap': 'calc(10px + (20 - 10) * ((100vw - 320px) / (768 - 320)))'
  },
  sidebar: {
    width: '250px',
    transition: 'all 0.3s ease',
    '@media (max-width: 768px)': {
      width: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      zIndex: 100,
      background: 'white',
      boxShadow: '0 0 10px rgba(0,0,0,0.1)',
      transform: 'translateX(var(--sidebar-transform))',
      '--sidebar-transform': props => props.isOpen ? '0' : '-100%'
    }
  },
  sidebarToggle: {
    display: 'none',
    '@media (max-width: 768px)': {
      display: 'flex',
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      zIndex: 101,
      padding: '12px',
      borderRadius: '50%',
      background: 'var(--primary-color, #007bff)',
      color: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }
  },
  card: {
    padding: 'var(--card-padding)',
    margin: 'var(--card-margin)',
    '--card-padding': 'calc(12px + (20 - 12) * ((100vw - 320px) / (768 - 320)))',
    '--card-margin': 'calc(8px + (15 - 8) * ((100vw - 320px) / (768 - 320)))'
  },
  table: {
    width: '100%',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    '@media (max-width: 768px)': {
      display: 'block',
      '& table': {
        minWidth: '500px'
      }
    }
  },
  modal: {
    width: 'min(95vw, 600px)',
    maxHeight: '90vh',
    padding: 'var(--modal-padding)',
    '--modal-padding': 'calc(15px + (25 - 15) * ((100vw - 320px) / (768 - 320)))'
  },
  button: {
    padding: 'var(--button-padding)',
    fontSize: 'var(--button-font-size)',
    '--button-padding': 'calc(8px + (12 - 8) * ((100vw - 320px) / (768 - 320)))',
    '--button-font-size': 'calc(14px + (16 - 14) * ((100vw - 320px) / (768 - 320)))'
  }
};

const InboxManager = () => {
  // State for leads from API
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add new state for enrichment data
  const [enrichmentData, setEnrichmentData] = useState(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [showEnrichmentPopup, setShowEnrichmentPopup] = useState(false);

  // Add new state for API settings and tab management
  const [activeTab, setActiveTab] = useState('inbox');
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    smartlead: localStorage.getItem('smartlead_api_key') || '',
    claude: localStorage.getItem('claude_api_key') || '',
    fullenrich: localStorage.getItem('fullenrich_api_key') || ''
  });
  const [apiTestStatus, setApiTestStatus] = useState({
    smartlead: null,
    claude: null,
    fullenrich: null
  });
  const [isSavingApi, setIsSavingApi] = useState(false);
  const [showApiToast, setShowApiToast] = useState(false);
  const [apiToastMessage, setApiToastMessage] = useState({ type: '', message: '' });

  // Add new state for searching phone number
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);

  // Replace single loading states with maps of lead IDs
  const [enrichingLeads, setEnrichingLeads] = useState(new Set());
  const [searchingPhoneLeads, setSearchingPhoneLeads] = useState(new Set());

  // Replace single toast with array of toasts
  const [toasts, setToasts] = useState([]);
  const toastsTimeoutRef = useRef({}); // Store timeouts by toast ID

  // Clean up all timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(toastsTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  // Modified toast helper function
  const showToast = (message, type = 'success', leadId = null) => {
    const id = Date.now(); // Unique ID for each toast
    const newToast = { id, message, type, leadId };
    
    setToasts(currentToasts => [...currentToasts, newToast]);
    
    // Store the timeout reference
    toastsTimeoutRef.current[id] = setTimeout(() => {
      removeToast(id);
    }, 10000);
  };

  // Remove specific toast
  const removeToast = (id) => {
    // Clear the timeout
    if (toastsTimeoutRef.current[id]) {
      clearTimeout(toastsTimeoutRef.current[id]);
      delete toastsTimeoutRef.current[id];
    }
    
    setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
  };

  // Helper functions (moved up before they're used)
  // Get last response date from them (last REPLY message)
  const getLastResponseFromThem = (conversation) => {
    const replies = conversation.filter(msg => msg.type === 'REPLY');
    if (replies.length === 0) return null;
    return replies[replies.length - 1].time;
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
        // Parse conversation data from email_message_body and extract subject
        let conversation = [];
        let extractedSubject = `Campaign for ${lead.first_name || 'Lead'}`;
        let emailStatsId = null;
        
        try {
          if (lead.email_message_body) {
            const parsedConversation = JSON.parse(lead.email_message_body);
            
            // Extract stats_id from the first message
            if (parsedConversation.length > 0 && parsedConversation[0].stats_id) {
              emailStatsId = parsedConversation[0].stats_id;
            }
            
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
                cc: msg.cc || null,
                type: msg.type || 'SENT',
                time: msg.time || new Date().toISOString(),
                content: extractTextFromHTML(msg.email_body || ''),
                subject: msg.subject || '',
                opened: (msg.open_count || 0) > 0,
                clicked: (msg.click_count || 0) > 0,
                response_time: responseTime
              };
            });
            
            // Extract subject from the first message in conversation or any message with subject
            if (conversation.length > 0) {
              const messageWithSubject = conversation.find(msg => msg.subject && msg.subject.trim() !== '');
              if (messageWithSubject) {
                extractedSubject = messageWithSubject.subject.trim();
              }
            }
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
          campaign_id: lead.campaign_ID || null,
          lead_id: lead.lead_ID || null,
          email_stats_id: emailStatsId,
          created_at: lead.created_at,
          updated_at: lead.created_at,
          email: lead.lead_email,
          first_name: lead.first_name || 'Unknown',
          last_name: lead.last_name || '',
          website: lead.website || lead.lead_email?.split('@')[1] || '',
          content_brief: `Email marketing campaign for ${lead.lead_category || 'business'}`,
          subject: extractedSubject,
          email_message_body: lead.email_message_body,
          intent: intentScore,
          created_at_best: lead.created_at,
          response_time_avg: avgResponseTime,
          engagement_score: engagementScore,
          lead_category: lead.lead_category,
          tags: [lead.lead_category ? leadCategoryMap[lead.lead_category] || 'Uncategorized' : 'Uncategorized'],
          conversation: conversation,
          // Include the Supabase fields with their values or defaults
          role: lead.role || 'N/A',
          company_data: lead.company_data || 'N/A',
          personal_linkedin_url: lead.personal_linkedin_url || null,
          business_linkedin_url: lead.business_linkedin_url || null,
          linkedin_url: lead.linkedin_url || 'N/A',
          phone: lead.phone || null,
          // Add any other relevant fields you want to include
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

  // Helper function to extract text from HTML and clean reply content
  const extractTextFromHTML = (html) => {
    if (!html) return '';
    
    // First clean HTML tags and entities
    let text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#x22;/g, '"')
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#8211;/g, '-')
      .replace(/&#8212;/g, '—')
      .replace(/&#8230;/g, '...')
      .replace(/&hellip;/g, '...')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '-')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract only the new reply content (before common reply separators)
    const replyIndicators = [
      'On ', // "On [date], [person] wrote:"
      'From:', // "From: [email]"
      '-----Original Message-----',
      '________________________________',
      '--- On ',
      'Sent from my iPhone',
      'Sent from my iPad',
      'Get Outlook for',
      'This email was sent to'
    ];
    
    // Find the first occurrence of any reply indicator
    let cutoffIndex = text.length;
    replyIndicators.forEach(indicator => {
      const index = text.indexOf(indicator);
      if (index !== -1 && index < cutoffIndex) {
        cutoffIndex = index;
      }
    });
    
    // Also look for common quote patterns like "> "
    const lines = text.split('\n');
    let newReplyLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Stop if we hit quoted content (lines starting with >)
      if (line.startsWith('>')) {
        break;
      }
      
      // Stop if we hit a reply indicator
      const hasReplyIndicator = replyIndicators.some(indicator => 
        line.includes(indicator)
      );
      if (hasReplyIndicator) {
        break;
      }
      
      newReplyLines.push(line);
    }
    
    // Use the shorter of the two methods
    const methodOne = text.substring(0, cutoffIndex).trim();
    const methodTwo = newReplyLines.join('\n').trim();
    
    const result = methodTwo.length > 0 && methodTwo.length < methodOne.length 
      ? methodTwo 
      : methodOne;
    
    return result || text; // Fallback to original if extraction fails
  };

  // Lead category mapping
  const leadCategoryMap = {
    1: 'Interested',
    2: 'Meeting Request', 
    3: 'Not Interested',
    4: 'Do Not Contact',
    5: 'Information Request',
    6: 'Out Of Office',
    7: 'Wrong Person',
    8: 'Uncategorizable by AI',
    9: 'Sender Originated Bounce'
  };



  // Available sort options
  const sortOptions = [
    { field: 'last_reply', label: 'Most Recent Lead Reply', getValue: (lead) => {
      const lastReply = getLastResponseFromThem(lead.conversation);
      return lastReply ? new Date(lastReply) : new Date(0);
    }},
    { field: 'last_sent', label: 'Most Recent Sent Message', getValue: (lead) => {
      const lastSent = lead.conversation.filter(m => m.type === 'SENT');
      return lastSent.length > 0 ? new Date(lastSent[lastSent.length - 1].time) : new Date(0);
    }},
    { field: 'intent', label: 'Intent Score', getValue: (lead) => lead.intent },
    { field: 'engagement', label: 'Engagement Score', getValue: (lead) => lead.engagement_score },
    { field: 'response_time', label: 'Response Time', getValue: (lead) => lead.response_time_avg },
    { field: 'name', label: 'Name (A-Z)', getValue: (lead) => `${lead.first_name} ${lead.last_name}`.toLowerCase() },
    { field: 'urgency', label: 'Urgency Level', getValue: (lead) => {
      const urgency = getResponseUrgency(lead);
      const urgencyOrder = { 'urgent-response': 4, 'needs-response': 3, 'needs-followup': 2, 'none': 1 };
      return urgencyOrder[urgency] || 0;
    }}
  ];

  // State for UI controls
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
  
  // Add state for collapsible sections - default to all open
  const [activeSection, setActiveSection] = useState(['general', 'enrichment', 'engagement']);
  
  // New state for editable email fields
  const [editableToEmail, setEditableToEmail] = useState('');
  const [editableCcEmails, setEditableCcEmails] = useState('');
  
  // New state for rich text editor
  const [showFormatting, setShowFormatting] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  
  // New state for advanced sort/filter popups
  const [showSortPopup, setShowSortPopup] = useState(false);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [activeSorts, setActiveSorts] = useState([{ field: 'last_reply', direction: 'desc' }]);
  const [activeFilters, setActiveFilters] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [showSentConfirm, setShowSentConfirm] = useState(false);

  // Available filter options
  const filterOptions = {
    intent: {
      label: 'Intent Score',
      options: [
        { value: 'high', label: 'High Intent (7-10)' },
        { value: 'medium', label: 'Medium Intent (4-6)' },
        { value: 'low', label: 'Low Intent (1-3)' }
      ]
    },
    urgency: {
      label: 'Urgency Status',
      options: [
        { value: 'urgent-response', label: '🚨 Urgent Response Needed' },
        { value: 'needs-response', label: '⚡ Needs Response' },
        { value: 'needs-followup', label: '📞 Needs Followup' },
        { value: 'none', label: 'No Action Needed' }
      ]
    },
    category: {
      label: 'Lead Category',
      options: [
        { value: '1', label: 'Interested' },
        { value: '2', label: 'Meeting Request' },
        { value: '3', label: 'Not Interested' },
        { value: '4', label: 'Do Not Contact' },
        { value: '5', label: 'Information Request' },
        { value: '6', label: 'Out Of Office' },
        { value: '7', label: 'Wrong Person' },
        { value: '8', label: 'Uncategorizable by AI' },
        { value: '9', label: 'Sender Originated Bounce' }
      ]
    },
    engagement: {
      label: 'Engagement Level',
      options: [
        { value: 'high', label: 'High Engagement (80%+)' },
        { value: 'medium', label: 'Medium Engagement (50-79%)' },
        { value: 'low', label: 'Low Engagement (0-49%)' }
      ]
    },
    replies: {
      label: 'Reply Status',
      options: [
        { value: 'has_replies', label: 'Has Replies' },
        { value: 'no_replies', label: 'No Replies Yet' },
        { value: 'multiple_replies', label: 'Multiple Replies (2+)' }
      ]
    },
    timeframe: {
      label: 'Last Activity',
      options: [
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: 'this_week', label: 'This Week' },
        { value: 'last_week', label: 'Last Week' },
        { value: 'this_month', label: 'This Month' },
        { value: 'older', label: 'Older than 1 Month' }
      ]
    }
  };

  // Handle adding sort
  const handleAddSort = (field, direction = 'desc') => {
    setActiveSorts(prev => {
      const existing = prev.find(s => s.field === field);
      if (existing) {
        return prev.map(s => s.field === field ? { ...s, direction } : s);
      }
      return [...prev, { field, direction }];
    });
  };

  // Handle removing sort
  const handleRemoveSort = (field) => {
    setActiveSorts(prev => prev.filter(s => s.field !== field));
    if (activeSorts.length === 1) {
      setActiveSorts([{ field: 'last_reply', direction: 'desc' }]); // Always have at least one sort
    }
  };

  // Handle adding filter
  const handleAddFilter = (category, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [category]: [...(prev[category] || []), value]
    }));
  };

  // Handle removing filter
  const handleRemoveFilter = (category, value) => {
    setActiveFilters(prev => {
      const updated = { ...prev };
      if (updated[category]) {
        updated[category] = updated[category].filter(v => v !== value);
        if (updated[category].length === 0) {
          delete updated[category];
        }
      }
      return updated;
    });
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setActiveFilters({});
  };

  // Handle delete lead
  const handleDeleteLead = async (lead) => {
    try {
      console.log('Deleting lead:', lead);
      
      // Send all lead data to delete webhook
      const response = await fetch('https://reidsickels.app.n8n.cloud/webhook/bfffab96-188f-4a4a-9ae2-62aa9e0a02f4', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...lead,
          smartlead_api_key: apiKeys.smartlead,
          claude_api_key: apiKeys.claude,
          fullenrich_api_key: apiKeys.fullenrich
        })
      });

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete webhook error:', errorText);
        throw new Error(`Failed to delete lead: ${response.status}`);
      }

      console.log('Lead deleted successfully');
      
      // Remove from local state immediately for better UX
      setLeads(prevLeads => prevLeads.filter(l => l.id !== lead.id));
      
      // If this was the selected lead, clear selection
      if (selectedLead?.id === lead.id) {
        setSelectedLead(null);
      }
      
      // Close confirmation popup
      setShowDeleteConfirm(false);
      setLeadToDelete(null);
      
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert(`Error deleting lead: ${error.message}`);
      setShowDeleteConfirm(false);
      setLeadToDelete(null);
    }
  };

  // Show delete confirmation
  const showDeleteConfirmation = (lead) => {
    setLeadToDelete(lead);
    setShowDeleteConfirm(true);
  };
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

  // Get intent color and label - NO COLORS, only for circles
  const getIntentStyle = (intent) => {
    return { bg: '', border: '', text: 'text-white', label: intent >= 7 ? 'High Intent' : intent >= 4 ? 'Medium Intent' : 'Low Intent' };
  };

  // Get engagement color
  const getEngagementColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Enhanced filter and sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let filtered = leads;

    // Apply tab filter first (who sent last message)
    if (activeTab === 'need_response') {
      filtered = filtered.filter(lead => {
        if (lead.conversation.length === 0) return false;
        const lastMessage = lead.conversation[lead.conversation.length - 1];
        return lastMessage.type === 'REPLY'; // They replied last, so we need to respond
      });
    } else if (activeTab === 'recently_sent') {
      filtered = filtered.filter(lead => {
        if (lead.conversation.length === 0) return true; // No conversation means we might have sent initial message
        const lastMessage = lead.conversation[lead.conversation.length - 1];
        return lastMessage.type === 'SENT'; // We sent last message
      });
    }
    // 'all' tab shows everything, so no additional filtering needed

    // Apply search filter (keep existing)
    if (searchQuery) {
      filtered = filtered.filter(lead => 
        lead.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply advanced filters
    Object.entries(activeFilters).forEach(([category, values]) => {
      if (values.length === 0) return;
      
      filtered = filtered.filter(lead => {
        return values.some(value => {
          switch (category) {
            case 'intent':
              if (value === 'high') return lead.intent >= 7;
              if (value === 'medium') return lead.intent >= 4 && lead.intent <= 6;
              if (value === 'low') return lead.intent <= 3;
              return false;
            
            case 'urgency':
              return getResponseUrgency(lead) === value;
            
            case 'category':
              const leadCategoryValue = lead.lead_category?.toString();
              return leadCategoryValue === value;
            
            case 'engagement':
              if (value === 'high') return lead.engagement_score >= 80;
              if (value === 'medium') return lead.engagement_score >= 50 && lead.engagement_score < 80;
              if (value === 'low') return lead.engagement_score < 50;
              return false;
            
            case 'replies':
              const replyCount = lead.conversation.filter(m => m.type === 'REPLY').length;
              if (value === 'has_replies') return replyCount > 0;
              if (value === 'no_replies') return replyCount === 0;
              if (value === 'multiple_replies') return replyCount >= 2;
              return false;
            
            case 'timeframe':
              const now = new Date();
              const lastActivity = lead.conversation.length > 0 
                ? new Date(lead.conversation[lead.conversation.length - 1].time)
                : new Date(lead.created_at);
              const daysDiff = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
              
              if (value === 'today') return daysDiff === 0;
              if (value === 'yesterday') return daysDiff === 1;
              if (value === 'this_week') return daysDiff <= 7;
              if (value === 'last_week') return daysDiff > 7 && daysDiff <= 14;
              if (value === 'this_month') return daysDiff <= 30;
              if (value === 'older') return daysDiff > 30;
              return false;
            
            default:
              return false;
          }
        });
      });
    });

    // Apply advanced sorting
    activeSorts.forEach(({ field, direction }) => {
      const sortOption = sortOptions.find(opt => opt.field === field);
      if (!sortOption) return;
      
      filtered.sort((a, b) => {
        const aVal = sortOption.getValue(a);
        const bVal = sortOption.getValue(b);
        
        let comparison = 0;
        if (aVal > bVal) comparison = 1;
        if (aVal < bVal) comparison = -1;
        
        return direction === 'desc' ? -comparison : comparison;
      });
    });

    return filtered;
  }, [leads, searchQuery, activeFilters, activeSorts, activeTab]);

  // Auto-populate email fields when lead is selected
  useEffect(() => {
    if (selectedLead && selectedLead.conversation.length > 0) {
      const lastMessage = selectedLead.conversation[selectedLead.conversation.length - 1];
      
      // Dynamically detect our email addresses from SENT messages
      const getOurEmails = () => {
        const ourEmails = new Set();
        selectedLead.conversation.forEach(msg => {
          if (msg.type === 'SENT' && msg.from) {
            ourEmails.add(msg.from);
          }
        });
        return Array.from(ourEmails);
      };
      
      // Get all unique email participants from the conversation (excluding our emails)
      const getAllParticipants = () => {
        const participants = new Set();
        const ourEmails = getOurEmails();
        
        // Go through conversation to find all unique email addresses
        selectedLead.conversation.forEach(msg => {
          if (msg.from) participants.add(msg.from);
          if (msg.to) participants.add(msg.to);
          if (msg.cc && Array.isArray(msg.cc) && msg.cc.length > 0) {
            msg.cc.forEach(ccEntry => {
              if (ccEntry.address) participants.add(ccEntry.address);
            });
          }
        });
        
        // Remove our own emails dynamically
        ourEmails.forEach(email => participants.delete(email));
        
        return Array.from(participants);
      };
      
      // Determine recipients based on the last message
      let primaryRecipient = '';
      let ccRecipients = [];
      
      if (lastMessage.type === 'REPLY') {
        // If they replied, send back to the sender and CC everyone else who was involved
        primaryRecipient = lastMessage.from;
        
        // Get all other participants for CC (excluding the primary recipient)
        const allParticipants = getAllParticipants();
        ccRecipients = allParticipants.filter(email => email !== primaryRecipient);
      } else {
        // If we sent last, use the same recipients as the last sent message
        primaryRecipient = lastMessage.to || selectedLead.email;
        
        // Only add CC if the last message actually had CC recipients
        if (lastMessage.cc && Array.isArray(lastMessage.cc) && lastMessage.cc.length > 0) {
          ccRecipients = lastMessage.cc
            .map(cc => cc.address)
            .filter(email => email && email.trim() !== '');
        }
      }
      
      setEditableToEmail(primaryRecipient || selectedLead.email);
      setEditableCcEmails(ccRecipients.join(', '));
    } else if (selectedLead) {
      // Fallback to original lead email if no conversation
      setEditableToEmail(selectedLead.email);
      setEditableCcEmails('');
    }
  }, [selectedLead]);
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

  // Check if lead needs reply (they replied last)
  const checkNeedsReply = (conversation) => {
    const lastMessage = conversation[conversation.length - 1];
    return lastMessage.type === 'REPLY';
  };

  // Auto-generate tags based on conversation - DISABLED
  const generateAutoTags = (conversation, lead) => {
    // Only return the lead category tag
    return lead.tags || [];
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

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // Rich text formatting functions
  const formatText = (command, value = null) => {
    document.execCommand(command, false, value);
  };

  const insertLink = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const editor = document.querySelector('[contenteditable]');

    // Create modal with clean styling
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: #1A1C1A;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 24px;
      width: 400px;
      max-width: 90vw;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Insert Link';
    title.style.cssText = `
      color: white;
      font-weight: bold;
      margin: 0 0 20px 0;
      font-size: 16px;
    `;

    // Text input
    const textContainer = document.createElement('div');
    textContainer.style.marginBottom = '16px';
    
    const textLabel = document.createElement('label');
    textLabel.textContent = 'Text to display:';
    textLabel.style.cssText = `
      display: block;
      color: white;
      font-size: 12px;
      margin-bottom: 4px;
    `;

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = selectedText;
    textInput.placeholder = 'Link text';
    textInput.style.cssText = `
          width: 100%;
          padding: 8px 12px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          color: white;
      font-size: 14px;
      box-sizing: border-box;
      outline: none;
    `;

    // URL input
    const urlContainer = document.createElement('div');
    urlContainer.style.marginBottom = '24px';
    
    const urlLabel = document.createElement('label');
    urlLabel.textContent = 'URL:';
    urlLabel.style.cssText = textLabel.style.cssText;

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'https://example.com';
    urlInput.style.cssText = textInput.style.cssText;

    // Error message
    const errorMessage = document.createElement('div');
    errorMessage.style.cssText = `
      color: #ff4444;
      font-size: 12px;
          margin-bottom: 16px;
      min-height: 16px;
    `;

    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    `;

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
            padding: 8px 16px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.05);
            color: white;
            cursor: pointer;
      font-size: 14px;
    `;

    const insertButton = document.createElement('button');
    insertButton.textContent = 'Insert Link';
    insertButton.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            background: #54FCFF;
            color: #1A1C1A;
            cursor: pointer;
            font-weight: bold;
      font-size: 14px;
    `;

    // Assemble the modal
    textContainer.appendChild(textLabel);
    textContainer.appendChild(textInput);
    urlContainer.appendChild(urlLabel);
    urlContainer.appendChild(urlInput);
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(insertButton);

    content.appendChild(title);
    content.appendChild(textContainer);
    content.appendChild(urlContainer);
    content.appendChild(errorMessage);
    content.appendChild(buttonsContainer);
    modal.appendChild(content);

    document.body.appendChild(modal);

    // Focus URL input if text is selected, otherwise focus text input
    setTimeout(() => {
      if (selectedText) {
    urlInput.focus();
      } else {
        textInput.focus();
      }
    }, 50);

    const validateAndInsert = () => {
      const text = textInput.value.trim();
      let url = urlInput.value.trim();

      // Validate inputs
      if (!text) {
        errorMessage.textContent = 'Please enter the text to display';
        return;
      }

      if (!url) {
        errorMessage.textContent = 'Please enter a URL';
        return;
      }

      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Validate URL format
      try {
        new URL(url);
      } catch (e) {
        errorMessage.textContent = 'Please enter a valid URL';
        return;
      }

      if (range && editor) {
        // Create link wrapper div to help with positioning the remove button
        const linkWrapper = document.createElement('span');
        linkWrapper.style.position = 'relative';
        linkWrapper.style.display = 'inline-block';
        
        // Create the link
        const link = document.createElement('a');
        link.href = url;
        link.textContent = text;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = `
          color: #0066cc;
          text-decoration: underline;
          cursor: pointer;
        `;
        
        // Create remove button (always visible)
        const removeBtn = document.createElement('span');
        removeBtn.textContent = '×';
        removeBtn.style.cssText = `
          position: absolute;
          top: -8px;
          right: -12px;
          background: #e0e0e0;
          color: #333;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          font-size: 12px;
          line-height: 16px;
          text-align: center;
          cursor: pointer;
          user-select: none;
          opacity: 0;
          transition: opacity 0.2s;
        `;
        
        // Show/hide remove button on hover
        linkWrapper.addEventListener('mouseenter', () => {
          removeBtn.style.opacity = '1';
          link.style.color = '#004499';
        });
        
        linkWrapper.addEventListener('mouseleave', () => {
          removeBtn.style.opacity = '0';
          link.style.color = '#0066cc';
        });
        
        // Handle remove button click
        removeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const text = document.createTextNode(link.textContent);
          linkWrapper.parentNode.replaceChild(text, linkWrapper);
          handleTextareaChange({ target: editor });
        });
        
        // Assemble the link component
        linkWrapper.appendChild(link);
        linkWrapper.appendChild(removeBtn);
        
        // Insert into document
        range.deleteContents();
        range.insertNode(linkWrapper);
        
        // Update editor content
        handleTextareaChange({ target: editor });
      }

      // Close modal
      document.body.removeChild(modal);
    };
    
    // Event Listeners
    cancelButton.addEventListener('click', () => document.body.removeChild(modal));
    insertButton.addEventListener('click', validateAndInsert);
    
    // Handle Enter key
    [textInput, urlInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          validateAndInsert();
        }
      });
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
      document.body.removeChild(modal);
      }
    });

    // Handle Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', escapeHandler);
      }
    });
  };

  const insertList = () => {
    const editor = document.querySelector('[contenteditable]');
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      
      if (selectedText) {
        // Convert selected text into a formatted list
        const lines = selectedText.split('\n');
        const listContainer = document.createElement('div');
        listContainer.style.cssText = `
          margin: 8px 0;
          padding-left: 8px;
        `;
        
        lines
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .forEach(line => {
            const listItem = document.createElement('div');
            listItem.style.cssText = `
              position: relative;
              padding-left: 20px;
              margin: 4px 0;
              line-height: 1.5;
            `;
            
            // Create bullet point
            const bullet = document.createElement('span');
            bullet.textContent = '•';
            bullet.style.cssText = `
              position: absolute;
              left: 4px;
              font-size: 1.2em;
              line-height: 1;
              top: 50%;
              transform: translateY(-50%);
            `;
            
            // Create text content without explicit color
            const textContent = document.createElement('span');
            textContent.textContent = line;
            
            listItem.appendChild(bullet);
            listItem.appendChild(textContent);
            listContainer.appendChild(listItem);
          });
        
        // Insert the formatted list
      range.deleteContents();
        range.insertNode(listContainer);
      } else {
        // Insert a single formatted bullet point
        const listItem = document.createElement('div');
        listItem.style.cssText = `
          position: relative;
          padding-left: 20px;
          margin: 4px 0;
          line-height: 1.5;
        `;
        
        // Create bullet point
        const bullet = document.createElement('span');
        bullet.textContent = '•';
        bullet.style.cssText = `
          position: absolute;
          left: 4px;
          font-size: 1.2em;
          line-height: 1;
          top: 50%;
          transform: translateY(-50%);
        `;
        
        // Create editable content area without explicit color
        const textContent = document.createElement('span');
        
        listItem.appendChild(bullet);
        listItem.appendChild(textContent);
        
        // Insert at cursor position
        range.deleteContents();
        range.insertNode(listItem);
        
        // Move cursor to text content
        const newRange = document.createRange();
        newRange.setStart(textContent, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
      
      // Update the draft content
      handleTextareaChange({ target: editor });
    }
  };

  const handleTextareaChange = (e) => {
    // Clean up any remaining remove buttons
    const removeButtons = e.target.querySelectorAll('.remove-link');
    removeButtons.forEach(btn => btn.remove());
    
    // Update content
    setDraftResponse(e.target.textContent || e.target.innerText);
    setDraftHtml(e.target.innerHTML);
  };

  const convertToHtml = (text) => {
    return text.replace(/\n/g, '<br>');
  };
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
      const lastMessage = selectedLead.conversation[selectedLead.conversation.length - 1];
      const urgency = getResponseUrgency(selectedLead);
      
      // Clean function to remove problematic characters
      const cleanString = (str) => {
        if (!str) return '';
        return str
          .replace(/\r\n/g, ' ')  // Replace Windows line breaks
          .replace(/\n/g, ' ')    // Replace Unix line breaks  
          .replace(/\r/g, ' ')    // Replace Mac line breaks
          .replace(/\t/g, ' ')    // Replace tabs
          .replace(/[\x00-\x1F\x7F-\x9F]/g, '')  // Remove other control characters
          .replace(/"/g, "'")     // Replace double quotes with single quotes
          .replace(/\s+/g, ' ')   // Replace multiple spaces with single space
          .trim();
      };

      // Debug: Log the full payload we're sending
      const payload = {
        id: selectedLead.id,
        email: cleanString(selectedLead.email),
        first_name: cleanString(selectedLead.first_name),
        last_name: cleanString(selectedLead.last_name),
        subject: cleanString(selectedLead.subject),
        intent: selectedLead.intent,
        engagement_score: selectedLead.engagement_score,
        urgency: urgency,
        last_message_type: lastMessage?.type || 'SENT',
        last_message_content: cleanString((lastMessage?.content || '').substring(0, 300)),
        reply_count: selectedLead.conversation.filter(msg => msg.type === 'REPLY').length,
        days_since_last_message: Math.floor((new Date() - new Date(lastMessage?.time || new Date())) / (1000 * 60 * 60 * 24)),
        website: cleanString(selectedLead.website || ''),
        content_brief: cleanString(selectedLead.content_brief || ''),
        conversation: selectedLead.conversation.map(msg => ({
          ...msg,
          content: cleanString(msg.content),
          from: cleanString(msg.from || ''),
          to: cleanString(msg.to || '')
        }))
      };

      // Debug: Log the full payload we're sending
      const fullPayload = {
        id: selectedLead.id,
        email: cleanString(selectedLead.email),
        first_name: cleanString(selectedLead.first_name),
        last_name: cleanString(selectedLead.last_name),
        subject: cleanString(selectedLead.subject),
        intent: selectedLead.intent,
        engagement_score: selectedLead.engagement_score,
        urgency: urgency,
        last_message_type: lastMessage?.type || 'SENT',
        last_message_content: cleanString((lastMessage?.content || '').substring(0, 300)),
        reply_count: selectedLead.conversation.filter(msg => msg.type === 'REPLY').length,
        days_since_last_message: Math.floor((new Date() - new Date(lastMessage?.time || new Date())) / (1000 * 60 * 60 * 24)),
        website: cleanString(selectedLead.website || ''),
        content_brief: cleanString(selectedLead.content_brief || ''),
        conversation: selectedLead.conversation.map(msg => ({
          ...msg,
          content: cleanString(msg.content),
          from: cleanString(msg.from || ''),
          to: cleanString(msg.to || '')
        })),
        email_message_body: selectedLead.email_message_body || ''
      };

      console.log('=== WEBHOOK DEBUG INFO ===');
      console.log('Payload being sent:', JSON.stringify(fullPayload, null, 2));
      console.log('Payload size (characters):', JSON.stringify(fullPayload).length);
      console.log('URL:', 'https://reidsickels.app.n8n.cloud/webhook/8021dcee-ebfd-4cd0-a424-49d7eeb5b66b');
      console.log('Request method: POST');
      console.log('Content-Type: application/json');

      const response = await fetch('https://reidsickels.app.n8n.cloud/webhook/draftmessage', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fullPayload)
      });
      
      console.log('=== RESPONSE DEBUG INFO ===');
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Get raw response text to see what we're actually getting
      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      console.log('Response text length:', responseText.length);
      console.log('Response text type:', typeof responseText);
      
      if (!response.ok) {
        console.error('=== ERROR DETAILS ===');
        console.error('Status:', response.status);
        console.error('Status Text:', response.statusText);
        console.error('Response Body:', responseText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
      }
      
      // Check if response is empty
      if (!responseText || responseText.trim() === '') {
        console.error('Empty response from webhook');
        throw new Error('Empty response from webhook');
      }
      
      // Try to parse JSON response
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Parsed response data:', data);
      } catch (e) {
        console.error('JSON parsing failed. Raw response:', responseText);
        console.error('JSON parse error:', e.message);
        throw new Error(`Invalid JSON response from webhook. Raw response: ${responseText}`);
      }
      
      // Handle both array and object response formats
      if (data.text) {
        // Clean the response text of any problematic characters
        const cleanResponseText = data.text
          .replace(/\\n/g, '\n')  // Convert literal \n to actual line breaks
          .replace(/\\r/g, '\r')  // Convert literal \r to actual line breaks
          .trim();

        // Update both the text state and HTML content
        setDraftResponse(cleanResponseText);
        const formattedHtml = convertToHtml(cleanResponseText);
        setDraftHtml(formattedHtml);

        // Update the contenteditable div
        const editor = document.querySelector('[contenteditable]');
        if (editor) {
          editor.innerHTML = formattedHtml;
        }

        console.log('Draft set successfully from object format');
      } else if (data && data.length > 0 && data[0].text) {
        const cleanResponseText = data[0].text
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .trim();

        // Update both the text state and HTML content
        setDraftResponse(cleanResponseText);
        const formattedHtml = convertToHtml(cleanResponseText);
        setDraftHtml(formattedHtml);

        // Update the contenteditable div
        const editor = document.querySelector('[contenteditable]');
        if (editor) {
          editor.innerHTML = formattedHtml;
        }

        console.log('Draft set successfully from array format');
      } else {
        console.error('No text found in response:', data);
        throw new Error('No text content in webhook response');
      }
    } catch (error) {
      console.error('=== FULL ERROR DETAILS ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Selected lead data:', selectedLead);
      
      // Simple fallback for debugging
      setDraftResponse(`Hi ${selectedLead.first_name},\n\nThank you for your message.\n\nBest regards`);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  // Handle send message
  const sendMessage = async () => {
    const textContent = document.querySelector('[contenteditable]')?.textContent || draftResponse;
    const htmlContent = document.querySelector('[contenteditable]')?.innerHTML || convertToHtml(draftResponse);
    
    if (!textContent.trim()) return;
    
    setIsSending(true);
    try {
      // Parse CC emails from the editable field
      const ccEmails = editableCcEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0)
        .map(email => ({ name: '', address: email }));

      // Get file attachments
      const attachmentInput = document.getElementById('attachment-input');
      const attachments = [];
      if (attachmentInput && attachmentInput.files.length > 0) {
        for (let file of attachmentInput.files) {
          // Convert file to base64 for sending
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
          });
          
          attachments.push({
            filename: file.name,
            content: base64,
            encoding: 'base64',
            contentType: file.type
          });
        }
      }
      
      // Prepare payload with editable recipients and HTML content
      const sendPayload = {
        // Draft message data with user-editable recipients and rich formatting
        message: {
          content: textContent.trim(), // Plain text version
          html_content: htmlContent, // Rich HTML version
          to: editableToEmail.trim(),
          cc: ccEmails,
          subject: `Re: ${selectedLead.subject}`,
          type: 'SENT',
          attachments: attachments
        },
        
        // Lead data
        lead: {
          id: selectedLead.id,
          campaign_id: selectedLead.campaign_id,
          lead_id: selectedLead.lead_id,
          email_stats_id: selectedLead.email_stats_id,
          email: editableToEmail.trim(), // Use the editable primary email
          first_name: selectedLead.first_name,
          last_name: selectedLead.last_name,
          subject: selectedLead.subject,
          intent: selectedLead.intent,
          engagement_score: selectedLead.engagement_score,
          urgency: getResponseUrgency(selectedLead),
          website: selectedLead.website || '',
          tags: selectedLead.tags,
          conversation_history: selectedLead.conversation,
          reply_count: selectedLead.conversation.filter(msg => msg.type === 'REPLY').length,
          last_activity: selectedLead.conversation.length > 0 ? selectedLead.conversation[selectedLead.conversation.length - 1].time : selectedLead.created_at,
          // Add recipient info
          cc_recipients: ccEmails.map(cc => cc.address)
        },
        smartlead_api_key: apiKeys.smartlead,
        claude_api_key: apiKeys.claude,
        fullenrich_api_key: apiKeys.fullenrich
      };

      console.log('Sending message with rich formatting:', {
        to: editableToEmail.trim(),
        cc: ccEmails,
        htmlContent: htmlContent,
        attachments: attachments.length,
        payload: sendPayload
      });

      const response = await fetch('https://reidsickels.app.n8n.cloud/webhook/8021dcee-ebfd-4cd0-a424-49d7eeb5b66b', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sendPayload)
      });

      console.log('Send response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Send webhook error:', errorText);
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Send response data:', responseData);

      // Show success modal instead of alert
      setShowSentConfirm(true);
      
      // Clear draft and editor
      setDraftResponse('');
      setDraftHtml('');
      const editor = document.querySelector('[contenteditable]');
      if (editor) {
        editor.innerHTML = '';
      }
      
      // Clear file input
      if (attachmentInput) {
        attachmentInput.value = '';
      }
      
      // Optionally refresh leads to get updated data
      await fetchLeads();
      
    } catch (error) {
      console.error('Error sending message:', error);
      alert(`Error sending message: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Add enrichment function
  const enrichLeadData = async (lead) => {
    setEnrichingLeads(prev => new Set([...prev, lead.id]));
    try {
      const response = await fetch('https://reidsickels.app.n8n.cloud/webhook/9894a38a-ac26-46b8-89a2-ef2e80e83504', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...lead,
          smartlead_api_key: apiKeys.smartlead,
          claude_api_key: apiKeys.claude,
          fullenrich_api_key: apiKeys.fullenrich
        })
      });

      if (!response.ok) {
        throw new Error('Failed to enrich lead data');
      }

      const enrichedData = await response.json();
      console.log('Raw webhook response:', enrichedData);

      // Create a new lead object with the enriched data
      const updatedLead = {
        ...lead,
        role: enrichedData.Role || null,
        company_data: enrichedData["Company Summary"] || null,
        personal_linkedin_url: enrichedData["Personal LinkedIn"] || null,
        business_linkedin_url: enrichedData["Business LinkedIn"] || null,
        last_name: enrichedData["Last Name"] || lead.last_name || ''
      };

      // Update the leads array
      setLeads(prevLeads => prevLeads.map(l => 
        l.id === lead.id ? updatedLead : l
      ));

      // If this is the selected lead, update it with a new object reference
      if (selectedLead?.id === lead.id) {
        setSelectedLead(updatedLead);
      }

      // Show success/not found toast with lead name
      const leadName = `${lead.first_name} ${lead.last_name}`.trim();
      if (enrichedData.Role || enrichedData["Company Summary"] || enrichedData["Personal LinkedIn"] || enrichedData["Business LinkedIn"]) {
        showToast(`Data enriched for ${leadName}`, 'success', lead.id);
      } else {
        showToast(`No additional data found for ${leadName}`, 'error', lead.id);
      }

    } catch (error) {
      console.error('Error enriching lead:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      const leadName = `${lead.first_name} ${lead.last_name}`.trim();
      showToast(`Error enriching data for ${leadName}`, 'error', lead.id);
    } finally {
      setEnrichingLeads(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{backgroundColor: '#1A1C1A'}}>
        <div className="text-center p-8 rounded-2xl shadow-xl" style={{backgroundColor: 'rgba(26, 28, 26, 0.8)', border: '1px solid white'}}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{borderColor: '#54FCFF'}}></div>
          <p className="text-white">Loading leads...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center" style={{backgroundColor: '#1A1C1A'}}>
        <div className="text-center">
          <p className="text-red-400 mb-6 font-medium">Error loading leads: {error}</p>
          <button 
            onClick={fetchLeads}
            className="px-4 py-2 text-white rounded-lg hover:opacity-80 transition-colors"
            style={{backgroundColor: '#54FCFF', color: '#1A1C1A', border: '1px solid white'}}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Function to handle API key updates
  const handleApiKeyChange = (key, value) => {
    setApiKeys(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Function to save API keys
  const saveApiKeys = () => {
    setIsSavingApi(true);
    try {
      // Save to localStorage
      Object.entries(apiKeys).forEach(([key, value]) => {
        localStorage.setItem(`${key}_api_key`, value);
      });

      // Show success toast
      setApiToastMessage({
        type: 'success',
        message: 'API keys saved successfully'
      });
      setShowApiToast(true);
      setTimeout(() => setShowApiToast(false), 3000);
    } catch (error) {
      setApiToastMessage({
        type: 'error',
        message: 'Failed to save API keys'
      });
      setShowApiToast(true);
      setTimeout(() => setShowApiToast(false), 3000);
    } finally {
      setIsSavingApi(false);
    }
  };

  // Function to toggle all sections
  const toggleAllSections = () => {
    if (activeSection.length === 0) {
      setActiveSection(['general', 'enrichment', 'engagement']);
    } else {
      setActiveSection([]);
    }
  };

  // Function to toggle individual section
  const toggleSection = (section) => {
    setActiveSection(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const findPhoneNumber = async (lead) => {
    setSearchingPhoneLeads(prev => new Set([...prev, lead.id]));
    try {
      const response = await fetch('https://reidsickels.app.n8n.cloud/webhook/0b5749de-2324-45da-aa36-20971addef0b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...lead,
          smartlead_api_key: apiKeys.smartlead,
          claude_api_key: apiKeys.claude,
          fullenrich_api_key: apiKeys.fullenrich
        })
      });

      if (!response.ok) {
        throw new Error('Failed to find phone number');
      }

      const data = await response.json();
      console.log('Raw webhook response:', data);

      // Extract phone number from the nested structure
      const phoneNumber = data?.datas?.[0]?.contact?.phones?.[0]?.number || null;

      // Create a new lead object with the phone number
      const updatedLead = {
        ...lead,
        phone: phoneNumber
      };

      // Update the leads array
      setLeads(prevLeads => prevLeads.map(l => 
        l.id === lead.id ? updatedLead : l
      ));

      // If this is the selected lead, update it with a new object reference
      if (selectedLead?.id === lead.id) {
        setSelectedLead(updatedLead);
      }

      // Show success/not found toast with lead name
      const leadName = `${lead.first_name} ${lead.last_name}`.trim();
      if (phoneNumber) {
        showToast(`Phone found for ${leadName}`, 'success', lead.id);
      } else {
        showToast(`No phone found for ${leadName}`, 'error', lead.id);
      }

    } catch (error) {
      console.error('Error finding phone number:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      const leadName = `${lead.first_name} ${lead.last_name}`.trim();
      showToast(`Error searching phone for ${leadName}`, 'error', lead.id);
    } finally {
      setSearchingPhoneLeads(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  };

  // Add window resize listener
  useEffect(() => {
    const handleResize = () => {
      // Force re-render on window resize to update styles
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Add mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setIsSidebarOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Handle sidebar toggle
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  
  // Handle sidebar close on mobile navigation
  const handleMobileNavigation = () => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Sidebar toggle button for mobile */}
      {isMobile && (
        <button 
          onClick={toggleSidebar}
          style={styles.sidebarToggle}
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}
      
      {/* Sidebar with mobile support */}
      <div style={{
        ...styles.sidebar,
        '--sidebar-transform': isSidebarOpen ? '0' : '-100%'
      }}>
        <div onClick={handleMobileNavigation}>
          {/* Existing sidebar content with mobile styles */}
          <div style={styles.filters}>
            {/* ... existing filter content ... */}
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div style={styles.mainContent}>
        {/* Header with responsive styles */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '10px' : '20px',
          alignItems: isMobile ? 'stretch' : 'center',
          marginBottom: '20px'
        }}>
          <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', margin: 0 }}>Inbox Manager</h1>
          <div style={styles.actionButtons}>
            {/* ... existing action buttons ... */}
          </div>
        </div>

        {/* Table container with horizontal scroll on mobile */}
        <div style={styles.table}>
          <table style={{ minWidth: isMobile ? '500px' : 'auto' }}>
            {/* ... existing table content ... */}
          </table>
        </div>

        {/* Modal with mobile styles */}
        {showModal && (
          <div style={{
            ...styles.modal,
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            zIndex: 1000
          }}>
            {/* ... existing modal content ... */}
          </div>
        )}

        {/* Toast notifications */}
        <div style={styles.toasts}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              style={{
                padding: '10px 15px',
                marginBottom: '10px',
                borderRadius: '4px',
                background: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  marginLeft: '10px'
                }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InboxManager;
