"""Pipeline orchestrator: runs all phases sequentially with progress reporting."""
import asyncio
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models.schema import AnalysisRun, Message
from pipeline import phase1, phase2_fast, phase2_slow, phase25, phase3, phase4

logger = logging.getLogger(__name__)

_progress_queues: dict[int, asyncio.Queue] = {}


def get_progress_queue(run_id: int) -> asyncio.Queue:
    if run_id not in _progress_queues:
        _progress_queues[run_id] = asyncio.Queue()
    return _progress_queues[run_id]


async def _emit(run_id: int, payload: dict):
    q = get_progress_queue(run_id)
    await q.put(payload)


async def run_pipeline(run_id: int, guild_id: str):
    async with AsyncSessionLocal() as db:
        try:
            await _emit(run_id, {"phase": 1, "status": "running", "label": "ルート分類"})
            msg_count = await phase1.run(db, guild_id, run_id)

            # Update total
            run_stmt = select(AnalysisRun).where(AnalysisRun.id == run_id)
            run_obj = (await db.execute(run_stmt)).scalars().first()
            if run_obj:
                run_obj.messages_total = msg_count
            await db.commit()

            await _emit(run_id, {"phase": 1, "status": "done", "messages": msg_count})
            await _emit(run_id, {"phase": "2_fast", "status": "running", "label": "Fast Route（形態素解析）"})
            fast_results, slow_needed = await phase2_fast.run(db, guild_id, run_id)

            if run_obj:
                run_obj.fast_count = len(fast_results)
            await db.commit()

            await _emit(run_id, {"phase": "2_fast", "status": "done", "confirmed": len(fast_results), "slow_needed": len(slow_needed)})

            # Build candidate pairs for slow route
            candidate_pairs = []
            for msg_id in slow_needed:
                from models.schema import Message as Msg
                msg = (await db.execute(select(Msg).where(Msg.id == msg_id))).scalars().first()
                if msg and msg.reference_id:
                    candidate_pairs.append((msg_id, msg.reference_id))

            await _emit(run_id, {"phase": "2_slow", "status": "running", "label": "Slow Route（ベクトル解析）", "candidates": len(candidate_pairs)})
            slow_results = await phase2_slow.run(db, guild_id, run_id, candidate_pairs)
            await _emit(run_id, {"phase": "2_slow", "status": "done", "confirmed": len(slow_results)})

            await _emit(run_id, {"phase": "2.5", "status": "running", "label": "スレッド内ターゲット判定"})
            thread_edges = await phase25.run(db, guild_id, run_id)
            await _emit(run_id, {"phase": "2.5", "status": "done", "edges": len(thread_edges)})

            await _emit(run_id, {"phase": 3, "status": "running", "label": "エッジ構築"})
            edge_count = await phase3.run(db, guild_id, run_id, fast_results, slow_results, thread_edges)
            await _emit(run_id, {"phase": 3, "status": "done", "edges": edge_count})

            await _emit(run_id, {"phase": 4, "status": "running", "label": "グラフ計算・スコア更新"})
            await phase4.run(db, guild_id, run_id)
            await _emit(run_id, {"phase": 4, "status": "done"})

            await _emit(run_id, {"type": "done", "run_id": run_id})
            logger.info(f"Pipeline run {run_id} completed")

        except Exception as e:
            logger.error(f"Pipeline run {run_id} failed: {e}", exc_info=True)
            run_stmt = select(AnalysisRun).where(AnalysisRun.id == run_id)
            run_obj = (await db.execute(run_stmt)).scalars().first()
            if run_obj:
                run_obj.status = "error"
                run_obj.error_message = str(e)
                run_obj.finished_at = datetime.utcnow()
            await db.commit()
            await _emit(run_id, {"type": "error", "message": str(e)})

        finally:
            # Cleanup queue after 120s
            async def _cleanup():
                await asyncio.sleep(120)
                _progress_queues.pop(run_id, None)
            asyncio.create_task(_cleanup())


async def start_pipeline(guild_id: str) -> int:
    async with AsyncSessionLocal() as db:
        run = AnalysisRun(started_at=datetime.utcnow(), status="running")
        db.add(run)
        await db.commit()
        await db.refresh(run)
        run_id = run.id

    asyncio.create_task(run_pipeline(run_id, guild_id))
    return run_id
