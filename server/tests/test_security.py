import time
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import app
from routers import auth
from security import normalize_jira_domain
from services.archivy_service import ArchivyService

def local_client(**kwargs):
    return TestClient(app, base_url="http://localhost", client=("127.0.0.1", 50000),
                      headers={"X-QuickGrid-Client": "1"}, **kwargs)

@pytest.mark.parametrize("headers", [
    {"Origin": "https://evil.example"},
    {"Origin": "null"},
    {"Sec-Fetch-Site": "cross-site"},
    {"X-QuickGrid-Client": ""},
])
def test_reject_untrusted_browser_requests(headers):
    with local_client() as client:
        assert client.get("/api/auth/status", headers=headers).status_code == 403
        assert client.post("/api/sync", headers=headers).status_code == 403

def test_host_peer_and_security_headers():
    with local_client() as client:
        assert client.get("/api/health", headers={"Host": "evil.example"}).status_code == 400
        response = client.get("/api/auth/status")
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-content-type-options"] == "nosniff"
    with TestClient(app, base_url="http://localhost", client=("192.0.2.1", 50000)) as remote:
        assert remote.get("/api/health").status_code == 403

def test_cors_preflight():
    with local_client() as client:
        headers = {"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST",
                   "Access-Control-Request-Headers": "X-QuickGrid-Client,Content-Type"}
        response = client.options("/api/sync", headers=headers)
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
        headers["Origin"] = "https://evil.example"
        assert client.options("/api/sync", headers=headers).status_code == 403

@pytest.mark.parametrize("domain", [
    "localhost", "127.0.0.1", "169.254.169.254", "evil.example",
    "company.atlassian.net.evil.example", "company.atlassian.net@evil.example",
    "company.atlassian.net:443", "company.atlassian.net/path",
    "http://company.atlassian.net", "company.atlassian.net?x=1",
])
def test_domain_blocks_ssrf_and_token_exfiltration(domain):
    with pytest.raises(HTTPException):
        normalize_jira_domain(domain)
    with local_client() as client:
        assert client.post("/api/auth/config", json={"jira_domain": domain}).status_code == 400

def test_normalize_cloud_domain_and_hide_secrets():
    assert normalize_jira_domain("https://Company.atlassian.net/") == "company.atlassian.net"
    with local_client() as client:
        response = client.post("/api/auth/config", json={
            "jira_api_token": "secret-api-value", "jira_client_secret": "secret-oauth-value"})
        assert response.status_code == 200
        assert response.json()["has_api_token"]
        assert "secret-api-value" not in response.text
        assert "secret-oauth-value" not in response.text

@pytest.mark.parametrize("kind,field", [("jira_field", None), ("text", "labels")])
def test_jira_values_cannot_be_written(kind, field):
    with local_client() as client:
        assert client.post("/api/sync").status_code == 200
        column = client.post("/api/columns", json={
            "name": "Read only", "type": kind, "jira_field_key": field}).json()
        payload = {"column_id": column["id"], "value": "forged"}
        assert client.post("/api/issues/CORE-101/custom-values", json=payload).status_code == 403
        payload["column_id"] = "missing"
        assert client.post("/api/issues/CORE-101/custom-values", json=payload).status_code == 404

@pytest.mark.parametrize("key", ["../secret", "x/y", "x\\y", ".", "CON", "NUL", "COM1", "a" * 129])
def test_invalid_note_keys(key):
    with pytest.raises(HTTPException):
        ArchivyService.get_note_filename(key)

def test_note_symlink_is_rejected(tmp_path, monkeypatch):
    from pathlib import Path
    monkeypatch.setattr(Path, "is_symlink", lambda self: self.name == "CORE-101.md")
    with pytest.raises(HTTPException):
        ArchivyService.note_path(str(tmp_path), "CORE-101")

def start_oauth(client):
    client.post("/api/auth/config", json={"jira_client_id": "test-client", "jira_client_secret": "test-secret"})
    response = client.get("/api/auth/jira/login")
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    state = parse_qs(urlparse(response.json()["url"]).query)["state"][0]
    return {"code": "test-code", "state": state, "redirect_uri": "http://localhost:5173/auth/callback"}

def test_oauth_browser_binding_redirect_and_expiry():
    with local_client() as client, local_client() as other:
        data = start_oauth(client)
        assert client.get("/api/auth/jira/login?redirect_uri=https://evil.example").status_code == 400
        assert other.post("/api/auth/jira/callback", json=data).status_code == 400
        assert client.post("/api/auth/jira/callback", json={**data, "state": "x" * 43}).status_code == 400
        assert client.post("/api/auth/jira/callback", json={**data, "redirect_uri": "http://127.0.0.1:5173/auth/callback"}).status_code == 400
        data = start_oauth(client)
        auth.OAUTH_STATES[data["state"]] = (time.monotonic() - 1, data["redirect_uri"])
        assert client.post("/api/auth/jira/callback", json=data).status_code == 400

def test_oauth_success_and_replay(monkeypatch):
    requests = []
    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, json):
            requests.append(json)
            return httpx.Response(200, json={"access_token": "private-token", "expires_in": 3600})
        async def get(self, url, headers):
            return httpx.Response(200, json=[{"id": "cloud-id"}])
    monkeypatch.setattr(auth.httpx, "AsyncClient", FakeClient)
    with local_client() as client:
        data = start_oauth(client)
        response = client.post("/api/auth/jira/callback", json=data)
        assert response.status_code == 200
        assert "private-token" not in response.text
        client.cookies.set(auth.OAUTH_COOKIE, data["state"])
        assert client.post("/api/auth/jira/callback", json=data).status_code == 400
        assert len(requests) == 1

def test_oauth_upstream_error_does_not_leak_secrets(monkeypatch):
    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, *args, **kwargs):
            return httpx.Response(400, text="sensitive-upstream-response")
    monkeypatch.setattr(auth.httpx, "AsyncClient", FakeClient)
    with local_client() as client:
        data = start_oauth(client)
        response = client.post("/api/auth/jira/callback", json=data)
        assert response.status_code == 400
        assert "sensitive-upstream-response" not in response.text


def test_saved_unsafe_domain_rejected_before_network():
    from models import SavedConfig
    from services.jira_service import JiraService
    config = SavedConfig(jira_auth_type="pat", jira_domain="127.0.0.1",
                         jira_email="test@example.com", jira_api_token="private")
    with pytest.raises(HTTPException):
        JiraService._get_connection_details(config)
