"""The in-process event broker behind the live updates."""

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
