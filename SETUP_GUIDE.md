# Step-by-Step Setup Guide: Street CRM to Google Sheets

This guide walks you through setting up credentials for both **Google Sheets (Google Cloud Service Account)** and **Street CRM Sandbox**, testing them independently, and running the automated sync.

---

## Part 1: Setting up Google Cloud & Service Account

A Google Cloud Service Account allows our Node.js script to write data directly to your target Google Sheet securely in the background without needing interactive browser logins.

### Step 1.1: Create or Open a Google Cloud Project
1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google account.
3. In the top navigation bar, click the project dropdown (next to "Google Cloud") and click **"New Project"**.
4. Project Name: Enter **`Street-CRM-Sheets-Sync`** (or any name you prefer).
5. Click **Create** and wait a few seconds until the project is created, then ensure it is selected in the top bar.

### Step 1.2: Enable Google Sheets API
1. In the search bar at the top of Google Cloud Console, type **`Google Sheets API`**.
2. Click on **Google Sheets API** from the results list.
3. Click the blue **"Enable"** button.
4. *(Optional but recommended)*: Also search for **`Google Drive API`** and click **"Enable"**.

### Step 1.3: Create a Service Account
1. In the left navigation menu, go to **IAM & Admin** > **Service Accounts** (or search for "Service Accounts" in the top bar).
2. Click **"+ Create Service Account"** at the top.
3. Fill in the details:
   - **Service account name**: `street-sheet-sync`
   - **Service account ID**: will automatically populate (e.g. `street-sheet-sync@street-crm-sheets-sync.iam.gserviceaccount.com`).
   - **Description**: `Syncs Street CRM data to Google Sheets`.
4. Click **Create and Continue**.
5. *(Optional)* Role: You can leave this blank or select **Project > Viewer**, as permissions are granted directly on the Google Sheet itself.
6. Click **Done**.

### Step 1.4: Generate and Download the JSON Key File
1. In the Service Accounts list, click on the email address of the service account you just created.
2. Click the **"Keys"** tab at the top.
3. Click **"Add Key"** > **"Create new key"**.
4. Select **JSON** as the key type.
5. Click **Create**.
6. A JSON file will automatically download to your computer.
7. **Important**:
   - Rename that downloaded file to: `service-account.json`
   - Move it directly into this project folder: `C:\Users\Admin\Desktop\Project Task\service-account.json`
   - *(Note: This file is listed in `.gitignore` so it will never be accidentally published).*

### Step 1.5: Share Your Google Sheet with the Service Account
1. Open your target Google Sheet in your web browser (or create a new blank one).
2. Look at the email address inside your `service-account.json` file (it's the `client_email` field, e.g., `street-sheet-sync@....iam.gserviceaccount.com`).
3. In your Google Sheet, click the green **"Share"** button in the top-right corner.
4. Paste the Service Account's email address into the "Add people and groups" field.
5. Make sure the role is set to **Editor**.
6. Uncheck the "Notify people" box (since service accounts do not have inboxes).
7. Click **Share** (or **Save**).
8. Copy the **Spreadsheet ID** from your browser address bar:
   - URL looks like: `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit`
   - Your `GOOGLE_SHEET_ID` is the long string between `/d/` and `/edit`:
     `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

---

## Part 2: Setting up Street CRM Sandbox

### Step 2.1: Obtain Sandbox API Access
1. If your agency already has a developer/sandbox account, log in at your Street portal.
2. If you do not have a sandbox yet, request one by emailing **`apis@street.co.uk`** stating that you are developing an internal reporting/sync integration.

### Step 2.2: Generate the API Token
1. In Street CRM, navigate to:
   **Settings** > **Account Administration** > **Applications** (or **Developer Settings** / **API Keys**).
2. Click **Create Application** or **Generate New Token**.
3. Name the application: `Google Sheets Sync Integration`.
4. Copy the generated **Bearer Token** (`STREET_API_KEY`).
5. Verify the base URL:
   - Production / Open API default: `https://street.co.uk/open-api/v1`
   - If Street provided a dedicated sandbox/staging hostname, use that URL.

---

## Part 3: Local Configuration & Independent Testing

### Step 3.1: Create `.env` file
In the project directory, copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Open `.env` and fill in:
```env
STREET_API_KEY=your_actual_street_sandbox_token
STREET_API_BASE_URL=https://street.co.uk/open-api/v1
GOOGLE_SHEET_ID=your_actual_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account.json
STREET_OBJECTS=properties,viewings,offers,applicants,tenancies,landlords
```

### Step 3.2: Run Test 1 (Street Sandbox API Test)
Run:
```bash
npm run test:street
```
What this verifies:
- Token validity and permissions.
- Connectivity to Street's API server.
- Shows sample data returned from the sandbox.

### Step 3.3: Run Test 2 (Google Sheets API Test)
Run:
```bash
npm run test:sheets
```
What this verifies:
- Service account authentication.
- Read access to the target sheet metadata.
- Write access by automatically creating a test tab `_ConnectionTest` and appending a timestamp row.
- Outputs the clickable Google Sheet link in your terminal.

---

## Part 4: Running the Full Refresh Sync

Once both independent tests pass:
```bash
npm run sync
```
What happens during sync:
1. Loops through each object (`Properties`, `Viewings`, `Offers`, `Applicants`, `Tenancies`, `Landlords`).
2. Checks if each tab exists in your Google Sheet (creates it automatically if not).
3. Paginates through Street API to fetch all current records.
4. Flattens nested JSON:API structures and extracts clean headers.
5. Clears previous data on the tab and updates it with fresh rows.
6. Applies professional styling (bold white headers, dark slate header background, and frozen top row).
7. Prints an execution summary table with row counts and duration.

---

## Part 5: Automated Scheduling with GitHub Actions

To run this sync automatically every night (or on any schedule) with zero hosting costs:

1. Push this project to GitHub.
2. In GitHub, go to your repository > **Settings** > **Secrets and variables** > **Actions**.
3. Click **"New repository secret"** and add:
   - Name: `STREET_API_KEY` -> Value: *Your Street sandbox token*
   - Name: `GOOGLE_SHEET_ID` -> Value: *Your Google Sheet ID*
   - Name: `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` -> Value: *Open `service-account.json` in a text editor, copy all of its text `{ ... }`, and paste it here.*
4. Under the **Actions** tab in GitHub, you will see `Scheduled Street CRM to Google Sheets Sync`.
5. You can click **Run workflow** to test it in the cloud immediately!
6. By default, it runs automatically every night at `02:00 AM UTC`.
