import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import SavedView, SavedViewCreate, SavedViewOut, SavedViewUpdate

router = APIRouter(prefix="/api/views", tags=["views"])

DEFAULT_VIEWS = [
    {
        "id": "view-all",
        "name": "Todas las incidencias",
        "group_by": None,
        "sort_field": "priority",
        "sort_direction": "desc",
        "search_query": "",
        "filter_id": None,
        "visible_columns": None,
        "is_default": True,
    },
    {
        "id": "view-by-status",
        "name": "Por Estado Jira",
        "group_by": "jira_status",
        "sort_field": "priority",
        "sort_direction": "desc",
        "search_query": "",
        "filter_id": None,
        "visible_columns": None,
        "is_default": False,
    },
    {
        "id": "view-by-assignee",
        "name": "Por Asignado",
        "group_by": "assignee_name",
        "sort_field": "priority",
        "sort_direction": "desc",
        "search_query": "",
        "filter_id": None,
        "visible_columns": None,
        "is_default": False,
    },
]

@router.get("", response_model=List[SavedViewOut])
def list_views(filter_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    if filter_id:
        views = db.query(SavedView).filter(SavedView.filter_id == filter_id).order_by(SavedView.created_at.asc()).all()
        if not views:
            # Seed default views specifically for this project (Jira filter)
            seeded = [
                SavedView(
                    id=f"view-{filter_id[:24]}-all",
                    name="Todas las incidencias",
                    group_by=None,
                    sort_field="priority",
                    sort_direction="desc",
                    search_query="",
                    filter_id=filter_id,
                    visible_columns=None,
                    is_default=True,
                ),
                SavedView(
                    id=f"view-{filter_id[:24]}-status",
                    name="Por Estado Jira",
                    group_by="jira_status",
                    sort_field="priority",
                    sort_direction="desc",
                    search_query="",
                    filter_id=filter_id,
                    visible_columns=None,
                    is_default=False,
                ),
                SavedView(
                    id=f"view-{filter_id[:24]}-assignee",
                    name="Por Asignado",
                    group_by="assignee_name",
                    sort_field="priority",
                    sort_direction="desc",
                    search_query="",
                    filter_id=filter_id,
                    visible_columns=None,
                    is_default=False,
                ),
            ]
            for v in seeded:
                db.add(v)
            db.commit()
            for v in seeded:
                db.refresh(v)
            return seeded
        return views

    views = db.query(SavedView).order_by(SavedView.created_at.asc()).all()
    if not views:
        # Seed default views so user has immediate templates
        seeded = []
        for d in DEFAULT_VIEWS:
            v = SavedView(**d)
            db.add(v)
            seeded.append(v)
        db.commit()
        for v in seeded:
            db.refresh(v)
        return seeded
    return views

@router.post("", response_model=SavedViewOut)
def create_view(data: SavedViewCreate, db: Session = Depends(get_db)):
    new_id = f"view-{uuid.uuid4().hex[:8]}"
    view = SavedView(
        id=new_id,
        name=data.name,
        group_by=data.group_by,
        sort_field=data.sort_field,
        sort_direction=data.sort_direction or "asc",
        search_query=data.search_query or "",
        filter_id=data.filter_id,
        visible_columns=data.visible_columns,
        filter_rules=data.filter_rules,
        is_default=bool(data.is_default),
    )
    db.add(view)
    db.commit()
    db.refresh(view)
    return view

@router.patch("/{view_id}", response_model=SavedViewOut)
def update_view(view_id: str, data: SavedViewUpdate, db: Session = Depends(get_db)):
    view = db.query(SavedView).filter(SavedView.id == view_id).first()
    if not view:
        raise HTTPException(status_code=404, detail="Vista no encontrada")

    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(view, key, val)

    db.commit()
    db.refresh(view)
    return view

@router.delete("/{view_id}")
def delete_view(view_id: str, db: Session = Depends(get_db)):
    view = db.query(SavedView).filter(SavedView.id == view_id).first()
    if not view:
        raise HTTPException(status_code=404, detail="Vista no encontrada")
    if view.is_default:
        raise HTTPException(status_code=400, detail="No se puede eliminar la vista predeterminada")

    db.delete(view)
    db.commit()
    return {"status": "success", "message": f"Vista '{view.name}' eliminada"}
