# Jira QuickGrid frontend

React, TypeScript, Tailwind CSS and Vite. See the [project README](../README.md), [user tutorial](../TUTORIAL.md), and [security policy](../SECURITY.md).

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
npm run build
npm run lint
npm audit
```

The development server binds to 127.0.0.1:5173 and proxies /api to 127.0.0.1:8000. Keep both servers local. Port 5173 is fixed because API origins and OAuth callbacks are restricted to that port.

All API requests must go through `apiFetch` in `src/services/api.ts`, which adds the required browser CSRF header. It is not a login credential. OAuth sends code, state and redirect_uri as a JSON body, checks HTTP failure, and removes callback parameters from browser history.

Jira fields are read-only; only local custom values are editable. User-facing changes must support English and Spanish.
