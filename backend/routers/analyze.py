import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.schema import AnalysisRun
from pipeline.orchestrator import start_pipeline, get_progress_queue
from routers.auth import require_admin, Role

logger = logging.getLogger(__name__)
router = APIRouter()


class RunRequest(BaseModel):
    guild_id: str


@router.post("/run")
async def run_analysis(req: RunRequest, _: Role = Depends(require_admin)):
    run_id = await start_pipeline(req.guild_id)
    return {"run_id": run_id, "status": "started"}


@router.get("/status/{run_id}")
async def get_status(run_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(AnalysisRun).where(AnalysisRun.id == run_id)
    run = (await db.execute(stmt)).scalars().first()
    if not run:
        raise HTTPException(404, "Run not found")
    return {
        "id": run.id,
        "status": run.status,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "messages_total": run.messages_total,
        "messages_done": run.messages_done,
        "fast_count": run.fast_count,
        "slow_count": run.slow_count,
        "gemini_count": run.gemini_count,
        "error_message": run.error_message,
    }


@router.get("/runs")
async def list_runs(db: AsyncSession = Depends(get_db)):
    stmt = select(AnalysisRun).order_by(AnalysisRun.started_at.desc()).limit(10)
    runs = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": r.id,
            "status": r.status,
            "started_at": r.started_at,
            "finished_at": r.finished_at,
            "messages_total": r.messages_total,
        }
        for r in runs
    ]


async def ws_analyze(websocket: WebSocket):
    await websocket.accept()
    run_id_str = websocket.query_params.get("run_id")
    if not run_id_str:
        await websocket.send_text(json.dumps({"type": "error", "message": "run_id required"}))
        await websocket.close()
        return

    run_id = int(run_id_str)
    q = get_progress_queue(run_id)

    try:
        while True:
            try:
                msg = await asyncio.wait_for(q.get(), timeout=30.0)
                await websocket.send_text(json.dumps(msg, default=str))
                if msg.get("type") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
