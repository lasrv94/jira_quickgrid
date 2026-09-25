from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import (
    BulkSetCustomValuesRequest,
    CustomColumn,
    IssueCustomValue,
    IssueOut,
    JiraFilterOut,
    JiraIssue,
    SetCustomValueRequest,
)
from pydantic import BaseModel
from services.jira_service import JiraService

router = APIRouter(prefix="/api", tags=["issues"])

class AddConfiguredFilterRequest(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    jql: Optional[str] = None

@router.get("/filters", response_model=List[JiraFilterOut])
async def list_jira_filters(db: Session = Depends(get_db)):
    filters = await JiraService.get_filters(db)
    return [JiraFilterOut(**f) for f in filters]

@router.get("/jira/available-filters", response_model=List[JiraFilterOut])
async def list_available_jira_filters(db: Session = Depends(get_db)):
    filters = await JiraService.get_available_jira_filters(db)
    return [JiraFilterOut(**f) for f in filters]

@router.post("/jira/configured-filters", response_model=List[JiraFilterOut])
async def add_configured_jira_filter(data: AddConfiguredFilterRequest, db: Session = Depends(get_db)):
    filters = await JiraService.add_configured_filter(db, filter_id=data.id, name=data.name, jql=data.jql)
    return [JiraFilterOut(**f) for f in filters]

@router.delete("/jira/configured-filters/{filter_id}", response_model=List[JiraFilterOut])
async def remove_configured_jira_filter(filter_id: str, db: Session = Depends(get_db)):
    filters = await JiraService.remove_configured_filter(db, filter_id=filter_id)
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
def list_issues(include_archived: bool = Query(False), db: Session = Depends(get_db)):
    # Auto-seed mock issues if database is empty so app works immediately
    count = db.query(JiraIssue).count()
    if count == 0:
        import asyncio
        asyncio.run(JiraService.sync_issues_from_jira(db))

    query = db.query(JiraIssue)
    if not include_archived:
        query = query.filter(JiraIssue.is_archived_in_jira == False)
    issues = query.order_by(JiraIssue.jira_updated_at.desc()).all()
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
                custom_values=custom_dict,
                raw_jira_fields=issue.raw_jira_fields
            )
        )
    return results

@router.get("/jira/fields")
async def list_jira_fields(db: Session = Depends(get_db)):
    return await JiraService.get_jira_fields(db)

@router.post("/jira/validate-filter")
async def validate_filter(filter_id: Optional[str] = None, jql: Optional[str] = None, db: Session = Depends(get_db)):
    return await JiraService.validate_filter_or_jql(db, filter_id=filter_id, jql=jql)

@router.post("/issues/{key}/custom-values")
def update_issue_custom_value(key: str, data: SetCustomValueRequest, db: Session = Depends(get_db)):
    column = db.get(CustomColumn, data.column_id)
    if column is None:
        raise HTTPException(404, "Column not found / Columna no encontrada")
    if column.type == "jira_field" or column.jira_field_key:
        raise HTTPException(403, "Jira fields are read-only / Campos Jira de solo lectura")
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


@router.post("/issues/custom-values/bulk")
def bulk_update_custom_values(data: BulkSetCustomValuesRequest, db: Session = Depends(get_db)):
    if not data.items:
        return {"status": "success", "updated_count": 0}

    col_ids = {item.column_id for item in data.items}
    columns = {col.id: col for col in db.query(CustomColumn).filter(CustomColumn.id.in_(col_ids)).all()}

    now = datetime.now(timezone.utc)
    updated_count = 0
    for item in data.items:
        col = columns.get(item.column_id)
        if not col or col.type in ("jira_field", "formula", "archivy_link") or col.jira_field_key:
            continue

        custom_val = db.query(IssueCustomValue).filter(
            IssueCustomValue.issue_key == item.issue_key,
            IssueCustomValue.column_id == item.column_id
        ).first()

        if custom_val:
            custom_val.value = item.value
            custom_val.updated_at = now
        else:
            custom_val = IssueCustomValue(
                issue_key=item.issue_key,
                column_id=item.column_id,
                value=item.value,
                updated_at=now,
                updated_by="User"
            )
            db.add(custom_val)
        updated_count += 1

    db.commit()
    return {"status": "success", "updated_count": updated_count}

