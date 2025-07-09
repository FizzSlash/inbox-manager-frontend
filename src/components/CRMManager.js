import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Users, CheckCircle, Phone, BarChart3, Search, Edit3, Loader2, X, Mail } from 'lucide-react';

const CRMManager = ({ brandId }) => {
  const [crmLeads, setCrmLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

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
      if (selectedLead && selectedLead.id === lead.id) setSidePanelOpen(false);
    } catch (err) {
      setToast({ type: 'error', message: 'Error moving lead to Inbox: ' + err.message });
    }
  };

  // Inline edit handlers
  const startEdit = (lead) => {
    setEditingId(lead.id);
    setEditFields({
      calls_booked: lead.calls_booked || 0,
      show_rate: lead.show_rate || '',
      close_rate: lead.close_rate || '',
      revenue_collected: lead.revenue_collected || 0,
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

  // Side panel logic
  const openSidePanel = (lead) => {
    setSelectedLead(lead);
    setSidePanelOpen(true);
  };
  const closeSidePanel = () => {
    setSelectedLead(null);
    setSidePanelOpen(false);
  };
  const saveSidePanel = async () => {
    if (!selectedLead) return;
    setSavingId(selectedLead.id);
    try {
      const { error } = await supabase
        .from('retention_harbor')
        .update(selectedLead)
        .eq('id', selectedLead.id);
      if (error) throw error;
      setCrmLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...selectedLead } : l));
      setToast({ type: 'success', message: 'Lead updated!' });
      setSidePanelOpen(false);
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
    const totalRevenue = crmLeads.reduce((sum, l) => sum + (l.revenue_collected || 0), 0);
    const avgCloseRate = crmLeads.reduce((sum, l) => sum + (l.close_rate || 0), 0) / totalLeads;
    const avgShowRate = crmLeads.reduce((sum, l) => sum + (l.show_rate || 0), 0) / totalLeads;
    const totalCalls = crmLeads.reduce((sum, l) => sum + (l.calls_booked || 0), 0);
    return {
      totalLeads,
      totalRevenue,
      avgCloseRate,
      avgShowRate,
      totalCalls
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
          <DollarSign className="w-7 h-7 mb-2 text-green-400" />
          <div className="text-2xl font-bold">${stats ? stats.totalRevenue.toLocaleString() : 0}</div>
          <div className="text-sm text-gray-400">Total Revenue</div>
        </div>
        <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
          <CheckCircle className="w-7 h-7 mb-2 text-purple-400" />
          <div className="text-2xl font-bold">{stats ? stats.avgCloseRate.toFixed(1) : 0}%</div>
          <div className="text-sm text-gray-400">Avg Close Rate</div>
        </div>
        <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
          <Phone className="w-7 h-7 mb-2 text-yellow-400" />
          <div className="text-2xl font-bold">{stats ? stats.totalCalls : 0}</div>
          <div className="text-sm text-gray-400">Calls Booked</div>
        </div>
        <div className="rounded-xl bg-[#232526] p-6 flex flex-col items-center shadow-lg">
          <BarChart3 className="w-7 h-7 mb-2 text-cyan-400" />
          <div className="text-2xl font-bold">{stats ? stats.avgShowRate.toFixed(1) : 0}%</div>
          <div className="text-sm text-gray-400">Avg Show Rate</div>
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
      {/* Leads Table */}
      <div className="overflow-x-auto rounded-xl shadow-lg bg-[#232526]">
        {loading ? (
          <div className="p-8 text-center text-lg text-gray-300 flex items-center justify-center gap-2"><Loader2 className="animate-spin w-6 h-6" /> Loading CRM leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-lg text-gray-300">No CRM leads found.</div>
        ) : (
          <table className="min-w-full text-white">
            <thead>
              <tr className="bg-[#1A1C1A] text-gray-300">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Calls Booked</th>
                <th className="px-4 py-2">Show Rate</th>
                <th className="px-4 py-2">Close Rate</th>
                <th className="px-4 py-2">Revenue</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => (
                <tr key={lead.id} className={`border-t border-gray-700 hover:bg-[#232a2e] transition-colors ${editingId === lead.id ? 'bg-[#232a2e]' : ''}`}
                  onClick={e => { if (e.target.tagName !== 'BUTTON') openSidePanel(lead); }}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="px-4 py-2 font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-accent" /> {lead.first_name} {lead.last_name}
                  </td>
                  <td className="px-4 py-2">{lead.email}</td>
                  <td className="px-4 py-2">
                    {editingId === lead.id ? (
                      <input type="number" className="w-16 rounded bg-[#181A1B] px-2 py-1" value={editFields.calls_booked} onChange={e => handleFieldChange('calls_booked', Number(e.target.value))} />
                    ) : (
                      lead.calls_booked
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === lead.id ? (
                      <input type="number" className="w-16 rounded bg-[#181A1B] px-2 py-1" value={editFields.show_rate} onChange={e => handleFieldChange('show_rate', Number(e.target.value))} />
                    ) : (
                      lead.show_rate ? `${lead.show_rate}%` : '-'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === lead.id ? (
                      <input type="number" className="w-16 rounded bg-[#181A1B] px-2 py-1" value={editFields.close_rate} onChange={e => handleFieldChange('close_rate', Number(e.target.value))} />
                    ) : (
                      lead.close_rate ? `${lead.close_rate}%` : '-'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === lead.id ? (
                      <input type="number" className="w-20 rounded bg-[#181A1B] px-2 py-1" value={editFields.revenue_collected} onChange={e => handleFieldChange('revenue_collected', Number(e.target.value))} />
                    ) : (
                      `$${lead.revenue_collected?.toLocaleString() || 0}`
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-blue-900 text-blue-300">{lead.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    {editingId === lead.id ? (
                      <input type="text" className="w-32 rounded bg-[#181A1B] px-2 py-1" value={editFields.notes} onChange={e => handleFieldChange('notes', e.target.value)} />
                    ) : (
                      <span className="truncate max-w-xs block" title={lead.notes}>{lead.notes}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    {editingId === lead.id ? (
                      <>
                        <button className="px-2 py-1 rounded bg-green-600 text-white text-xs" onClick={e => { e.stopPropagation(); saveEdit(lead); }} disabled={savingId === lead.id}>{savingId === lead.id ? <Loader2 className="animate-spin w-4 h-4" /> : 'Save'}</button>
                        <button className="px-2 py-1 rounded bg-gray-600 text-white text-xs" onClick={e => { e.stopPropagation(); cancelEdit(); }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="px-2 py-1 rounded bg-blue-600 text-white text-xs" onClick={e => { e.stopPropagation(); startEdit(lead); }} title="Edit"><Edit3 className="w-4 h-4 inline" /></button>
                        <button className="px-2 py-1 rounded bg-indigo-700 text-white text-xs font-semibold" onClick={e => { e.stopPropagation(); handleMoveToInbox(lead); }}>Move to Inbox</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
                <label className="block text-xs text-gray-400 mb-1">Calls Booked</label>
                <input type="number" className="w-full rounded bg-[#181A1B] px-2 py-1" value={selectedLead.calls_booked || 0} onChange={e => setSelectedLead(l => ({ ...l, calls_booked: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Show Rate (%)</label>
                <input type="number" className="w-full rounded bg-[#181A1B] px-2 py-1" value={selectedLead.show_rate || ''} onChange={e => setSelectedLead(l => ({ ...l, show_rate: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Close Rate (%)</label>
                <input type="number" className="w-full rounded bg-[#181A1B] px-2 py-1" value={selectedLead.close_rate || ''} onChange={e => setSelectedLead(l => ({ ...l, close_rate: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Revenue Collected</label>
                <input type="number" className="w-full rounded bg-[#181A1B] px-2 py-1" value={selectedLead.revenue_collected || 0} onChange={e => setSelectedLead(l => ({ ...l, revenue_collected: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea className="w-full rounded bg-[#181A1B] px-2 py-1 min-h-[80px]" value={selectedLead.notes || ''} onChange={e => setSelectedLead(l => ({ ...l, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded bg-green-600 text-white font-semibold" onClick={saveSidePanel} disabled={savingId === selectedLead.id}>{savingId === selectedLead.id ? <Loader2 className="animate-spin w-5 h-5" /> : 'Save Changes'}</button>
              <button className="px-4 py-2 rounded bg-gray-600 text-white font-semibold" onClick={closeSidePanel}>Cancel</button>
              <button className="px-4 py-2 rounded bg-indigo-700 text-white font-semibold ml-auto" onClick={() => handleMoveToInbox(selectedLead)}>Move to Inbox</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMManager; 