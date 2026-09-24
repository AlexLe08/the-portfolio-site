def test_submit_contact_message(client):
    response = client.post(
        "/contact",
        json={"name": "Jamie", "email": "jamie@example.com", "message": "Hi there"},
    )

    assert response.status_code == 201
    assert "id" in response.json()


def test_submit_contact_message_rejects_invalid_email(client):
    response = client.post(
        "/contact",
        json={"name": "Jamie", "email": "not-an-email", "message": "Hi there"},
    )

    assert response.status_code == 422
