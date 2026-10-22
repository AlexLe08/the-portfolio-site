"""Print an argon2 hash of a password, for the ADMIN_PASSWORD_HASH setting.

    ./.venv/bin/python hash_password.py

The password is read without echoing and never stored; only the hash is
printed. Paste it into Render (or .env, in single quotes: it contains `$`).
"""

from getpass import getpass

from argon2 import PasswordHasher

password = getpass("Admin password: ")
if password != getpass("Again: "):
    raise SystemExit("Passwords don't match.")
if len(password) < 12:
    raise SystemExit("Use at least 12 characters.")
print(PasswordHasher().hash(password))
