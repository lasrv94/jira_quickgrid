# Jira QuickGrid

A local web app for viewing Jira Cloud issues in a spreadsheet-style grid. Add your own tracking fields and notes without changing Jira tickets.

## What you can do

- Browse, search, filter, sort, and group Jira issues.
- Add local text, select, number, and date fields.
- Save views with different filters and layouts.
- Write Markdown notes for each issue and export the grid to PDF.
- Switch the interface between English and Spanish.

Jira fields are read-only. Sync refreshes Jira data while preserving local custom values and notes. Deleting a local column also deletes its associated values.

## Get started

Install **Python 3.10+**, **Node.js 22.12+**, and **Git**. On Windows, enable "Add Python to PATH" during installation.

```sh
git clone https://github.com/lasrv94/jira_quickgrid.git
cd jira_quickgrid
```

### Windows

Run setup once, then launch the app:

```powershell
.\setup.bat
.\run.bat
```

You can also double-click these files. Setup installs the dependencies; the launcher starts the backend and frontend and opens your browser. Close both server windows when finished.

### macOS / Linux

```sh
chmod +x setup.sh start.sh
./setup.sh
./start.sh
```

Open **http://localhost:5173** in your browser. Press Ctrl+C in the launcher terminal to stop the app.

The app starts in **Mock mode**, so you can try it without a Jira account. See the [installation and user guide](TUTORIAL.md) for manual setup and detailed usage.

## Connect Jira Cloud

Open **Settings** and choose a connection mode:

- **Mock:** explore sample issues without credentials.
- **API token:** enter your Jira domain (such as `company.atlassian.net`), Atlassian email, and API token, then save your settings.
- **OAuth:** configure an Atlassian OAuth application, save its client credentials, and connect. Follow the [OAuth setup instructions](TUTORIAL.md#mode-3-atlassian-oauth-20-3lo).

Choose a Jira filter and sync to load your issues. Jira Server/Data Center and custom Jira hostnames are not supported.

## Using Jira QuickGrid at work

Jira QuickGrid can be suitable for individual use within a company when your organization permits the tool and its handling of Jira data. Its design reduces several common risks:

- **Read-only Jira access:** the app reads issues without changing Jira tickets, workflows, or project settings. Local tracking fields do not modify your company's Jira configuration.
- **Local storage:** downloaded issues, custom values, and notes are stored on your workstation rather than in an additional hosted service. Jira authentication and API requests still contact Atlassian, and avatars can load from external services.
- **Browser protections:** the API restricts browser origins and local access, validates Jira Cloud domains before sending credentials, and protects OAuth callbacks against replay.
- **Separate local data:** syncing Jira preserves your local custom values and notes.

These controls support workplace use; they do not guarantee safety for every person or company. Use a trusted, company-approved workstation, follow your IT/security team's requirements, and protect the unencrypted local credentials and backups. This is a single-user local tool, not a shared enterprise service. See the security details below before connecting company data.

## Your data and security

This app is intended for **one user on a trusted local workstation**. Keep both servers local; it has no application login or shared-user access controls and must not be exposed to a network or public tunnel.

Settings, credentials, and issue data are stored in `server/jira_app.db`. Notes are stored in `server/data/archivy_notes/` unless you select another folder. **Credentials are not encrypted by the app.** Protect these files and their backups, and keep them out of Git. Stop the app before copying the database and notes for a backup.

Jira connections contact Atlassian, and avatar images can load from external services. Follow your organization's policy before using company data. Read [SECURITY.md](SECURITY.md) for the full operating limits and reporting guidance.

## Documentation

- [Installation and user guide](TUTORIAL.md): setup, connection modes, grid tools, and troubleshooting.
- [Security guide](SECURITY.md): supported deployment, data protection, and known limitations.

## Development

The frontend is React with TypeScript and Vite (`client/`); the backend is FastAPI with SQLite (`server/`). Tests use temporary storage rather than your application data.

Run these checks before submitting changes:

```powershell
# From the repository root, on Windows
.\server\.venv\Scripts\pytest.exe server/tests/ -v
cd client
npm run build
npm run lint
```

On macOS/Linux, use `server/.venv/bin/pytest server/tests/ -v` for the backend tests. Keep Jira fields read-only and preserve local custom values during sync. Use `apiFetch` in `client/src/services/api.ts` for frontend API requests so the required browser protection header is included.
