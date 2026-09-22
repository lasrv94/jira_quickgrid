import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy.orm import Session
from models import SavedConfig

DEFAULT_NOTES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "archivy_notes")

class ArchivyService:
    @staticmethod
    def get_notes_dir(db: Optional[Session] = None) -> str:
        if db:
            config = db.query(SavedConfig).filter(SavedConfig.id == "default").first()
            if config and config.archivy_dir:
                os.makedirs(config.archivy_dir, exist_ok=True)
                return config.archivy_dir
        os.makedirs(DEFAULT_NOTES_DIR, exist_ok=True)
        return DEFAULT_NOTES_DIR

    @staticmethod
    def get_note_filename(issue_key: str) -> str:
        sanitized = re.sub(r'[^a-zA-Z0-9_\-]', '_', issue_key)
        return f"{sanitized}.md"

    @staticmethod
    def get_note(issue_key: str, issue_summary: str = "", db: Optional[Session] = None) -> Dict[str, Any]:
        notes_dir = ArchivyService.get_notes_dir(db)
        filepath = os.path.join(notes_dir, ArchivyService.get_note_filename(issue_key))

        if not os.path.exists(filepath):
            # Create default boilerplate markdown note
            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            default_content = (
                f"# [{issue_key}] {issue_summary}\n\n"
                f"> **Tags:** `#jira` `#{issue_key}` `#knowledge-base`  \n"
                f"> **Creado:** {now_str}\n\n"
                f"## 📋 Contexto y Requerimientos\n"
                f"- Documentación y notas técnicas asociadas a este ticket de Jira.\n\n"
                f"## 🔍 Análisis Técnico / Causa Raíz (RCA)\n"
                f"Describe aquí los hallazgos técnicos, arquitectura o análisis del problema.\n\n"
                f"## 🧪 Guía de Pruebas / Verificación\n"
                f"1. Paso de prueba 1\n"
                f"2. Paso de prueba 2\n\n"
                f"## 🔗 Referencias y Enlaces\n"
                f"- [Jira Ticket](#)\n"
            )
            return {
                "issue_key": issue_key,
                "title": f"[{issue_key}] {issue_summary}",
                "content": default_content,
                "exists": False,
                "updated_at": None,
                "path": filepath,
            }

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        mod_time = datetime.fromtimestamp(os.path.getmtime(filepath), tz=timezone.utc).isoformat()
        return {
            "issue_key": issue_key,
            "title": f"[{issue_key}] {issue_summary}",
            "content": content,
            "exists": True,
            "updated_at": mod_time,
            "path": filepath,
        }

    @staticmethod
    def save_note(issue_key: str, content: str, db: Optional[Session] = None) -> Dict[str, Any]:
        notes_dir = ArchivyService.get_notes_dir(db)
        filepath = os.path.join(notes_dir, ArchivyService.get_note_filename(issue_key))
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        mod_time = datetime.fromtimestamp(os.path.getmtime(filepath), tz=timezone.utc).isoformat()
        return {
            "issue_key": issue_key,
            "content": content,
            "exists": True,
            "updated_at": mod_time,
            "path": filepath,
        }

    @staticmethod
    def list_notes(db: Optional[Session] = None) -> List[Dict[str, Any]]:
        notes_dir = ArchivyService.get_notes_dir(db)
        results = []
        if not os.path.exists(notes_dir):
            return results
        for filename in os.listdir(notes_dir):
            if filename.endswith(".md"):
                key = filename[:-3]
                path = os.path.join(notes_dir, filename)
                mod_time = datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc).isoformat()
                with open(path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                    title = lines[0].replace("#", "").strip() if lines else key
                results.append({
                    "issue_key": key,
                    "title": title,
                    "filename": filename,
                    "updated_at": mod_time
                })
        return results
