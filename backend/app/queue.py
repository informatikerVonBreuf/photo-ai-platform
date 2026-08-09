from __future__ import annotations

from redis import Redis


class JobQueue:
    def __init__(self, redis_url: str, queue_name: str) -> None:
        self.client = Redis.from_url(redis_url, decode_responses=True)
        self.queue_name = queue_name

    def ping(self) -> bool:
        return bool(self.client.ping())

    def enqueue(self, job_id: str) -> None:
        self.client.lpush(self.queue_name, job_id)

    def dequeue(self, timeout_seconds: int = 5) -> str | None:
        item = self.client.brpop(self.queue_name, timeout=timeout_seconds)
        return item[1] if item else None

    def close(self) -> None:
        self.client.close()
