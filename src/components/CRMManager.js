import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Users, DollarSign, CheckCircle, BarChart3, Search, Edit3, Loader2, X, Mail, Phone } from 'lucide-react';

const STAGE_OPTIONS = [
  'Lead',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Closed Won',
  'Closed Lost',
  'Nurture'
];

const CRMManager = ({ brandId }) => {
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
  const handleMoveToInbox = async (lead) => {
    if (!lead || !brandId) return;
    try {
      const { error } = await supabase
        .from('retention_harbor')
        .update({ status: 'INBOX' })
        .eq('id', lead.id);
      if (error) throw error;
      setCrmLeads(prev => prev.filter(l => l.id !== lead.id));
      setToast({ type: 'success', message: 'Lead moved to Inbox!' });
      if (selectedLead && selectedLead.id === lead.id) closeSidePanel();
    } catch (err) {
      setToast({ type: 'error', message: 'Error moving lead to Inbox: ' + err.message });
    }
  };

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
      {/* Side Panel for Lead Details */}
      {sidePanelOpen && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
          <div className="w-full max-w-lg h-full bg-[#232526] shadow-2xl p-8 flex flex-col relative overflow-y-auto">
            <button className="absolute top-4 right-4 text-gray-400 hover:text-white" onClick={closeSidePanel}><X className="w-6 h-6" /></button>
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><Mail className="w-6 h-6 text-accent" /> {selectedLead.first_name} {selectedLead.last_name}</h3>
            <div className="mb-4 text-gray-300">{selectedLead.email}</div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Stage</label>
                {editing ? (
                  <select className="w-full rounded bg-[#181A1B] px-2 py-1" value={editFields.stage} onChange={e => handleFieldChange('stage', e.target.value)}>
                    {STAGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-blue-900 text-blue-300">{selectedLead.stage}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-6">
                {editing ? (
                  <><input type="checkbox" checked={!!editFields.call_booked} onChange={e => handleFieldChange('call_booked', e.target.checked)} /> <label className="text-xs text-gray-400">Call Booked</label></>
                ) : (
                  <><input type="checkbox" checked={!!selectedLead.call_booked} readOnly /> <label className="text-xs text-gray-400">Call Booked</label></>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Deal Size</label>
                {editing ? (
                  <input type="number" className="w-full rounded bg-[#181A1B] px-2 py-1" value={editFields.deal_size} onChange={e => handleFieldChange('deal_size', Number(e.target.value))} />
                ) : (
                  `$${selectedLead.deal_size?.toLocaleString() || 0}`
                )}
              </div>
              <div className="flex items-center gap-2 mt-6">
                {editing ? (
                  <><input type="checkbox" checked={!!editFields.closed} onChange={e => handleFieldChange('closed', e.target.checked)} /> <label className="text-xs text-gray-400">Closed</label></>
                ) : (
                  <><input type="checkbox" checked={!!selectedLead.closed} readOnly /> <label className="text-xs text-gray-400">Closed</label></>
                )}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              {editing ? (
                <textarea className="w-full rounded bg-[#181A1B] px-2 py-1 min-h-[80px]" value={editFields.notes} onChange={e => handleFieldChange('notes', e.target.value)} />
              ) : (
                <span className="block whitespace-pre-line text-base">{selectedLead.notes}</span>
              )}
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button className="px-4 py-2 rounded bg-green-600 text-white font-semibold" onClick={saveEdit} disabled={savingId === selectedLead.id}>{savingId === selectedLead.id ? <Loader2 className="animate-spin w-5 h-5" /> : 'Save Changes'}</button>
                  <button className="px-4 py-2 rounded bg-gray-600 text-white font-semibold" onClick={cancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="px-4 py-2 rounded bg-blue-600 text-white font-semibold flex items-center gap-2" onClick={startEdit}><Edit3 className="w-5 h-5" /> Edit</button>
                  <button className="px-4 py-2 rounded bg-indigo-700 text-white font-semibold ml-auto" onClick={() => handleMoveToInbox(selectedLead)}>Move to Inbox</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMManager; 