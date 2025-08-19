-- ====================================================================
-- CRM SETTINGS TABLE - Store CRM configuration as JSON
-- ====================================================================

-- Create CRM settings table for dynamic stage/status configuration
CREATE TABLE IF NOT EXISTS crm_settings (
  id SERIAL PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  setting_type TEXT NOT NULL DEFAULT 'pipeline_stages',
  configuration JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, setting_type)
);

-- Insert default CRM pipeline configuration
INSERT INTO crm_settings (brand_id, setting_type, configuration)
SELECT 
  id as brand_id,
  'pipeline_stages',
  '[
    { "value": "Lead", "label": "Lead", "color": "#9CA3AF", "order": 1 },
    { "value": "Contacted", "label": "Contacted", "color": "#3B82F6", "order": 2 },
    { "value": "Qualified", "label": "Qualified", "color": "#8B5CF6", "order": 3 },
    { "value": "Proposal Sent", "label": "Proposal Sent", "color": "#F59E0B", "order": 4 },
    { "value": "Closed Won", "label": "Closed Won", "color": "#10B981", "order": 5 },
    { "value": "Closed Lost", "label": "Closed Lost", "color": "#EF4444", "order": 6 },
    { "value": "Nurture", "label": "Nurture", "color": "#06B6D4", "order": 7 }
  ]'::jsonb
FROM brands
WHERE NOT EXISTS (
  SELECT 1 FROM crm_settings 
  WHERE crm_settings.brand_id = brands.id 
  AND crm_settings.setting_type = 'pipeline_stages'
);

-- Insert default lead stages configuration (from InboxManager)
INSERT INTO crm_settings (brand_id, setting_type, configuration)
SELECT 
  id as brand_id,
  'lead_stages',
  '[
    { "value": "initial-outreach", "label": "Initial Outreach", "color": "#9CA3AF", "order": 1 },
    { "value": "engaged", "label": "Engaged", "color": "#3B82F6", "order": 2 },
    { "value": "pricing-discussion", "label": "Pricing Discussion", "color": "#8B5CF6", "order": 3 },
    { "value": "samples-requested", "label": "Samples Requested", "color": "#F59E0B", "order": 4 },
    { "value": "call-scheduled", "label": "Call Scheduled", "color": "#10B981", "order": 5 },
    { "value": "considering", "label": "Considering", "color": "#06B6D4", "order": 6 },
    { "value": "stalled", "label": "Stalled", "color": "#F59E0B", "order": 7 },
    { "value": "no-response", "label": "No Response", "color": "#9CA3AF", "order": 8 },
    { "value": "rejected", "label": "Rejected", "color": "#EF4444", "order": 9 },
    { "value": "active", "label": "Active", "color": "#10B981", "order": 10 }
  ]'::jsonb
FROM brands
WHERE NOT EXISTS (
  SELECT 1 FROM crm_settings 
  WHERE crm_settings.brand_id = brands.id 
  AND crm_settings.setting_type = 'lead_stages'
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_settings_brand_id ON crm_settings (brand_id);
CREATE INDEX IF NOT EXISTS idx_crm_settings_type ON crm_settings (setting_type);

-- Function to get CRM settings
CREATE OR REPLACE FUNCTION get_crm_settings(brand_uuid UUID, setting_name TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT configuration INTO result
  FROM crm_settings
  WHERE brand_id = brand_uuid AND setting_type = setting_name;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to update CRM settings
CREATE OR REPLACE FUNCTION update_crm_settings(
  brand_uuid UUID, 
  setting_name TEXT, 
  new_config JSONB
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO crm_settings (brand_id, setting_type, configuration, updated_at)
  VALUES (brand_uuid, setting_name, new_config, NOW())
  ON CONFLICT (brand_id, setting_type)
  DO UPDATE SET 
    configuration = new_config,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

SELECT 'CRM Settings table created with JSON configuration! ✅' as status;