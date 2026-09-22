import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

// Load .env file
dotenv.config();

export interface Config {
  streetApiKey: string;
  streetBaseUrl: string;
  streetObjects: string[];
  googleSheetId: string;
}

export function getConfig(): Config {
  const streetApiKey = (process.env.STREET_API_KEY || '').trim().replace(/^['"`]+|['"`]+$/g, '');
  const rawBaseUrl = (process.env.STREET_API_BASE_URL || 'https://street.co.uk/open-api/v1').trim().replace(/^['"`]+|['"`]+$/g, '');
  const streetBaseUrl = rawBaseUrl.replace(/\/+$/, '');
  const googleSheetId = (process.env.GOOGLE_SHEET_ID || '').trim().replace(/^['"`]+|['"`]+$/g, '');
  
  const rawObjects = process.env.STREET_OBJECTS || 'properties,viewings,valuations,sales,tenancies,people';
  const streetObjects = rawObjects
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  return {
    streetApiKey,
    streetBaseUrl,
    streetObjects,
    googleSheetId,
  };
}

export function getGoogleAuth() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

  // 1. Direct base64 encoded JSON (ideal for CI / GitHub Actions)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
    try {
      const decodedJson = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      const credentials = JSON.parse(decodedJson);
      return new google.auth.GoogleAuth({
        credentials,
        scopes,
      });
    } catch (err: any) {
      throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_BASE64: ${err.message}`);
    }
  }

  // 2. Direct raw JSON string (useful for CI / Docker)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
      return new google.auth.GoogleAuth({
        credentials,
        scopes,
      });
    } catch (err: any) {
      throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY_JSON: ${err.message}`);
    }
  }

  // 3. Local file path
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account.json';
  const resolvedPath = path.resolve(process.cwd(), keyPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Google Service Account key file not found at "${resolvedPath}".\n` +
      `Please ensure you downloaded the JSON key from Google Cloud Console and saved it as "service-account.json", ` +
      `or specify GOOGLE_SERVICE_ACCOUNT_KEY_PATH in your .env file.`
    );
  }

  return new google.auth.GoogleAuth({
    keyFile: resolvedPath,
    scopes,
  });
}
