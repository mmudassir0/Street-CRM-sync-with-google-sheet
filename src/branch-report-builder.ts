import { google, sheets_v4 } from 'googleapis';
import { getConfig, getGoogleAuth } from './config';
import { StreetClient } from './street-client';

export interface BranchKpiSummary {
  name: string;
  thisWeek: number | string;
  mtd: number | string;
  ytdCurrent: number | string;
  ytdLastYear: number | string;
  yoyChange: string;
}

export interface DetailItem {
  address: string;
  priceOrValue: string | number;
  typeOrService: string;
  statusOrFee: string;
}

export class BranchReportBuilder {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor() {
    const config = getConfig();
    if (!config.googleSheetId) {
      throw new Error('GOOGLE_SHEET_ID is not configured in .env');
    }
    const auth = getGoogleAuth();
    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = config.googleSheetId;
  }

  /**
   * Helper to ensure a tab exists.
   */
  async ensureTab(tabName: string): Promise<number> {
    const metadata = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });
    const sheet = (metadata.data.sheets || []).find(
      s => s.properties?.title?.toLowerCase() === tabName.toLowerCase()
    );

    if (sheet?.properties?.sheetId !== undefined && sheet.properties.sheetId !== null) {
      return sheet.properties.sheetId;
    }

    const addRes = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
              },
            },
          },
        ],
      },
    });

    const newId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
    return (newId !== undefined && newId !== null) ? newId : 0;
  }

  /**
   * Populates a Sales Branch tab (Bovey Tracey, Teignmouth, Newton Abbot, Fine & Country)
   * following the exact layout of "13th Sept Teignmouth figs.xlsx".
   */
  async buildSalesBranchSheet(
    tabName: string,
    weekEndingDate: string,
    weekNumber: number,
    kpiMetrics: BranchKpiSummary[],
    valuations: DetailItem[],
    instructions: DetailItem[],
    salesAgreed: DetailItem[]
  ): Promise<void> {
    const sheetId = await this.ensureTab(tabName);

    // Clear existing tab contents
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `'${tabName}'!A1:Z150`,
    });

    const rows: any[][] = [];

    // Header section
    rows.push(['Office', tabName, 'Date', weekEndingDate, 'Week No.', weekNumber]);
    rows.push([]);

    // KPI & YTD Performance Summary Table
    rows.push(['KEY PERFORMANCE INDICATORS (KPIs) & YTD COMPARISON']);
    rows.push([
      'Metric',
      'This Week',
      'MTD',
      `YTD (${new Date().getFullYear()})`,
      `YTD (${new Date().getFullYear() - 1})`,
      'YoY Change (%)',
    ]);

    for (const kpi of kpiMetrics) {
      rows.push([
        kpi.name,
        kpi.thisWeek,
        kpi.mtd,
        kpi.ytdCurrent,
        kpi.ytdLastYear,
        kpi.yoyChange,
      ]);
    }

    rows.push([]);
    rows.push(['MARKET VALUATIONS']);
    rows.push(['Address', 'Value (£)', 'Property Type', 'Status']);
    if (valuations.length > 0) {
      for (const v of valuations) {
        rows.push([v.address, v.priceOrValue, v.typeOrService, v.statusOrFee]);
      }
    } else {
      rows.push(['No valuations recorded for this period', '', '', '']);
    }

    rows.push([]);
    rows.push(['PROPERTY INSTRUCTIONS']);
    rows.push(['Address', 'Asking Price (£)', 'Property Type', 'Fee (%/£)']);
    if (instructions.length > 0) {
      for (const inst of instructions) {
        rows.push([inst.address, inst.priceOrValue, inst.typeOrService, inst.statusOrFee]);
      }
    } else {
      rows.push(['No new instructions recorded for this period', '', '', '']);
    }

    rows.push([]);
    rows.push(['SALES AGREED']);
    rows.push(['Address', 'Agreed Price (£)', 'Fee (£)', 'Fee (%)']);
    if (salesAgreed.length > 0) {
      for (const sa of salesAgreed) {
        rows.push([sa.address, sa.priceOrValue, sa.typeOrService, sa.statusOrFee]);
      }
    } else {
      rows.push(['No sales agreed recorded for this period', '', '', '']);
    }

    // Write all values
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });

    // Apply header & section formatting
    await this.applyReportFormatting(sheetId);
  }

  /**
   * Populates the Rentals tab following the exact layout of "Lettings Weekly.xlsx".
   */
  async buildRentalsSheet(
    tabName: string,
    weekEndingDate: string,
    weekNumber: number,
    kpiMetrics: BranchKpiSummary[],
    valuations: DetailItem[],
    instructions: DetailItem[],
    letAgreed: DetailItem[]
  ): Promise<void> {
    const sheetId = await this.ensureTab(tabName);

    // Clear existing tab contents
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `'${tabName}'!A1:Z150`,
    });

    const rows: any[][] = [];

    // Header section
    rows.push(['Office', 'Lettings / Rentals', 'Date', weekEndingDate, 'Week No.', weekNumber]);
    rows.push([]);

    // KPI & YTD Performance Summary Table
    rows.push(['KEY PERFORMANCE INDICATORS (KPIs) & YTD COMPARISON']);
    rows.push([
      'Metric',
      'This Week',
      'MTD',
      `YTD (${new Date().getFullYear()})`,
      `YTD (${new Date().getFullYear() - 1})`,
      'YoY Change (%)',
    ]);

    for (const kpi of kpiMetrics) {
      rows.push([
        kpi.name,
        kpi.thisWeek,
        kpi.mtd,
        kpi.ytdCurrent,
        kpi.ytdLastYear,
        kpi.yoyChange,
      ]);
    }

    rows.push([]);
    rows.push(['MARKET VALUATIONS']);
    rows.push(['Valuation Address', 'Rent PCM (£)', 'Property Type', 'Status']);
    if (valuations.length > 0) {
      for (const v of valuations) {
        rows.push([v.address, v.priceOrValue, v.typeOrService, v.statusOrFee]);
      }
    } else {
      rows.push(['No valuations recorded for this period', '', '', '']);
    }

    rows.push([]);
    rows.push(['NEW PROPERTY INSTRUCTIONS']);
    rows.push(['Address', 'Service Type', 'Monthly Fee (%/£)', 'Setup Fee (£)']);
    if (instructions.length > 0) {
      for (const inst of instructions) {
        rows.push([inst.address, inst.priceOrValue, inst.typeOrService, inst.statusOrFee]);
      }
    } else {
      rows.push(['No new instructions recorded for this period', '', '', '']);
    }

    rows.push([]);
    rows.push(['LET AGREED']);
    rows.push(['Address', 'Service Type', 'Monthly Fee (%/£)', 'Setup Fee (£)']);
    if (letAgreed.length > 0) {
      for (const la of letAgreed) {
        rows.push([la.address, la.priceOrValue, la.typeOrService, la.statusOrFee]);
      }
    } else {
      rows.push(['No let agreed recorded for this period', '', '', '']);
    }

    // Write all values
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });

    // Apply header & section formatting
    await this.applyReportFormatting(sheetId);
  }

  /**
   * Applies professional styling to the Google Sheet tab.
   */
  private async applyReportFormatting(sheetId: number): Promise<void> {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            // Bold row 1 (Office, Date, Week No)
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 6,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.93, green: 0.95, blue: 0.98 },
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            },
            // Format KPI Table Header (Row 4: index 3)
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 3,
                  endRowIndex: 4,
                  startColumnIndex: 0,
                  endColumnIndex: 6,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                    backgroundColor: { red: 0.16, green: 0.24, blue: 0.31 },
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            },
          ],
        },
      });
    } catch (e: any) {
      console.warn(`Formatting note: ${e.message}`);
    }
  }
}

/**
 * Calculates ISO Week Number for a given date.
 */
export function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Computes YoY % change string.
 */
export function calculateYoY(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? '+100%' : '0%';
  }
  const diff = ((current - previous) / previous) * 100;
  const prefix = diff > 0 ? '+' : '';
  return `${prefix}${diff.toFixed(1)}%`;
}
