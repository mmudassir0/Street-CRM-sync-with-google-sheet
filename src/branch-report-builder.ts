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

export interface SalesOperationalMetrics {
  mtdSalesCommission: string | number;
  weekCompletions: number;
  totalForSale: number;
  mtdCompletions: number;
  offersReceived: number;
  salesInProgress: number | string;
  weeklyFallThroughs: number;
  weeklyWithdrawn: number;
  mtdFallThroughs: number;
  mtdWithdrawn: number;
  weeklyApplicants: number;
  weeklyViewingsBooked: number;
  weeklyViewingsAttended: number;
  weeklyViewingsCancelled: number;
  mortgageReferrals: number;
  conveyancingInstructions: number;
  mtdMortgageReferrals: number;
  mtdConveyancingInstructions: number;
}

export interface RentalsOperationalMetrics {
  totalFullyManaged: number;
  weeklyTotalIncome: string | number;
  availableProperties: number;
  mtdIncome: string | number;
  weeklyLost: number;
  mtdLost: number;
  weeklyApplicants: number;
  weeklyViewingsAttended: number;
  mortgageReferrals: number;
  inspectionsCompleted: number;
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
    operational: SalesOperationalMetrics,
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
    const headingRowIndices: number[] = [];
    const tableHeaderRowIndices: number[] = [];

    // Header section
    rows.push(['Office', tabName, 'Date', weekEndingDate, 'Week No.', weekNumber]);
    rows.push([]);

    // KPI & YTD Performance Summary Table
    headingRowIndices.push(rows.length);
    rows.push(['KEY PERFORMANCE INDICATORS (KPIs) & YTD COMPARISON']);

    tableHeaderRowIndices.push(rows.length);
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

    // Weekly & Monthly Pipeline & Activity (Branch Report)
    rows.push([]);
    headingRowIndices.push(rows.length);
    rows.push(['WEEKLY & MONTHLY PIPELINE & ACTIVITY (BRANCH REPORT)']);

    tableHeaderRowIndices.push(rows.length);
    rows.push(['Operational Metric', 'Value', 'Pipeline & Activity Metric', 'Value']);
    rows.push([
      'MTD Sale Agreed Commission',
      typeof operational.mtdSalesCommission === 'number' ? `£${operational.mtdSalesCommission.toLocaleString()}` : operational.mtdSalesCommission,
      'Week Completions',
      operational.weekCompletions,
    ]);
    rows.push(['Total Number For Sale', operational.totalForSale, 'MTD Completions', operational.mtdCompletions]);
    rows.push(['Number Of Offers Received', operational.offersReceived, 'Sales In Progress (Pipeline)', operational.salesInProgress]);
    rows.push(['Weekly Number Of Fall Throughs', operational.weeklyFallThroughs, 'Weekly Number Of Withdrawn (Dis-instructed)', operational.weeklyWithdrawn]);
    rows.push(['MTD Fall Throughs', operational.mtdFallThroughs, 'MTD Withdrawn', operational.mtdWithdrawn]);
    rows.push(['Number Of Applicants Registered (Week)', operational.weeklyApplicants, 'Number Of Viewings Booked (Week)', operational.weeklyViewingsBooked]);
    rows.push(['Number Of Viewings Attended (Week)', operational.weeklyViewingsAttended, 'Number Of Viewings Cancelled (Week)', operational.weeklyViewingsCancelled]);
    rows.push(['Mortgage Referrals (Week)', operational.mortgageReferrals, 'Conveyancing Instructions (Week)', operational.conveyancingInstructions]);
    rows.push(['MTD Mortgage Referrals', operational.mtdMortgageReferrals, 'MTD Conveyancing Instructions', operational.mtdConveyancingInstructions]);

    rows.push([]);
    headingRowIndices.push(rows.length);
    rows.push(['MARKET VALUATIONS']);

    tableHeaderRowIndices.push(rows.length);
    rows.push(['Address', 'Value (£)', 'Property Type', 'Status']);
    if (valuations.length > 0) {
      for (const v of valuations) {
        rows.push([v.address, v.priceOrValue, v.typeOrService, v.statusOrFee]);
      }
    } else {
      rows.push(['No valuations recorded for this period', '', '', '']);
    }

    rows.push([]);
    headingRowIndices.push(rows.length);
    rows.push(['PROPERTY INSTRUCTIONS']);

    tableHeaderRowIndices.push(rows.length);
    rows.push(['Address', 'Asking Price (£)', 'Property Type', 'Fee (%/£)']);
    if (instructions.length > 0) {
      for (const inst of instructions) {
        rows.push([inst.address, inst.priceOrValue, inst.typeOrService, inst.statusOrFee]);
      }
    } else {
      rows.push(['No new instructions recorded for this period', '', '', '']);
    }

    rows.push([]);
    headingRowIndices.push(rows.length);
    rows.push(['SALES AGREED']);

    tableHeaderRowIndices.push(rows.length);
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
    await this.applyReportFormatting(sheetId, headingRowIndices, tableHeaderRowIndices);
  }

  /**
   * Populates the Rentals tab following the exact layout of "Lettings Weekly.xlsx".
   */
  async buildRentalsSheet(
    tabName: string,
    weekEndingDate: string,
    weekNumber: number,
    kpiMetrics: BranchKpiSummary[],
    operational: RentalsOperationalMetrics,
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
    const headingRowIndices: number[] = [];
    const tableHeaderRowIndices: number[] = [];

    // Header section
    rows.push(['Office', 'Lettings / Rentals', 'Date', weekEndingDate, 'Week No.', weekNumber]);
    rows.push([]);

    // KPI & YTD Performance Summary Table
    headingRowIndices.push(rows.length);
    rows.push(['KEY PERFORMANCE INDICATORS (KPIs) & YTD COMPARISON']);

    tableHeaderRowIndices.push(rows.length);
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

    // Operational Summary
    rows.push([]);
    headingRowIndices.push(rows.length);
    rows.push(['LETTINGS OPERATIONS & REVENUE SUMMARY (BRANCH REPORT)']);

    tableHeaderRowIndices.push(rows.length);
    rows.push(['Operational Metric', 'Value', 'Activity & Revenue Metric', 'Value']);
    rows.push([
      'Total Number Fully Managed',
      operational.totalFullyManaged,
      'Weekly Total Income',
      typeof operational.weeklyTotalIncome === 'number' ? `£${operational.weeklyTotalIncome.toLocaleString()}` : operational.weeklyTotalIncome,
    ]);
    rows.push([
      'Available Properties To Let',
      operational.availableProperties,
      'MTD Income',
      typeof operational.mtdIncome === 'number' ? `£${operational.mtdIncome.toLocaleString()}` : operational.mtdIncome,
    ]);
    rows.push(['Weekly Number Lost', operational.weeklyLost, 'MTD Lost', operational.mtdLost]);
    rows.push([
      'Number Of Applicants/Enquiries (Week)',
      operational.weeklyApplicants,
      'Number Of Viewings Attended (Week)',
      operational.weeklyViewingsAttended,
    ]);
    rows.push([
      'Mortgage Referrals (Week)',
      operational.mortgageReferrals,
      'Property Inspections Completed',
      operational.inspectionsCompleted,
    ]);

    rows.push([]);
    headingRowIndices.push(rows.length);
    rows.push(['MARKET VALUATIONS']);

    tableHeaderRowIndices.push(rows.length);
    rows.push(['Valuation Address', 'Rent PCM (£)', 'Property Type', 'Status']);
    if (valuations.length > 0) {
      for (const v of valuations) {
        rows.push([v.address, v.priceOrValue, v.typeOrService, v.statusOrFee]);
      }
    } else {
      rows.push(['No valuations recorded for this period', '', '', '']);
    }

    rows.push([]);
    headingRowIndices.push(rows.length);
    rows.push(['NEW PROPERTY INSTRUCTIONS']);

    tableHeaderRowIndices.push(rows.length);
    rows.push(['Address', 'Service Type', 'Monthly Fee (%/£)', 'Setup Fee (£)']);
    if (instructions.length > 0) {
      for (const inst of instructions) {
        rows.push([inst.address, inst.priceOrValue, inst.typeOrService, inst.statusOrFee]);
      }
    } else {
      rows.push(['No new instructions recorded for this period', '', '', '']);
    }

    rows.push([]);
    headingRowIndices.push(rows.length);
    rows.push(['LET AGREED']);

    tableHeaderRowIndices.push(rows.length);
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
    await this.applyReportFormatting(sheetId, headingRowIndices, tableHeaderRowIndices);
  }

  /**
   * Applies professional styling to the Google Sheet tab.
   * Highlights all table headers with a dark background and bold white text.
   * Makes all section headings bold.
   */
  private async applyReportFormatting(
    sheetId: number,
    headingRowIndices: number[],
    tableHeaderRowIndices: number[]
  ): Promise<void> {
    try {
      const requests: sheets_v4.Schema$Request[] = [
        // Unmerge all existing merged cells to prevent overlap errors on re-run
        {
          unmergeCells: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 150,
              startColumnIndex: 0,
              endColumnIndex: 10,
            },
          },
        },
        // Bold row 1 (Office, Date, Week No) with clean header background
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
                backgroundColor: { red: 0.92, green: 0.95, blue: 0.98 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
      ];

      // Format all Section Headings (Just Bold text, NO dark background, merged across columns A to G)
      for (const hIdx of headingRowIndices) {
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: hIdx,
              endRowIndex: hIdx + 1,
              startColumnIndex: 0,
              endColumnIndex: 6,
            },
            mergeType: 'MERGE_ALL',
          },
        });
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: hIdx,
              endRowIndex: hIdx + 1,
              startColumnIndex: 0,
              endColumnIndex: 6,
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 0, green: 0, blue: 0 }, fontSize: 11 },
                backgroundColor: { red: 1, green: 1, blue: 1 }, // Clean white / no dark background
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        });
      }

      // Format ALL Table Headers (Dark Gray background with bold white text)
      for (const thIdx of tableHeaderRowIndices) {
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: thIdx,
              endRowIndex: thIdx + 1,
              startColumnIndex: 0,
              endColumnIndex: 6,
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.25, green: 0.25, blue: 0.25 }, // Dark Gray (#404040)
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        });
      }

      // Right-align data columns B through F in the KPI table (rows 4 to 16)
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 4,
            endRowIndex: 16,
            startColumnIndex: 1,
            endColumnIndex: 6,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'RIGHT',
            },
          },
          fields: 'userEnteredFormat(horizontalAlignment)',
        },
      });

      // Auto-resize all columns (A through G) according to cell content!
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 7,
          },
        },
      });

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests },
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
    return current > 0 ? "'+100%" : '0%';
  }
  const diff = ((current - previous) / previous) * 100;
  const prefix = diff > 0 ? '+' : '';
  return `'${prefix}${diff.toFixed(1)}%`;
}
