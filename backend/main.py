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
        _bot_task = asyncio.create_task(discord_client.start(settings.discord_bot_token))
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


app = FastAPI(title="Discord ComVis API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from routers import collect, analyze, graph as graph_router, dashboard, settings as settings_router

app.include_router(collect.router, prefix="/api/collect", tags=["collect"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])
app.include_router(graph_router.router, prefix="/api/graph", tags=["graph"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["settings"])

# WebSocket routes
app.add_websocket_route("/ws/collect", collect.ws_collect)
app.add_websocket_route("/ws/analyze", analyze.ws_analyze)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
