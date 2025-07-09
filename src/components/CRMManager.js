import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Users, DollarSign, CheckCircle, BarChart3, Search, Edit3, Loader2, X, Mail, ChevronDown, Phone } from 'lucide-react';

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
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const fetchCrmLeads = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('retention_harbor')
        .select('*')
        .eq('brand_id', brandId)
        .eq('status', 'CRM')
        .order('created_at', { ascending: false });
      if (error) {
        setToast({ type: 'error', message: 'Error fetching CRM leads: ' + error.message });
      } else {
        setCrmLeads(data);
      }
      setLoading(false);
    };
    if (brandId) fetchCrmLeads();
  }, [brandId]);

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
    } catch (err) {
      setToast({ type: 'error', message: 'Error moving lead to Inbox: ' + err.message });
    }
  };

  // Inline edit handlers
  const startEdit = (lead) => {
    setEditingId(lead.id);
    setEditFields({
      stage: lead.stage || 'Lead',
      call_booked: !!lead.call_booked,
      deal_size: lead.deal_size || 0,
      closed: !!lead.closed,
      notes: lead.notes || ''
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditFields({});
  };
  const handleFieldChange = (field, value) => {
    setEditFields(prev => ({ ...prev, [field]: value }));
  };
  const saveEdit = async (lead) => {
    setSavingId(lead.id);
    try {
      const { error } = await supabase
        .from('retention_harbor')
        .update(editFields)
        .eq('id', lead.id);
      if (error) throw error;
      setCrmLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...editFields } : l));
      setToast({ type: 'success', message: 'Lead updated!' });
      setEditingId(null);
      setEditFields({});
    } catch (err) {
      setToast({ type: 'error', message: 'Error saving lead: ' + err.message });
    } finally {
      setSavingId(null);
    }
  };

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

  return (
    <div className="p-8 min-h-screen bg-[#181A1B] text-white">
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
      {/* Card List of Leads */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-lg text-gray-300 flex items-center justify-center gap-2"><Loader2 className="animate-spin w-6 h-6" /> Loading CRM leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="col-span-full p-8 text-center text-lg text-gray-300">No CRM leads found.</div>
        ) : (
          filteredLeads.map(lead => (
            <div key={lead.id} className={`rounded-2xl bg-[#232526] shadow-lg p-6 flex flex-col gap-4 relative transition-all ${editingId === lead.id ? 'ring-2 ring-accent' : ''}`}> 
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-6 h-6 text-accent" />
                <span className="text-xl font-bold">{lead.first_name} {lead.last_name}</span>
                <span className="ml-auto inline-block px-2 py-1 rounded-full text-xs font-semibold bg-blue-900 text-blue-300">{lead.stage}</span>
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Stage</label>
                  {editingId === lead.id ? (
                    <select className="rounded bg-[#181A1B] px-3 py-2 text-base" value={editFields.stage} onChange={e => handleFieldChange('stage', e.target.value)}>
                      {STAGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <span className="text-base font-semibold">{lead.stage}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Call Booked</label>
                  {editingId === lead.id ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!editFields.call_booked} onChange={e => handleFieldChange('call_booked', e.target.checked)} className="w-5 h-5" />
                      <span className="text-base">{editFields.call_booked ? 'Yes' : 'No'}</span>
                    </label>
                  ) : (
                    <span className="text-base">{lead.call_booked ? 'Yes' : 'No'}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Deal Size</label>
                  {editingId === lead.id ? (
                    <input type="number" className="rounded bg-[#181A1B] px-3 py-2 text-base w-32" value={editFields.deal_size} onChange={e => handleFieldChange('deal_size', Number(e.target.value))} />
                  ) : (
                    <span className="text-base font-semibold">${lead.deal_size?.toLocaleString() || 0}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Closed</label>
                  {editingId === lead.id ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!editFields.closed} onChange={e => handleFieldChange('closed', e.target.checked)} className="w-5 h-5" />
                      <span className="text-base">{editFields.closed ? 'Yes' : 'No'}</span>
                    </label>
                  ) : (
                    <span className="text-base">{lead.closed ? 'Yes' : 'No'}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <label className="text-xs text-gray-400">Notes</label>
                {editingId === lead.id ? (
                  <textarea className="rounded bg-[#181A1B] px-3 py-2 text-base min-h-[60px]" value={editFields.notes} onChange={e => handleFieldChange('notes', e.target.value)} />
                ) : (
                  <span className="text-base block whitespace-pre-line">{lead.notes}</span>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                {editingId === lead.id ? (
                  <>
                    <button className="px-4 py-2 rounded bg-green-600 text-white text-base font-semibold" onClick={() => saveEdit(lead)} disabled={savingId === lead.id}>{savingId === lead.id ? <Loader2 className="animate-spin w-5 h-5" /> : 'Save'}</button>
                    <button className="px-4 py-2 rounded bg-gray-600 text-white text-base font-semibold" onClick={cancelEdit}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="px-4 py-2 rounded bg-blue-600 text-white text-base font-semibold flex items-center gap-2" onClick={() => startEdit(lead)} title="Edit"><Edit3 className="w-5 h-5" /> Edit</button>
                    <button className="px-4 py-2 rounded bg-indigo-700 text-white text-base font-semibold" onClick={() => handleMoveToInbox(lead)}>Move to Inbox</button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CRMManager; 