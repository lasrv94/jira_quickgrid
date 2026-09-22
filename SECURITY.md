# Security review and operating policy

Review date: 2026-09-22.

## Supported deployment and trust boundary

This release is intended for one trusted user on a local workstation. Both servers must bind to loopback. There is no application login, tenant isolation, or per-user authorization. Jira authentication is not application authentication. A local process can send the client header and access all app data.

Do not deploy this release to shared hosts, a LAN, public reverse proxies, or tunnels. Forwarding through a local proxy can defeat the peer-address boundary. Supporting shared deployment requires a separate authentication/authorization design and HTTPS.

## Findings addressed

| Finding | Risk before changes | Remediation |
| --- | --- | --- |
| Wildcard CORS and unprotected local API | A hostile website could attempt to read or modify local data and connection settings | Exact frontend origin allowlist, loopback peer and trusted Host checks, cross-site request rejection, required custom API header |
| Fixed OAuth state and unrestricted callback URL | Login CSRF and missing binding to the initiating browser | Random state, HttpOnly SameSite cookie, ten-minute expiry, single-use server state, exact callback allowlist |
| OAuth callback body mismatch and unchecked frontend status | Failed authentication could be presented as success | Validated JSON callback body including state; frontend checks HTTP status |
| Arbitrary Jira domain accepted with API credentials | Server-side requests and token disclosure to attacker-selected hosts | Strict single-subdomain atlassian.net validation both on save and before credential-bearing requests |
| Jira-mapped columns accepted custom-value writes | API clients could bypass UI read-only rules | Reject mapped-field writes and return 404 for unknown columns |
| Note filename aliasing and symlink access | Invalid keys could collide or access files outside the selected folder | Strict note keys, Windows device-name rejection, resolved-path checks and symlink rejection; note body length limit |
| Raw Jira error bodies returned/logged | Sensitive upstream data could leak through diagnostics | Generic client errors and status-only search failure logs |
| Tests used application storage | Test runs could modify real local data | Temporary database and notes directory, reset per test |
| Private notes not excluded from Git | Accidental disclosure in source control | Ignore local Markdown notes while retaining the sample |
| Overstated security documentation | Users could mistake a desktop tool for an enterprise service | Explicit storage, network, credential and hosting limitations |

API responses also include no-store, nosniff, no-referrer and frame-denial headers. These are backend response headers, not a complete frontend content-security policy.

## Remaining limitations

* API tokens, client secrets, and OAuth tokens remain unencrypted in SQLite. Filesystem access compromises them. Use restrictive OS permissions, full-disk encryption, and protected backups. Do not upload the database, its WAL files, or private notes.
* The selected notes directory is user-configurable and trusted. Use a directory owned by your account. Path checks do not protect against a malicious local process racing filesystem changes.
* OAuth state is in memory and supports one backend process. Restarting loses pending logins; starting another login in the same browser replaces its cookie. The cookie is intentionally usable over local HTTP. HTTPS and Secure cookies are required in any future hosted design.
* API tokens can grant broader rights than the read operations used by the code. Choose least-privilege credentials and rotate/revoke them through Atlassian if exposed.
* Remote avatar URLs can cause browser requests to external services. Mock images are external too.
* No live Atlassian login or penetration test was performed. Automated tests mock external OAuth responses. This review is not a guarantee that all vulnerabilities have been found.
* Dependency audits describe the installed versions/lockfile at the time of review. Python requirements use lower bounds rather than a reproducible lock; rerun audits after installs and upgrades.

## Verification

Run from the project root:

```powershell
.\server\.venv\Scripts\pytest.exe server/tests/ -v
cd client
npm run build
npm run lint
npm audit
```

For Python advisories, install `pip-audit` in the backend virtual environment, then run `python -m pip_audit --progress-spinner off` using that interpreter.

The security suite covers hostile origins, missing client headers, invalid hosts and remote peers, preflight behavior, sensitive response headers, Jira domain rejection, credential omission from responses, read-only fields, note keys, a simulated symlink, and OAuth binding/expiry/replay/error redaction.

### Results from this review

* Backend: 41 tests passed (nine original tests plus 32 security cases); two dependency deprecation warnings.
* Frontend: production build passed; lint passed with zero errors and ten warnings. Vite also reported a bundle-size warning.
* `npm audit`: zero known vulnerabilities in the frontend lockfile.
* `pip-audit`: zero known vulnerabilities after upgrading the local virtual environment's pip from 26.1.1 to 26.2.1. That environment upgrade is local; setup scripts already upgrade pip on installation.
* Targeted tracked-file scans for private-key headers and common GitHub/AWS token patterns found no matches. This is not a comprehensive secret or Git-history audit.

## Reporting

Report suspected vulnerabilities privately to the repository maintainer using an available private GitHub security-reporting channel. Do not put credentials, company ticket contents, databases, or working exploits containing private data in public issues. If credentials were exposed, revoke them in Atlassian and remove them from affected backups and repository history as appropriate.

## References

* [OWASP OAuth 2.0 guidance](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
* [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
* [Starlette CORS and trusted-host middleware](https://www.starlette.io/middleware/)


## API-token TLS certificate verification

Under **Settings > API token**, **Verify TLS certificate (recommended)** is enabled by default. If a connection fails because of a certificate error, you can temporarily turn it off and save settings. The choice is remembered and applies to API-token Jira requests, including filters, field discovery, validation, and sync. OAuth always keeps certificate verification enabled.

This skips certificate verification; it does not turn off HTTPS or fix expired tokens, permissions, or network failures. Disabling verification can expose your API token and Jira data to interception. For a lasting fix, ask IT for an approved CA certificate bundle, set `SSL_CERT_FILE` to its PEM file path in the backend environment, restart the backend, and keep verification enabled. See [HTTPX certificate configuration](https://www.python-httpx.org/advanced/ssl/).
