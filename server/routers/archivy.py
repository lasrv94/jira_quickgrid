from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import JiraIssue
from services.archivy_service import ArchivyService

router = APIRouter(prefix="/api/archivy", tags=["archivy"])

class NoteSaveRequest(BaseModel):
    content: str

@router.get("/notes/{issue_key}")
def get_issue_note(issue_key: str, db: Session = Depends(get_db)):
    issue = db.query(JiraIssue).filter(JiraIssue.key == issue_key).first()
    summary = issue.summary if issue else ""
    return ArchivyService.get_note(issue_key, issue_summary=summary, db=db)

@router.post("/notes/{issue_key}")
def save_issue_note(issue_key: str, data: NoteSaveRequest, db: Session = Depends(get_db)):
    return ArchivyService.save_note(issue_key, data.content, db=db)

@router.get("/notes")
def list_archivy_notes(db: Session = Depends(get_db)):
    return ArchivyService.list_notes(db=db)
