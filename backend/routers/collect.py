import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from collector import discord_client as dc
from collector import fetcher

logger = logging.getLogger(__name__)
router = APIRouter()

_collect_progress_queue: asyncio.Queue = asyncio.Queue()
_active_fetches: int = 0  # tracks how many channel fetches are in-flight


class FetchRequest(BaseModel):
    channel_id: str  # string to avoid JS 53-bit precision loss on snowflake IDs
    limit: Optional[int] = None
    after: Optional[datetime] = None
    before: Optional[datetime] = None


@router.get("/guilds")
async def list_guilds():
    if not dc.is_ready():
        raise HTTPException(503, "Discord bot not connected yet")
    return [
        {"id": str(g.id), "name": g.name, "icon": str(g.icon.url) if g.icon else None}
        for g in dc.discord_client.guilds
    ]


@router.get("/guilds/{guild_id}/channels")
async def list_channels(guild_id: int):
    if not dc.is_ready():
        raise HTTPException(503, "Discord bot not connected yet")
    guild = dc.get_guild(guild_id)
    if guild is None:
        raise HTTPException(404, "Guild not found")
    channels = await guild.fetch_channels()
    return [
        {"id": str(c.id), "name": c.name, "type": str(c.type)}
        for c in channels
        if hasattr(c, "history")
    ]


@router.post("/fetch")
async def start_fetch(req: FetchRequest, db: AsyncSession = Depends(get_db)):
    global _active_fetches
    if not dc.is_ready():
        raise HTTPException(503, "Discord bot not connected yet")

    _active_fetches += 1

    async def progress_cb(done: int, total: int | None):
        await _collect_progress_queue.put({"type": "progress", "done": done, "total": total})

    async def done_cb(total: int):
        global _active_fetches
        _active_fetches -= 1
        await _collect_progress_queue.put({"type": "channel_done", "done": total})
        if _active_fetches <= 0:
            _active_fetches = 0
            await _collect_progress_queue.put({"type": "done", "done": total})

    job = await fetcher.fetch_channel(
        db=db,
        channel_id=int(req.channel_id),
        limit=req.limit,
        after=req.after,
        before=req.before,
        progress_cb=progress_cb,
        done_cb=done_cb,
    )
    return {"status": "started", "job_status": job.status}


@router.get("/status")
async def fetch_status():
    job = fetcher.get_current_job()
    if job is None:
        return {"status": "idle"}
    return {"status": job.status, "done": job.done, "total": job.total}


@router.post("/cancel")
async def cancel_fetch():
    job = fetcher.get_current_job()
    if job:
        job.cancel()
    return {"status": "cancelled"}


async def ws_collect(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            try:
                msg = await asyncio.wait_for(_collect_progress_queue.get(), timeout=30.0)
                await websocket.send_text(json.dumps(msg))
                if msg.get("type") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
