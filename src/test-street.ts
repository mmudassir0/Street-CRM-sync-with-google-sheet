import { StreetClient } from './street-client';
import { getConfig } from './config';

async function main() {
  console.log('====================================================');
  console.log(' Street CRM API Sandbox Connection Test');
  console.log('====================================================\n');

  let config;
  try {
    config = getConfig();
  } catch (err: any) {
    console.error('❌ Configuration error:', err.message);
    process.exit(1);
  }

  if (!config.streetApiKey) {
    console.error('❌ STREET_API_KEY is not set in your .env file.');
    console.error('   Please copy .env.example to .env and add your Street API token.\n');
    process.exit(1);
  }

  console.log(`📡 Target API Base URL: ${config.streetBaseUrl}`);
  console.log(`🔑 Using Token: ${config.streetApiKey.slice(0, 6)}...${config.streetApiKey.slice(-4)}`);
  console.log('⏳ Sending test request to Street API (/properties)...');

  try {
    const street = new StreetClient();
    const result = await street.testConnection();
    if (result.success) {
      console.log('\n--- 1. VALUATION FIELDS ---');
      const sampleVal = (await street.client.get('/valuations?page[number]=34&page[size]=1')).data.data?.[0];
      console.log('Valuation attributes:', Object.keys(sampleVal?.attributes || {}));
      console.log('Valuation sample data:', JSON.stringify(sampleVal?.attributes, null, 2).slice(0, 500));

      console.log('\n--- 2. PROPERTY FIELDS ---');
      const sampleProp = (await street.client.get('/properties?page[number]=46&page[size]=1')).data.data?.[0];
      console.log('Property attributes:', Object.keys(sampleProp?.attributes || {}));
      console.log('Property dates:', Object.entries(sampleProp?.attributes || {}).filter(([k]) => k.includes('date') || k.includes('at')));
      console.log('Property status & sales fields:', {
        status: sampleProp?.attributes?.status,
        is_sales: sampleProp?.attributes?.is_sales,
        is_lettings: sampleProp?.attributes?.is_lettings,
        pricing: sampleProp?.attributes?.pricing,
      });

      console.log('\n--- TESTING LIVE TEIGNMOUTH METRICS ---');
      const teignmouthBranchId = 'a6229980-b58e-4b7a-a489-db756ec48e7e';
      
      const [vList, pList, sList, viewList] = await Promise.all([
        street.fetchAll('/valuations?include=branch&filter[updated_from]=2025-01-01T00:00:00Z', 10),
        street.fetchAll('/properties?include=branch&filter[updated_from]=2025-01-01T00:00:00Z', 10),
        street.fetchAll('/sales?include=branch&filter[updated_from]=2025-01-01T00:00:00Z', 10),
        street.fetchAll('/viewings?include=branch&filter[updated_from]=2025-01-01T00:00:00Z', 10),
      ]);

      const tVals = vList.filter(v => v['branch_id'] === teignmouthBranchId);
      const tProps = pList.filter(p => p['branch_id'] === teignmouthBranchId);
      const tSales = sList.filter(s => s['branch_id'] === teignmouthBranchId);
      const tViews = viewList.filter(v => v['branch_id'] === teignmouthBranchId);

      console.log('Teignmouth records since 2025:');
      console.log('  Valuations:', tVals.length);
      console.log('  Properties:', tProps.length);
      console.log('  Sales:', tSales.length);
      console.log('  Viewings:', tViews.length);
      if (tVals.length > 0) console.log('  Sample Val date & status:', { start: tVals[0]['start'], created_at: tVals[0]['created_at'], status: tVals[0]['status'] });
      if (tProps.length > 0) console.log('  Sample Prop status & address:', { status: tProps[0]['status'], address: tProps[0]['address.single_line'] });

      console.log('\n--- 4. VIEWING FIELDS ---');
      const sampleView = (await street.client.get('/viewings?page[number]=50&page[size]=1')).data.data?.[0];
      console.log('Viewing attributes:', Object.keys(sampleView?.attributes || {}));
      console.log('Viewing status & dates:', {
        status: sampleView?.attributes?.status,
        start_at: sampleView?.attributes?.start_at,
        start: sampleView?.attributes?.start,
        created_at: sampleView?.attributes?.created_at,
      });

      console.log('\n--- 5. TENANCY FIELDS ---');
      const sampleTen = (await street.client.get('/tenancies?page[number]=7&page[size]=1')).data.data?.[0];
      console.log('Tenancy attributes:', Object.keys(sampleTen?.attributes || {}));
      console.log('Tenancy status & dates:', {
        status: sampleTen?.attributes?.status,
        service_level: sampleTen?.attributes?.service_level,
        active: sampleTen?.attributes?.active,
        start_date: sampleTen?.attributes?.start_date,
        created_at: sampleTen?.attributes?.created_at,
      });

      console.log('\n--- CHECKING LATEST VALUATIONS (Page 34) ---');
      const lastVals = await street.client.get('/valuations?page[number]=34&page[size]=100');
      const latest = lastVals.data.data?.slice(-5);
      console.log('Latest 5 valuations in CRM:');
      for (const item of latest || []) {
        console.log({
          id: item.id,
          created_at: item.attributes?.created_at,
          start: item.attributes?.start,
          status: item.attributes?.status,
        });
      }

      console.log('\n--- CHECKING LATEST PROPERTIES (Page 46) ---');
      const lastProps = await street.client.get('/properties?page[number]=46&page[size]=100');
      const latestProps = lastProps.data.data?.slice(-5);
      console.log('Latest 5 properties in CRM:');
      for (const item of latestProps || []) {
        console.log({
          id: item.id,
          created_at: item.attributes?.created_at,
          status: item.attributes?.status,
          address: item.attributes?.address?.single_line,
        });
      }

      console.log('\n--- 3. SALES SAMPLE ---');
      const sales = await street.fetchAll('/sales?include=branch', 1);
      console.log(`Fetched ${sales.length} sales. Recent 3:`);
      for (const s of sales.slice(0, 5)) {
        console.log({
          id: s['id'],
          branch_id: s['branch_id'],
          status: s['status'],
          created_at: s['created_at'],
          address: s['address.single_line'],
        });
      }
    } else {
      console.error(`\n❌ Street API connection failed with HTTP ${result.status}`);
      console.error(`   Error details: ${result.error}`);
      console.error('\n🛠️ Troubleshooting Tips:');
      if (result.status === 401) {
        console.error('   - 401 Unauthorized: Your STREET_API_KEY is invalid or expired.');
        console.error('   - Verify your token inside Street CRM under Settings > Account Administration > Applications.');
      } else if (result.status === 403) {
        console.error('   - 403 Forbidden: Your token lacks permissions to access the /properties endpoint.');
      } else if (result.status === 404) {
        console.error('   - 404 Not Found: Check if STREET_API_BASE_URL is correct.');
      } else {
        console.error('   - Check your internet connection and verify Street CRM API status.');
      }
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`\n❌ Unexpected error: ${err.message}`);
    process.exit(1);
  }
}

main();
