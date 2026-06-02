from fastapi.testclient import TestClient

from fastapi import FastAPI

from main import _cors_middleware, app


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


def test_loan_route_includes_cors_header_for_frontend_origin():
    client = TestClient(app)

    response = client.get(
        "/api/loans",
        headers={"Origin": "https://mork-wealth.zachary-mork-portfolio.dev"},
    )

    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == "https://mork-wealth.zachary-mork-portfolio.dev"


def test_server_errors_include_cors_header_for_frontend_origin():
    error_app = FastAPI()

    @error_app.get("/api/error")
    async def error_route():
        raise RuntimeError("boom")

    client = TestClient(_cors_middleware(error_app), raise_server_exceptions=False)

    response = client.get(
        "/api/error",
        headers={"Origin": "https://mork-wealth.zachary-mork-portfolio.dev"},
    )

    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "https://mork-wealth.zachary-mork-portfolio.dev"
