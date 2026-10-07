"""Running coroutines concurrently, a limited number at a time."""

import asyncio
from collections.abc import Awaitable, Iterable


async def gather_limited[T](awaitables: Iterable[Awaitable[T]], *, limit: int) -> list[T]:
    """Await with at most ``limit`` running at once; results keep the order of the input.

    The first failure cancels the rest and is raised as itself, not as an exception group.
    """
    semaphore = asyncio.Semaphore(limit)

    async def limited(awaitable: Awaitable[T]) -> T:
        async with semaphore:
            return await awaitable

    try:
        async with asyncio.TaskGroup() as group:
            tasks = [group.create_task(limited(awaitable)) for awaitable in awaitables]
    except ExceptionGroup as errors:
        raise errors.exceptions[0] from errors
    return [task.result() for task in tasks]
