import pytest
from pydantic import ValidationError

from app.core.config import Settings

SECRET = "not-a-real-secret-abc123"


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
