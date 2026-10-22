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


def test_list_projects_orders_by_sort_order_then_id(client, db_session):
    make_project(db_session, slug="third", sort_order=2)
    make_project(db_session, slug="tied-first", sort_order=1)
    make_project(db_session, slug="tied-second", sort_order=1)

    response = client.get("/projects")

    slugs = [p["slug"] for p in response.json()]
    assert slugs == ["tied-first", "tied-second", "third"]


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

    assert response.status_code == 401  # no credentials at all


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


def test_update_project_without_admin_key_is_rejected(client, db_session):
    make_project(db_session, slug="existing")

    response = client.patch("/projects/existing", json={"title": "New"})

    assert response.status_code == 401  # no credentials at all


def test_update_project_with_wrong_admin_key_is_rejected(client, db_session):
    make_project(db_session, slug="existing")

    response = client.patch(
        "/projects/existing", json={"title": "New"}, headers={"x-admin-key": "wrong-key"}
    )

    assert response.status_code == 401


def test_update_missing_project_returns_404(client):
    response = client.patch(
        "/projects/does-not-exist", json={"title": "New"}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 404


def test_update_project_changes_only_sent_fields(client, db_session):
    make_project(db_session, slug="existing", repo_url="https://example.com/repo")

    response = client.patch(
        "/projects/existing",
        json={"title": "Renamed", "stack": ["Go"]},
        headers=ADMIN_HEADERS,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Renamed"
    assert body["stack"] == ["Go"]
    assert body["summary"] == "A project for testing."
    assert body["case_study_md"] == "# Test"
    assert body["repo_url"] == "https://example.com/repo"


def test_update_project_can_clear_repo_url(client, db_session):
    make_project(db_session, slug="existing", repo_url="https://example.com/repo")

    response = client.patch(
        "/projects/existing", json={"repo_url": None}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 200
    assert response.json()["repo_url"] is None


def test_update_project_can_publish_a_draft(client, db_session):
    make_project(db_session, slug="draft-one", published=False)

    response = client.patch(
        "/projects/draft-one", json={"published": True}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 200
    assert client.get("/projects/draft-one").status_code == 200


def test_update_project_can_change_sort_order(client, db_session):
    make_project(db_session, slug="first", sort_order=1)
    make_project(db_session, slug="second", sort_order=2)

    response = client.patch(
        "/projects/second", json={"sort_order": 0}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 200
    slugs = [p["slug"] for p in client.get("/projects").json()]
    assert slugs == ["second", "first"]


def test_update_project_rejects_null_for_required_fields(client, db_session):
    make_project(db_session, slug="existing")

    response = client.patch(
        "/projects/existing", json={"title": None}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 422
    assert client.get("/projects/existing").json()["title"] == "Test Project"


def test_update_project_rejects_slug_change(client, db_session):
    make_project(db_session, slug="existing")

    response = client.patch(
        "/projects/existing", json={"slug": "renamed"}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 422
    assert client.get("/projects/existing").status_code == 200
