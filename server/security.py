"""Security boundaries for the single-user, loopback-only application."""
import re
from fastapi import HTTPException

TRUSTED_ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173"}

def normalize_jira_domain(value: str) -> str:
    domain = value.strip().removeprefix("https://").rstrip("/").lower()
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net", domain):
        raise HTTPException(400, "Use a Jira Cloud domain / Usa un dominio Jira Cloud: company.atlassian.net")
    return domain
