def test_keepalive_pings_database(client):
    response = client.get("/api/keepalive")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "reachable"}
