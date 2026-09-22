import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session
from models import JiraIssue, SavedConfig

logger = logging.getLogger(__name__)

MOCK_FILTERS = [
    {"id": "fav-1", "name": "Sprint 34 - Sprint Backlog", "jql": "project = CORE AND sprint in openSprints() ORDER BY priority DESC"},
    {"id": "fav-2", "name": "Mis Tickets Asignados", "jql": "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC"},
    {"id": "fav-3", "name": "Bugs Críticos en Producción", "jql": "issuetype = Bug AND priority in (High, Highest) AND status != Done"},
    {"id": "fav-4", "name": "Todos los Tickets Activos", "jql": "statusCategory in ('To Do', 'In Progress') ORDER BY created DESC"},
]

MOCK_ISSUES = [
    {
        "key": "CORE-101",
        "jira_id": "10001",
        "summary": "Implementar flujo OAuth 2.0 3LO con Atlassian Cloud",
        "jira_status": "In Progress",
        "jira_status_category": "In Progress",
        "issue_type": "Story",
        "priority": "Highest",
        "assignee_name": "Laura Sánchez",
        "assignee_avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
        "reporter_name": "Carlos Mendoza",
        "jira_created_at": "2026-03-01T10:00:00Z",
        "jira_updated_at": "2026-03-20T14:30:00Z",
        "raw_jira_fields": {"story_points": 5, "component": "Auth"}
    },
    {
        "key": "CORE-102",
        "jira_id": "10002",
        "summary": "Memory leak al virtualizar tabla de 5,000 elementos en navegador",
        "jira_status": "To Do",
        "jira_status_category": "To Do",
        "issue_type": "Bug",
        "priority": "High",
        "assignee_name": "Mateo Rivera",
        "assignee_avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
        "reporter_name": "Laura Sánchez",
        "jira_created_at": "2026-03-05T11:20:00Z",
        "jira_updated_at": "2026-03-18T09:15:00Z",
        "raw_jira_fields": {"story_points": 3, "component": "Frontend"}
    },
    {
        "key": "CORE-103",
        "jira_id": "10003",
        "summary": "Soporte de Markdown enriquecido en Drawer lateral para Archivy",
        "jira_status": "In Review",
        "jira_status_category": "In Progress",
        "issue_type": "Story",
        "priority": "Medium",
        "assignee_name": "Elena Morales",
        "assignee_avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
        "reporter_name": "Mateo Rivera",
        "jira_created_at": "2026-03-08T16:00:00Z",
        "jira_updated_at": "2026-03-21T17:45:00Z",
        "raw_jira_fields": {"story_points": 8, "component": "KnowledgeBase"}
    },
    {
        "key": "CORE-104",
        "jira_id": "10004",
        "summary": "Alinear paleta de colores y pill badges con Airtable Design System",
        "jira_status": "Done",
        "jira_status_category": "Done",
        "issue_type": "Task",
        "priority": "Low",
        "assignee_name": "Carlos Mendoza",
        "assignee_avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces",
        "reporter_name": "Elena Morales",
        "jira_created_at": "2026-02-28T08:30:00Z",
        "jira_updated_at": "2026-03-15T12:00:00Z",
        "raw_jira_fields": {"story_points": 2, "component": "UI/UX"}
    },
    {
        "key": "CORE-105",
        "jira_id": "10005",
        "summary": "Filtros multi-criterio y ordenación multinivel en TanStack Table",
        "jira_status": "In Progress",
        "jira_status_category": "In Progress",
        "issue_type": "Story",
        "priority": "High",
        "assignee_name": "Laura Sánchez",
        "assignee_avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
        "reporter_name": "Carlos Mendoza",
        "jira_created_at": "2026-03-10T14:10:00Z",
        "jira_updated_at": "2026-03-22T10:00:00Z",
        "raw_jira_fields": {"story_points": 5, "component": "Frontend"}
    },
    {
        "key": "CORE-106",
        "jira_id": "10006",
        "summary": "Error 401 al renovar refresh token expirado en Atlassian Auth",
        "jira_status": "QA Testing",
        "jira_status_category": "In Progress",
        "issue_type": "Bug",
        "priority": "Highest",
        "assignee_name": "Mateo Rivera",
        "assignee_avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
        "reporter_name": "Laura Sánchez",
        "jira_created_at": "2026-03-12T09:00:00Z",
        "jira_updated_at": "2026-03-21T11:20:00Z",
        "raw_jira_fields": {"story_points": 3, "component": "Auth"}
    },
    {
        "key": "CORE-107",
        "jira_id": "10007",
        "summary": "Agrupación dinámica estilo Airtable con recuento de filas y colapso",
        "jira_status": "In Progress",
        "jira_status_category": "In Progress",
        "issue_type": "Story",
        "priority": "Medium",
        "assignee_name": "Elena Morales",
        "assignee_avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
        "reporter_name": "Mateo Rivera",
        "jira_created_at": "2026-03-14T15:40:00Z",
        "jira_updated_at": "2026-03-22T08:15:00Z",
        "raw_jira_fields": {"story_points": 5, "component": "UI/UX"}
    },
    {
        "key": "CORE-108",
        "jira_id": "10008",
        "summary": "Optimización SQLite WAL mode para transacciones concurrentes",
        "jira_status": "Done",
        "jira_status_category": "Done",
        "issue_type": "Task",
        "priority": "Low",
        "assignee_name": "Carlos Mendoza",
        "assignee_avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces",
        "reporter_name": "Elena Morales",
        "jira_created_at": "2026-03-02T13:00:00Z",
        "jira_updated_at": "2026-03-19T16:30:00Z",
        "raw_jira_fields": {"story_points": 2, "component": "Backend"}
    }
]

class JiraService:
    @staticmethod
    def get_or_create_config(db: Session) -> SavedConfig:
        config = db.query(SavedConfig).filter(SavedConfig.id == "default").first()
        if not config:
            config = SavedConfig(
                id="default",
                jira_auth_type="mock",
                selected_filter_id="fav-1",
                selected_filter_name="Sprint 34 - Sprint Backlog",
                filter_jql="project = CORE AND sprint in openSprints() ORDER BY priority DESC"
            )
            db.add(config)
            db.commit()
            db.refresh(config)
        return config

    @staticmethod
    async def get_filters(db: Session) -> List[Dict[str, Any]]:
        config = JiraService.get_or_create_config(db)
        if config.jira_auth_type == "mock":
            return MOCK_FILTERS

        if config.jira_auth_type == "pat":
            # Basic Auth with Jira Domain + Email + Token
            if not config.jira_domain or not config.jira_email or not config.jira_api_token:
                return MOCK_FILTERS
            url = f"https://{config.jira_domain}/rest/api/3/filter/favourite"
            auth = (config.jira_email, config.jira_api_token)
            async with httpx.AsyncClient() as client:
                res = await client.get(url, auth=auth, headers={"Accept": "application/json"})
                if res.status_code == 200:
                    data = res.json()
                    return [{"id": str(f.get("id")), "name": f.get("name"), "jql": f.get("jql", "")} for f in data]

        if config.jira_auth_type == "oauth":
            if not config.jira_access_token or not config.jira_cloud_id:
                return MOCK_FILTERS
            url = f"https://api.atlassian.com/ex/jira/{config.jira_cloud_id}/rest/api/3/filter/favourite"
            headers = {
                "Authorization": f"Bearer {config.jira_access_token}",
                "Accept": "application/json",
            }
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return [{"id": str(f.get("id")), "name": f.get("name"), "jql": f.get("jql", "")} for f in data]

        return MOCK_FILTERS

    @staticmethod
    async def sync_issues_from_jira(db: Session, filter_id: Optional[str] = None) -> Tuple[int, int]:
        """
        Synchronizes issues from Jira without touching local custom values.
        Returns (synced_count, total_count).
        """
        config = JiraService.get_or_create_config(db)
        if filter_id:
            config.selected_filter_id = filter_id
            # update name/jql if mock
            for f in MOCK_FILTERS:
                if f["id"] == filter_id:
                    config.selected_filter_name = f["name"]
                    config.filter_jql = f["jql"]
            db.commit()

        raw_issues = []
        if config.jira_auth_type == "mock" or not (config.jira_access_token or config.jira_api_token):
            raw_issues = MOCK_ISSUES
        elif config.jira_auth_type == "pat":
            raw_issues = await JiraService._fetch_pat_issues(config)
        elif config.jira_auth_type == "oauth":
            raw_issues = await JiraService._fetch_oauth_issues(config)

        if not raw_issues:
            raw_issues = MOCK_ISSUES

        now = datetime.now(timezone.utc)
        synced_keys = set()

        for item in raw_issues:
            key = item["key"]
            synced_keys.add(key)
            existing = db.query(JiraIssue).filter(JiraIssue.key == key).first()
            created_dt = None
            if item.get("jira_created_at"):
                try:
                    created_dt = datetime.fromisoformat(item["jira_created_at"].replace("Z", "+00:00"))
                except Exception:
                    pass

            updated_dt = None
            if item.get("jira_updated_at"):
                try:
                    updated_dt = datetime.fromisoformat(item["jira_updated_at"].replace("Z", "+00:00"))
                except Exception:
                    pass

            if existing:
                # Update only Jira native fields
                existing.jira_id = item.get("jira_id")
                existing.summary = item.get("summary", "")
                existing.jira_status = item.get("jira_status", "Open")
                existing.jira_status_category = item.get("jira_status_category", "To Do")
                existing.issue_type = item.get("issue_type", "Task")
                existing.priority = item.get("priority", "Medium")
                existing.assignee_name = item.get("assignee_name")
                existing.assignee_avatar = item.get("assignee_avatar")
                existing.reporter_name = item.get("reporter_name")
                existing.jira_created_at = created_dt or existing.jira_created_at
                existing.jira_updated_at = updated_dt or existing.jira_updated_at
                existing.raw_jira_fields = item.get("raw_jira_fields")
                existing.last_synced_at = now
                existing.is_archived_in_jira = False
            else:
                new_issue = JiraIssue(
                    key=key,
                    jira_id=item.get("jira_id"),
                    summary=item.get("summary", ""),
                    jira_status=item.get("jira_status", "Open"),
                    jira_status_category=item.get("jira_status_category", "To Do"),
                    issue_type=item.get("issue_type", "Task"),
                    priority=item.get("priority", "Medium"),
                    assignee_name=item.get("assignee_name"),
                    assignee_avatar=item.get("assignee_avatar"),
                    reporter_name=item.get("reporter_name"),
                    jira_created_at=created_dt or now,
                    jira_updated_at=updated_dt or now,
                    raw_jira_fields=item.get("raw_jira_fields"),
                    last_synced_at=now,
                    is_archived_in_jira=False,
                )
                db.add(new_issue)

        config.last_sync = now
        db.commit()

        total = db.query(JiraIssue).count()
        return len(synced_keys), total

    @staticmethod
    async def _fetch_pat_issues(config: SavedConfig) -> List[Dict[str, Any]]:
        jql = config.filter_jql or "ORDER BY updated DESC"
        url = f"https://{config.jira_domain}/rest/api/3/search"
        auth = (config.jira_email, config.jira_api_token)
        issues = []
        start_at = 0
        max_results = 100

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {"jql": jql, "startAt": start_at, "maxResults": max_results}
                res = await client.get(url, auth=auth, params=params, headers={"Accept": "application/json"})
                if res.status_code != 200:
                    break
                data = res.json()
                items = data.get("issues", [])
                for i in items:
                    issues.append(JiraService._parse_jira_issue(i))
                start_at += len(items)
                total = data.get("total", 0)
                if start_at >= total or len(items) == 0:
                    break

        return issues

    @staticmethod
    async def _fetch_oauth_issues(config: SavedConfig) -> List[Dict[str, Any]]:
        jql = config.filter_jql or "ORDER BY updated DESC"
        url = f"https://api.atlassian.com/ex/jira/{config.jira_cloud_id}/rest/api/3/search"
        headers = {
            "Authorization": f"Bearer {config.jira_access_token}",
            "Accept": "application/json",
        }
        issues = []
        start_at = 0
        max_results = 100

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {"jql": jql, "startAt": start_at, "maxResults": max_results}
                res = await client.get(url, headers=headers, params=params)
                if res.status_code != 200:
                    break
                data = res.json()
                items = data.get("issues", [])
                for i in items:
                    issues.append(JiraService._parse_jira_issue(i))
                start_at += len(items)
                total = data.get("total", 0)
                if start_at >= total or len(items) == 0:
                    break

        return issues

    @staticmethod
    def _parse_jira_issue(item: Dict[str, Any]) -> Dict[str, Any]:
        fields = item.get("fields", {})
        status = fields.get("status", {})
        status_cat = status.get("statusCategory", {}).get("name", "To Do")
        assignee = fields.get("assignee") or {}
        avatar_urls = assignee.get("avatarUrls", {})
        avatar = avatar_urls.get("48x48") or avatar_urls.get("32x32")

        return {
            "key": item.get("key"),
            "jira_id": item.get("id"),
            "summary": fields.get("summary", ""),
            "jira_status": status.get("name", "Open"),
            "jira_status_category": status_cat,
            "issue_type": fields.get("issuetype", {}).get("name", "Task"),
            "priority": fields.get("priority", {}).get("name", "Medium"),
            "assignee_name": assignee.get("displayName"),
            "assignee_avatar": avatar,
            "reporter_name": (fields.get("reporter") or {}).get("displayName"),
            "jira_created_at": fields.get("created"),
            "jira_updated_at": fields.get("updated"),
            "raw_jira_fields": {
                "description": fields.get("description"),
                "labels": fields.get("labels", []),
            },
        }
