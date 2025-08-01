import React, { useState } from 'react';
import { Search, Filter, Send, Edit3, Clock, Mail, User, MessageSquare, ChevronDown, ChevronRight, X, TrendingUp, Calendar, ExternalLink, BarChart3, Users, AlertCircle, CheckCircle, Timer, Zap, Target, DollarSign, Activity, Key, Brain, Database, Loader2, Save, Phone, LogOut, FileText, Bot } from 'lucide-react';

const DemoPage = () => {
  const [activeDemo, setActiveDemo] = useState('dashboard');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [showAIDraft, setShowAIDraft] = useState(false);

  // Demo data
  const demoLeads = [
    {
      id: 1,
      email: "sarah@techstartup.com",
      first_name: "Sarah",
      last_name: "Johnson",
      company: "TechStartup Inc",
      intent: 9,
      status: "INBOX",
      response_urgency: "urgent-response",
      conversation: [
        { type: "SENT", content: "Hi Sarah, saw your company is scaling fast...", time: "2024-01-15T10:00:00Z" },
        { type: "REPLY", content: "Yes! We're looking for solutions exactly like this. Can we schedule a call?", time: "2024-01-15T14:30:00Z" }
      ],
      website: "techstartup.com",
      created_at_lead: "2024-01-15T09:00:00Z"
    },
    {
      id: 2,
      email: "mike@ecommerceco.com",
      first_name: "Mike",
      last_name: "Chen",
      company: "EcommerceCo",
      intent: 7,
      status: "INBOX",
      response_urgency: "needs-response",
      conversation: [
        { type: "SENT", content: "Hi Mike, noticed your e-commerce site...", time: "2024-01-14T15:00:00Z" },
        { type: "REPLY", content: "Interesting. What kind of ROI are you seeing?", time: "2024-01-14T16:45:00Z" }
      ],
      website: "ecommerceco.com",
      created_at_lead: "2024-01-14T14:00:00Z"
    },
    {
      id: 3,
      email: "jennifer@consultingfirm.com",
      first_name: "Jennifer",
      last_name: "Davis",
      company: "Consulting Firm LLC",
      intent: 5,
      status: "INBOX",
      response_urgency: "needs-followup",
      conversation: [
        { type: "SENT", content: "Hi Jennifer, helping consulting firms like yours...", time: "2024-01-13T11:00:00Z" },
        { type: "REPLY", content: "Thanks for reaching out. Not looking right now but keep me posted.", time: "2024-01-13T13:20:00Z" },
        { type: "SENT", content: "No problem! I'll follow up in a few months.", time: "2024-01-13T13:25:00Z" }
      ],
      website: "consultingfirm.com",
      created_at_lead: "2024-01-13T10:00:00Z"
    }
  ];

  const demoAnalytics = {
    totalLeads: 247,
    responseRate: 68,
    avgResponseTime: "2.3 hours",
    conversions: 23,
    hotLeads: 12,
    warmLeads: 35
  };

  const getIntentColor = (intent) => {
    if (intent >= 8) return '#10B981'; // Green
    if (intent >= 6) return '#F59E0B'; // Yellow
    if (intent >= 4) return '#EF4444'; // Red
    return '#6B7280'; // Gray
  };

  const getUrgencyInfo = (urgency) => {
    switch (urgency) {
      case 'urgent-response':
        return { color: '#EF4444', text: 'Urgent Response', icon: AlertCircle };
      case 'needs-response':
        return { color: '#F59E0B', text: 'Needs Response', icon: Clock };
      case 'needs-followup':
        return { color: '#6B7280', text: 'Follow Up', icon: Calendar };
      default:
        return { color: '#10B981', text: 'Up to Date', icon: CheckCircle };
    }
  };

  const generateAIDraft = () => {
    setIsGeneratingDraft(true);
    setTimeout(() => {
      setIsGeneratingDraft(false);
      setShowAIDraft(true);
    }, 2000);
  };

  const themeStyles = {
    primaryBg: '#1F2937',
    secondaryBg: '#374151',
    textPrimary: '#F9FAFB',
    textSecondary: '#D1D5DB',
    border: '#4B5563',
    accent: '#3B82F6'
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: themeStyles.primaryBg, color: themeStyles.textPrimary }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: themeStyles.border, backgroundColor: themeStyles.secondaryBg }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-8 h-8" style={{ color: themeStyles.accent }} />
              <h1 className="text-2xl font-bold">Inbox Manager Demo</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveDemo('dashboard')}
                className={`px-4 py-2 rounded-lg transition-all ${ 
                  activeDemo === 'dashboard' ? 'text-white' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: activeDemo === 'dashboard' ? themeStyles.accent : 'transparent' }}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveDemo('ai-draft')}
                className={`px-4 py-2 rounded-lg transition-all ${ 
                  activeDemo === 'ai-draft' ? 'text-white' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: activeDemo === 'ai-draft' ? themeStyles.accent : 'transparent' }}
              >
                AI Draft
              </button>
              <button
                onClick={() => setActiveDemo('analytics')}
                className={`px-4 py-2 rounded-lg transition-all ${ 
                  activeDemo === 'analytics' ? 'text-white' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: activeDemo === 'analytics' ? themeStyles.accent : 'transparent' }}
              >
                Analytics
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Dashboard Demo */}
        {activeDemo === 'dashboard' && (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2">Unified Lead Dashboard</h2>
              <p style={{ color: themeStyles.textSecondary }}>
                All your leads from all campaigns in one place, with AI-powered intent scoring
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg" style={{ backgroundColor: themeStyles.secondaryBg }}>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5" style={{ color: themeStyles.accent }} />
                  <span className="text-sm" style={{ color: themeStyles.textSecondary }}>Total Leads</span>
                </div>
                <div className="text-2xl font-bold">{demoAnalytics.totalLeads}</div>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: themeStyles.secondaryBg }}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5" style={{ color: '#10B981' }} />
                  <span className="text-sm" style={{ color: themeStyles.textSecondary }}>Response Rate</span>
                </div>
                <div className="text-2xl font-bold">{demoAnalytics.responseRate}%</div>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: themeStyles.secondaryBg }}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5" style={{ color: '#F59E0B' }} />
                  <span className="text-sm" style={{ color: themeStyles.textSecondary }}>Avg Response</span>
                </div>
                <div className="text-2xl font-bold">{demoAnalytics.avgResponseTime}</div>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: themeStyles.secondaryBg }}>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5" style={{ color: '#EF4444' }} />
                  <span className="text-sm" style={{ color: themeStyles.textSecondary }}>Hot Leads</span>
                </div>
                <div className="text-2xl font-bold">{demoAnalytics.hotLeads}</div>
              </div>
            </div>

            {/* Lead Cards */}
            <div className="space-y-4">
              {demoLeads.map((lead) => {
                const urgencyInfo = getUrgencyInfo(lead.response_urgency);
                const UrgencyIcon = urgencyInfo.icon;
                
                return (
                  <div
                    key={lead.id}
                    className="p-6 rounded-lg border cursor-pointer hover:border-blue-500 transition-all"
                    style={{ backgroundColor: themeStyles.secondaryBg, borderColor: themeStyles.border }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <User className="w-5 h-5" style={{ color: themeStyles.textSecondary }} />
                            <span className="font-semibold">{lead.first_name} {lead.last_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" style={{ color: themeStyles.textSecondary }} />
                            <span className="text-sm" style={{ color: themeStyles.textSecondary }}>{lead.email}</span>
                          </div>
                          {lead.website && (
                            <div className="flex items-center gap-2">
                              <ExternalLink className="w-4 h-4" style={{ color: themeStyles.textSecondary }} />
                              <span className="text-sm" style={{ color: themeStyles.textSecondary }}>{lead.website}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4" style={{ color: getIntentColor(lead.intent) }} />
                            <span className="text-sm font-medium">Intent Score: {lead.intent}/10</span>
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: getIntentColor(lead.intent) }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <UrgencyIcon className="w-4 h-4" style={{ color: urgencyInfo.color }} />
                            <span className="text-sm" style={{ color: urgencyInfo.color }}>
                              {urgencyInfo.text}
                            </span>
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="text-sm" style={{ color: themeStyles.textSecondary }}>Last message:</div>
                          <div className="text-sm mt-1 p-2 rounded" style={{ backgroundColor: themeStyles.primaryBg }}>
                            "{lead.conversation[lead.conversation.length - 1].content}"
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          className="px-3 py-1 rounded text-sm font-medium transition-all hover:opacity-80"
                          style={{ backgroundColor: themeStyles.accent, color: 'white' }}
                        >
                          Reply
                        </button>
                        <button
                          className="px-3 py-1 rounded text-sm font-medium transition-all hover:opacity-80"
                          style={{ backgroundColor: '#10B981', color: 'white' }}
                        >
                          CRM
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Draft Demo */}
        {activeDemo === 'ai-draft' && (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2">AI-Powered Draft Generation</h2>
              <p style={{ color: themeStyles.textSecondary }}>
                Generate personalized responses in seconds using your brand voice and context
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-4">Lead Context</h3>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: themeStyles.secondaryBg }}>
                    <div className="mb-3">
                      <strong>Sarah Johnson</strong> - sarah@techstartup.com
                    </div>
                    <div className="text-sm" style={{ color: themeStyles.textSecondary }}>
                      Intent Score: 9/10 | Company: TechStartup Inc
                    </div>
                    <div className="mt-3 p-3 rounded" style={{ backgroundColor: themeStyles.primaryBg }}>
                      <div className="text-sm font-medium mb-2">Conversation History:</div>
                      <div className="space-y-2 text-sm">
                        <div><strong>You:</strong> "Hi Sarah, saw your company is scaling fast..."</div>
                        <div><strong>Sarah:</strong> "Yes! We're looking for solutions exactly like this. Can we schedule a call?"</div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={generateAIDraft}
                  disabled={isGeneratingDraft}
                  className="w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: themeStyles.accent, color: 'white' }}
                >
                  {isGeneratingDraft ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating AI Draft...
                    </>
                  ) : (
                    <>
                      <Bot className="w-5 h-5" />
                      Generate AI Draft
                    </>
                  )}
                </button>
              </div>

              {/* Output Section */}
              <div>
                <h3 className="text-xl font-semibold mb-4">Generated Response</h3>
                <div className="p-4 rounded-lg h-64" style={{ backgroundColor: themeStyles.secondaryBg }}>
                  {!showAIDraft ? (
                    <div className="flex items-center justify-center h-full text-center">
                      <div>
                        <Bot className="w-12 h-12 mx-auto mb-3" style={{ color: themeStyles.textSecondary }} />
                        <p style={{ color: themeStyles.textSecondary }}>
                          Click "Generate AI Draft" to see personalized response
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 rounded" style={{ backgroundColor: themeStyles.primaryBg }}>
                        <div className="text-sm font-medium mb-2">Subject: Quick call to discuss your scaling needs?</div>
                        <div className="text-sm leading-relaxed">
                          Hi Sarah,<br/><br/>
                          Great to hear you're actively looking for solutions! I'd love to show you exactly how we've helped other fast-scaling tech startups like yours streamline their operations.<br/><br/>
                          Would you be available for a quick 15-minute call this week? I can share some specific case studies from companies in similar growth stages.<br/><br/>
                          Best regards,<br/>
                          [Your Name]
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm" style={{ color: themeStyles.textSecondary }}>
                        <CheckCircle className="w-4 h-4" style={{ color: '#10B981' }} />
                        Personalized based on context and intent score
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Demo */}
        {activeDemo === 'analytics' && (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2">Performance Analytics</h2>
              <p style={{ color: themeStyles.textSecondary }}>
                Track your campaign performance and optimize for better results
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-6 rounded-lg" style={{ backgroundColor: themeStyles.secondaryBg }}>
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-6 h-6" style={{ color: themeStyles.accent }} />
                  <h3 className="text-lg font-semibold">Response Rates</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>This Week</span>
                    <span className="font-semibold">68%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Week</span>
                    <span>62%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average</span>
                    <span>65%</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-lg" style={{ backgroundColor: themeStyles.secondaryBg }}>
                <div className="flex items-center gap-3 mb-4">
                  <Target className="w-6 h-6" style={{ color: '#10B981' }} />
                  <h3 className="text-lg font-semibold">Intent Distribution</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>High Intent (8-10)</span>
                    <span className="font-semibold">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medium Intent (5-7)</span>
                    <span className="font-semibold">35</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Low Intent (1-4)</span>
                    <span className="font-semibold">8</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-lg" style={{ backgroundColor: themeStyles.secondaryBg }}>
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-6 h-6" style={{ color: '#F59E0B' }} />
                  <h3 className="text-lg font-semibold">Response Times</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Average</span>
                    <span className="font-semibold">2.3 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fastest</span>
                    <span>12 minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Within 1 hour</span>
                    <span>78%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Demo Notice */}
      <div className="fixed bottom-4 right-4 p-4 rounded-lg shadow-lg" style={{ backgroundColor: themeStyles.accent }}>
        <div className="text-white text-sm font-medium">
          🎯 This is a demo using sample data
        </div>
      </div>
    </div>
  );
};

export default DemoPage; 