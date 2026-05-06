import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db

logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)

_bot_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _bot_task
    await init_db()
    logger.info("Database initialized")

    if settings.discord_bot_token:
        from collector.discord_client import discord_client

        def _bot_done(task: asyncio.Task):
            try:
                exc = task.exception()
                if exc:
                    logger.error(f"Discord bot task crashed: {type(exc).__name__}: {exc}")
            except asyncio.CancelledError:
                pass

        _bot_task = asyncio.create_task(discord_client.start(settings.discord_bot_token))
        _bot_task.add_done_callback(_bot_done)
        logger.info("Discord bot task started")
    else:
        logger.warning("DISCORD_BOT_TOKEN not set — bot will not connect")

    yield

    if _bot_task and not _bot_task.done():
        from collector.discord_client import discord_client
        await discord_client.close()
        _bot_task.cancel()
        try:
            await _bot_task
        except asyncio.CancelledError:
            pass
    logger.info("Shutdown complete")


app = FastAPI(title="CBReview API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from routers import (
    auth as auth_router,
    collect,
    analyze,
    graph as graph_router,
    dashboard,
    settings as settings_router,
    evaluation as evaluation_router,
)

app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(collect.router, prefix="/api/collect", tags=["collect"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])
app.include_router(graph_router.router, prefix="/api/graph", tags=["graph"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["settings"])
app.include_router(evaluation_router.router, prefix="/api/evaluation", tags=["evaluation"])

# WebSocket routes
app.add_websocket_route("/ws/collect", collect.ws_collect)
app.add_websocket_route("/ws/analyze", analyze.ws_analyze)


@app.get("/api/health")
async def health():
    from collector.discord_client import discord_client, is_ready
    bot_user = str(discord_client.user) if is_ready() else None
    task_status = "none"
    if _bot_task:
        if _bot_task.done():
            exc = _bot_task.exception() if not _bot_task.cancelled() else None
            task_status = f"failed: {exc}" if exc else ("cancelled" if _bot_task.cancelled() else "done")
        else:
            task_status = "running"
    return {
        "status": "ok",
        "bot_ready": is_ready(),
        "bot_user": bot_user,
        "bot_task": task_status,
        "token_set": bool(settings.discord_bot_token),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
