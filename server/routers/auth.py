import os
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
import httpx
from sqlalchemy.orm import Session
from database import get_db
from models import ConfigOut, ConfigUpdateRequest, SavedConfig
from services.jira_service import JiraService

router = APIRouter(prefix="/api/auth", tags=["auth"])

ATLASSIAN_AUTH_URL = "https://auth.atlassian.com/authorize"
ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"

@router.get("/status", response_model=ConfigOut)
def get_auth_status(db: Session = Depends(get_db)):
    config = JiraService.get_or_create_config(db)
    return ConfigOut(
        id=config.id,
        selected_filter_id=config.selected_filter_id,
        selected_filter_name=config.selected_filter_name,
        filter_jql=config.filter_jql,
        last_sync=config.last_sync,
        jira_auth_type=config.jira_auth_type or "mock",
        jira_domain=config.jira_domain,
        jira_email=config.jira_email,
        has_api_token=bool(config.jira_api_token),
        has_oauth_token=bool(config.jira_access_token),
        jira_client_id=config.jira_client_id,
        jira_cloud_id=config.jira_cloud_id,
        archivy_dir=config.archivy_dir
    )

@router.post("/config", response_model=ConfigOut)
def update_auth_config(data: ConfigUpdateRequest, db: Session = Depends(get_db)):
    config = JiraService.get_or_create_config(db)
    if data.jira_auth_type is not None:
        config.jira_auth_type = data.jira_auth_type
    if data.jira_domain is not None:
        config.jira_domain = data.jira_domain.replace("https://", "").replace("http://", "").rstrip("/")
    if data.jira_email is not None:
        config.jira_email = data.jira_email
    if data.jira_api_token is not None and data.jira_api_token.strip():
        config.jira_api_token = data.jira_api_token
    if data.jira_client_id is not None:
        config.jira_client_id = data.jira_client_id
    if data.jira_client_secret is not None and data.jira_client_secret.strip():
        config.jira_client_secret = data.jira_client_secret
    if data.selected_filter_id is not None:
        config.selected_filter_id = data.selected_filter_id
    if data.selected_filter_name is not None:
        config.selected_filter_name = data.selected_filter_name
    if data.filter_jql is not None:
        config.filter_jql = data.filter_jql
    if data.archivy_dir is not None:
        config.archivy_dir = data.archivy_dir

    db.commit()
    db.refresh(config)
    return get_auth_status(db)

@router.get("/jira/login")
def jira_oauth_login(redirect_uri: str = "http://localhost:5173/auth/callback", db: Session = Depends(get_db)):
    config = JiraService.get_or_create_config(db)
    client_id = config.jira_client_id or os.environ.get("JIRA_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=400,
            detail="Falta configurar el Atlassian Client ID en la pestaña de Configuración."
        )

    params = {
        "audience": "api.atlassian.com",
        "client_id": client_id,
        "scope": "read:jira-work read:jira-user offline_access",
        "redirect_uri": redirect_uri,
        "state": "jira_quickgrid_session",
        "response_type": "code",
        "prompt": "consent",
    }
    url = f"{ATLASSIAN_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return {"url": url}

@router.post("/jira/callback")
async def jira_oauth_callback(code: str, redirect_uri: str = "http://localhost:5173/auth/callback", db: Session = Depends(get_db)):
    config = JiraService.get_or_create_config(db)
    client_id = config.jira_client_id or os.environ.get("JIRA_CLIENT_ID")
    client_secret = config.jira_client_secret or os.environ.get("JIRA_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Falta configurar Client ID y Client Secret de Atlassian.")

    # Exchange code for access token
    payload = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
    }

    async with httpx.AsyncClient() as client:
        token_res = await client.post(ATLASSIAN_TOKEN_URL, json=payload)
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Error obteniendo token de Atlassian: {token_res.text}")
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)

        # Get accessible resources (Cloud ID)
        resources_res = await client.get(
            ATLASSIAN_RESOURCES_URL,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
        )
        if resources_res.status_code != 200:
            raise HTTPException(status_code=400, detail="No se pudo obtener la instancia (Cloud ID) de Jira.")
        
        resources = resources_res.json()
        if not resources:
            raise HTTPException(status_code=400, detail="No se encontraron sitios de Jira vinculados a este usuario.")
        
        cloud_id = resources[0].get("id")

        # Save to database
        config.jira_access_token = access_token
        config.jira_refresh_token = refresh_token
        config.jira_cloud_id = cloud_id
        config.jira_auth_type = "oauth"
        config.jira_token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        db.commit()

    return {"status": "success", "cloud_id": cloud_id, "message": "Autenticación OAuth con Jira exitosa"}
