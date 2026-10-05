from fastapi import APIRouter, HTTPException, Request, status

from ghr.api.deps import ContainerDep, CurrentUserDep
from ghr.schemas import Credentials, CurrentUser
from ghr.security import SESSION_USER_KEY, verify_credentials

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(credentials: Credentials, request: Request, container: ContainerDep) -> CurrentUser:
    settings = container.settings
    if not verify_credentials(
        credentials.username,
        credentials.password,
        expected_username=settings.username,
        password_hash=settings.password_hash.get_secret_value(),
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password")
    request.session.clear()
    request.session[SESSION_USER_KEY] = settings.username
    return CurrentUser(username=settings.username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request) -> None:
    request.session.clear()


@router.get("/me")
async def me(username: CurrentUserDep) -> CurrentUser:
    return CurrentUser(username=username)
