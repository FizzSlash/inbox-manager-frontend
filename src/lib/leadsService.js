import { supabase } from './supabase';

// Lead service functions that work with Supabase and RLS
export const leadsService = {
  // Fetch leads for the current user (RLS will filter by brand_id)
  async fetchLeads() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch leads: ${error.message}`);
    }

    return data || [];
  },

  // Insert a new lead with brand_id set to current user's ID
  async insertLead(leadData) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const leadWithBrand = {
      ...leadData,
      brand_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('leads')
      .insert([leadWithBrand])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to insert lead: ${error.message}`);
    }

    return data;
  },

  // Update a lead (RLS will ensure user can only update their own leads)
  async updateLead(leadId, updates) {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update lead: ${error.message}`);
    }

    return data;
  },

  // Delete a lead (RLS will ensure user can only delete their own leads)
  async deleteLead(leadId) {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (error) {
      throw new Error(`Failed to delete lead: ${error.message}`);
    }

    return true;
  },

  // Update lead stage
  async updateLeadStage(leadId, newStage) {
    return this.updateLead(leadId, { stage: newStage });
  },

  // Add message to lead conversation
  async addMessage(leadId, message) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const messageData = {
      lead_id: leadId,
      content: message.content,
      html_content: message.htmlContent,
      sender: 'us',
      sent_at: new Date().toISOString(),
      brand_id: user.id
    };

    const { data, error } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add message: ${error.message}`);
    }

    return data;
  },

  // Fetch messages for a lead
  async fetchMessages(leadId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('sent_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return data || [];
  }
}; 