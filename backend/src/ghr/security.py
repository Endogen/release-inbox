"""Single-user authentication with an Argon2 password hash and a signed session cookie."""

import hmac

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

SESSION_USER_KEY = "user"

_password_hash = PasswordHash((Argon2Hasher(),))
# Verified against when the username is wrong, so both failure paths take the same time.
_DUMMY_HASH = _password_hash.hash("ghr-timing-equaliser")


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_credentials(
    username: str, password: str, *, expected_username: str, password_hash: str
) -> bool:
    username_matches = hmac.compare_digest(username.encode(), expected_username.encode())
    password_matches = _password_hash.verify(
        password, password_hash if username_matches else _DUMMY_HASH
    )
    return username_matches and password_matches
