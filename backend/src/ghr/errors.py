"""Domain errors translated to HTTP responses by the API layer."""


class NotFoundError(Exception):
    def __init__(self, entity: str, identifier: object) -> None:
        super().__init__(f"{entity} {identifier} not found")


class ConflictError(Exception):
    """The request conflicts with the current state or configuration."""


class InvalidRequestError(Exception):
    """The request is well-formed but can't be processed as asked."""


class SummaryError(Exception):
    """The summary couldn't be created; the message is safe to show to the user."""
