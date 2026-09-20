import { google, sheets_v4 } from 'googleapis';
import { getConfig, getGoogleAuth } from './config';

export interface SheetMetadata {
  title: string;
  sheetId: number;
}

export class SheetsClient {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor() {
    const config = getConfig();
    if (!config.googleSheetId) {
      throw new Error(
        'GOOGLE_SHEET_ID is not defined. Please set it in your .env file or environment variables.'
      );
    }

    const auth = getGoogleAuth();
    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = config.googleSheetId;
  }

  /**
   * Retrieves spreadsheet metadata and confirms read access.
   */
  async getSpreadsheetInfo(): Promise<{ title: string; sheets: SheetMetadata[] }> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const title = response.data.properties?.title || 'Untitled Spreadsheet';
      const sheets: SheetMetadata[] = (response.data.sheets || []).map((s) => ({
        title: s.properties?.title || '',
        sheetId: s.properties?.sheetId || 0,
      }));

      return { title, sheets };
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404) {
        throw new Error(
          `Google Sheet not found (ID: ${this.spreadsheetId}). Check that GOOGLE_SHEET_ID is correct.`
        );
      }
      if (status === 403) {
        throw new Error(
          `Access denied to Google Sheet (ID: ${this.spreadsheetId}).\n` +
          `Make sure you shared the Google Sheet with your Service Account's email as an 'Editor'.`
        );
      }
      throw new Error(`Google Sheets API error: ${err.message}`);
    }
  }

  /**
   * Ensures a sheet (tab) with the given title exists. Creates it if missing.
   */
  async ensureSheetExists(sheetTitle: string): Promise<number> {
    const { sheets } = await this.getSpreadsheetInfo();
    const existing = sheets.find((s) => s.title.toLowerCase() === sheetTitle.toLowerCase());

    if (existing) {
      return existing.sheetId;
    }

    console.log(`[Google Sheets] Tab "${sheetTitle}" does not exist. Creating it now...`);
    const addSheetResponse = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      },
    });

    const newSheetId =
      addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId || 0;
    return newSheetId;
  }

  /**
   * Clears all existing data in a sheet tab.
   */
  async clearSheet(sheetTitle: string): Promise<void> {
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `'${sheetTitle}'!A1:ZZZ`,
    });
  }

  /**
   * Writes header row and all data rows into the specified sheet.
   */
  async writeSheetData(sheetTitle: string, headers: string[], rows: any[][]): Promise<void> {
    const values = [headers, ...rows];

    if (values.length === 0 || headers.length === 0) {
      console.log(`[Google Sheets] No data to write for tab "${sheetTitle}".`);
      return;
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `'${sheetTitle}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
  }

  /**
   * Formats the header row: frozen row 1, bold white text with a sleek slate background.
   */
  async formatHeaderRow(sheetId: number, columnCount: number): Promise<void> {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            // 1. Freeze the top header row
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
            // 2. Format row 1: Dark slate background, white bold text
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: columnCount,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.16,
                      green: 0.24,
                      blue: 0.31,
                    },
                    textFormat: {
                      bold: true,
                      foregroundColor: {
                        red: 1.0,
                        green: 1.0,
                        blue: 1.0,
                      },
                    },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
          ],
        },
      });
    } catch (err: any) {
      // Formatting failure shouldn't stop the sync, just log a warning
      console.warn(`[Google Sheets] Warning: Could not apply header formatting: ${err.message}`);
    }
  }

  /**
   * Appends a test row to a tab (used by test-sheets).
   */
  async appendTestRow(sheetTitle: string, rowData: any[]): Promise<string> {
    await this.ensureSheetExists(sheetTitle);

    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `'${sheetTitle}'!A:E`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    });

    return response.data.updates?.updatedRange || 'Unknown Range';
  }
}
