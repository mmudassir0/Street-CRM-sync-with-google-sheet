import { StreetClient, StreetRecord } from './street-client';
import { SheetsClient } from './sheets-client';
import { getConfig } from './config';

interface SyncSummary {
  endpoint: string;
  tabTitle: string;
  recordCount: number;
  columnCount: number;
  status: 'SUCCESS' | 'EMPTY' | 'FAILED';
  durationMs: number;
  error?: string;
}

/**
 * Capitalizes a string for clean tab names (e.g., "properties" -> "Properties").
 */
function toTabTitle(endpoint: string): string {
  const clean = endpoint.replace(/^\/+/, '').trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Determines clean ordered column headers from a list of flattened records.
 * Common ID and timestamp columns are placed first.
 */
function extractOrderedHeaders(records: StreetRecord[]): string[] {
  const allKeys = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      allKeys.add(key);
    }
  }

  const priorityOrder = [
    'id',
    'type',
    'status',
    'reference',
    'created_at',
    'updated_at',
  ];

  const headers: string[] = [];

  // Add priority headers first if present
  for (const p of priorityOrder) {
    if (allKeys.has(p)) {
      headers.push(p);
      allKeys.delete(p);
    }
  }

  // Add all remaining headers alphabetically
  const remaining = Array.from(allKeys).sort((a, b) => a.localeCompare(b));
  headers.push(...remaining);

  return headers;
}

/**
 * Formats a record value for Google Sheets.
 */
function formatCellValue(val: any): string | number | boolean {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (typeof val === 'number') {
    return val;
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

async function runSync() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log(' Street CRM Sandbox -> Google Sheets Full Refresh Sync');
  console.log('================================================================\n');

  let config;
  try {
    config = getConfig();
  } catch (err: any) {
    console.error('❌ Configuration error:', err.message);
    process.exit(1);
  }

  console.log(`📋 Objects to sync: ${config.streetObjects.join(', ')}`);
  console.log(`📊 Target Google Sheet ID: ${config.googleSheetId}`);
  console.log(`🌐 Street API URL: ${config.streetBaseUrl}\n`);

  let street: StreetClient;
  let sheets: SheetsClient;

  try {
    street = new StreetClient();
    sheets = new SheetsClient();
  } catch (err: any) {
    console.error(`❌ Initialization error: ${err.message}`);
    process.exit(1);
  }

  // Verify spreadsheet access
  try {
    const spreadsheetInfo = await sheets.getSpreadsheetInfo();
    console.log(` Connected to Google Spreadsheet: "${spreadsheetInfo.title}"\n`);
  } catch (err: any) {
    console.error(`❌ Cannot connect to Google Sheet: ${err.message}`);
    process.exit(1);
  }

  const summaries: SyncSummary[] = [];

  // Iterate over each Street CRM object
  for (const endpoint of config.streetObjects) {
    const objectStartTime = Date.now();
    const tabTitle = toTabTitle(endpoint);
    console.log(`----------------------------------------------------------------`);
    console.log(`▶ Syncing [${endpoint}] -> Tab: "${tabTitle}"`);

    try {
      // 1. Ensure tab exists in Google Sheet
      const sheetId = await sheets.ensureSheetExists(tabTitle);

      // 2. Fetch records from Street API
      const records = await street.fetchAll(endpoint);

      if (records.length === 0) {
        console.log(`ℹ️ No records found for "${endpoint}". Clearing tab and writing header.`);
        await sheets.clearSheet(tabTitle);
        await sheets.writeSheetData(tabTitle, ['Info'], [['No records returned from Street CRM sandbox.']]);

        summaries.push({
          endpoint,
          tabTitle,
          recordCount: 0,
          columnCount: 1,
          status: 'EMPTY',
          durationMs: Date.now() - objectStartTime,
        });
        continue;
      }

      // 3. Extract headers and build matrix
      const headers = extractOrderedHeaders(records);
      const rows: any[][] = [];

      for (const record of records) {
        const row = headers.map(header => formatCellValue(record[header]));
        rows.push(row);
      }

      // 4. Clear existing data and write fresh records (Full Refresh)
      console.log(`[Google Sheets] Clearing tab "${tabTitle}" and writing ${rows.length} rows...`);
      await sheets.clearSheet(tabTitle);
      await sheets.writeSheetData(tabTitle, headers, rows);

      // 5. Format header row (bold, colored, frozen row 1)
      await sheets.formatHeaderRow(sheetId, headers.length);

      console.log(`✅ Tab "${tabTitle}" updated successfully (${rows.length} rows, ${headers.length} columns).`);

      summaries.push({
        endpoint,
        tabTitle,
        recordCount: rows.length,
        columnCount: headers.length,
        status: 'SUCCESS',
        durationMs: Date.now() - objectStartTime,
      });
    } catch (err: any) {
      console.error(`❌ Failed to sync "${endpoint}": ${err.message}`);
      summaries.push({
        endpoint,
        tabTitle,
        recordCount: 0,
        columnCount: 0,
        status: 'FAILED',
        durationMs: Date.now() - objectStartTime,
        error: err.message,
      });
    }
  }

  // Display Final Summary
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n================================================================');
  console.log(` Sync Completed in ${totalDuration}s`);
  console.log('================================================================');
  console.log(
    'Tab Name'.padEnd(20) +
    'Status'.padEnd(12) +
    'Records'.padEnd(12) +
    'Columns'.padEnd(12) +
    'Time (s)'
  );
  console.log('----------------------------------------------------------------');

  for (const s of summaries) {
    const timeSec = (s.durationMs / 1000).toFixed(1);
    console.log(
      s.tabTitle.padEnd(20) +
      s.status.padEnd(12) +
      String(s.recordCount).padEnd(12) +
      String(s.columnCount).padEnd(12) +
      `${timeSec}s`
    );
  }
  console.log('================================================================\n');

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${config.googleSheetId}/edit`;
  console.log(`🔗 Access your Google Sheet here:\n   ${sheetUrl}\n`);
}

runSync().catch(err => {
  console.error('Fatal sync execution error:', err);
  process.exit(1);
});
