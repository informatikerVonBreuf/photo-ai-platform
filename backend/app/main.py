from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import router
from .config import Settings, get_settings
from .database import Database
from .queue import JobQueue
from .retrieval import LocalRetrievalClient
from .vlm import LocalVlmJudgeClient


def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        active_settings.storage_dir.mkdir(parents=True, exist_ok=True)
        database: Database | None = None
        job_queue: JobQueue | None = None
        app.state.database = None
        app.state.job_queue = None
        app.state.retrieval = None
        app.state.vlm_judge = None
        app.state.vlm_lock = asyncio.Lock()
        app.state.vlm_retry_after = 0.0

        try:
            if active_settings.persistence_enabled:
                database = Database(active_settings.postgres_dsn)
                await asyncio.to_thread(database.open)
                app.state.database = database

            if active_settings.queue_enabled:
                job_queue = JobQueue(
                    active_settings.redis_url,
                    active_settings.redis_queue_name,
                )
                await asyncio.to_thread(job_queue.ping)
                app.state.job_queue = job_queue

            if active_settings.embedding_service_enabled:
                app.state.retrieval = LocalRetrievalClient(
                    embedding_url=active_settings.embedding_service_url,
                    qdrant_url=active_settings.qdrant_url,
                    qdrant_api_key=active_settings.qdrant_api_key,
                    collection=active_settings.qdrant_collection,
                    score_threshold=active_settings.vector_score_threshold,
                )

            if active_settings.vlm_enabled:
                app.state.vlm_judge = LocalVlmJudgeClient(
                    server_url=active_settings.model_server_url,
                    model=active_settings.vlm_model_alias,
                    timeout_seconds=active_settings.vlm_timeout_seconds,
                )

            yield
        finally:
            if job_queue is not None:
                await asyncio.to_thread(job_queue.close)
            if database is not None:
                await asyncio.to_thread(database.close)

    app = FastAPI(
        title=active_settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = active_settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(router)
    app.mount(
        "/media",
        StaticFiles(directory=active_settings.storage_dir, check_dir=False),
        name="media",
    )
    return app


app = create_app()
