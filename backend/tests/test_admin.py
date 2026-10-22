import pytest

from tests.helpers import ADMIN_HEADERS, make_project


@pytest.mark.parametrize("path", ["/admin/projects", "/admin/projects/anything"])
def test_admin_reads_require_auth(client, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"x-admin-key": "wrong"}).status_code == 401


def test_admin_list_includes_drafts_in_display_order(client, db_session):
    make_project(db_session, slug="third", sort_order=30)
    make_project(db_session, slug="draft", sort_order=20, published=False)
    make_project(db_session, slug="first", sort_order=10)

    response = client.get("/admin/projects", headers=ADMIN_HEADERS)

    assert response.status_code == 200
    rows = response.json()
    assert [p["slug"] for p in rows] == ["first", "draft", "third"]
    assert [p["published"] for p in rows] == [True, False, True]


def test_admin_list_returns_editor_fields(client, db_session):
    make_project(db_session, slug="p", sort_order=10, repo_url="https://example.com/r")

    [project] = client.get("/admin/projects", headers=ADMIN_HEADERS).json()

    assert project["sort_order"] == 10
    assert project["case_study_md"] == "# Test"
    assert project["repo_url"] == "https://example.com/r"


def test_admin_detail_finds_drafts(client, db_session):
    make_project(db_session, slug="draft", published=False)

    response = client.get("/admin/projects/draft", headers=ADMIN_HEADERS)

    assert response.status_code == 200
    assert response.json()["published"] is False
    # The public route still hides it.
    assert client.get("/projects/draft").status_code == 404


def test_admin_detail_missing_project_returns_404(client):
    response = client.get("/admin/projects/nope", headers=ADMIN_HEADERS)

    assert response.status_code == 404


def test_public_list_still_omits_admin_fields(client, db_session):
    make_project(db_session, slug="p")

    [project] = client.get("/projects").json()

    assert "published" not in project
    assert "sort_order" not in project
