import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Users, DollarSign, CheckCircle, BarChart3, Search, Edit3, Loader2, X, Mail, Phone } from 'lucide-react';

// ThemeStyles and dark mode detection (copied from InboxManager)
const getThemeStyles = () => {
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDarkMode ? {
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
  'Lead',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Closed Won',
  'Closed Lost',
  'Nurture'
];

const CRMManager = ({ brandId, onGoToInboxLead = () => {} }) => {
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
  const [themeStyles, setThemeStyles] = useState(getThemeStyles());

  useEffect(() => {
    const fetchCrmLeads = async () => {
      setLoading(true);
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
    if (brandId) fetchCrmLeads();
  }, [brandId, sort]);

  useEffect(() => {
    const updateTheme = () => setThemeStyles(getThemeStyles());
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
    return () => window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', updateTheme);
  }, []);

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

  // Refactor main return:
  if (selectedLead) {
    return (
      <div className="flex min-h-screen" style={{backgroundColor: themeStyles.primaryBg}}>
        {/* Side Panel (left half) */}
        <div className="w-1/2 h-full flex flex-col shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, borderRadius: '12px', margin: '8px', border: `1px solid ${themeStyles.border}`}}>
          {/* Lead Header and content (copy from previous side panel, keep themeStyles, paddings, etc) */}
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
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onGoToInboxLead(selectedLead.id)}
                  className="px-4 py-2 rounded-lg transition-colors duration-300 flex items-center gap-2 text-sm bg-indigo-700 text-white hover:bg-indigo-800"
                >
                  Go to lead in Inbox
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
              {/* Unified Lead Information Section */}
              <div className="rounded-2xl p-6 shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <label className="block text-lg font-medium mb-2" style={{color: themeStyles.textSecondary}}>Stage</label>
                    <select className="w-full rounded-xl px-4 py-3 text-xl font-semibold transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg, color: themeStyles.textPrimary, border: `1px solid ${themeStyles.border}`}} value={editFields.stage} onChange={e => handleFieldChange('stage', e.target.value)}>
                      {STAGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
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
                  <textarea className="w-full rounded-xl px-4 py-3 text-xl min-h-[120px] transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg, color: themeStyles.textPrimary, border: `1px solid ${themeStyles.border}`}} value={editFields.notes} onChange={e => handleFieldChange('notes', e.target.value)} />
                </div>
                <div className="flex gap-4 mt-auto">
                  <button className="px-8 py-4 rounded-xl font-bold shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.success, color: '#fff', fontSize: '1.25rem'}} onClick={saveEdit} disabled={savingId === selectedLead.id}>{savingId === selectedLead.id ? <Loader2 className="animate-spin w-7 h-7" /> : 'Save Changes'}</button>
                  <button onClick={handleRemoveFromCRM} className="px-8 py-4 rounded-xl font-bold shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.error, color: '#fff', fontSize: '1.25rem'}} disabled={savingId === selectedLead.id}>{savingId === selectedLead.id ? <Loader2 className="animate-spin w-7 h-7" /> : 'Remove from CRM'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* CRM Table/Dashboard (right half) */}
        <div className="w-1/2 p-8" style={{backgroundColor: themeStyles.primaryBg}}>
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-accent" /> CRM Dashboard
          </h2>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
            <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
              <Users className="w-7 h-7 mb-2 text-blue-400" />
              <div className="text-2xl font-bold">{stats ? stats.totalLeads : 0}</div>
              <div className="text-sm text-gray-400">Total Leads</div>
            </div>
            <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
              <CheckCircle className="w-7 h-7 mb-2 text-green-400" />
              <div className="text-2xl font-bold">{stats ? stats.totalClosed : 0}</div>
              <div className="text-sm text-gray-400">Total Closed</div>
            </div>
            <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
              <DollarSign className="w-7 h-7 mb-2 text-yellow-400" />
              <div className="text-2xl font-bold">${stats ? stats.totalDealSize.toLocaleString() : 0}</div>
              <div className="text-sm text-gray-400">Total Deal Size</div>
            </div>
            <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
              <Phone className="w-7 h-7 mb-2 text-cyan-400" />
              <div className="text-2xl font-bold">{stats ? stats.totalCalls : 0}</div>
              <div className="text-sm text-gray-400">Calls Booked</div>
            </div>
            <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
              <BarChart3 className="w-7 h-7 mb-2 text-purple-400" />
              <div className="text-2xl font-bold">{stats ? stats.winRate.toFixed(1) : 0}%</div>
              <div className="text-sm text-gray-400">Win Rate</div>
            </div>
          </div>
          {/* Search Bar */}
          <div className="flex items-center mb-6 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                className="w-full rounded-lg bg-[#232526] text-white px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                placeholder="Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            </div>
          </div>
          {/* Toast */}
          {toast && (
            <div className={`mb-4 px-4 py-2 rounded ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.message}</div>
          )}
          {/* Table of Leads */}
          <div className="overflow-x-auto rounded-xl shadow-lg bg-[#232526]">
            <table className="min-w-full text-white">
              <thead>
                <tr className="bg-[#1A1C1A] text-gray-300">
                  <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('first_name')}>Name {sort.field === 'first_name' && (sort.dir === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('stage')}>Stage {sort.field === 'stage' && (sort.dir === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('deal_size')}>Deal Size {sort.field === 'deal_size' && (sort.dir === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('call_booked')}>Call Booked {sort.field === 'call_booked' && (sort.dir === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('closed')}>Closed {sort.field === 'closed' && (sort.dir === 'asc' ? '▲' : '▼')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-lg text-gray-300"><Loader2 className="animate-spin w-6 h-6 inline" /> Loading CRM leads...</td></tr>
                ) : filteredLeads.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-lg text-gray-300">No CRM leads found.</td></tr>
                ) : (
                  filteredLeads.map(lead => (
                    <tr key={lead.id} className="border-t border-gray-700 hover:bg-[#232a2e] transition-colors cursor-pointer" onClick={() => openSidePanel(lead)}>
                      <td className="px-4 py-2 font-medium flex items-center gap-2"><Mail className="w-4 h-4 text-accent" /> {lead.first_name} {lead.last_name}</td>
                      <td className="px-4 py-2"><span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-blue-900 text-blue-300">{lead.stage}</span></td>
                      <td className="px-4 py-2">${lead.deal_size?.toLocaleString() || 0}</td>
                      <td className="px-4 py-2">{lead.call_booked ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-2">{lead.closed ? 'Yes' : 'No'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  // If no selectedLead, render CRM dashboard/table full width
  return (
    <div className="p-8 min-h-screen bg-[#181A1B] text-white relative">
      <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <BarChart3 className="w-7 h-7 text-accent" /> CRM Dashboard
      </h2>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
        <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
          <Users className="w-7 h-7 mb-2 text-blue-400" />
          <div className="text-2xl font-bold">{stats ? stats.totalLeads : 0}</div>
          <div className="text-sm text-gray-400">Total Leads</div>
        </div>
        <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
          <CheckCircle className="w-7 h-7 mb-2 text-green-400" />
          <div className="text-2xl font-bold">{stats ? stats.totalClosed : 0}</div>
          <div className="text-sm text-gray-400">Total Closed</div>
        </div>
        <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
          <DollarSign className="w-7 h-7 mb-2 text-yellow-400" />
          <div className="text-2xl font-bold">${stats ? stats.totalDealSize.toLocaleString() : 0}</div>
          <div className="text-sm text-gray-400">Total Deal Size</div>
        </div>
        <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
          <Phone className="w-7 h-7 mb-2 text-cyan-400" />
          <div className="text-2xl font-bold">{stats ? stats.totalCalls : 0}</div>
          <div className="text-sm text-gray-400">Calls Booked</div>
        </div>
        <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
          <BarChart3 className="w-7 h-7 mb-2 text-purple-400" />
          <div className="text-2xl font-bold">{stats ? stats.winRate.toFixed(1) : 0}%</div>
          <div className="text-sm text-gray-400">Win Rate</div>
        </div>
      </div>
      {/* Search Bar */}
      <div className="flex items-center mb-6 max-w-md">
        <div className="relative w-full">
          <input
            type="text"
            className="w-full rounded-lg bg-[#232526] text-white px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
        </div>
      </div>
      {/* Toast */}
      {toast && (
        <div className={`mb-4 px-4 py-2 rounded ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.message}</div>
      )}
      {/* Table of Leads */}
      <div className="overflow-x-auto rounded-xl shadow-lg bg-[#232526]">
        <table className="min-w-full text-white">
          <thead>
            <tr className="bg-[#1A1C1A] text-gray-300">
              <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('first_name')}>Name {sort.field === 'first_name' && (sort.dir === 'asc' ? '▲' : '▼')}</th>
              <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('stage')}>Stage {sort.field === 'stage' && (sort.dir === 'asc' ? '▲' : '▼')}</th>
              <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('deal_size')}>Deal Size {sort.field === 'deal_size' && (sort.dir === 'asc' ? '▲' : '▼')}</th>
              <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('call_booked')}>Call Booked {sort.field === 'call_booked' && (sort.dir === 'asc' ? '▲' : '▼')}</th>
              <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('closed')}>Closed {sort.field === 'closed' && (sort.dir === 'asc' ? '▲' : '▼')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-lg text-gray-300"><Loader2 className="animate-spin w-6 h-6 inline" /> Loading CRM leads...</td></tr>
            ) : filteredLeads.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-lg text-gray-300">No CRM leads found.</td></tr>
            ) : (
              filteredLeads.map(lead => (
                <tr key={lead.id} className="border-t border-gray-700 hover:bg-[#232a2e] transition-colors cursor-pointer" onClick={() => openSidePanel(lead)}>
                  <td className="px-4 py-2 font-medium flex items-center gap-2"><Mail className="w-4 h-4 text-accent" /> {lead.first_name} {lead.last_name}</td>
                  <td className="px-4 py-2"><span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-blue-900 text-blue-300">{lead.stage}</span></td>
                  <td className="px-4 py-2">${lead.deal_size?.toLocaleString() || 0}</td>
                  <td className="px-4 py-2">{lead.call_booked ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">{lead.closed ? 'Yes' : 'No'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CRMManager; 