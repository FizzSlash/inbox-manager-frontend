import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Users, DollarSign, CheckCircle, BarChart3, Search, Edit3, Loader2, X, Mail, Phone, ExternalLink, AlertCircle, ChevronDown, Settings, Plus, Trash2, RotateCcw, Palette } from 'lucide-react';

// Helper function for displaying lead names
const getDisplayName = (lead) => {
  // First try first_name + last_name
  if (lead.first_name || lead.last_name) {
    return `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
  }
  
  // Then try lead_email (from backfill/imports)
  if (lead.lead_email) {
    return lead.lead_email;
  }
  
  // Then try email 
  if (lead.email) {
    return lead.email;
  }
  
  // Last resort
  return 'No Email';
};

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
  
  // 🆕 NEW: Kanban view mode and dynamic stages
  const [viewMode, setViewMode] = useState('kanban'); // 'list' or 'kanban' - DEFAULT TO KANBAN
  const [crmStages, setCrmStages] = useState([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const [showStageEditor, setShowStageEditor] = useState(false);
  const [draggedLead, setDraggedLead] = useState(null);
  
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

  // 🆕 NEW: Load CRM stages dynamically from database
  useEffect(() => {
    const loadCrmStages = async () => {
      if (demoMode || !brandId) {
        // Demo mode - use hardcoded stages
        setCrmStages([
          { id: 'demo-1', name: 'Interested', color: '#6B7280', order_position: 1, lead_count: 0 },
          { id: 'demo-2', name: 'Call Booked', color: '#3B82F6', order_position: 2, lead_count: 0 },
          { id: 'demo-3', name: 'Proposal Sent', color: '#8B5CF6', order_position: 3, lead_count: 0 },
          { id: 'demo-4', name: 'Follow Up', color: '#F59E0B', order_position: 4, lead_count: 0 },
          { id: 'demo-5', name: 'Closed Won', color: '#10B981', order_position: 5, lead_count: 0 },
          { id: 'demo-6', name: 'Closed Lost', color: '#EF4444', order_position: 6, lead_count: 0 },
          { id: 'demo-7', name: 'Nurture', color: '#06B6D4', order_position: 7, lead_count: 0 }
        ]);
        setStagesLoading(false);
        return;
      }

      setStagesLoading(true);
      try {
        console.log('🔄 Loading CRM stages for brand:', brandId);
        const { data, error } = await supabase.rpc('get_crm_config', { brand_uuid: brandId });
        
        if (error) {
          console.error('❌ Error loading CRM stages:', error);
          console.error('❌ Error details:', error.message, error.code, error.details);
          setToast({ type: 'error', message: `Failed to load CRM stages: ${error.message}` });
          
          // Fallback to basic default stages on error
          setCrmStages([
            { id: 'fallback-1', name: 'Interested', color: '#6B7280', order_position: 1, lead_count: 0 },
            { id: 'fallback-2', name: 'Call Booked', color: '#3B82F6', order_position: 2, lead_count: 0 },
            { id: 'fallback-3', name: 'Proposal Sent', color: '#8B5CF6', order_position: 3, lead_count: 0 },
            { id: 'fallback-4', name: 'Follow Up', color: '#F59E0B', order_position: 4, lead_count: 0 },
            { id: 'fallback-5', name: 'Closed Won', color: '#10B981', order_position: 5, lead_count: 0 },
            { id: 'fallback-6', name: 'Closed Lost', color: '#EF4444', order_position: 6, lead_count: 0 },
            { id: 'fallback-7', name: 'Nurture', color: '#06B6D4', order_position: 7, lead_count: 0 }
          ]);
        } else if (data && data.length > 0) {
          const result = data[0];
          console.log('✅ Loaded CRM config:', result);
          
          if (result.stages && Array.isArray(result.stages)) {
            // Add lead counts from the stage_lead_counts
            const stagesWithCounts = result.stages.map(stage => ({
              ...stage,
              lead_count: result.stage_lead_counts?.[stage.name] || 0
            }));
            setCrmStages(stagesWithCounts);
          } else {
            console.warn('⚠️ No stages found in config, using defaults');
            setCrmStages([
              { id: 'default-1', name: 'Interested', color: '#6B7280', order_position: 1, lead_count: 0 },
              { id: 'default-2', name: 'Call Booked', color: '#3B82F6', order_position: 2, lead_count: 0 },
              { id: 'default-3', name: 'Proposal Sent', color: '#8B5CF6', order_position: 3, lead_count: 0 },
              { id: 'default-4', name: 'Follow Up', color: '#F59E0B', order_position: 4, lead_count: 0 },
              { id: 'default-5', name: 'Closed Won', color: '#10B981', order_position: 5, lead_count: 0 },
              { id: 'default-6', name: 'Closed Lost', color: '#EF4444', order_position: 6, lead_count: 0 },
              { id: 'default-7', name: 'Nurture', color: '#06B6D4', order_position: 7, lead_count: 0 }
            ]);
          }
        }
      } catch (error) {
        console.error('❌ Exception loading CRM stages:', error);
        setToast({ type: 'error', message: 'Failed to load CRM stages: ' + error.message });
        setCrmStages([
          { id: 'error-1', name: 'Interested', color: '#6B7280', order_position: 1, lead_count: 0 },
          { id: 'error-2', name: 'Call Booked', color: '#3B82F6', order_position: 2, lead_count: 0 },
          { id: 'error-3', name: 'Proposal Sent', color: '#8B5CF6', order_position: 3, lead_count: 0 },
          { id: 'error-4', name: 'Follow Up', color: '#F59E0B', order_position: 4, lead_count: 0 },
          { id: 'error-5', name: 'Closed Won', color: '#10B981', order_position: 5, lead_count: 0 },
          { id: 'error-6', name: 'Closed Lost', color: '#EF4444', order_position: 6, lead_count: 0 },
          { id: 'error-7', name: 'Nurture', color: '#06B6D4', order_position: 7, lead_count: 0 }
        ]);
      } finally {
        setStagesLoading(false);
      }
    };

    loadCrmStages();
  }, [brandId, demoMode]);

  // 🆕 NEW: Auto-fix leads with invalid stages
  useEffect(() => {
    const fixInvalidStages = async () => {
      if (!crmLeads.length || !crmStages.length || demoMode) return;
      
      const validStageNames = crmStages.map(s => s.name);
      const leadsToFix = crmLeads.filter(lead => 
        !lead.stage || !validStageNames.includes(lead.stage)
      );
      
      if (leadsToFix.length > 0) {
        console.log(`🔧 Found ${leadsToFix.length} leads with invalid stages, fixing...`);
        const firstStage = crmStages[0]?.name || 'Interested';
        
        try {
          for (const lead of leadsToFix) {
            await supabase
              .from('retention_harbor')
              .update({ stage: firstStage })
              .eq('id', lead.id);
          }
          
          // Update local state
          setCrmLeads(prev => prev.map(lead => 
            leadsToFix.some(l => l.id === lead.id) 
              ? { ...lead, stage: firstStage }
              : lead
          ));
          
          setToast({ 
            type: 'success', 
            message: `Fixed ${leadsToFix.length} leads with invalid stages` 
          });
        } catch (error) {
          console.error('❌ Error fixing invalid stages:', error);
        }
      }
    };

    fixInvalidStages();
  }, [crmLeads, crmStages, demoMode]);

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
      (l.email && l.email.toLowerCase().includes(s)) ||
      (l.lead_email && l.lead_email.toLowerCase().includes(s)) // 🆕 FIXED: Include lead_email in search
    );
  }, [crmLeads, search]);

  // Sorting
  const handleSort = (field) => {
    setSort(prev => ({
      field,
      dir: prev.field === field ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc'
    }));
  };

  // 🆕 NEW: Drag and drop handlers for Kanban
  const handleDragStart = (e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    
    if (!draggedLead || draggedLead.stage === targetStage) {
      setDraggedLead(null);
      return;
    }

    console.log(`🔄 Moving lead ${draggedLead.id} from ${draggedLead.stage} to ${targetStage}`);
    
    // Optimistic update
    setCrmLeads(prev => prev.map(lead => 
      lead.id === draggedLead.id 
        ? { ...lead, stage: targetStage }
        : lead
    ));

    try {
      const { error } = await supabase
        .from('retention_harbor')
        .update({ stage: targetStage })
        .eq('id', draggedLead.id);

      if (error) throw error;
      
      setToast({ type: 'success', message: `Moved to ${targetStage}!` });
    } catch (error) {
      console.error('❌ Error updating lead stage:', error);
      // Revert optimistic update
      setCrmLeads(prev => prev.map(lead => 
        lead.id === draggedLead.id 
          ? { ...lead, stage: draggedLead.stage }
          : lead
      ));
      setToast({ type: 'error', message: 'Error moving lead: ' + error.message });
    }

    setDraggedLead(null);
  };

  // Side panel logic
  const openSidePanel = (lead) => {
    setSelectedLead(lead);
    setEditFields({
      stage: lead.stage || (crmStages[0]?.name || 'Interested'), // 🆕 FIXED: Default to first CRM stage
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
        stage: selectedLead.stage || (crmStages[0]?.name || 'Interested'),
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

  // 🆕 NEW: Group leads by stage for Kanban
  const leadsByStage = useMemo(() => {
    const grouped = {};
    crmStages.forEach(stage => {
      grouped[stage.name] = filteredLeads.filter(lead => lead.stage === stage.name);
    });
    return grouped;
  }, [filteredLeads, crmStages]);

  return (
    <div className="p-8 min-h-screen relative" style={{backgroundColor: themeStyles.primaryBg, color: themeStyles.textPrimary}}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold flex items-center gap-3" style={{color: themeStyles.textPrimary}}>
          <BarChart3 className="w-7 h-7" style={{color: themeStyles.accent}} /> CRM Dashboard
        </h2>
        
        {/* 🆕 NEW: View mode toggle and Edit Stages button */}
        <div className="flex items-center gap-4">
          {/* List/Kanban Toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{border: `1px solid ${themeStyles.border}`}}>
            <button
              onClick={() => setViewMode('list')}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: viewMode === 'list' ? themeStyles.accent : 'transparent',
                color: viewMode === 'list' ? '#000000' : themeStyles.textPrimary, // 🆕 FIXED: Black text when active
              }}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: viewMode === 'kanban' ? themeStyles.accent : 'transparent',
                color: viewMode === 'kanban' ? '#000000' : themeStyles.textPrimary, // 🆕 FIXED: Black text when active
              }}
            >
              Kanban
            </button>
          </div>
          
          {/* Edit Stages Button */}
          {!demoMode && (
            <button
              onClick={() => setShowStageEditor(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: themeStyles.tertiaryBg,
                color: themeStyles.textPrimary,
                border: `1px solid ${themeStyles.border}`
              }}
            >
              <Settings className="w-4 h-4" />
              Edit Stages
            </button>
          )}
        </div>
      </div>

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

      {/* 🆕 NEW: Kanban Board View */}
      {viewMode === 'kanban' ? (
        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${crmStages.length}, minmax(300px, 1fr))` }}>
          {stagesLoading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin w-6 h-6" style={{color: themeStyles.accent}} />
                <span style={{color: themeStyles.textSecondary}}>Loading stages...</span>
              </div>
            </div>
          ) : (
            crmStages.map(stage => (
              <div
                key={stage.id}
                className="rounded-xl shadow-lg transition-colors duration-300"
                style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.name)}
              >
                {/* Stage Header */}
                <div className="p-4 border-b" style={{borderColor: themeStyles.border}}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg" style={{color: stage.color}}>
                      {stage.name}
                    </h3>
                    <span 
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${stage.color}20`,
                        color: stage.color
                      }}
                    >
                      {leadsByStage[stage.name]?.length || 0}
                    </span>
                  </div>
                </div>
                
                {/* Stage Content */}
                <div className="p-4 space-y-3 min-h-[400px]">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin w-5 h-5" style={{color: themeStyles.textMuted}} />
                    </div>
                  ) : leadsByStage[stage.name]?.length === 0 ? (
                    <div className="text-center py-8" style={{color: themeStyles.textMuted}}>
                      <div className="text-sm">No leads in this stage</div>
                    </div>
                  ) : (
                    leadsByStage[stage.name]?.map(lead => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        onClick={() => openSidePanel(lead)}
                        className="p-3 rounded-lg cursor-pointer transition-all hover:shadow-md border"
                        style={{
                          backgroundColor: themeStyles.tertiaryBg,
                          borderColor: themeStyles.border,
                          transform: draggedLead?.id === lead.id ? 'rotate(2deg)' : 'none',
                          opacity: draggedLead?.id === lead.id ? 0.5 : 1
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="w-3 h-3" style={{color: themeStyles.accent}} />
                          <span className="font-medium text-sm" style={{color: themeStyles.textPrimary}}>
                            {getDisplayName(lead)} {/* 🆕 FIXED: Show email instead of Unknown */}
                          </span>
                        </div>
                        {lead.deal_size > 0 && (
                          <div className="text-xs mb-1" style={{color: themeStyles.textSecondary}}>
                            Deal: ${lead.deal_size.toLocaleString()}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          {lead.call_booked && (
                            <span 
                              className="px-2 py-0.5 rounded-full"
                              style={{backgroundColor: `${themeStyles.success}20`, color: themeStyles.success}}
                            >
                              Call Booked
                            </span>
                          )}
                          {lead.closed && (
                            <span 
                              className="px-2 py-0.5 rounded-full"
                              style={{backgroundColor: `${themeStyles.success}20`, color: themeStyles.success}}
                            >
                              Closed
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* List View (Original Table) */
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
                filteredLeads.map(lead => {
                  const stageOption = crmStages.find(s => s.name === lead.stage);
                  return (
                    <tr key={lead.id} className="border-t transition-colors cursor-pointer hover:opacity-80" style={{borderColor: themeStyles.border}} onClick={() => openSidePanel(lead)}>
                      <td className="px-6 py-4 font-medium">
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 shrink-0" style={{color: themeStyles.accent}} />
                          <span style={{color: themeStyles.textPrimary}}>
                            {getDisplayName(lead)} {/* 🆕 FIXED: Show email instead of Unknown */}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 🆕 NEW: Stage Editor Modal */}
      {showStageEditor && (
        <StageEditorModal
          brandId={brandId}
          crmStages={crmStages}
          setCrmStages={setCrmStages}
          themeStyles={themeStyles}
          onClose={() => setShowStageEditor(false)}
          setToast={setToast}
        />
      )}

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
                    {getDisplayName(selectedLead)} {/* 🆕 FIXED: Show email instead of Unknown */}
                  </h2>
                  <p className="mt-2 font-medium transition-colors duration-300" style={{color: themeStyles.textSecondary}}>
                    {selectedLead.email || selectedLead.lead_email || 'No email'}
                  </p>
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
                      
                      {/* 🆕 UPDATED: Custom Stage Dropdown using dynamic stages */}
                       <div className="relative stage-dropdown">
                        <button
                          type="button"
                          onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
                          className="w-full rounded-xl px-4 py-3 text-xl font-semibold transition-colors duration-300 flex items-center justify-between"
                          style={{backgroundColor: themeStyles.primaryBg, color: themeStyles.textPrimary, border: `1px solid ${themeStyles.border}`}}
                        >
                          <span>{crmStages.find(s => s.name === editFields.stage)?.name || editFields.stage}</span>
                          <ChevronDown className={`w-6 h-6 transition-transform duration-200 ${stageDropdownOpen ? 'rotate-180' : ''}`} style={{color: themeStyles.textMuted}} />
                        </button>
                        
                        {stageDropdownOpen && (
                          <div 
                            className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-xl z-50 overflow-hidden"
                            style={{backgroundColor: themeStyles.primaryBg, border: `1px solid ${themeStyles.border}`}}
                          >
                            {crmStages.map((stage) => (
                              <button
                                key={stage.id}
                                type="button"
                                onClick={() => {
                                  handleFieldChange('stage', stage.name);
                                  setStageDropdownOpen(false);
                                }}
                                className="w-full px-4 py-4 text-left transition-all duration-200 flex items-center justify-between hover:opacity-80"
                                style={{
                                  backgroundColor: editFields.stage === stage.name ? `${stage.color}20` : 'transparent',
                                  borderBottom: `1px solid ${themeStyles.border}`
                                }}
                              >
                                <span 
                                  className="font-semibold text-lg"
                                  style={{color: stage.color}}
                                >
                                  {stage.name}
                                </span>
                                {editFields.stage === stage.name && (
                                  <CheckCircle className="w-5 h-5 ml-auto" style={{color: stage.color}} />
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

// 🆕 NEW: Stage Editor Modal Component
const StageEditorModal = ({ brandId, crmStages, setCrmStages, themeStyles, onClose, setToast }) => {
  const [editStages, setEditStages] = useState(crmStages.map(s => ({ ...s })));
  const [saving, setSaving] = useState(false);

  const addStage = () => {
    const newStage = {
      id: `new-${Date.now()}`,
      name: 'New Stage',
      color: '#6B7280',
      order_position: editStages.length + 1,
      lead_count: 0
    };
    setEditStages([...editStages, newStage]);
  };

  const removeStage = (stageId) => {
    setEditStages(editStages.filter(s => s.id !== stageId));
  };

  const updateStage = (stageId, field, value) => {
    setEditStages(editStages.map(s => 
      s.id === stageId ? { ...s, [field]: value } : s
    ));
  };

  const resetToDefaults = () => {
    const defaultStages = [
      { id: 'reset-1', name: 'Interested', color: '#6B7280', order_position: 1, lead_count: 0 },
      { id: 'reset-2', name: 'Call Booked', color: '#3B82F6', order_position: 2, lead_count: 0 },
      { id: 'reset-3', name: 'Proposal Sent', color: '#8B5CF6', order_position: 3, lead_count: 0 },
      { id: 'reset-4', name: 'Follow Up', color: '#F59E0B', order_position: 4, lead_count: 0 },
      { id: 'reset-5', name: 'Closed Won', color: '#10B981', order_position: 5, lead_count: 0 },
      { id: 'reset-6', name: 'Closed Lost', color: '#EF4444', order_position: 6, lead_count: 0 },
      { id: 'reset-7', name: 'Nurture', color: '#06B6D4', order_position: 7, lead_count: 0 }
    ];
    setEditStages(defaultStages);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      // Prepare stages data (without lead_count)
      const stagesToSave = editStages.map((stage, index) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        order_position: index + 1
      }));

      const { error } = await supabase.rpc('update_crm_config', {
        brand_uuid: brandId,
        new_stages: stagesToSave
      });

      if (error) throw error;

      // Update local state
      setCrmStages(editStages);
      setToast({ type: 'success', message: 'CRM stages updated successfully!' });
      onClose();
    } catch (error) {
      console.error('❌ Error saving CRM stages:', error);
      setToast({ type: 'error', message: 'Error saving stages: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl"
        style={{
          backgroundColor: themeStyles.secondaryBg,
          border: `1px solid ${themeStyles.border}`,
          margin: '20px'
        }}
      >
        {/* Header */}
        <div className="p-6 border-b" style={{borderColor: themeStyles.border}}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold" style={{color: themeStyles.textPrimary}}>
              Edit CRM Stages
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:opacity-80"
              style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textMuted}}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4 mb-6">
            {editStages.map((stage, index) => (
              <div
                key={stage.id}
                className="flex items-center gap-4 p-4 rounded-lg"
                style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}
              >
                {/* Order */}
                <div className="w-8 text-center font-medium" style={{color: themeStyles.textMuted}}>
                  {index + 1}
                </div>

                {/* Name */}
                <input
                  type="text"
                  value={stage.name}
                  onChange={(e) => updateStage(stage.id, 'name', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: themeStyles.primaryBg,
                    color: themeStyles.textPrimary,
                    border: `1px solid ${themeStyles.border}`
                  }}
                />

                {/* Color Picker */}
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) => updateStage(stage.id, 'color', e.target.value)}
                    className="w-10 h-10 rounded-lg border cursor-pointer"
                    style={{border: `1px solid ${themeStyles.border}`}}
                  />
                  <Palette className="w-4 h-4" style={{color: themeStyles.textMuted}} />
                </div>

                {/* Lead Count (Read-only) */}
                <div 
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: `${stage.color}20`,
                    color: stage.color
                  }}
                >
                  {stage.lead_count} leads
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeStage(stage.id)}
                  className="p-2 rounded-lg hover:opacity-80"
                  style={{
                    backgroundColor: `${themeStyles.error}20`,
                    color: themeStyles.error
                  }}
                  disabled={editStages.length <= 1}
                  title={editStages.length <= 1 ? "Cannot remove the last stage" : "Remove stage"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <button
                onClick={addStage}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: themeStyles.tertiaryBg,
                  color: themeStyles.textPrimary,
                  border: `1px solid ${themeStyles.border}`
                }}
              >
                <Plus className="w-4 h-4" />
                Add Stage
              </button>
              
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: `${themeStyles.warning}20`,
                  color: themeStyles.warning,
                  border: `1px solid ${themeStyles.warning}`
                }}
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Defaults
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: themeStyles.tertiaryBg,
                  color: themeStyles.textPrimary,
                  border: `1px solid ${themeStyles.border}`
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={saveChanges}
                disabled={saving}
                className="px-6 py-2 rounded-lg transition-colors font-medium"
                style={{
                  backgroundColor: themeStyles.success,
                  color: '#FFFFFF'
                }}
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </div>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRMManager;