"""Single-user authentication: Argon2 password hash, signed session cookie, sign-in throttling
and a same-origin check for state-changing requests."""

import hashlib
import hmac
import time
from collections import deque

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

SESSION_USER_KEY = "user"
SESSION_CREDENTIAL_KEY = "credential"

_password_hash = PasswordHash((Argon2Hasher(),))
# Verified against when the username is wrong, so both failure paths take the same time.
_DUMMY_HASH = _password_hash.hash("ghr-timing-equaliser")

#: ``Sec-Fetch-Site`` values that mean the request came from this app (or was typed in).
_SAME_SITE_FETCH = frozenset({"same-origin", "none"})


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_credentials(
    username: str, password: str, *, expected_username: str, password_hash: str
) -> bool:
    """CPU-heavy (Argon2): call it from a worker thread in async code."""
    username_matches = hmac.compare_digest(username.encode(), expected_username.encode())
    password_matches = _password_hash.verify(
        password, password_hash if username_matches else _DUMMY_HASH
    )
    return username_matches and password_matches


def credential_fingerprint(username: str, password_hash: str) -> str:
    """Stored in the session; changing the password or username signs out all sessions."""
    return hashlib.sha256(f"{username}\0{password_hash}".encode()).hexdigest()[:32]


def is_same_origin_request(
    *, sec_fetch_site: str | None, origin: str | None, expected_origin: str
) -> bool:
    """Reject cross-site requests: browsers send ``Sec-Fetch-Site``; older ones send ``Origin``.

    Requests without either header (curl, tests) aren't from a browser and carry no ambient
    cookie risk beyond the session they explicitly present.
    """
    if sec_fetch_site is not None:
        return sec_fetch_site in _SAME_SITE_FETCH
    if origin is not None:
        return origin.rstrip("/").lower() == expected_origin.rstrip("/").lower()
    return True


class LoginThrottle:
    """Limits failed sign-ins per client address within a sliding window (in memory, which is
    sufficient for the single-process deployment)."""

    def __init__(self, *, max_failures: int, window_seconds: int) -> None:
        self._max_failures = max_failures
        self._window = window_seconds
        self._failures: dict[str, deque[float]] = {}

    def retry_after(self, client: str) -> int | None:
        """Seconds until the client may try again, or ``None`` if it isn't blocked."""
        failures = self._recent(client)
        if len(failures) < self._max_failures:
            return None
        return max(1, int(failures[0] + self._window - time.monotonic()) + 1)

    def record_failure(self, client: str) -> None:
        self._failures.setdefault(client, deque()).append(time.monotonic())

    def reset(self, client: str) -> None:
        self._failures.pop(client, None)

    def _recent(self, client: str) -> deque[float]:
        failures = self._failures.get(client)
        if failures is None:
            return deque()
        cutoff = time.monotonic() - self._window
        while failures and failures[0] <= cutoff:
            failures.popleft()
        if not failures:
            del self._failures[client]
        return failures
