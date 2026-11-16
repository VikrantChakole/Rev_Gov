import pytest
from starlette.testclient import TestClient
from main import app
from app.data_layer.repositories.application_repo import ApplicationRepository
from app.core.database import get_db


client = TestClient(app)


def test_delete_application_citizen_flow():
    """
    Test that a citizen can create an application draft,
    and then successfully delete it via DELETE /api/v1/applications/{app_id}.
    """
    # 1. Login or mock citizen auth token
    from app.core.security import create_access_token
    token = create_access_token({"sub": "CIT-TEST-DELETE", "role": "citizen", "citizen_ref": "CIT-TEST-DELETE"})
    headers = {"Authorization": f"Bearer {token}"}

    # Ensure citizen exists
    from app.models.db_models import Citizen
    db = next(get_db())
    citizen = db.query(Citizen).filter(Citizen.citizen_ref == "CIT-TEST-DELETE").first()
    if not citizen:
        citizen = Citizen(
            citizen_ref="CIT-TEST-DELETE",
            name="Delete Test Citizen",
            phone="9988776655",
        )
        db.add(citizen)
        db.commit()

    # 2. Create a draft application
    create_res = client.post(
        "/api/v1/applications/draft",
        json={"service_id": "caste_certificate", "channel": "WEB_MANUAL"},
        headers=headers,
    )
    assert create_res.status_code == 200, create_res.text
    app_data = create_res.json()
    draft_id = app_data["draft_id"]

    # 3. Delete the application
    del_res = client.delete(
        f"/api/v1/applications/{draft_id}",
        headers=headers,
    )
    assert del_res.status_code == 200, del_res.text
    del_json = del_res.json()
    assert del_json["success"] is True

    # 4. Verify it is gone from DB
    repo = ApplicationRepository(db)
    assert repo.get_by_id(draft_id) is None
