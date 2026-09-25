import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import httpx
import pytest

from database import SessionLocal
from models import SavedConfig
from services.jira_service import JiraService
from test_security import local_client


def test_tls_setting_defaults_and_persists():
    with local_client() as client:
        assert client.get("/api/auth/status").json()["jira_verify_tls"] is True
        for enabled in (False, True):
            response = client.post("/api/auth/config", json={"jira_verify_tls": enabled})
            assert response.status_code == 200
            assert response.json()["jira_verify_tls"] is enabled
            assert client.get("/api/auth/status").json()["jira_verify_tls"] is enabled
        client.post("/api/auth/config", json={"jira_verify_tls": False})
        client.post("/api/auth/config", json={"jira_email": "user@example.com"})
        assert client.get("/api/auth/status").json()["jira_verify_tls"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize("mode,setting,expected", [
    ("pat", True, True), ("pat", False, False), ("oauth", False, True),
])
async def test_tls_policy_applies_to_all_jira_requests(monkeypatch, mode, setting, expected):
    original_client = httpx.AsyncClient
    client_options = []
    paths = []

    def respond(request):
        assert request.url.scheme == "https"
        paths.append(request.url.path)
        path = request.url.path
        if path.endswith(("/project", "/filter/favourite", "/field")):
            return httpx.Response(200, json=[])
        if path.endswith("/filter/123"):
            return httpx.Response(200, json={"name": "Test", "jql": "project = TEST"})
        return httpx.Response(200, json={"issues": []})

    def client_factory(**kwargs):
        client_options.append(kwargs)
        return original_client(**kwargs, transport=httpx.MockTransport(respond))

    monkeypatch.setattr(httpx, "AsyncClient", client_factory)
    with SessionLocal() as db:
        db.add(SavedConfig(id="default", jira_auth_type=mode,
                           jira_domain="example.atlassian.net", jira_email="test@example.com",
                           jira_api_token="test-token", jira_access_token="oauth-token",
                           jira_cloud_id="test-cloud", jira_verify_tls=setting,
                           selected_filter_id="123"))
        db.commit()
        await JiraService.get_filters(db)
        await JiraService.get_available_jira_filters(db)
        await JiraService.get_jira_fields(db)
        await JiraService.validate_filter_or_jql(db, jql="project = TEST")
        await JiraService.sync_issues_from_jira(db)
        assert client_options
        assert all(options["verify"] is expected for options in client_options)
        for suffix in ("/project", "/filter/favourite", "/field", "/filter/123", "/search/jql"):
            assert any(path.endswith(suffix) for path in paths)


def test_missing_tls_setting_keeps_verification():
    assert JiraService._verify_tls(SavedConfig(jira_auth_type="pat")) is True


def test_existing_database_migrates_with_verification_enabled(tmp_path):
    database = tmp_path / "legacy.db"
    with sqlite3.connect(database) as conn:
        conn.execute("CREATE TABLE saved_configs (id VARCHAR(64) PRIMARY KEY)")
        conn.execute("INSERT INTO saved_configs (id) VALUES ('default')")
    env = {**os.environ, "DATABASE_URL": "sqlite:///" + str(database)}
    server = Path(__file__).resolve().parents[1]
    for _ in range(2):
        subprocess.run([sys.executable, "-c", "import main; main.engine.dispose()"],
                       cwd=server, env=env, check=True, capture_output=True, timeout=30)
    with sqlite3.connect(database) as conn:
        assert conn.execute("SELECT jira_verify_tls FROM saved_configs WHERE id='default'").fetchone() == (1,)
