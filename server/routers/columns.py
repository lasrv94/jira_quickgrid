import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import CustomColumn, CustomColumnCreate, CustomColumnOut, CustomColumnUpdate

router = APIRouter(prefix="/api/columns", tags=["columns"])

DEFAULT_COLUMNS = [
    {
        "id": "col-estado-interno",
        "name": "Estado Interno",
        "type": "single_select",
        "position": 0,
        "is_visible": True,
        "width": 180,
        "options": [
            {"id": "opt-analisis", "label": "En Análisis", "color": "amber"},
            {"id": "opt-listo", "label": "Listo para Dev", "color": "emerald"},
            {"id": "opt-qa", "label": "En Pruebas QA", "color": "purple"},
            {"id": "opt-bloqueado", "label": "Bloqueado", "color": "rose"},
            {"id": "opt-aprobado", "label": "Aprobado", "color": "sky"},
        ]
    },
    {
        "id": "col-comentarios-internos",
        "name": "Comentarios Internos",
        "type": "long_text",
        "position": 1,
        "is_visible": True,
        "width": 240,
        "options": []
    },
    {
        "id": "col-archivy-wiki",
        "name": "Archivy Wiki",
        "type": "archivy_link",
        "position": 2,
        "is_visible": True,
        "width": 150,
        "options": []
    }
]

@router.get("", response_model=List[CustomColumnOut])
def list_columns(db: Session = Depends(get_db)):
    cols = db.query(CustomColumn).order_by(CustomColumn.position.asc()).all()
    if not cols:
        # Seed default custom columns
        for item in DEFAULT_COLUMNS:
            new_col = CustomColumn(
                id=item["id"],
                name=item["name"],
                type=item["type"],
                options=item["options"],
                position=item["position"],
                is_visible=item["is_visible"],
                width=item["width"]
            )
            db.add(new_col)
        db.commit()
        cols = db.query(CustomColumn).order_by(CustomColumn.position.asc()).all()
    return cols

@router.post("", response_model=CustomColumnOut)
def create_column(data: CustomColumnCreate, db: Session = Depends(get_db)):
    col_id = f"col-{uuid.uuid4().hex[:8]}"
    count = db.query(CustomColumn).count()
    new_col = CustomColumn(
        id=col_id,
        name=data.name,
        type=data.type,
        options=data.options or [],
        position=data.position if data.position is not None else count,
        is_visible=data.is_visible if data.is_visible is not None else True,
        width=data.width or 160,
        jira_field_key=data.jira_field_key
    )
    db.add(new_col)
    db.commit()
    db.refresh(new_col)
    return new_col

@router.patch("/{column_id}", response_model=CustomColumnOut)
def update_column(column_id: str, data: CustomColumnUpdate, db: Session = Depends(get_db)):
    col = db.query(CustomColumn).filter(CustomColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Columna no encontrada")
    if data.name is not None:
        col.name = data.name
    if data.type is not None:
        col.type = data.type
    if data.options is not None:
        col.options = data.options
    if data.position is not None:
        col.position = data.position
    if data.is_visible is not None:
        col.is_visible = data.is_visible
    if data.width is not None:
        col.width = data.width
    if data.jira_field_key is not None:
        col.jira_field_key = data.jira_field_key

    db.commit()
    db.refresh(col)
    return col

@router.delete("/{column_id}")
def delete_column(column_id: str, db: Session = Depends(get_db)):
    col = db.query(CustomColumn).filter(CustomColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Columna no encontrada")
    db.delete(col)
    db.commit()
    return {"status": "success", "deleted_id": column_id}
