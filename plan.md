# Implementation Plan: Jira QuickGrid

An internal web application for visual, modern, and lightweight Jira issue management featuring an **Airtable-style** data grid, **OAuth 2.0 (3LO)** and **API Token** authentication, persistent local custom fields (internal statuses, QA commentary, color single-selects) that are **never overwritten during sync**, and integrated **Archivy** Markdown knowledge base support.

---

## 1. High-Level Architecture & Tech Stack

### Frontend (SPA, Reactive & Local-First)
* **Framework:** React 19 / Vite + TypeScript.
* **Styling:** Tailwind CSS v4 with an Airtable-inspired palette (soft pastel pills, subtle borders, high-density typography).
* **Data Grid:** TanStack Table v8 with dynamic horizontal scrolling and sticky columns (`Key`, `Summary`).
* **Icons & UI:** Lucide React icons.
* **Bilingual Support:** Integrated English & Spanish localization dictionary (`client/src/utils/i18n.ts`).

### Backend (REST API & Sync Engine)
* **Framework:** FastAPI (Python 3.10+).
* **Database:** SQLite with WAL mode (Write-Ahead Logging) and foreign keys enabled via SQLAlchemy (`server/database.py`).
* **Local Persistence:** Embedded SQLite (`jira_app.db`) and Markdown file storage (`server/data/archivy_notes/`).

---

## 2. Relational Data Model & No-Overwrite Guarantee

The critical architectural invariant is that **Jira fields are strictly synchronized in a read-only mirror**, while **local fields created by the user (internal status, QA notes, custom tags) are NEVER erased or overwritten upon sync**.

### Entity-Relationship Diagram

```mermaid
erDiagram
    JIRA_ISSUES ||--o{ ISSUE_CUSTOM_VALUES : "has custom data"
    CUSTOM_COLUMNS ||--o{ ISSUE_CUSTOM_VALUES : "defines schema"
    SAVED_CONFIGS ||--o{ JIRA_ISSUES : "filters scope"
    SAVED_VIEWS ||--o{ SAVED_CONFIGS : "organizes layouts"

    JIRA_ISSUES {
        string key PK "e.g. KAN-101"
        string jira_id UK "Numeric Jira ID"
        string summary "Issue summary"
        string jira_status "Jira status name"
        string jira_status_category "To Do / In Progress / Done"
        string issue_type "Bug, Task, Story..."
        string priority "Highest, High, Medium, Low..."
        string assignee_name "Assignee display name"
        string assignee_avatar "Avatar URL"
        string reporter_name "Reporter display name"
        datetime jira_created_at "Creation timestamp"
        datetime jira_updated_at "Last update timestamp"
        json raw_jira_fields "Full raw JSON payload from Jira"
        datetime last_synced_at "Sync timestamp"
        boolean is_archived_in_jira "Flag if excluded from current JQL"
    }

    CUSTOM_COLUMNS {
        string id PK "UUID or column key"
        string name "e.g. QA Status, Dev Notes"
        string type "single_select, text, long_text, date, number, archivy_link, jira_field"
        json options "Array of options with color tags"
        int position "Display order position"
        boolean is_visible "Visibility flag"
        int width "Pixel width"
        string jira_field_key "Mapped Jira custom field key if imported"
    }

    ISSUE_CUSTOM_VALUES {
        string issue_key PK "FK to JIRA_ISSUES"
        string column_id PK "FK to CUSTOM_COLUMNS"
        json value "User entered value"
        datetime updated_at "Update timestamp"
        string updated_by "Editor"
    }

    SAVED_CONFIGS {
        string id PK "default"
        string selected_filter_id "Jira filter ID"
        string selected_filter_name "Jira filter display name"
        string filter_jql "Direct JQL query"
        datetime last_sync "Timestamp"
        string jira_auth_type "mock, pat, oauth"
        string jira_domain "Domain"
        string jira_email "Email"
        string jira_api_token "API Token"
        string jira_client_id "OAuth Client ID"
        string jira_client_secret "OAuth Client Secret"
    }

    SAVED_VIEWS {
        string id PK "View UUID"
        string name "View name"
        string group_by "Grouping field"
        string sort_field "Sort field"
        string sort_direction "asc or desc"
        string search_query "Search text"
        string filter_id "Jira filter ID"
        json visible_columns "Array of column IDs"
        json filter_rules "Compound Airtable filter rules"
        boolean is_default "Default view flag"
    }
```

---

## 3. Jira Synchronization Flow

1. **JQL Query Execution:** Fetches issues matching user's selected Jira filter or direct JQL (`/rest/api/3/search/jql`).
2. **UPSERT on `jira_issues`:** Inserts new issues or updates existing Jira attributes.
3. **Preservation of `issue_custom_values`:** The local custom values table is strictly indexed by `(issue_key, column_id)` and is never updated or purged by the Jira sync cycle.
4. **Scope Archival:** Issues that no longer match the current filter query are flagged `is_archived_in_jira = True` so the UI reflects the exact sprint or filter scope.

---

## 4. Airtable-Style Filtering Engine

* **Compound Rules:** Global `AND` / `OR` conjunction toggle.
* **Operators:**
  * Multi-select & Arrays: `has any of`, `has all of`, `has none of`, `is exactly`.
  * Text: `contains`, `not contains`, `is`, `is not`, `starts with`, `ends with`, `is empty`, `is not empty`.
  * Numbers: `=`, `≠`, `>`, `<`, `≥`, `≤`, `is empty`, `is not empty`.
  * Dates: `is`, `is before`, `is after`, `is today`, `is empty`, `is not empty`.
* **Dynamic Tag Picker:** Interactive pill container allowing one-click tag additions from discovered issue data and manual tag creation.
* **Saved View Persistence:** Active filter trees are preserved in `saved_views.filter_rules` and restored on view tab changes.
