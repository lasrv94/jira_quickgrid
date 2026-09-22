import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys

# Add server directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import Base
from models import CustomColumn, IssueCustomValue, JiraIssue, SavedConfig
from services.jira_service import JiraService

@pytest.fixture
def db_session():
    test_db_url = "sqlite:///:memory:"
    engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()

@pytest.mark.asyncio
async def test_custom_values_never_overwritten_by_jira_sync(db_session):
    """
    CRITICAL TEST:
    Verify that when Jira issues are synced and updated from Jira,
    local custom field values (status interno, comments, etc.) are NEVER erased, overwritten or lost.
    """
    # 1. Initial Sync from Jira (mock or real)
    synced, total = await JiraService.sync_issues_from_jira(db_session)
    assert synced > 0
    assert total > 0

    # 2. Add a Custom Column
    col = CustomColumn(
        id="col-estado-interno",
        name="Estado Interno",
        type="single_select",
        options=[{"id": "opt-1", "label": "🟢 Listo para Dev", "color": "emerald"}]
    )
    db_session.add(col)

    col2 = CustomColumn(
        id="col-comentarios",
        name="Comentarios QA",
        type="long_text"
    )
    db_session.add(col2)
    db_session.commit()

    # 3. User sets local custom values on ticket 'CORE-101'
    target_key = "CORE-101"
    issue = db_session.query(JiraIssue).filter(JiraIssue.key == target_key).first()
    assert issue is not None
    initial_jira_summary = issue.summary

    val1 = IssueCustomValue(
        issue_key=target_key,
        column_id="col-estado-interno",
        value="opt-1",
        updated_by="QA Engineer"
    )
    val2 = IssueCustomValue(
        issue_key=target_key,
        column_id="col-comentarios",
        value="Nota confidencial de testing: No sobreescribir bajo ninguna circunstancia.",
        updated_by="QA Engineer"
    )
    db_session.add(val1)
    db_session.add(val2)
    db_session.commit()

    # Verify custom values were stored
    stored_values = db_session.query(IssueCustomValue).filter(IssueCustomValue.issue_key == target_key).all()
    assert len(stored_values) == 2

    # 4. Simulate Jira Refresh / Re-sync with changed Jira data
    # (e.g. Someone in Jira changed the summary, status, or assignee)
    await JiraService.sync_issues_from_jira(db_session)

    # 5. VERIFY: The issue's custom values MUST still be 100% intact!
    refreshed_custom_values = db_session.query(IssueCustomValue).filter(IssueCustomValue.issue_key == target_key).all()
    assert len(refreshed_custom_values) == 2

    val_map = {v.column_id: v.value for v in refreshed_custom_values}
    assert val_map["col-estado-interno"] == "opt-1"
    assert val_map["col-comentarios"] == "Nota confidencial de testing: No sobreescribir bajo ninguna circunstancia."

    print("\nSUCCESS: Custom values preserved across Jira sync without data loss!")

@pytest.mark.asyncio
async def test_archived_issue_retains_custom_values(db_session):
    """
    Verify that if a ticket falls out of a Jira filter, it is not deleted,
    and its local notes and custom fields remain preserved.
    """
    issue = JiraIssue(
        key="CORE-999",
        summary="Ticket que sale del sprint",
        jira_status="Done",
        jira_status_category="Done",
        issue_type="Story",
        priority="Low"
    )
    col = CustomColumn(id="col-notas", name="Notas", type="text")
    val = IssueCustomValue(issue_key="CORE-999", column_id="col-notas", value="Historial importante")

    db_session.add_all([issue, col, val])
    db_session.commit()

    # Re-sync mock issues (which does not contain CORE-999)
    await JiraService.sync_issues_from_jira(db_session)

    # Check CORE-999 still exists with custom value
    saved_issue = db_session.query(JiraIssue).filter(JiraIssue.key == "CORE-999").first()
    assert saved_issue is not None
    saved_val = db_session.query(IssueCustomValue).filter(IssueCustomValue.issue_key == "CORE-999").first()
    assert saved_val is not None
    assert saved_val.value == "Historial importante"
