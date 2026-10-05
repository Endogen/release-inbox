"""Domain errors translated to HTTP responses by the API layer."""


class NotFoundError(Exception):
    def __init__(self, entity: str, identifier: object) -> None:
        super().__init__(f"{entity} {identifier} not found")
        self.entity = entity
        self.identifier = identifier


class ConflictError(Exception):
    pass
