import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
except Exception as e:
    logger.warning(f"Database migration note: {e}")

app = FastAPI(
    title="Jira Airtable-like Web App",
    description="Internal Jira management web app with Airtable interface, persistent local custom fields, and Archivy integration",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(columns.router)
app.include_router(issues.router)
app.include_router(archivy.router)
app.include_router(views.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Jira Airtable Web"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
