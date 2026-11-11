import pytest

from tests.helpers import ADMIN_HEADERS, make_project, project_payload


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


def test_public_list_returns_only_summary_fields(client, db_session):
    # No case_study_md (heavy) and no admin fields (published, sort_order).
    make_project(db_session, slug="published-one")

    [project] = client.get("/projects").json()

    assert set(project) == {"slug", "title", "summary", "stack"}


def test_get_unpublished_project_returns_404(client, db_session):
    make_project(db_session, slug="draft-one", published=False)

    response = client.get("/projects/draft-one")

    assert response.status_code == 404


def test_get_missing_project_returns_404(client):
    response = client.get("/projects/does-not-exist")

    assert response.status_code == 404


def test_create_project_succeeds_with_valid_admin_key(client):
    response = client.post(
        "/projects",
        json=project_payload(stack=["Python", "FastAPI"], case_study_md="# Body", published=True),
        headers=ADMIN_HEADERS,
    )

    assert response.status_code == 201
    assert response.json()["slug"] == "new-project"


def test_create_project_with_duplicate_slug_returns_409(client, db_session):
    make_project(db_session, slug="already-exists")

    response = client.post(
        "/projects",
        json=project_payload(slug="already-exists"),
        headers=ADMIN_HEADERS,
    )

    assert response.status_code == 409


@pytest.mark.parametrize(
    "slug",
    [
        "",
        "Has-Capitals",
        "has space",
        "under_score",
        "-leading-hyphen",
        "trailing-hyphen-",
        "double--hyphen",
        "slash/in-it",
        "a" * 121,  # longer than the String(120) column
    ],
)
def test_create_project_rejects_malformed_slug(client, slug):
    response = client.post("/projects", json=project_payload(slug=slug), headers=ADMIN_HEADERS)

    assert response.status_code == 422


def test_create_project_accepts_slug_at_max_length(client):
    slug = "a" * 120

    response = client.post("/projects", json=project_payload(slug=slug), headers=ADMIN_HEADERS)

    assert response.status_code == 201
    assert response.json()["slug"] == slug


# Each is one character over its String(n) column, which SQLite ignores.
OVER_LONG_FIELDS = [{"title": "t" * 201}, {"repo_url": "https://example.com/" + "r" * 281}]


@pytest.mark.parametrize("overrides", OVER_LONG_FIELDS)
def test_create_project_rejects_values_longer_than_their_columns(client, overrides):
    response = client.post("/projects", json=project_payload(**overrides), headers=ADMIN_HEADERS)

    assert response.status_code == 422


@pytest.mark.parametrize("overrides", OVER_LONG_FIELDS)
def test_update_project_rejects_values_longer_than_their_columns(client, db_session, overrides):
    make_project(db_session, slug="existing")

    response = client.patch("/projects/existing", json=overrides, headers=ADMIN_HEADERS)

    assert response.status_code == 422


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
