import sys
from pathlib import Path

# Ensure backend root is on path when running pytest from backend/ or project root
_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

import pytest
from fastapi.testclient import TestClient
from main import app
from services import user_service


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_user_secrets():
    user_service._user_secrets.clear()
    yield
    user_service._user_secrets.clear()
