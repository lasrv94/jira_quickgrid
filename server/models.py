import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Literal
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from database import Base

def utcnow():
    return datetime.now(timezone.utc)

# ----------------- SQLAlchemy Models -----------------

class JiraIssue(Base):
    __tablename__ = "jira_issues"

    key = Column(String(64), primary_key=True, index=True)
    jira_id = Column(String(64), nullable=True, index=True)
    summary = Column(Text, nullable=False, default="")
    jira_status = Column(String(128), nullable=False, default="Open")
    jira_status_category = Column(String(64), nullable=False, default="To Do")
    issue_type = Column(String(64), nullable=False, default="Task")
    priority = Column(String(64), nullable=False, default="Medium")
    assignee_name = Column(String(128), nullable=True)
    assignee_avatar = Column(Text, nullable=True)
    reporter_name = Column(String(128), nullable=True)
    jira_created_at = Column(DateTime(timezone=True), nullable=True)
    jira_updated_at = Column(DateTime(timezone=True), nullable=True)
    raw_jira_fields = Column(JSON, nullable=True)
    last_synced_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    is_archived_in_jira = Column(Boolean, default=False)

    custom_values = relationship("IssueCustomValue", back_populates="issue", cascade="all, delete-orphan")


class CustomColumn(Base):
    __tablename__ = "custom_columns"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(128), nullable=False)
    type = Column(String(64), nullable=False)  # single_select, text, long_text, date, number, archivy_link
    options = Column(JSON, nullable=True, default=list)  # list of {id, label, color}
    position = Column(Integer, default=0)
    is_visible = Column(Boolean, default=True)
    width = Column(Integer, default=160)
    jira_field_key = Column(String(128), nullable=True)
    formula = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    values = relationship("IssueCustomValue", back_populates="column", cascade="all, delete-orphan")


class IssueCustomValue(Base):
    __tablename__ = "issue_custom_values"

    issue_key = Column(String(64), ForeignKey("jira_issues.key", ondelete="CASCADE"), primary_key=True)
    column_id = Column(String(64), ForeignKey("custom_columns.id", ondelete="CASCADE"), primary_key=True)
    value = Column(JSON, nullable=True)  # String, number, option ID, dict, etc.
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    updated_by = Column(String(128), default="User")

    issue = relationship("JiraIssue", back_populates="custom_values")
    column = relationship("CustomColumn", back_populates="values")


class SavedConfig(Base):
    __tablename__ = "saved_configs"

    id = Column(String(64), primary_key=True, default="default")
    selected_filter_id = Column(String(128), nullable=True)
    selected_filter_name = Column(String(256), nullable=True)
    filter_jql = Column(Text, nullable=True)
    last_sync = Column(DateTime(timezone=True), nullable=True)
    
    # Auth configuration
    jira_auth_type = Column(String(32), default="mock")  # "oauth", "pat", "mock"
    jira_domain = Column(String(256), nullable=True)
    jira_email = Column(String(256), nullable=True)
    jira_api_token = Column(Text, nullable=True)
    jira_verify_tls = Column(Boolean, nullable=False, default=True, server_default="1")
    jira_client_id = Column(String(256), nullable=True)
    jira_client_secret = Column(Text, nullable=True)
    jira_access_token = Column(Text, nullable=True)
    jira_refresh_token = Column(Text, nullable=True)
    jira_cloud_id = Column(String(256), nullable=True)
    jira_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    archivy_dir = Column(Text, nullable=True)


class SavedView(Base):
    __tablename__ = "saved_views"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4())[:8])
    name = Column(String(128), nullable=False)
    group_by = Column(String(64), nullable=True)
    sort_field = Column(String(64), nullable=True)
    sort_direction = Column(String(16), default="asc")
    search_query = Column(String(256), default="")
    filter_id = Column(String(128), nullable=True)
    visible_columns = Column(JSON, nullable=True)
    filter_rules = Column(JSON, nullable=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


# ----------------- Pydantic Schemas -----------------

class SelectOption(BaseModel):
    id: str
    label: str
    color: str  # e.g., "bg-blue-100 text-blue-800", or hex, or preset name

class CustomColumnCreate(BaseModel):
    name: str
    type: str  # single_select, text, long_text, date, number, archivy_link, jira_field, formula
    options: Optional[List[Dict[str, Any]]] = None
    position: Optional[int] = 0
    is_visible: Optional[bool] = True
    width: Optional[int] = 160
    jira_field_key: Optional[str] = None
    formula: Optional[str] = None

class CustomColumnUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    options: Optional[List[Dict[str, Any]]] = None
    position: Optional[int] = None
    is_visible: Optional[bool] = None
    width: Optional[int] = None
    jira_field_key: Optional[str] = None
    formula: Optional[str] = None

class CustomColumnOut(BaseModel):
    id: str
    name: str
    type: str
    options: Optional[List[Dict[str, Any]]] = []
    position: int
    is_visible: bool
    width: int
    jira_field_key: Optional[str] = None
    formula: Optional[str] = None

    model_config = {"from_attributes": True}

class SetCustomValueRequest(BaseModel):
    column_id: str
    value: Any

class BulkSetCustomValueItem(BaseModel):
    issue_key: str
    column_id: str
    value: Any

class BulkSetCustomValuesRequest(BaseModel):
    items: List[BulkSetCustomValueItem]

class IssueOut(BaseModel):
    key: str
    jira_id: Optional[str] = None
    summary: str
    jira_status: str
    jira_status_category: str
    issue_type: str
    priority: str
    assignee_name: Optional[str] = None
    assignee_avatar: Optional[str] = None
    reporter_name: Optional[str] = None
    jira_created_at: Optional[datetime] = None
    jira_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    is_archived_in_jira: bool = False
    custom_values: Dict[str, Any] = {}
    raw_jira_fields: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}

class JiraFilterOut(BaseModel):
    id: str
    name: str
    jql: str
    description: Optional[str] = None

class ConfigOut(BaseModel):
    id: str
    selected_filter_id: Optional[str] = None
    selected_filter_name: Optional[str] = None
    filter_jql: Optional[str] = None
    last_sync: Optional[datetime] = None
    jira_auth_type: str
    jira_domain: Optional[str] = None
    jira_email: Optional[str] = None
    jira_verify_tls: bool = True
    has_api_token: bool = False
    has_oauth_token: bool = False
    jira_client_id: Optional[str] = None
    jira_cloud_id: Optional[str] = None
    archivy_dir: Optional[str] = None

class ConfigUpdateRequest(BaseModel):
    selected_filter_id: Optional[str] = None
    selected_filter_name: Optional[str] = None
    filter_jql: Optional[str] = None
    jira_auth_type: Optional[Literal["mock", "pat", "oauth"]] = None
    jira_domain: Optional[str] = None
    jira_email: Optional[str] = None
    jira_api_token: Optional[str] = None
    jira_verify_tls: Optional[bool] = None
    jira_client_id: Optional[str] = None
    jira_client_secret: Optional[str] = None
    archivy_dir: Optional[str] = None

class SavedViewCreate(BaseModel):
    name: str
    group_by: Optional[str] = None
    sort_field: Optional[str] = None
    sort_direction: Optional[str] = "asc"
    search_query: Optional[str] = ""
    filter_id: Optional[str] = None
    visible_columns: Optional[List[str]] = None
    filter_rules: Optional[Any] = None
    is_default: Optional[bool] = False

class SavedViewUpdate(BaseModel):
    name: Optional[str] = None
    group_by: Optional[str] = None
    sort_field: Optional[str] = None
    sort_direction: Optional[str] = None
    search_query: Optional[str] = None
    filter_id: Optional[str] = None
    visible_columns: Optional[List[str]] = None
    filter_rules: Optional[Any] = None
    is_default: Optional[bool] = None

class SavedViewOut(BaseModel):
    id: str
    name: str
    group_by: Optional[str] = None
    sort_field: Optional[str] = None
    sort_direction: str = "asc"
    search_query: str = ""
    filter_id: Optional[str] = None
    visible_columns: Optional[List[str]] = None
    filter_rules: Optional[Any] = None
    is_default: bool = False
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

