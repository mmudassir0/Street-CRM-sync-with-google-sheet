import { SheetsClient } from './sheets-client';
import { getConfig } from './config';

async function main() {
  console.log('====================================================');
  console.log(' Google Sheets API Service Account Connection Test');
  console.log('====================================================\n');

  let config;
  try {
    config = getConfig();
  } catch (err: any) {
    console.error('❌ Configuration error:', err.message);
    process.exit(1);
  }

  if (!config.googleSheetId) {
    console.error('❌ GOOGLE_SHEET_ID is not set in your .env file.');
    console.error('   Please copy .env.example to .env and set your target Google Sheet ID.\n');
    process.exit(1);
  }

  console.log(`📄 Target Google Sheet ID: ${config.googleSheetId}`);
  console.log('⏳ Authenticating with Google Cloud Service Account...');

  try {
    const sheets = new SheetsClient();

    console.log('⏳ Verifying spreadsheet access and reading metadata...');
    const info = await sheets.getSpreadsheetInfo();
    console.log(`✅ Successfully connected to spreadsheet: "${info.title}"`);
    console.log(`📊 Found ${info.sheets.length} existing tab(s): ${info.sheets.map(s => s.title).join(', ')}`);

    const testTabName = '_ConnectionTest';
    console.log(`\n⏳ Writing test verification row to "${testTabName}" tab...`);

    const now = new Date();
    const testRow = [
      now.toISOString(),
      'Connection Test Successful',
      'Street CRM to Google Sheets Integration',
      process.env.COMPUTERNAME || process.env.HOSTNAME || 'Local Machine',
    ];

    const updatedRange = await sheets.appendTestRow(testTabName, testRow);
    console.log(`✅ Test row successfully appended to range: ${updatedRange}`);

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${config.googleSheetId}/edit`;
    console.log(`\n🎉 Verified! You can inspect the sheet in your browser:`);
    console.log(`   🔗 ${sheetUrl}\n`);
  } catch (err: any) {
    console.error(`\n❌ Google Sheets connection test failed:`);
    console.error(`   ${err.message}`);
    console.error('\n🛠️ Troubleshooting Tips:');
    console.error('   1. Ensure Google Sheets API is enabled in your Google Cloud Console project:');
    console.error('      https://console.cloud.google.com/apis/library/sheets.googleapis.com');
    console.error('   2. Verify that service-account.json exists in this folder (or GOOGLE_SERVICE_ACCOUNT_KEY_PATH is correct).');
    console.error('   3. Make sure you opened your Google Sheet, clicked "Share", and added your Service Account\'s');
    console.error('      client_email address as an "Editor".');
    console.error('   4. Verify the GOOGLE_SHEET_ID matches the ID between /d/ and /edit in the browser URL.');
    process.exit(1);
  }
}

main();
