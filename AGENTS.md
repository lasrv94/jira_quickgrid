# AGENTS.md — Developer & AI Agent Guidelines

This document provides system context, architectural invariants, code conventions, and verification procedures for AI coding agents and human contributors working on the **Jira QuickGrid** repository.

---

## 1. System Overview & Technology Stack

* **Frontend:**
  * **Framework:** React 19 (functional components + hooks), Vite v8, TypeScript 5.8+.
  * **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`). Clean, modern interactive grid styling (soft pastels, subtle borders, compact typography).
  * **Icons:** `lucide-react`.
  * **Bilingual Support:** `client/src/utils/i18n.ts`. All user-facing strings must support both English (`en`) and Spanish (`es`).
* **Backend:**
  * **Framework:** FastAPI (Python 3.10+).
  * **Database:** SQLite with Write-Ahead Logging (WAL mode) and foreign keys enabled via SQLAlchemy (`server/database.py`).
  * **Validation:** Pydantic v2 schemas (`server/models.py`).
  * **Testing:** `pytest` + `httpx` (`server/tests/`).
* **Data Stores:**
  * Embedded SQLite: `server/jira_app.db`.
  * Local Markdown notes: `server/data/archivy_notes/*.md`.

---

## 2. Non-Negotiable Architectural Invariants

### 1. Jira Fields are STRICTLY Read-Only
* Any column or cell originating from Jira Cloud (e.g., `key`, `summary`, `jira_status`, `priority`, `assignee_name`, `issue_type`, or any dynamic Jira field added via `col.type === 'jira_field'` or `col.jira_field_key`) **MUST NOT** be editable in the UI.
* Do not attach edit handlers, double-click input triggers, or edit pencil icons to Jira fields.
* They are authoritative mirrors of the remote Jira instance.

### 2. Local Custom Fields Never Overwrite Jira & Are Never Overwritten
* Only locally created columns (e.g. `single_select`, `text`, `long_text`, `number`, `date`, `archivy_link`) can be edited.
* Edits to local fields are saved to `issue_custom_values` via `POST /api/issues/{key}/custom-values`.
* When the user triggers **Sync Issues**, the backend executes an **UPSERT** on `jira_issues`. It **never** touches, modifies, or truncates `issue_custom_values`.
* Local fields must retain their values even if a ticket is archived or changed in Jira.

### 3. Schema Evolution & SQLite Auto-Migrations
* In `server/main.py`, new table columns are checked upon startup using SQLite `PRAGMA table_info(...)`.
* If a new column is added to SQLAlchemy models (e.g. `saved_views.filter_rules`), add a guarded auto-migration snippet in `server/main.py` to prevent errors on existing user databases.

---

## 3. Filtering Engine Conventions (`filterEvaluator.ts`)

* **Field Key Resolution:**
  When extracting values for filtering via `getFieldValue(issue, fieldId, columns)`:
  * Check if `fieldId` corresponds to a `CustomColumn` with a `jira_field_key` (e.g., `customfield_10043`). If so, read from `issue.raw_jira_fields[jira_field_key]`.
  * Check if `fieldId` exists on `issue`, `issue.custom_values`, or `issue.raw_jira_fields`.
* **Multi-Select & Array Handling:**
  * Jira arrays (Components, Labels, multi-select custom fields) or comma-separated strings must be unpacked via `extractArrayItems(val)`.
  * Operators for multi-select fields:
    * `has_any_of`: Target items intersect with issue items.
    * `has_all_of`: Target items are a subset of issue items.
    * `has_none_of`: Disjoint sets.
    * `is_exactly`: Exact set equality.
  * Standard text operators (`contains`, `equals`) on array fields should check whether any item in the array matches.
* **Filter Conditions Storage:**
  * Multi-item targets are stored as JSON stringified arrays (e.g., `'["item1", "item2"]'`) or comma-separated strings, parsed safely with `parseTargetItems`.

---

## 4. UI / Component Guidelines

* **Toolbar Structure:**
  * Keep tools logically ordered: Jira Filter Selector -> Sync Button -> Search Input -> Filter Menu Button -> Sort Menu -> Group Menu -> Columns Visibility -> Manage Fields -> Add Column -> PDF Export -> Settings.
* **Active State Feedback:**
  * When filters are active (`filterConditions.length > 0`), the Filter button must be badged and highlighted (`border-emerald-500 bg-emerald-50 text-emerald-800`).
* **Table Horizontal Scrolling & Sizing:**
  * Maintain dynamic column widths and ensure table horizontal scrollbar exists without cutting off dropdowns or modals.

---

## 5. Verification Commands

Before committing or pushing any changes, execute and verify:

1. **Frontend Type-Check & Build:**
   ```bash
   cd client
   npm run build
   ```
   Must pass with 0 TypeScript errors.

2. **Frontend Linter:**
   ```bash
   cd client
   npm run lint
   ```
   Must pass with 0 errors.

3. **Backend Test Suite:**
   ```bash
   # From project root
   .\server\.venv\Scripts\pytest.exe server/tests/ -v
   ```
   All persistence, API integration, and security tests must pass (41 cases after the security review). Tests must use temporary storage, never the user's application database or notes.


## 6. Security invariants

* Preserve the loopback-only, single-user boundary. Do not widen host/origin allowlists or expose ports without designing real authentication and authorization.
* Use `apiFetch` for frontend API requests; it adds `X-QuickGrid-Client: 1`. This header is a CSRF control, not authentication.
* OAuth state must be random, expire, be browser-bound, and be consumed once. Callback URLs must exactly match the allowlist.
* Validate Jira Cloud domains before sending credentials, including values already saved in the database.
* Reject writes to Jira-mapped values on the backend as well as in the UI.
* Do not print upstream response bodies or secrets in errors. Do not track private notes, databases, or credentials.
* Keep [SECURITY.md](SECURITY.md) accurate; never claim encrypted storage or enterprise multi-user safety without implementing and verifying those controls.
