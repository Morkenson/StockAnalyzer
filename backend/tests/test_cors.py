from fastapi.testclient import TestClient

from main import app


def test_custom_frontend_origin_preflight_is_allowed():
    client = TestClient(app)

    response = client.options(
        "/api/auth/signin",
        headers={
            "Origin": "https://mork-wealth.zachary-mork-portfolio.dev",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://mork-wealth.zachary-mork-portfolio.dev"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_debug_includes_custom_frontend_origin():
    client = TestClient(app)

    response = client.get("/api/cors-debug")

    assert response.status_code == 200
    assert "https://mork-wealth.zachary-mork-portfolio.dev" in response.json()["allowedOrigins"]
