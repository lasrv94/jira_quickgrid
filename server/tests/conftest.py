"""Never use the user's database or notes during tests."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
_test_dir = tempfile.TemporaryDirectory(prefix="quickgrid-tests-")
os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(_test_dir.name) / "test.db")

import pytest
from database import Base, engine
from services import archivy_service

@pytest.fixture(autouse=True)
def isolated_storage(monkeypatch):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(archivy_service, "DEFAULT_NOTES_DIR", str(Path(_test_dir.name) / "notes"))
    yield

def pytest_sessionfinish(session, exitstatus):
    engine.dispose()
    _test_dir.cleanup()
