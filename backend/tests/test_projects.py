from app import models

ADMIN_HEADERS = {"x-admin-key": "dev-only-change-me"}


def make_project(db_session, **overrides):
    defaults = dict(
        slug="test-project",
        title="Test Project",
        summary="A project for testing.",
        stack=["Python"],
        case_study_md="# Test",
        published=True,
    )
    project = models.Project(**{**defaults, **overrides})
    db_session.add(project)
    db_session.commit()
    return project


def test_list_projects_only_returns_published(client, db_session):
    make_project(db_session, slug="published-one", published=True)
    make_project(db_session, slug="draft-one", published=False)

    response = client.get("/projects")

    assert response.status_code == 200
    slugs = [p["slug"] for p in response.json()]
    assert slugs == ["published-one"]


def test_project_summary_omits_case_study_body(client, db_session):
    make_project(db_session, slug="published-one")

    response = client.get("/projects")

    assert "case_study_md" not in response.json()[0]


def test_get_unpublished_project_returns_404(client, db_session):
    make_project(db_session, slug="draft-one", published=False)

    response = client.get("/projects/draft-one")

    assert response.status_code == 404


def test_get_missing_project_returns_404(client):
    response = client.get("/projects/does-not-exist")

    assert response.status_code == 404


def test_create_project_without_admin_key_is_rejected(client):
    response = client.post(
        "/projects",
        json={
            "slug": "new-project",
            "title": "New",
            "summary": "S",
            "stack": [],
            "case_study_md": "x",
        },
    )

    assert response.status_code == 422  # missing required header


def test_create_project_with_wrong_admin_key_is_rejected(client):
    response = client.post(
        "/projects",
        json={
            "slug": "new-project",
            "title": "New",
            "summary": "S",
            "stack": [],
            "case_study_md": "x",
        },
        headers={"x-admin-key": "wrong-key"},
    )

    assert response.status_code == 401


def test_create_project_succeeds_with_valid_admin_key(client):
    response = client.post(
        "/projects",
        json={
            "slug": "new-project",
            "title": "New",
            "summary": "S",
            "stack": ["Python", "FastAPI"],
            "case_study_md": "# Body",
            "published": True,
        },
        headers=ADMIN_HEADERS,
    )

    assert response.status_code == 201
    assert response.json()["slug"] == "new-project"


def test_create_project_with_duplicate_slug_returns_409(client, db_session):
    make_project(db_session, slug="already-exists")

    response = client.post(
        "/projects",
        json={
            "slug": "already-exists",
            "title": "New",
            "summary": "S",
            "stack": [],
            "case_study_md": "x",
        },
        headers=ADMIN_HEADERS,
    )

    assert response.status_code == 409
