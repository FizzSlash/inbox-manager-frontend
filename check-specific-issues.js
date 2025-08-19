const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xajedwcurzdgzrlnrcqi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhamVkd2N1cnpkZ3pybG5yY3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5ODYwMTgsImV4cCI6MjA2MjU2MjAxOH0.lXFmMWHLpwGVZo2VWbtmAZFaiPnLAm1sZkBXpik2mpY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecificIssues() {
  console.log('🔍 Checking Specific Database Issues...\n');

  try {
    // 1. Count retention_harbor records and brand_id status
    console.log('=== RETENTION_HARBOR BRAND_ID STATUS ===');
    const { data: countData, error: countError } = await supabase
      .from('retention_harbor')
      .select('brand_id', { count: 'exact' });
    
    if (countError) {
      console.log('❌ Error counting retention_harbor:', countError.message);
    } else {
      console.log('✅ Total retention_harbor records:', countData.length);
      const withBrandId = countData.filter(row => row.brand_id !== null).length;
      const withoutBrandId = countData.filter(row => row.brand_id === null).length;
      console.log(`✅ Records WITH brand_id: ${withBrandId}`);
      console.log(`❌ Records WITHOUT brand_id: ${withoutBrandId}`);
      
      if (countData.length > 0) {
        console.log('Sample brand_id values:', countData.slice(0, 5).map(r => r.brand_id));
      }
    }

    // 2. Check api_settings structure and data
    console.log('\n=== API_SETTINGS DETAILED CHECK ===');
    const { data: apiData, error: apiError } = await supabase
      .from('api_settings')
      .select('*');
    
    if (apiError) {
      console.log('❌ Error accessing api_settings:', apiError.message);
    } else {
      console.log('✅ API settings records:', apiData.length);
      if (apiData.length > 0) {
        console.log('✅ API settings data:', apiData[0]);
        console.log('✅ API columns:', Object.keys(apiData[0]));
      } else {
        console.log('❌ API settings table is EMPTY');
      }
    }

    // 3. Get a sample retention_harbor record to see all columns
    console.log('\n=== RETENTION_HARBOR COLUMNS CHECK ===');
    const { data: sampleData, error: sampleError } = await supabase
      .from('retention_harbor')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.log('❌ Error getting retention_harbor sample:', sampleError.message);
    } else if (sampleData && sampleData.length > 0) {
      console.log('✅ retention_harbor columns:', Object.keys(sampleData[0]));
      console.log('✅ Sample record (first 10 fields):', 
        Object.fromEntries(Object.entries(sampleData[0]).slice(0, 10))
      );
    } else {
      console.log('❌ retention_harbor table appears to be empty or inaccessible');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkSpecificIssues();