"""Command line interface: ``ghr serve``, ``ghr migrate`` and helpers for creating secrets."""

import base64
import logging
import secrets
from importlib.resources import files
from typing import Annotated

import typer
import uvicorn
from alembic import command
from alembic.config import Config
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from ghr.config import get_settings
from ghr.security import hash_password

cli = typer.Typer(help="GitHub release inbox.", no_args_is_help=True)


@cli.command()
def serve(
    host: Annotated[str, typer.Option(help="Interface to bind to.")] = "127.0.0.1",
    port: Annotated[int, typer.Option(help="Port to listen on.")] = 8000,
    reload: Annotated[bool, typer.Option(help="Reload on code changes (development).")] = False,
) -> None:
    """Run the API server. Uses a single worker because polling runs in-process."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    uvicorn.run(
        "ghr.app:create_app",
        factory=True,
        host=host,
        port=port,
        reload=reload,
        proxy_headers=True,
    )


@cli.command()
def migrate(revision: Annotated[str, typer.Argument()] = "head") -> None:
    """Create or upgrade the database schema."""
    settings = get_settings()
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    command.upgrade(alembic_config(), revision)


@cli.command("hash-password")
def hash_password_command() -> None:
    """Create the Argon2 hash for GHR_PASSWORD_HASH."""
    password = typer.prompt("Password", hide_input=True, confirmation_prompt=True)
    typer.echo(hash_password(password))


@cli.command("generate-secret")
def generate_secret() -> None:
    """Create a random value for GHR_SESSION_SECRET."""
    typer.echo(secrets.token_urlsafe(48))


@cli.command("generate-vapid-keys")
def generate_vapid_keys() -> None:
    """Create the key pair for GHR_VAPID_PUBLIC_KEY and GHR_VAPID_PRIVATE_KEY."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_raw = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = private_key.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    typer.echo(f"GHR_VAPID_PUBLIC_KEY={_b64url(public_raw)}")
    typer.echo(f"GHR_VAPID_PRIVATE_KEY={_b64url(private_raw)}")


def alembic_config() -> Config:
    config = Config()
    config.set_main_option("script_location", str(files("ghr") / "migrations"))
    return config


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()
