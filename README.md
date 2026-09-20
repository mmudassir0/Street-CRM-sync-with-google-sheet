# Street CRM Sandbox to Google Sheets Sync Pipeline

An automated, reliable TypeScript pipeline that pulls data from the **Street.co.uk CRM Sandbox API** and synchronizes it into a target **Google Sheet** using separate tabs per object with full nightly refreshes.

---

## 🎯 Architecture & Features

- **Independent Connection Testers**: Test Street API and Google Sheets API separately before running syncs.
- **Separate Tabs Per Object**: Creates dedicated tabs for `Properties`, `Viewings`, `Offers`, `Applicants`, `Tenancies`, and `Landlords`.
- **Full Refresh Strategy**: Wipes outdated data and writes the latest records, keeping your sheet clean and accurate.
- **Automated Formatting**: Bold headers, dark slate styling, and frozen top row.
- **Dynamic Field Flattening**: Handles nested JSON:API structures and relationships seamlessly.
- **Zero-Host Scheduling**: Includes a production-ready GitHub Actions workflow for automated daily syncs.

---

## 🚀 Quick Start Checklist

### 1. Prerequisites
- Node.js (v18+ or v20+) installed.
- Access to Street CRM Sandbox API token.
- Google Cloud Project with Sheets API enabled and a Service Account.

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` with your credentials:
```env
STREET_API_KEY=your_street_sandbox_api_token
STREET_API_BASE_URL=https://street.co.uk/open-api/v1
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account.json
STREET_OBJECTS=properties,viewings,offers,applicants,tenancies,landlords
```

### 3. Test Connections Independently
```bash
# Test 1: Confirm Street CRM Sandbox token can pull data
npm run test:street

# Test 2: Confirm Google Service Account has write access to the Sheet
npm run test:sheets
```

### 4. Run Full Sync
```bash
npm run sync
```

---

## 📖 Detailed Guides

- For complete step-by-step instructions on setting up Google Cloud, Service Accounts, and Street API, see [SETUP_GUIDE.md](file:///C:/Users/Admin/Desktop/Project%20Task/SETUP_GUIDE.md).

---

## ⏰ Automated Scheduling (GitHub Actions)

This repository includes a scheduled workflow at `.github/workflows/scheduled-sync.yml`.

To enable automated nightly syncs:
1. Push this project to a GitHub repository (private recommended).
2. Go to **Settings > Secrets and variables > Actions** in your GitHub repo.
3. Add the following repository secrets:
   - `STREET_API_KEY`: Your Street API Bearer token.
   - `GOOGLE_SHEET_ID`: Your Google Sheet ID.
   - `GOOGLE_SERVICE_ACCOUNT_KEY_JSON`: The entire raw JSON content of your `service-account.json` file.
   - *(Optional)* `STREET_API_BASE_URL`: Custom sandbox URL if different from default.
   - *(Optional)* `STREET_OBJECTS`: Custom comma-separated list of objects.
4. The workflow runs every day at 02:00 AM UTC, and can also be triggered manually anytime under the **Actions** tab.
