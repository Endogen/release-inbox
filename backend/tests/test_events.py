"""The in-process event broker behind the live updates."""

import asyncio
from types import SimpleNamespace
from typing import cast

from ghr.api.events import stream_events
from ghr.container import Container
from ghr.events import Event, EventBroker


async def test_delivers_events_to_every_subscriber() -> None:
    broker = EventBroker()
    async with broker.subscribe() as first, broker.subscribe() as second:
        broker.publish(Event("releases-changed"))

        assert first.get_nowait().type == "releases-changed"
        assert second.get_nowait().type == "releases-changed"

    broker.publish(Event("releases-changed"))  # no subscribers left: nothing to do


async def test_a_slow_subscriber_keeps_the_latest_events() -> None:
    broker = EventBroker()
    async with broker.subscribe() as queue:
        for index in range(queue.maxsize + 5):
            broker.publish(Event("sync-status", {"index": index}))

        received = [queue.get_nowait().data["index"] for _ in range(queue.qsize())]

    assert received[-1] == queue.maxsize + 4
    assert len(received) == queue.maxsize


async def test_notifications_only_reach_subscribers_that_ask_for_them() -> None:
    broker = EventBroker()
    async with broker.subscribe() as tab, broker.subscribe(notifications=True) as desktop:
        assert broker.publish(Event("notification", {"title": "acme/app"})) == 1
        assert broker.publish(Event("releases-changed")) == 2

        assert [event.type for event in _drain(desktop)] == ["notification", "releases-changed"]
        assert [event.type for event in _drain(tab)] == ["releases-changed"]


def _drain(queue: asyncio.Queue[Event]) -> list[Event]:
    return [queue.get_nowait() for _ in range(queue.qsize())]


async def test_the_stream_sends_notifications_only_if_asked() -> None:
    broker = EventBroker()
    container = cast(Container, SimpleNamespace(broker=broker))
    desktop = stream_events(container, notifications=True)
    tab = stream_events(container)
    for stream in (desktop, tab):
        await anext(stream)  # the "connected" comment, sent once subscribed

    broker.publish(Event("notification", {"title": "acme/app"}))
    broker.publish(Event("releases-changed"))

    assert [(await anext(desktop)).event for _ in range(2)] == [
        "notification",
        "releases-changed",
    ]
    assert (await anext(tab)).event == "releases-changed"
    await desktop.aclose()
    await tab.aclose()
