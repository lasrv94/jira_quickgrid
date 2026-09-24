import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from security import TRUSTED_ORIGINS
from database import Base, engine
from routers import archivy, auth, columns, issues, views

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jira_app")

# Initialize database schema
Base.metadata.create_all(bind=engine)

# Auto-migration for newly added columns if table already existed in SQLite
try:
    with engine.connect() as conn:
        col_rows = conn.exec_driver_sql("PRAGMA table_info(custom_columns)").fetchall()
        col_names = [r[1] for r in col_rows]
        if "jira_field_key" not in col_names and len(col_names) > 0:
            conn.exec_driver_sql("ALTER TABLE custom_columns ADD COLUMN jira_field_key VARCHAR(128)")
            conn.commit()

        if "formula" not in col_names and len(col_names) > 0:
            conn.exec_driver_sql("ALTER TABLE custom_columns ADD COLUMN formula TEXT")
            conn.commit()

        config_cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(saved_configs)")}
        if config_cols and "jira_verify_tls" not in config_cols:
            conn.exec_driver_sql("ALTER TABLE saved_configs ADD COLUMN jira_verify_tls BOOLEAN NOT NULL DEFAULT 1")
            conn.commit()

        view_rows = conn.exec_driver_sql("PRAGMA table_info(saved_views)").fetchall()
        view_cols = [r[1] for r in view_rows]
        if "filter_rules" not in view_cols and len(view_cols) > 0:
            conn.exec_driver_sql("ALTER TABLE saved_views ADD COLUMN filter_rules JSON")
            conn.commit()
except Exception as e:
    logger.warning(f"Database migration note: {e}")

app = FastAPI(
    title="Jira QuickGrid API",
    description="Internal Jira management web app with QuickGrid interface, persistent local custom fields, and Archivy integration",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(TRUSTED_ORIGINS),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-QuickGrid-Client"],
)

@app.middleware("http")
async def protect_local_api(request, call_next):
    origin = request.headers.get("origin")
    if (not request.client or request.client.host not in {"127.0.0.1", "::1"}
            or (origin is not None and origin not in TRUSTED_ORIGINS)
            or request.headers.get("sec-fetch-site") == "cross-site"):
        return JSONResponse({"detail": "Local access only / Solo acceso local"}, status_code=403)
    if (request.url.path.startswith("/api/") and request.url.path != "/api/health"
            and request.method != "OPTIONS"
            and request.headers.get("x-quickgrid-client") != "1"):
        return JSONResponse({"detail": "Missing client header / Falta cabecera del cliente"}, status_code=403)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    return response

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "[::1]"])

# Include Routers
app.include_router(auth.router)
app.include_router(columns.router)
app.include_router(issues.router)
app.include_router(archivy.router)
app.include_router(views.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Jira QuickGrid"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
