from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import IssueCustomValue, IssueOut, JiraFilterOut, JiraIssue, SetCustomValueRequest
from services.jira_service import JiraService

router = APIRouter(prefix="/api", tags=["issues"])

@router.get("/filters", response_model=List[JiraFilterOut])
async def list_jira_filters(db: Session = Depends(get_db)):
    filters = await JiraService.get_filters(db)
    return [JiraFilterOut(**f) for f in filters]

@router.post("/sync")
async def sync_jira_issues(filter_id: Optional[str] = None, db: Session = Depends(get_db)):
    synced_count, total_count = await JiraService.sync_issues_from_jira(db, filter_id=filter_id)
    return {
        "status": "success",
        "synced": synced_count,
        "total": total_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"Sincronizados {synced_count} tickets desde Jira. Los campos internos se mantuvieron intactos."
    }

@router.get("/issues", response_model=List[IssueOut])
def list_issues(db: Session = Depends(get_db)):
    # Auto-seed mock issues if database is empty so app works immediately
    count = db.query(JiraIssue).count()
    if count == 0:
        import asyncio
        asyncio.run(JiraService.sync_issues_from_jira(db))

    issues = db.query(JiraIssue).order_by(JiraIssue.jira_updated_at.desc()).all()
    results = []
    for issue in issues:
        vals = db.query(IssueCustomValue).filter(IssueCustomValue.issue_key == issue.key).all()
        custom_dict = {v.column_id: v.value for v in vals}
        results.append(
            IssueOut(
                key=issue.key,
                jira_id=issue.jira_id,
                summary=issue.summary,
                jira_status=issue.jira_status,
                jira_status_category=issue.jira_status_category,
                issue_type=issue.issue_type,
                priority=issue.priority,
                assignee_name=issue.assignee_name,
                assignee_avatar=issue.assignee_avatar,
                reporter_name=issue.reporter_name,
                jira_created_at=issue.jira_created_at,
                jira_updated_at=issue.jira_updated_at,
                last_synced_at=issue.last_synced_at,
                is_archived_in_jira=issue.is_archived_in_jira,
                custom_values=custom_dict
            )
        )
    return results

@router.post("/issues/{key}/custom-values")
def update_issue_custom_value(key: str, data: SetCustomValueRequest, db: Session = Depends(get_db)):
    issue = db.query(JiraIssue).filter(JiraIssue.key == key).first()
    if not issue:
        raise HTTPException(status_code=404, detail=f"Ticket {key} no encontrado")

    custom_val = db.query(IssueCustomValue).filter(
        IssueCustomValue.issue_key == key,
        IssueCustomValue.column_id == data.column_id
    ).first()

    now = datetime.now(timezone.utc)
    if custom_val:
        custom_val.value = data.value
        custom_val.updated_at = now
    else:
        custom_val = IssueCustomValue(
            issue_key=key,
            column_id=data.column_id,
            value=data.value,
            updated_at=now,
            updated_by="User"
        )
        db.add(custom_val)

    db.commit()
    return {
        "status": "success",
        "issue_key": key,
        "column_id": data.column_id,
        "value": data.value,
        "updated_at": now.isoformat()
    }

@router.delete("/issues/{key}/custom-values/{column_id}")
def delete_issue_custom_value(key: str, column_id: str, db: Session = Depends(get_db)):
    custom_val = db.query(IssueCustomValue).filter(
        IssueCustomValue.issue_key == key,
        IssueCustomValue.column_id == column_id
    ).first()
    if custom_val:
        db.delete(custom_val)
        db.commit()
    return {"status": "success", "issue_key": key, "column_id": column_id}
