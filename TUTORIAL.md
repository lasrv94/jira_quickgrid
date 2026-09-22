# 📘 Installation & User Manual: Jira QuickGrid

Welcome to **Jira QuickGrid**. This guide explains step-by-step how to install, configure, use this application on your own workstation. For a short introduction, see the [README](README.md); for deployment and credential limits, see the [security guide](SECURITY.md).

---

## 📋 1. Prerequisites

Before getting started, make sure you have installed on your computer:

* **Python:** Version 3.10 or higher ([Download Python](https://www.python.org/downloads/)). *(On Windows, make sure to check "Add Python to PATH")*.
* **Node.js:** Version 22.12 or higher ([Download Node.js LTS](https://nodejs.org/)).
* **Git:** For cloning and version controlling the codebase ([Download Git](https://git-scm.com/)).

---

## 🚀 2. Step-by-Step Installation

### Windows (Recommended 1-Click Setup)
1. Open the project folder in Windows Explorer or your terminal.
2. Double-click **`setup.bat`** (or run it from CMD/PowerShell).
3. The setup script will automatically create the Python virtual environment (`.venv`), install backend dependencies, and install frontend npm packages.

### macOS / Linux
Open your terminal in the project root directory and run:
```bash
chmod +x setup.sh start.sh
./setup.sh
```

### Manual Installation (Optional)
If you prefer setting up each component manually:
```bash
# 1. Setup Backend
cd server
python -m venv .venv

# On Windows:
.\.venv\Scripts\activate
# On macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
cd ..

# 2. Setup Frontend
cd client
npm ci
cd ..
```

---

## 💻 3. Running the Application

### Windows
* **Double-click `run.bat`**  
  *Or in PowerShell:*
  ```powershell
  .\start.ps1
  ```
This starts both the FastAPI backend and Vite frontend concurrently and opens your default browser.

### macOS / Linux
```bash
./start.sh
```

### Access URLs:
* **Web Application (Grid):** [http://localhost:5173](http://localhost:5173)
* **Interactive API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🎯 4. Application User Manual

### 4.1. Navigating the QuickGrid Interactive Data Grid
* **Sticky Columns:** The **Jira Key** (`Key`) and **Summary** (`Summary`) columns remain pinned to the left while you scroll horizontally across additional fields.
* **Jira Native Columns (Read-Only):** Native Jira columns feature a lock indicator, reminding you they originate from Jira Cloud and cannot be edited locally, guaranteeing fidelity with your company's official source of truth.

### 4.2. Creating Local Custom Fields
You can create internal tracking fields that **Jira does not have** by clicking **`+ Add Field`** in the toolbar:
1. **Single Select (Color Pills):** Define custom workflow stages (e.g. *"In QA Analysis"*, *"Ready for Deploy"*, *"Blocked on Staging"*). Assign distinctive pastel colors to each option.
2. **Short Text / Long Text:** For internal QA commentary, technical notes, or private team reminders.
3. **Date & Number:** Track internal target deadlines, confidence scores, or custom estimates.
4. **Archivy Wiki Link:** Direct link to an internal Markdown documentation note for that ticket.

### 4.3. Safe Sync Guarantee (No Overwrites)
* When you click **`[ 🔄 Update Data ]`**:
  * The system pulls the latest issue statuses, summaries, and assignees from Jira.
  * **Your local fields (internal statuses, QA comments, ratings) are NEVER overwritten or lost**, as they live in a separate local relational table indexed by the ticket key.

### 4.4. Advanced Multi-Field Filters
Click **`[ 🔍 Filter ]`** in the top toolbar to open the filtering popover:
* **Add Multiple Rules:** Click **`+ Add condition`** to add one or more filter rules.
* **Compound Logic:** Toggle between `All (AND)` (all conditions must match) or `Any (OR)` (any condition matches).
* **Multi-Select Operators:**
  * For labels, components, and Jira multi-select fields (like custom fields), use:
    * `has any of`: matches tickets containing at least one chosen tag.
    * `has all of`: matches tickets containing all chosen tags.
    * `has none of`: excludes tickets with those tags.
    * `is exactly`: requires the exact same set of tags.
  * Pick options directly from discovered pills (`[ Tag 1 ✕ ] [ Tag 2 ✕ ]`) or type custom values.
* **Real-time Counter:** Watch the live indicator show `"Showing X of Y issues"` instantly.

### 4.5. Dynamic Grouping (Group By)
Click the **`📑 Group`** button in the toolbar:
* Group tickets by **Jira Status**, **Priority**, **Assignee**, or any of your **Local Single-Select Columns**.
* Each group header is collapsible and shows total ticket count.

### 4.6. Technical Documentation with Archivy Drawer
* Click **`Wiki Doc`** on any row to slide out the Markdown editor.
* Draft root-cause analyses (RCA), test plans, or meeting notes with live rendered Markdown preview.
* Notes are saved locally as `.md` files in `server/data/archivy_notes/`.

### 4.7. One-Click PDF Export
* Click the **`📄 Export PDF`** button in the toolbar to generate a printable PDF summary of your filtered grid view.

---

## ⚙️ 5. Jira Connection Modes

Click the gear icon **`⚙️`** in the top right to configure your connection:

### Mode 1: Mock / Demo (Default)
* Requires no credentials or Jira account.
* Loads a full active sprint dataset with diverse statuses and priorities for immediate testing.

### Mode 2: Jira Cloud API Token (API Token)
A direct way to connect to your corporate Jira instance without administrative assistance:
1. **Domain:** Your Jira Cloud subdomain (e.g. `your-company.atlassian.net`).
2. **Email:** Your Atlassian user email.
3. **API Token:** Generate a personal token at [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens).
4. Click **Validate with Jira** and **Save Settings**.

### Mode 3: Atlassian OAuth 2.0 (3LO)
For standard corporate OAuth flows:
1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/).
2. Create an OAuth 2.0 (3LO) app and add the **Jira platform REST API**.
3. Under **Callback URL**, set: `http://localhost:5173/auth/callback`.
4. Under **Scopes**, add: `read:jira-work`, `read:jira-user`, `offline_access`.
5. Copy your `Client ID` and `Client Secret` into the app and click **Connect with Atlassian Jira**.

---

## 🔒 6. Security FAQ

### "Is it safe to connect to our corporate Jira?"
Use it only on a trusted, single-user workstation and follow your organization's approval and data-handling rules. See [SECURITY.md](SECURITY.md).

* Keep backend and frontend on loopback. Do not publish port 8000 or 5173 or put the app behind a network proxy.
* The app sends read requests to Jira; an API token may still have broader permissions. OAuth requests read scopes plus offline access. Prefer the minimum privileges your workflow needs.
* Jira tokens, OAuth secrets, and downloaded tickets are stored unencrypted in SQLite. Protect the database, notes, and backups using OS permissions and disk encryption.
* The browser can load remote avatar images; mock mode includes external image URLs. Jira/OAuth traffic goes to Atlassian. Do not assume the application is fully offline.
* Private Markdown notes are ignored by Git. Sharing code does not require sharing your database, notes, credentials, or PDF exports.

### Troubleshooting security checks
* Use exactly `http://localhost:5173` or `http://127.0.0.1:5173`. Vite fails if port 5173 is occupied instead of silently switching ports.
* For scripts, send `X-QuickGrid-Client: 1` to API endpoints. This is not authentication; all local processes remain trusted.
* OAuth callbacks must match the origin used to open the app and the callback registered in Atlassian. Login attempts expire after ten minutes and cannot be replayed. A backend restart invalidates pending attempts; start login again.
* Only `company.atlassian.net` domains (or the equivalent HTTPS base URL) are accepted. Jira Server/Data Center and arbitrary custom hosts are unsupported.
* Notes use letters, digits, underscores and hyphens in filenames; paths, Windows device names, and symlink note files are rejected.
* Environment variables must be set in the process that launches the backend. The app does not automatically load `.env` files.
