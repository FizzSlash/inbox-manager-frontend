import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Users, DollarSign, CheckCircle, BarChart3, Search, Edit3, Loader2, X, Mail, Phone, ExternalLink, AlertCircle, ChevronDown } from 'lucide-react';

// ThemeStyles and dark mode detection (copied from InboxManager)
const getThemeStyles = (isDarkMode) => {
  return isDarkMode ? {
    // Dark mode colors
    primaryBg: '#1A1C1A',
    secondaryBg: 'rgba(26, 28, 26, 0.8)',
    tertiaryBg: 'rgba(255, 255, 255, 0.05)',
    textPrimary: '#FFFFFF',
    textSecondary: '#D1D5DB',
    textMuted: '#9CA3AF',
    accent: '#54FCFF',
    border: 'rgba(255, 255, 255, 0.1)',
    borderStrong: 'rgba(255, 255, 255, 0.2)',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  } : {
    // Light mode colors (fixed contrast)
    primaryBg: '#F8FAFC',
    secondaryBg: '#FFFFFF',
    tertiaryBg: '#F1F5F9',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    accent: '#2563EB',
    border: 'rgba(0, 0, 0, 0.15)',
    borderStrong: 'rgba(0, 0, 0, 0.25)',
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
  };
};

const STAGE_OPTIONS = [
  { value: 'Lead', label: 'Lead', color: '#9CA3AF' },
  { value: 'Contacted', label: 'Contacted', color: '#3B82F6' },
  { value: 'Qualified', label: 'Qualified', color: '#8B5CF6' },
  { value: 'Proposal Sent', label: 'Proposal Sent', color: '#F59E0B' },
  { value: 'Closed Won', label: 'Closed Won', color: '#10B981' },
  { value: 'Closed Lost', label: 'Closed Lost', color: '#EF4444' },
  { value: 'Nurture', label: 'Nurture', color: '#06B6D4' }
];

const CRMManager = ({ brandId, onGoToInboxLead = () => {}, demoMode = false, demoData = null }) => {
  const [crmLeads, setCrmLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [sort, setSort] = useState({ field: 'created_at', dir: 'desc' });
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  
  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  // Theme management (matching InboxManager pattern)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('inbox_manager_theme');
    return savedTheme ? savedTheme === 'dark' : true; // Default to dark mode
  });
  
  const themeStyles = getThemeStyles(isDarkMode);

  // Close stage dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stageDropdownOpen && !event.target.closest('.stage-dropdown')) {
        setStageDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [stageDropdownOpen]);

  // Listen for theme changes from localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'inbox_manager_theme') {
        const newTheme = e.newValue === 'dark';
        setIsDarkMode(newTheme);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events in case theme is changed in the same window
    const handleThemeChange = () => {
      const savedTheme = localStorage.getItem('inbox_manager_theme');
      const newTheme = savedTheme ? savedTheme === 'dark' : true;
      setIsDarkMode(newTheme);
    };

    window.addEventListener('themeChanged', handleThemeChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('themeChanged', handleThemeChange);
    };
  }, []);

  useEffect(() => {
    const fetchCrmLeads = async () => {
      setLoading(true);
      
      // In demo mode, use provided demo data
      if (demoMode && demoData) {
        console.log('📺 CRM Demo mode: Using demo CRM leads');
        setTimeout(() => {
          setCrmLeads(demoData);
          setLoading(false);
        }, 1000); // Simulate loading time
        return;
      }
      
      const { data, error } = await supabase
        .from('retention_harbor')
        .select('*')
        .eq('brand_id', brandId)
        .eq('status', 'CRM')
        .order(sort.field, { ascending: sort.dir === 'asc' });
      if (error) {
        setToast({ type: 'error', message: 'Error fetching CRM leads: ' + error.message });
      } else {
        setCrmLeads(data);
      }
      setLoading(false);
    };
    if (brandId || (demoMode && demoData)) fetchCrmLeads();
  }, [brandId, sort, demoMode, demoData]);

  // Stats calculations
  const stats = useMemo(() => {
    if (!crmLeads.length) return null;
    const totalLeads = crmLeads.length;
    const totalClosed = crmLeads.filter(l => l.closed).length;
    const totalDealSize = crmLeads.reduce((sum, l) => sum + (l.deal_size || 0), 0);
    const totalCalls = crmLeads.filter(l => l.call_booked).length;
    const winRate = totalLeads ? (totalClosed / totalLeads) * 100 : 0;
    return {
      totalLeads,
      totalClosed,
      totalDealSize,
      totalCalls,
      winRate
    };
  }, [crmLeads]);

  // Filtered leads by search
  const filteredLeads = useMemo(() => {
    if (!search) return crmLeads;
    const s = search.toLowerCase();
    return crmLeads.filter(l =>
      (l.first_name && l.first_name.toLowerCase().includes(s)) ||
      (l.last_name && l.last_name.toLowerCase().includes(s)) ||
      (l.email && l.email.toLowerCase().includes(s))
    );
  }, [crmLeads, search]);

  // Sorting
  const handleSort = (field) => {
    setSort(prev => ({
      field,
      dir: prev.field === field ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc'
    }));
  };

  // Side panel logic
  const openSidePanel = (lead) => {
    setSelectedLead(lead);
    setEditFields({
      stage: lead.stage || 'Lead',
      call_booked: !!lead.call_booked,
      deal_size: lead.deal_size || 0,
      closed: !!lead.closed,
      notes: lead.notes || ''
    });
    setSidePanelOpen(true);
    setEditing(false);
  };
  const closeSidePanel = () => {
    setSelectedLead(null);
    setSidePanelOpen(false);
    setEditing(false);
    setEditFields({});
  };
  const startEdit = () => setEditing(true);
  const cancelEdit = () => {
    if (selectedLead) {
      setEditFields({
        stage: selectedLead.stage || 'Lead',
        call_booked: !!selectedLead.call_booked,
        deal_size: selectedLead.deal_size || 0,
        closed: !!selectedLead.closed,
        notes: selectedLead.notes || ''
      });
    }
    setEditing(false);
  };
  const handleFieldChange = (field, value) => {
    setEditFields(prev => ({ ...prev, [field]: value }));
  };
  const saveEdit = async () => {
    if (!selectedLead) return;
    setSavingId(selectedLead.id);
    try {
      const { error } = await supabase
        .from('retention_harbor')
        .update(editFields)
        .eq('id', selectedLead.id);
      if (error) throw error;
      setCrmLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...editFields } : l));
      setToast({ type: 'success', message: 'Lead updated!' });
      setEditing(false);
    } catch (err) {
      setToast({ type: 'error', message: 'Error saving lead: ' + err.message });
    } finally {
      setSavingId(null);
    }
  };

  // Update handleRemoveFromCRM to do optimistic updates:
  const handleRemoveFromCRM = async () => {
    if (!selectedLead) return;
    
    // Optimistic update - remove from local state immediately
    setCrmLeads(prev => prev.filter(l => l.id !== selectedLead.id));
    closeSidePanel();
    
    try {
      const { error } = await supabase
        .from('retention_harbor')
        .update({ status: 'INBOX' })
        .eq('id', selectedLead.id);
      if (error) throw error;
      setToast({ type: 'success', message: 'Lead removed from CRM!' });
    } catch (err) {
      // Revert optimistic update on error
      setCrmLeads(prev => [...prev, selectedLead]);
      setToast({ type: 'error', message: 'Error removing lead from CRM: ' + err.message });
    }
  };

  return (
    <div className="p-8 min-h-screen relative" style={{backgroundColor: themeStyles.primaryBg, color: themeStyles.textPrimary}}>
      <h2 className="text-3xl font-bold mb-6 flex items-center gap-3" style={{color: themeStyles.textPrimary}}>
        <BarChart3 className="w-7 h-7" style={{color: themeStyles.accent}} /> CRM Dashboard
      </h2>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
        <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
          <Users className="w-7 h-7 mb-2" style={{color: themeStyles.accent}} />
          <div className="text-2xl font-bold" style={{color: themeStyles.textPrimary}}>{stats ? stats.totalLeads : 0}</div>
          <div className="text-sm" style={{color: themeStyles.textMuted}}>Total Leads</div>
        </div>
        <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
          <CheckCircle className="w-7 h-7 mb-2" style={{color: themeStyles.success}} />
          <div className="text-2xl font-bold" style={{color: themeStyles.textPrimary}}>{stats ? stats.totalClosed : 0}</div>
          <div className="text-sm" style={{color: themeStyles.textMuted}}>Total Closed</div>
        </div>
        <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
          <DollarSign className="w-7 h-7 mb-2" style={{color: themeStyles.warning}} />
          <div className="text-2xl font-bold" style={{color: themeStyles.textPrimary}}>${stats ? stats.totalDealSize.toLocaleString() : 0}</div>
          <div className="text-sm" style={{color: themeStyles.textMuted}}>Total Deal Size</div>
        </div>
        <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
          <Phone className="w-7 h-7 mb-2" style={{color: themeStyles.accent}} />
          <div className="text-2xl font-bold" style={{color: themeStyles.textPrimary}}>{stats ? stats.totalCalls : 0}</div>
          <div className="text-sm" style={{color: themeStyles.textMuted}}>Calls Booked</div>
        </div>
        <div className="rounded-2xl shadow-lg p-6 flex flex-col items-center transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
          <BarChart3 className="w-7 h-7 mb-2" style={{color: themeStyles.accent}} />
          <div className="text-2xl font-bold" style={{color: themeStyles.textPrimary}}>{stats ? stats.winRate.toFixed(1) : 0}%</div>
          <div className="text-sm" style={{color: themeStyles.textMuted}}>Win Rate</div>
        </div>
      </div>
      {/* Search Bar */}
      <div className="flex items-center mb-6 max-w-md">
        <div className="relative w-full">
          <input
            type="text"
            className="w-full rounded-lg px-4 py-2 pl-10 focus:outline-none focus:ring-2 transition-all"
            style={{backgroundColor: themeStyles.secondaryBg, color: themeStyles.textPrimary, border: `1px solid ${themeStyles.border}`, focusRing: `2px solid ${themeStyles.accent}`}}
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 w-5 h-5" style={{color: themeStyles.textMuted}} />
        </div>
      </div>

      {/* Table of Leads */}
      <div className="overflow-x-auto rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
        <table className="min-w-full" style={{color: themeStyles.textPrimary}}>
          <thead>
            <tr style={{backgroundColor: themeStyles.tertiaryBg}}>
              <th className="px-6 py-4 text-left cursor-pointer transition-colors duration-300 font-semibold" style={{color: themeStyles.textSecondary}} onClick={() => handleSort('first_name')}>
                Name {sort.field === 'first_name' && (sort.dir === 'asc' ? '▲' : '▼')}
              </th>
              <th className="px-4 py-4 text-center cursor-pointer transition-colors duration-300 font-semibold" style={{color: themeStyles.textSecondary}} onClick={() => handleSort('stage')}>
                Stage {sort.field === 'stage' && (sort.dir === 'asc' ? '▲' : '▼')}
              </th>
              <th className="px-4 py-4 text-right cursor-pointer transition-colors duration-300 font-semibold" style={{color: themeStyles.textSecondary}} onClick={() => handleSort('deal_size')}>
                Deal Size {sort.field === 'deal_size' && (sort.dir === 'asc' ? '▲' : '▼')}
              </th>
              <th className="px-4 py-4 text-center cursor-pointer transition-colors duration-300 font-semibold" style={{color: themeStyles.textSecondary}} onClick={() => handleSort('call_booked')}>
                Call Booked {sort.field === 'call_booked' && (sort.dir === 'asc' ? '▲' : '▼')}
              </th>
              <th className="px-4 py-4 text-center cursor-pointer transition-colors duration-300 font-semibold" style={{color: themeStyles.textSecondary}} onClick={() => handleSort('closed')}>
                Closed {sort.field === 'closed' && (sort.dir === 'asc' ? '▲' : '▼')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-lg" style={{color: themeStyles.textSecondary}}>
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="animate-spin w-6 h-6" />
                    <span>Loading CRM leads...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-lg" style={{color: themeStyles.textSecondary}}>
                  No CRM leads found.
                </td>
              </tr>
            ) : (
              filteredLeads.map(lead => (
                <tr key={lead.id} className="border-t transition-colors cursor-pointer hover:opacity-80" style={{borderColor: themeStyles.border}} onClick={() => openSidePanel(lead)}>
                  <td className="px-6 py-4 font-medium">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 shrink-0" style={{color: themeStyles.accent}} />
                      <span style={{color: themeStyles.textPrimary}}>{lead.first_name} {lead.last_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {(() => {
                      const stageOption = STAGE_OPTIONS.find(opt => opt.value === lead.stage);
                      return (
                        <span 
                          className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: `${stageOption?.color || themeStyles.accent}20`, 
                            color: stageOption?.color || themeStyles.accent, 
                            border: `1px solid ${stageOption?.color || themeStyles.accent}30`
                          }}
                        >
                          {lead.stage}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-4 text-right font-medium" style={{color: themeStyles.textPrimary}}>
                    ${lead.deal_size?.toLocaleString() || 0}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span 
                      className="inline-flex items-center justify-center w-12 h-6 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: lead.call_booked ? `${themeStyles.success}20` : `${themeStyles.textMuted}20`,
                        color: lead.call_booked ? themeStyles.success : themeStyles.textMuted,
                        border: `1px solid ${lead.call_booked ? themeStyles.success : themeStyles.textMuted}30`
                      }}
                    >
                      {lead.call_booked ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span 
                      className="inline-flex items-center justify-center w-12 h-6 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: lead.closed ? `${themeStyles.success}20` : `${themeStyles.textMuted}20`,
                        color: lead.closed ? themeStyles.success : themeStyles.textMuted,
                        border: `1px solid ${lead.closed ? themeStyles.success : themeStyles.textMuted}30`
                      }}
                    >
                      {lead.closed ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Side Panel for Lead Details */}
      {sidePanelOpen && selectedLead && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50"
          onClick={(e) => {
            // Close panel if clicking on overlay (not on the panel itself)
            if (e.target === e.currentTarget) {
              closeSidePanel();
            }
          }}
        >
          <div
            className="w-full max-w-2xl h-full flex flex-col relative overflow-y-auto"
            style={{
              backgroundColor: isDarkMode ? '#1A1C1A' : '#FFFFFF',
              borderRadius: '12px',
              border: `1px solid ${themeStyles.border}`,
              margin: '8px',
              marginRight: '0',
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.25)',
              minHeight: 0
            }}
          >
            {/* Lead Header */}
            <div
              className="p-8 transition-colors duration-300"
              style={{backgroundColor: themeStyles.tertiaryBg, borderRadius: '12px 12px 0 0', borderBottom: `1px solid ${themeStyles.border}`}}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                    {selectedLead.first_name} {selectedLead.last_name}
                  </h2>
                  <p className="mt-2 font-medium transition-colors duration-300" style={{color: themeStyles.textSecondary}}>{selectedLead.email}</p>
                  {selectedLead.phone ? (
                    <p className="text-sm mt-2 flex items-center gap-2 transition-colors duration-300" style={{color: themeStyles.accent}}>
                      <Phone className="w-3 h-3" />
                      <span className="font-medium">{selectedLead.phone}</span>
                    </p>
                  ) : (
                    <p className="text-sm mt-2 flex items-center gap-2 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                      <Phone className="w-3 h-3" />
                      <span>No phone number found</span>
                    </p>
                  )}
                  {selectedLead.website && (
                    <p className="text-sm mt-2">
                      <a href={`https://${selectedLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-colors duration-300" style={{color: themeStyles.accent}}>
                        {selectedLead.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onGoToInboxLead(selectedLead.id)}
                    className="px-3 py-2 rounded-lg transition-colors duration-300 flex items-center gap-2 text-sm bg-blue-600 text-white hover:bg-blue-700"
                    style={{marginRight: '8px'}}
                    title="Go to lead in Inbox"
                  >
                    Go to lead in Inbox
                  </button>
                  <button
                    onClick={handleRemoveFromCRM}
                    className="px-3 py-2 rounded-lg transition-colors duration-300 flex items-center gap-2 text-sm bg-red-600 text-white hover:bg-red-700"
                    style={{marginRight: '8px'}}
                    title="Remove from CRM"
                  >
                    Remove from CRM
                  </button>
                  <button
                    onClick={closeSidePanel}
                    className="p-2 rounded-lg transition-colors duration-300 hover:opacity-80"
                    style={{border: `1px solid ${themeStyles.border}`, backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textMuted}}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 transition-colors duration-300" style={{scrollbarWidth: 'thin', scrollbarColor: `${themeStyles.accent} ${themeStyles.primaryBg}50`}}>
              <div className="space-y-8">
                {/* Timeline/Metadata Section */}
                <div className="mb-6 p-4 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>Last Reply</span>
                        <p className="font-medium mt-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                          {selectedLead.last_reply || 'No replies yet'}
                        </p>
                      </div>
                      <div>
                        <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>Last Followup</span>
                        <p className="font-medium mt-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                          {selectedLead.last_followup || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>Avg Response</span>
                        <p className="font-medium mt-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{selectedLead.avg_response || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full text-sm transition-colors duration-300" style={{backgroundColor: `${themeStyles.accent}15`, border: `1px solid ${themeStyles.accent}20`}}>
                      <span className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{selectedLead.replies_count || 0}</span>
                      <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}> replies</span>
                    </div>
                  </div>
                </div>
                {/* Unified Lead Information Section */}
                <div className="rounded-2xl p-6 shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="relative">
                      <label className="block text-lg font-medium mb-2" style={{color: themeStyles.textSecondary}}>Stage</label>
                      
                                             {/* Custom Stage Dropdown */}
                       <div className="relative stage-dropdown">
                        <button
                          type="button"
                          onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
                          className="w-full rounded-xl px-4 py-3 text-xl font-semibold transition-colors duration-300 flex items-center justify-between"
                          style={{backgroundColor: themeStyles.primaryBg, color: themeStyles.textPrimary, border: `1px solid ${themeStyles.border}`}}
                        >
                          <span>{STAGE_OPTIONS.find(opt => opt.value === editFields.stage)?.label}</span>
                          <ChevronDown className={`w-6 h-6 transition-transform duration-200 ${stageDropdownOpen ? 'rotate-180' : ''}`} style={{color: themeStyles.textMuted}} />
                        </button>
                        
                        {stageDropdownOpen && (
                          <div 
                            className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-xl z-50 overflow-hidden"
                            style={{backgroundColor: themeStyles.primaryBg, border: `1px solid ${themeStyles.border}`}}
                          >
                            {STAGE_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  handleFieldChange('stage', option.value);
                                  setStageDropdownOpen(false);
                                }}
                                className="w-full px-4 py-4 text-left transition-all duration-200 flex items-center justify-between hover:opacity-80"
                                style={{
                                  backgroundColor: editFields.stage === option.value ? `${option.color}20` : 'transparent',
                                  borderBottom: `1px solid ${themeStyles.border}`
                                }}
                              >
                                <span 
                                  className="font-semibold text-lg"
                                  style={{color: option.color}}
                                >
                                  {option.label}
                                </span>
                                {editFields.stage === option.value && (
                                  <CheckCircle className="w-5 h-5 ml-auto" style={{color: option.color}} />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-8">
                      <input type="checkbox" id="call_booked" checked={!!editFields.call_booked} onChange={e => handleFieldChange('call_booked', e.target.checked)} className="w-7 h-7 accent-accent" />
                      <label htmlFor="call_booked" className="text-lg font-medium" style={{color: themeStyles.textSecondary}}>Call Booked</label>
                    </div>
                    <div>
                      <label className="block text-lg font-medium mb-2" style={{color: themeStyles.textSecondary}}>Deal Size</label>
                      <input type="number" className="w-full rounded-xl px-4 py-3 text-xl font-semibold transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg, color: themeStyles.textPrimary, border: `1px solid ${themeStyles.border}`}} value={editFields.deal_size} onChange={e => handleFieldChange('deal_size', Number(e.target.value))} />
                    </div>
                    <div className="flex items-center gap-4 mt-8">
                      <input type="checkbox" id="closed" checked={!!editFields.closed} onChange={e => handleFieldChange('closed', e.target.checked)} className="w-7 h-7 accent-accent" />
                      <label htmlFor="closed" className="text-lg font-medium" style={{color: themeStyles.textSecondary}}>Closed</label>
                    </div>
                  </div>
                  <div className="mb-10">
                    <label className="block text-lg font-medium mb-2" style={{color: themeStyles.textSecondary}}>Notes</label>
                    <textarea className="w-full rounded-xl px-4 py-3 text-xl min-h-[200px] transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg, color: themeStyles.textPrimary, border: `1px solid ${themeStyles.border}`}} value={editFields.notes} onChange={e => handleFieldChange('notes', e.target.value)} />
                  </div>
                  <div className="flex gap-4 mt-auto">
                    <button className="px-8 py-4 rounded-xl font-bold shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.success, color: '#fff', fontSize: '1.25rem'}} onClick={saveEdit} disabled={savingId === selectedLead.id}>{savingId === selectedLead.id ? <Loader2 className="animate-spin w-7 h-7" /> : 'Save Changes'}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div 
            className="flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg cursor-pointer transition-all transform hover:scale-102 min-w-[200px]"
            style={{
              backgroundColor: toast.type === 'success' 
                ? `${themeStyles.success}20` 
                : `${themeStyles.error}20`,
              border: `1px solid ${toast.type === 'success' ? themeStyles.success : themeStyles.error}`,
              backdropFilter: 'blur(8px)',
              animation: 'slideIn 0.2s ease-out'
            }}
            onClick={() => setToast(null)}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" style={{color: themeStyles.success}} />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" style={{color: themeStyles.error}} />
            )}
            <span className="text-sm font-medium flex-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
              {toast.message}
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setToast(null);
              }}
              className="ml-2 shrink-0 hover:opacity-80 transition-colors duration-300"
              style={{color: themeStyles.textMuted}}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default CRMManager; 