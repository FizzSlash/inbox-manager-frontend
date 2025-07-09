import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Users, CheckCircle, Phone, BarChart3, Search } from 'lucide-react';

const CRMManager = ({ brandId }) => {
  const [crmLeads, setCrmLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

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
          <div className="p-8 text-center text-lg text-gray-300">Loading CRM leads...</div>
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
                <tr key={lead.id} className="border-t border-gray-700 hover:bg-[#232a2e] transition-colors">
                  <td className="px-4 py-2 font-medium">{lead.first_name} {lead.last_name}</td>
                  <td className="px-4 py-2">{lead.email}</td>
                  <td className="px-4 py-2">{lead.calls_booked}</td>
                  <td className="px-4 py-2">{lead.show_rate ? `${lead.show_rate}%` : '-'}</td>
                  <td className="px-4 py-2">{lead.close_rate ? `${lead.close_rate}%` : '-'}</td>
                  <td className="px-4 py-2">${lead.revenue_collected?.toLocaleString() || 0}</td>
                  <td className="px-4 py-2">{lead.status}</td>
                  <td className="px-4 py-2">{lead.notes}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleMoveToInbox(lead)}
                      className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-xs"
                    >
                      Move to Inbox
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CRMManager; 