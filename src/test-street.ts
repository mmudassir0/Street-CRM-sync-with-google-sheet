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
      console.log(`\n✅ Street API connection successful! (HTTP ${result.status})`);
      
      const data = result.sampleData;
      if (Array.isArray(data?.data)) {
        console.log(`📊 Sample records returned: ${data.data.length}`);
        if (data.data.length > 0) {
          const sample = data.data[0];
          console.log(`\n🔍 First record preview:`);
          console.log(`   - ID:   ${sample.id}`);
          console.log(`   - Type: ${sample.type}`);
          console.log(`   - Sample Attributes:`, JSON.stringify(sample.attributes, null, 2).slice(0, 300) + '...');
        }
      } else {
        console.log('ℹ️ Response received:', JSON.stringify(data, null, 2).slice(0, 300));
      }
      console.log('\n🎉 Street CRM sandbox connection verified and ready for sync!\n');
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
