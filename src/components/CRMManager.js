import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const CRMManager = ({ brandId }) => {
  const [crmLeads, setCrmLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCrmLeads = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });
      if (error) {
        alert('Error fetching CRM leads: ' + error.message);
      } else {
        setCrmLeads(data);
      }
      setLoading(false);
    };
    if (brandId) fetchCrmLeads();
  }, [brandId]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">CRM Leads</h2>
      {loading ? (
        <div>Loading...</div>
      ) : crmLeads.length === 0 ? (
        <div>No CRM leads found.</div>
      ) : (
        <table className="min-w-full bg-gray-900 text-white rounded-lg overflow-hidden">
          <thead>
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Calls Booked</th>
              <th className="px-4 py-2">Show Rate</th>
              <th className="px-4 py-2">Close Rate</th>
              <th className="px-4 py-2">Revenue</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {crmLeads.map(lead => (
              <tr key={lead.id} className="border-t border-gray-700">
                <td className="px-4 py-2">{lead.first_name} {lead.last_name}</td>
                <td className="px-4 py-2">{lead.email}</td>
                <td className="px-4 py-2">{lead.calls_booked}</td>
                <td className="px-4 py-2">{lead.show_rate ? `${lead.show_rate}%` : '-'}</td>
                <td className="px-4 py-2">{lead.close_rate ? `${lead.close_rate}%` : '-'}</td>
                <td className="px-4 py-2">${lead.revenue_collected?.toLocaleString() || 0}</td>
                <td className="px-4 py-2">{lead.status}</td>
                <td className="px-4 py-2">{lead.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CRMManager; 