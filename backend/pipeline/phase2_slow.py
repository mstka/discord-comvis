"""Phase 2 Slow Route: vector-based QA pair detection."""
import logging
import math
from dataclasses import dataclass
from datetime import datetime

import numpy as np
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.schema import Message, MessageVector, OpenSocket, AnalysisRun
from algorithms import vector as vec_algo
from algorithms import kalman as kalman_algo
from algorithms import gemini as gemini_algo
from config import settings

logger = logging.getLogger(__name__)


@dataclass
class SlowResult:
    message_id: str
    parent_id: str
    confidence: float
    route: str  # "slow" | "gemini"


async def _get_or_compute_vector(db: AsyncSession, msg: Message) -> np.ndarray:
    from algorithms.vector import EMBEDDING_DIM
    stmt = select(MessageVector).where(MessageVector.message_id == msg.id)
    cached = (await db.execute(stmt)).scalars().first()
    if cached:
        vec = np.frombuffer(cached.vector, dtype=np.float32).copy()
        if vec.shape[0] == EMBEDDING_DIM:
            return vec
        # Stale cache (dimension mismatch) — delete and recompute
        logger.info(f"Recomputing vector for {msg.id}: cached dim={vec.shape[0]}, expected={EMBEDDING_DIM}")
        await db.delete(cached)
        await db.commit()

    vec = await gemini_algo.embed(msg.content or "")
    mv = MessageVector(
        message_id=msg.id,
        vector=vec.tobytes(),
        model="text-embedding-004",
    )
    db.add(mv)
    await db.commit()
    return vec


def _time_decay(dt_seconds: float, lam: float) -> float:
    dt_minutes = dt_seconds / 60.0
    return math.exp(-lam * dt_minutes)


async def run(
    db: AsyncSession,
    guild_id: str,
    run_id: int,
    candidate_pairs: list[tuple[str, str]],
) -> list[SlowResult]:
    """candidate_pairs: list of (message_id, parent_message_id)"""
    results: list[SlowResult] = []

    # Count Gemini calls for run tracking
    gemini_count = 0

    for msg_id, parent_id in candidate_pairs:
        msg_stmt = select(Message).where(Message.id == msg_id)
        msg = (await db.execute(msg_stmt)).scalars().first()
        parent_stmt = select(Message).where(Message.id == parent_id)
        parent = (await db.execute(parent_stmt)).scalars().first()

        if not msg or not parent:
            continue

        # Get embeddings
        vec_msg = await _get_or_compute_vector(db, msg)
        vec_parent = await _get_or_compute_vector(db, parent)
        gemini_count += 2

        # Get context window (5 preceding messages in channel)
        ctx_stmt = select(Message).where(
            and_(
                Message.channel_id == msg.channel_id,
                Message.timestamp < msg.timestamp,
                Message.guild_id == guild_id,
            )
        ).order_by(Message.timestamp.desc()).limit(5)
        context_msgs = (await db.execute(ctx_stmt)).scalars().all()
        context_vecs = []
        for cm in context_msgs:
            cv = await _get_or_compute_vector(db, cm)
            context_vecs.append(cv)
            gemini_count += 1

        # CCA score
        s_cca = vec_algo.compute_cca_score(
            context_vecs if context_vecs else [vec_parent],
            [vec_msg],
        )

        # Difference vector score
        s_diff = vec_algo.compute_difference_vector_score(vec_parent, vec_msg)

        # Bilinear score
        s_bilinear = vec_algo.compute_bilinear_score(vec_parent, vec_msg)

        # Time decay
        dt = (msg.timestamp - parent.timestamp).total_seconds()
        channel_type = "default"
        lam = settings.slow_lambda_default
        s_time = _time_decay(dt, lam)

        # Kalman tracker
        tracker = kalman_algo.get_tracker(msg.channel_id)
        tracker.update(vec_msg)
        mahal = tracker.mahalanobis_to(vec_msg)
        if mahal > 5.0:
            s_time *= 0.5  # topic shift penalty

        # Combined score
        s_slow = (
            settings.slow_alpha * s_cca
            + settings.slow_beta * s_diff
            + settings.slow_gamma * s_bilinear
            + settings.slow_delta * s_time
        )

        if s_slow >= 0.80:
            results.append(SlowResult(
                message_id=msg_id,
                parent_id=parent_id,
                confidence=s_slow,
                route="slow",
            ))
        elif s_slow >= 0.60:
            # Gemini gray zone
            is_qa = await gemini_algo.judge_qa_pair(
                author_a=parent.author_id,
                content_a=parent.content or "",
                timestamp_a=str(parent.timestamp),
                author_b=msg.author_id,
                content_b=msg.content or "",
                timestamp_b=str(msg.timestamp),
            )
            gemini_count += 1
            if is_qa:
                results.append(SlowResult(
                    message_id=msg_id,
                    parent_id=parent_id,
                    confidence=s_slow,
                    route="gemini",
                ))
        # else: s_slow < 0.60 → register as new parent (no edge)

    # Update run stats
    run_stmt = select(AnalysisRun).where(AnalysisRun.id == run_id)
    run_obj = (await db.execute(run_stmt)).scalars().first()
    if run_obj:
        run_obj.slow_count = (run_obj.slow_count or 0) + len(candidate_pairs)
        run_obj.gemini_count = (run_obj.gemini_count or 0) + gemini_count
    await db.commit()

    logger.info(f"Phase 2 Slow: {len(results)} confirmed from {len(candidate_pairs)} candidates")
    return results
