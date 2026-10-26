import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.core.config import Settings
from app.models import Media

SECRET = "not-a-real-secret-abc123"


def make_media(public_id: str) -> Media:
    return Media(
        url=f"https://res.cloudinary.com/demo-cloud/image/upload/{public_id}.webp",
        public_id=public_id,
        alt_text="A diagram",
        width=1200,
        height=800,
        content_type="image/webp",
        size_bytes=48_000,
    )


def test_media_row_gets_an_id_and_created_at(db_session):
    media = make_media("portfolio/diagram")
    db_session.add(media)
    db_session.commit()

    assert media.id is not None
    assert media.created_at is not None


def test_public_id_is_unique(db_session):
    db_session.add(make_media("portfolio/diagram"))
    db_session.commit()

    db_session.add(make_media("portfolio/diagram"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_cloudinary_url_accepts_the_console_format():
    url = f"cloudinary://123456789012345:{SECRET}@demo-cloud"

    assert Settings(cloudinary_url=url).cloudinary_url.get_secret_value() == url


def test_cloudinary_url_may_be_empty():
    assert Settings(cloudinary_url="").cloudinary_url.get_secret_value() == ""


@pytest.mark.parametrize(
    "url",
    [
        # The name pasted twice: the Console's copy button includes it.
        f"CLOUDINARY_URL=cloudinary://123456789012345:{SECRET}@demo-cloud",
        f"https://123456789012345:{SECRET}@demo-cloud",
        f"cloudinary://123456789012345:{SECRET}@",
        "cloudinary://<api_key>:<api_secret>@demo-cloud ",
    ],
)
def test_malformed_cloudinary_url_fails_at_startup(url):
    with pytest.raises(ValidationError, match="must look like cloudinary://") as error:
        Settings(cloudinary_url=url)

    # Startup errors land in Render's logs, so the secret must not be in them.
    assert SECRET not in str(error.value)
