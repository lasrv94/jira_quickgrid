import json
from security import normalize_jira_domain
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException
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
        "summary": "Alinear paleta de colores y pill badges con QuickGrid Design System",
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
        "summary": "Agrupación dinámica estilo QuickGrid con recuento de filas y colapso",
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

DEFAULT_FIELDS = "*all"

class JiraService:
    @staticmethod
    def get_or_create_config(db: Session) -> SavedConfig:
        config = db.query(SavedConfig).filter(SavedConfig.id == "default").first()
        if not config:
            default_filter = {
                "id": "fav-1",
                "name": "Sprint 34 - Sprint Backlog",
                "jql": "project = CORE AND sprint in openSprints() ORDER BY priority DESC"
            }
            config = SavedConfig(
                id="default",
                jira_auth_type="mock",
                selected_filter_id=default_filter["id"],
                selected_filter_name=default_filter["name"],
                filter_jql=default_filter["jql"],
                configured_filters=[default_filter]
            )
            db.add(config)
            db.commit()
            db.refresh(config)
        return config

    @staticmethod
    def _make_bounded_jql(jql: Optional[str]) -> str:
        """
        Ensures JQL query satisfies Jira Cloud's requirement for bounded queries (CHANGE-2046).
        """
        if not jql or not jql.strip():
            return "project is not EMPTY ORDER BY created DESC"
        
        trimmed = jql.strip()
        lower = trimmed.lower()
        if lower.startswith("order by"):
            return f"project is not EMPTY {trimmed}"
        
        # Check if query has project, created, updated, or assignee
        has_bound = any(k in lower for k in ["project", "created", "updated", "assignee", "reporter", "issuetype", "id", "key"])
        if not has_bound:
            return f"project is not EMPTY AND ({trimmed})"
        
        return trimmed

    @staticmethod
    async def get_filters(db: Session) -> List[Dict[str, Any]]:
        """
        Returns only the Jira filters explicitly configured by the user.
        Never auto-injects all Jira projects or favorite filters.
        """
        config = JiraService.get_or_create_config(db)
        saved = config.configured_filters
        if saved and isinstance(saved, list) and len(saved) > 0:
            return saved

        # Fallback to selected_filter_id if configured_filters is not populated yet
        if config.selected_filter_id:
            fallback = [{
                "id": config.selected_filter_id,
                "name": config.selected_filter_name or f"Filtro #{config.selected_filter_id}",
                "jql": config.filter_jql or ""
            }]
            config.configured_filters = fallback
            db.commit()
            return fallback

        if config.jira_auth_type == "mock":
            mock_default = [MOCK_FILTERS[0]]
            config.configured_filters = mock_default
            db.commit()
            return mock_default

        default_one = [{
            "id": "default-all",
            "name": "✨ Todos los tickets",
            "jql": "project is not EMPTY ORDER BY created DESC"
        }]
        config.configured_filters = default_one
        db.commit()
        return default_one

    @staticmethod
    async def get_available_jira_filters(db: Session) -> List[Dict[str, Any]]:
        """
        Fetches user's favorite filters and projects directly from the Jira instance
        so the user can explore and choose which ones to add to their configured list.
        """
        config = JiraService.get_or_create_config(db)
        if config.jira_auth_type == "mock":
            return MOCK_FILTERS

        base_url, auth, headers = JiraService._get_connection_details(config)
        if not base_url:
            return []

        results: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=15.0, verify=JiraService._verify_tls(config)) as client:
            # 1. Fetch user favorite filters from Jira
            try:
                fav_res = await client.get(f"{base_url}/rest/api/3/filter/favourite", auth=auth, headers=headers)
                if fav_res.status_code == 200:
                    for f in fav_res.json():
                        results.append({
                            "id": f"fav-{f.get('id')}",
                            "name": f"⭐ {f.get('name')}",
                            "jql": f.get("jql", "")
                        })
            except Exception as e:
                logger.warning(f"Error fetching favorite filters: {e}")

            # 2. Fetch Projects from Jira instance
            try:
                proj_res = await client.get(f"{base_url}/rest/api/3/project", auth=auth, headers=headers)
                if proj_res.status_code == 200:
                    for p in proj_res.json():
                        pkey = p.get("key")
                        pname = p.get("name") or pkey
                        results.append({
                            "id": f"proj-{pkey}",
                            "name": f"📁 Proyecto: {pkey} ({pname})",
                            "jql": f"project = \"{pkey}\" ORDER BY created DESC"
                        })
            except Exception as e:
                logger.warning(f"Error fetching projects: {e}")

            # 3. Add handy smart presets
            results.append({
                "id": "my-assigned",
                "name": "👤 Mis tickets asignados",
                "jql": "assignee = currentUser() ORDER BY updated DESC"
            })
            results.append({
                "id": "unassigned-open",
                "name": "❓ Tickets sin asignar",
                "jql": "assignee is EMPTY ORDER BY created DESC"
            })
            results.append({
                "id": "all-projects",
                "name": "✨ Todos los tickets (Todos los proyectos)",
                "jql": "project is not EMPTY ORDER BY created DESC"
            })

        return results

    @staticmethod
    async def add_configured_filter(
        db: Session,
        filter_id: Optional[str] = None,
        name: Optional[str] = None,
        jql: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        config = JiraService.get_or_create_config(db)
        filters = list(config.configured_filters or [])

        target_id = (filter_id or "").strip()
        target_name = (name or "").strip()
        target_jql = (jql or "").strip()

        # If user entered a numeric Jira filter ID, look up its name and JQL
        if target_id and (target_id.isdigit() or (target_id.startswith("fav-") and target_id.replace("fav-", "").isdigit())):
            clean_id = target_id.replace("fav-", "")
            base_url, auth, headers = JiraService._get_connection_details(config)
            if base_url:
                try:
                    async with httpx.AsyncClient(timeout=10.0, verify=JiraService._verify_tls(config)) as client:
                        f_res = await client.get(f"{base_url}/rest/api/3/filter/{clean_id}", auth=auth, headers=headers)
                        if f_res.status_code == 200:
                            fdata = f_res.json()
                            if not target_name:
                                target_name = f"⭐ {fdata.get('name')}"
                            if not target_jql:
                                target_jql = fdata.get("jql", "")
                except Exception as e:
                    logger.warning(f"Could not fetch filter details: {e}")

        if not target_id:
            import uuid
            target_id = f"filter-{uuid.uuid4().hex[:8]}"

        if not target_name:
            target_name = f"Filtro #{target_id}"

        # If JQL is provided, normalize/validate bounded JQL
        if not target_jql:
            target_jql = "project is not EMPTY ORDER BY created DESC"

        existing_idx = next((i for i, f in enumerate(filters) if f.get("id") == target_id), None)
        new_entry = {"id": target_id, "name": target_name, "jql": target_jql}
        if existing_idx is not None:
            filters[existing_idx] = new_entry
        else:
            filters.append(new_entry)

        config.configured_filters = filters
        if len(filters) == 1 or not config.selected_filter_id:
            config.selected_filter_id = target_id
            config.selected_filter_name = target_name
            config.filter_jql = target_jql

        db.commit()
        return filters

    @staticmethod
    async def remove_configured_filter(db: Session, filter_id: str) -> List[Dict[str, Any]]:
        config = JiraService.get_or_create_config(db)
        filters = [f for f in (config.configured_filters or []) if f.get("id") != filter_id]
        config.configured_filters = filters

        if config.selected_filter_id == filter_id:
            if filters:
                config.selected_filter_id = filters[0]["id"]
                config.selected_filter_name = filters[0]["name"]
                config.filter_jql = filters[0]["jql"]
            else:
                config.selected_filter_id = None
                config.selected_filter_name = None
                config.filter_jql = None

        db.commit()
        return filters

    @staticmethod
    def _verify_tls(config: SavedConfig) -> bool:
        # Only an explicit opt-out in API-token mode can disable verification.
        return not (config.jira_auth_type == "pat" and config.jira_verify_tls is False)

    @staticmethod
    def _get_connection_details(config: SavedConfig) -> Tuple[Optional[str], Optional[Tuple[str, str]], Dict[str, str]]:
        headers = {"Accept": "application/json"}
        if config.jira_auth_type == "pat":
            if not config.jira_domain or not config.jira_email or not config.jira_api_token:
                return None, None, {}
            domain = normalize_jira_domain(config.jira_domain)
            base_url = f"https://{domain}"
            auth = (config.jira_email, config.jira_api_token)
            return base_url, auth, headers

        if config.jira_auth_type == "oauth":
            if not config.jira_access_token or not config.jira_cloud_id:
                return None, None, {}
            base_url = f"https://api.atlassian.com/ex/jira/{config.jira_cloud_id}"
            headers["Authorization"] = f"Bearer {config.jira_access_token}"
            return base_url, None, headers

        return None, None, {}

    @staticmethod
    async def sync_issues_from_jira(db: Session, filter_id: Optional[str] = None) -> Tuple[int, int]:
        """
        Synchronizes issues from Jira without touching local custom values.
        Returns (synced_count, total_count).
        """
        config = JiraService.get_or_create_config(db)
        
        # If user changed filter
        if filter_id:
            config.selected_filter_id = filter_id
            filters = await JiraService.get_filters(db)
            matched = next((f for f in filters if f["id"] == filter_id), None)
            if matched:
                config.selected_filter_name = matched["name"]
                config.filter_jql = matched["jql"]
            elif filter_id.strip().isdigit():
                # Fetch directly from Jira filter API
                base_url, auth, headers = JiraService._get_connection_details(config)
                if base_url:
                    async with httpx.AsyncClient(timeout=10.0, verify=JiraService._verify_tls(config)) as client:
                        f_res = await client.get(f"{base_url}/rest/api/3/filter/{filter_id.strip()}", auth=auth, headers=headers)
                        if f_res.status_code == 200:
                            fdata = f_res.json()
                            config.selected_filter_name = fdata.get("name", f"Filtro #{filter_id}")
                            config.filter_jql = fdata.get("jql", "")
            db.commit()
        elif config.selected_filter_id and config.selected_filter_id.strip().isdigit() and not config.filter_jql:
            base_url, auth, headers = JiraService._get_connection_details(config)
            if base_url:
                async with httpx.AsyncClient(timeout=10.0, verify=JiraService._verify_tls(config)) as client:
                    f_res = await client.get(f"{base_url}/rest/api/3/filter/{config.selected_filter_id.strip()}", auth=auth, headers=headers)
                    if f_res.status_code == 200:
                        fdata = f_res.json()
                        config.selected_filter_name = fdata.get("name", f"Filtro #{config.selected_filter_id}")
                        config.filter_jql = fdata.get("jql", "")
                        db.commit()

        # Handle Mock Mode
        if config.jira_auth_type == "mock":
            raw_issues = MOCK_ISSUES
        else:
            base_url, auth, headers = JiraService._get_connection_details(config)
            if not base_url:
                raise HTTPException(
                    status_code=400,
                    detail="Faltan credenciales de Jira. Configúralas en el menú de Configuración (⚙️)."
                )

            jql = JiraService._make_bounded_jql(config.filter_jql)
            raw_issues = await JiraService._fetch_jira_issues(base_url, auth, headers, jql, verify_tls=JiraService._verify_tls(config))

            # In real Jira mode, remove initial mock seed issues if any
            mock_keys = ["CORE-101", "CORE-102", "CORE-103", "CORE-104", "CORE-105", "CORE-106", "CORE-107", "CORE-108"]
            db.query(JiraIssue).filter(JiraIssue.key.in_(mock_keys)).delete(synchronize_session=False)

        now = datetime.now(timezone.utc)
        synced_keys = set()

        for item in raw_issues:
            key = item["key"]
            if not key:
                continue
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
        # Mark issues not in the synced set as archived so the grid only shows issues matching the active filter/query
        if synced_keys:
            db.query(JiraIssue).filter(~JiraIssue.key.in_(synced_keys)).update(
                {"is_archived_in_jira": True}, synchronize_session=False
            )
        elif config.jira_auth_type != "mock":
            db.query(JiraIssue).update({"is_archived_in_jira": True}, synchronize_session=False)

        config.last_sync = now
        db.commit()

        total = db.query(JiraIssue).filter(JiraIssue.is_archived_in_jira == False).count()
        return len(synced_keys), total

    @staticmethod
    async def _fetch_jira_issues(
        base_url: str,
        auth: Optional[Tuple[str, str]],
        headers: Dict[str, str],
        jql: str,
        *, verify_tls: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Fetches issues using Jira Cloud's modern /rest/api/3/search/jql (CHANGE-2046)
        with cursor-based pagination (nextPageToken), and fallbacks to /rest/api/3/search
        and /rest/api/2/search with offset pagination (startAt).
        Retrieves all issues matching the JQL instead of truncating at 100.
        """
        issues: List[Dict[str, Any]] = []
        max_results = 100
        max_total_issues = 10000

        async with httpx.AsyncClient(timeout=35.0, verify=verify_tls) as client:
            # 1. Try modern /rest/api/3/search/jql API with nextPageToken pagination
            url_jql = f"{base_url}/rest/api/3/search/jql"
            next_page_token: Optional[str] = None
            used_jql = False
            page = 0

            while len(issues) < max_total_issues:
                params: Dict[str, Any] = {
                    "jql": jql,
                    "fields": DEFAULT_FIELDS,
                    "maxResults": max_results,
                }
                if next_page_token:
                    params["nextPageToken"] = next_page_token

                res = await client.get(url_jql, auth=auth, headers=headers, params=params)

                if res.status_code in (401, 403):
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=f"Error de autenticación con Jira ({res.status_code}): Verifica tu correo y API Token / permisos."
                    )

                if res.status_code == 200:
                    used_jql = True
                    data = res.json()
                    batch = data.get("issues", [])
                    for i in batch:
                        parsed = JiraService._parse_jira_issue(i)
                        if parsed:
                            issues.append(parsed)

                    page += 1
                    token = data.get("nextPageToken")
                    is_last = data.get("isLast", False)

                    if is_last or not token or not batch or token == next_page_token:
                        break

                    next_page_token = token
                else:
                    if page == 0:
                        # First page failed, fallback to /rest/api/3/search
                        break
                    else:
                        logger.warning("Pagination error on page %s (%s): %s", page, url_jql, res.status_code)
                        break

            if used_jql and (issues or page > 0):
                return issues

            # 2. Fallback to /rest/api/3/search with startAt offset pagination
            url_search = f"{base_url}/rest/api/3/search"
            start_at = 0
            used_v3 = False

            while len(issues) < max_total_issues:
                params = {
                    "jql": jql,
                    "fields": DEFAULT_FIELDS,
                    "maxResults": max_results,
                    "startAt": start_at,
                }
                res_v3 = await client.get(url_search, auth=auth, headers=headers, params=params)

                if res_v3.status_code in (401, 403):
                    raise HTTPException(
                        status_code=res_v3.status_code,
                        detail=f"Error de autenticación con Jira ({res_v3.status_code}): Verifica tu correo y API Token."
                    )

                if res_v3.status_code == 200:
                    used_v3 = True
                    data = res_v3.json()
                    batch = data.get("issues", [])
                    for i in batch:
                        parsed = JiraService._parse_jira_issue(i)
                        if parsed:
                            issues.append(parsed)

                    total = data.get("total", len(issues))
                    start_at += len(batch)
                    if start_at >= total or not batch or len(batch) < max_results:
                        break
                else:
                    break

            if used_v3 and (issues or start_at > 0):
                return issues

            # 3. Fallback to /rest/api/2/search with startAt offset pagination
            url_v2 = f"{base_url}/rest/api/2/search"
            start_at = 0
            used_v2 = False

            while len(issues) < max_total_issues:
                params = {
                    "jql": jql,
                    "fields": DEFAULT_FIELDS,
                    "maxResults": max_results,
                    "startAt": start_at,
                }
                res_v2 = await client.get(url_v2, auth=auth, headers=headers, params=params)

                if res_v2.status_code in (401, 403):
                    raise HTTPException(
                        status_code=res_v2.status_code,
                        detail=f"Error de autenticación con Jira ({res_v2.status_code}): Verifica tu correo y API Token."
                    )

                if res_v2.status_code == 200:
                    used_v2 = True
                    data = res_v2.json()
                    batch = data.get("issues", [])
                    for i in batch:
                        parsed = JiraService._parse_jira_issue(i)
                        if parsed:
                            issues.append(parsed)

                    total = data.get("total", len(issues))
                    start_at += len(batch)
                    if start_at >= total or not batch or len(batch) < max_results:
                        break
                else:
                    break

            if used_v2 or issues:
                return issues

            # If all failed, log and raise error
            logger.error("Jira API search failed across all endpoints")
            raise HTTPException(
                status_code=400,
                detail="No se pudieron consultar los tickets desde la API de Jira. Verifica tu consulta JQL y permisos."
            )

    @staticmethod
    def _parse_jira_issue(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        key = item.get("key")
        if not key:
            return None

        fields = item.get("fields") or {}
        status = fields.get("status") or {}
        status_cat_obj = status.get("statusCategory") or {}
        status_cat = status_cat_obj.get("name", "To Do")

        prio_obj = fields.get("priority") or {}
        priority_name = prio_obj.get("name", "Medium")

        itype_obj = fields.get("issuetype") or {}
        issue_type_name = itype_obj.get("name", "Task")

        assignee = fields.get("assignee") or {}
        avatar_urls = assignee.get("avatarUrls") or {}
        avatar = avatar_urls.get("48x48") or avatar_urls.get("32x32")

        reporter = fields.get("reporter") or {}
        reporter_name = reporter.get("displayName")

        # Save full fields payload for custom field selectors
        raw_payload = {}
        for k, v in fields.items():
            if v is not None:
                raw_payload[k] = v

        return {
            "key": key,
            "jira_id": item.get("id"),
            "summary": fields.get("summary") or "",
            "jira_status": status.get("name", "Open"),
            "jira_status_category": status_cat,
            "issue_type": issue_type_name,
            "priority": priority_name,
            "assignee_name": assignee.get("displayName"),
            "assignee_avatar": avatar,
            "reporter_name": reporter_name,
            "jira_created_at": fields.get("created"),
            "jira_updated_at": fields.get("updated"),
            "raw_jira_fields": raw_payload,
        }

    @staticmethod
    async def get_jira_fields(db: Session) -> List[Dict[str, Any]]:
        config = JiraService.get_or_create_config(db)
        if config.jira_auth_type == "mock":
            return [
                {"id": "summary", "name": "Resumen (Summary)", "custom": False, "type": "string"},
                {"id": "description", "name": "Descripción", "custom": False, "type": "string"},
                {"id": "labels", "name": "Etiquetas (Labels)", "custom": False, "type": "array"},
                {"id": "components", "name": "Componentes", "custom": False, "type": "array"},
                {"id": "duedate", "name": "Fecha Límite (Due Date)", "custom": False, "type": "date"},
                {"id": "customfield_storypoints", "name": "Story Points", "custom": True, "type": "number"},
                {"id": "fixVersions", "name": "Versiones Corregidas", "custom": False, "type": "array"},
            ]

        base_url, auth, headers = JiraService._get_connection_details(config)
        if not base_url:
            return []

        async with httpx.AsyncClient(timeout=15.0, verify=JiraService._verify_tls(config)) as client:
            try:
                res = await client.get(f"{base_url}/rest/api/3/field", auth=auth, headers=headers)
                if res.status_code == 200:
                    fields = res.json()
                    results = []
                    for f in fields:
                        results.append({
                            "id": f.get("id"),
                            "name": f.get("name"),
                            "custom": f.get("custom", False),
                            "type": (f.get("schema") or {}).get("type", "string"),
                            "navigable": f.get("navigable", True),
                        })
                    return results
            except Exception as e:
                logger.warning(f"Error fetching Jira fields: {e}")
        return []

    @staticmethod
    async def validate_filter_or_jql(db: Session, filter_id: Optional[str] = None, jql: Optional[str] = None) -> Dict[str, Any]:
        config = JiraService.get_or_create_config(db)
        if config.jira_auth_type == "mock":
            return {"valid": True, "filter_id": filter_id or "fav-1", "name": "Mock Filter", "jql": jql or "project = CORE", "matched_issues": 8}

        base_url, auth, headers = JiraService._get_connection_details(config)
        if not base_url:
            raise HTTPException(status_code=400, detail="Faltan credenciales de Jira.")

        async with httpx.AsyncClient(timeout=15.0, verify=JiraService._verify_tls(config)) as client:
            target_jql = jql
            filter_name = "Consulta JQL personalizada"

            # If Filter ID was entered
            if filter_id and filter_id.strip():
                fid = filter_id.strip()
                known_filters = await JiraService.get_filters(db)
                matched_known = next((f for f in known_filters if f["id"] == fid), None)
                if matched_known:
                    target_jql = matched_known.get("jql")
                    filter_name = matched_known.get("name")
                elif fid.isdigit() or (fid.startswith("fav-") and fid.replace("fav-", "").isdigit()):
                    clean_id = fid.replace("fav-", "")
                    f_res = await client.get(f"{base_url}/rest/api/3/filter/{clean_id}", auth=auth, headers=headers)
                    if f_res.status_code == 200:
                        fdata = f_res.json()
                        target_jql = fdata.get("jql")
                        filter_name = fdata.get("name")
                    else:
                        raise HTTPException(status_code=404, detail=f"No se encontró el filtro de Jira con ID {clean_id} en tu instancia.")
                else:
                    if not target_jql:
                        target_jql = fid

            bounded_jql = JiraService._make_bounded_jql(target_jql)
            url_jql = f"{base_url}/rest/api/3/search/jql"
            res = await client.get(url_jql, auth=auth, headers=headers, params={"jql": bounded_jql, "maxResults": 1, "fields": "summary"})
            if res.status_code == 200:
                data = res.json()
                count = len(data.get("issues", []))
                return {
                    "valid": True,
                    "filter_id": filter_id,
                    "name": filter_name,
                    "jql": target_jql,
                    "bounded_jql": bounded_jql,
                    "matched_issues": count,
                    "message": f"Filtro válido. Coincide con tickets en Jira."
                }
            else:
                raise HTTPException(status_code=400, detail=f"Jira query validation failed / Consulta Jira no valida ({res.status_code})")
