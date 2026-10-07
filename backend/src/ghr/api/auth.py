import asyncio

from fastapi import APIRouter, HTTPException, Request, status

from ghr.api.deps import ContainerDep, CurrentUserDep
from ghr.schemas import Credentials, CurrentUser
from ghr.security import (
    SESSION_CREDENTIAL_KEY,
    SESSION_USER_KEY,
    credential_fingerprint,
    verify_credentials,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(credentials: Credentials, request: Request, container: ContainerDep) -> CurrentUser:
    settings = container.settings
    throttle = container.login_throttle
    client = request.client.host if request.client else "unknown"

    if retry_after := throttle.retry_after(client):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many failed sign-ins. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    throttle.record_attempt(client)
    password_hash = settings.password_hash.get_secret_value()
    # Argon2 is deliberately slow; keep it off the event loop.
    valid = await asyncio.to_thread(
        verify_credentials,
        credentials.username,
        credentials.password,
        expected_username=settings.username,
        password_hash=password_hash,
    )
    if not valid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password")

    throttle.reset(client)
    request.session.clear()
    request.session[SESSION_USER_KEY] = settings.username
    request.session[SESSION_CREDENTIAL_KEY] = credential_fingerprint(
        settings.username, password_hash
    )
    return CurrentUser(username=settings.username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request) -> None:
    request.session.clear()


@router.get("/me")
async def me(username: CurrentUserDep) -> CurrentUser:
    return CurrentUser(username=username)
