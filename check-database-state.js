const { createClient } = require('@supabase/supabase-js');

// Your actual Supabase config
const supabaseUrl = 'https://xajedwcurzdgzrlnrcqi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhamVkd2N1cnpkZ3pybG5yY3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5ODYwMTgsImV4cCI6MjA2MjU2MjAxOH0.lXFmMWHLpwGVZo2VWbtmAZFaiPnLAm1sZkBXpik2mpY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseState() {
  console.log('🔍 Checking Database State...\n');

  try {
    // 1. Check table columns for retention_harbor
    console.log('=== RETENTION_HARBOR TABLE STRUCTURE ===');
    const { data: retentionCols, error: retentionError } = await supabase
      .from('retention_harbor')
      .select('*')
      .limit(1);
    
    if (retentionError) {
      console.log('❌ Error accessing retention_harbor:', retentionError.message);
    } else {
      console.log('✅ Available columns:', Object.keys(retentionCols[0] || {}));
    }

    // 2. Check brands table
    console.log('\n=== BRANDS TABLE ===');
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('*');
    
    if (brandsError) {
      console.log('❌ Error accessing brands:', brandsError.message);
    } else {
      console.log('✅ Brand data:', brands);
      if (brands[0]) {
        console.log('✅ Brand columns:', Object.keys(brands[0]));
      }
    }

    // 3. Check CRM settings
    console.log('\n=== CRM_SETTINGS TABLE ===');
    const { data: crmSettings, error: crmError } = await supabase
      .from('crm_settings')
      .select('*');
    
    if (crmError) {
      console.log('❌ Error accessing crm_settings:', crmError.message);
    } else {
      console.log('✅ CRM settings data:', crmSettings);
      if (crmSettings[0]) {
        console.log('✅ CRM columns:', Object.keys(crmSettings[0]));
      }
    }

    // 4. Check navvii_ai_settings
    console.log('\n=== NAVVII_AI_SETTINGS TABLE ===');
    const { data: aiSettings, error: aiError } = await supabase
      .from('navvii_ai_settings')
      .select('*');
    
    if (aiError) {
      console.log('❌ Error accessing navvii_ai_settings:', aiError.message);
    } else {
      console.log('✅ AI settings data:', aiSettings);
      if (aiSettings[0]) {
        console.log('✅ AI columns:', Object.keys(aiSettings[0]));
      }
    }

    // 5. Check api_settings
    console.log('\n=== API_SETTINGS TABLE ===');
    const { data: apiSettings, error: apiError } = await supabase
      .from('api_settings')
      .select('*');
    
    if (apiError) {
      console.log('❌ Error accessing api_settings:', apiError.message);
    } else {
      console.log('✅ API settings data:', apiSettings);
      if (apiSettings[0]) {
        console.log('✅ API columns:', Object.keys(apiSettings[0]));
      }
    }

    // 6. Check upgrade_attempts
    console.log('\n=== UPGRADE_ATTEMPTS TABLE ===');
    const { data: upgradeAttempts, error: upgradeError } = await supabase
      .from('upgrade_attempts')
      .select('*')
      .limit(5);
    
    if (upgradeError) {
      console.log('❌ Error accessing upgrade_attempts:', upgradeError.message);
    } else {
      console.log('✅ Upgrade attempts count:', upgradeAttempts?.length || 0);
      if (upgradeAttempts[0]) {
        console.log('✅ Upgrade columns:', Object.keys(upgradeAttempts[0]));
      }
    }

    // 7. Check relationships
    console.log('\n=== CHECKING RELATIONSHIPS ===');
    const { data: retentionWithBrand, error: relationError } = await supabase
      .from('retention_harbor')
      .select('brand_id, lead_email')
      .limit(1);
    
    if (relationError) {
      console.log('❌ Error checking retention_harbor brand_id:', relationError.message);
    } else {
      console.log('✅ Sample retention_harbor brand_id:', retentionWithBrand[0]?.brand_id || 'NULL');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkDatabaseState();