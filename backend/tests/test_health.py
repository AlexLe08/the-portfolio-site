from app.core.config import settings


def test_health_reports_the_deployed_commit(client, monkeypatch):
    monkeypatch.setattr(settings, "render_git_commit", "abc123")

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["commit"] == "abc123"


def test_health_commit_is_null_outside_render(client, monkeypatch):
    monkeypatch.setattr(settings, "render_git_commit", "")

    assert client.get("/health").json() == {"status": "ok", "environment": settings.environment, "commit": None}
