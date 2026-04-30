"""Phase 2.5: Thread-internal target detection.

Classifies each reply as:
- Type A: directed at the thread owner
- Type B: directed at another responder (sub-conversation)
- Type C: general supplement to the whole thread
"""
import logging

import numpy as np
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.schema import Message, MessageVector
from algorithms import vector as vec_algo

logger = logging.getLogger(__name__)

EDGE_TYPE_MAP = {
    "A": "main",
    "B": "sub",
    "C": "distributed",
}


async def _get_vector(db: AsyncSession, msg: Message) -> np.ndarray | None:
    stmt = select(MessageVector).where(MessageVector.message_id == msg.id)
    mv = (await db.execute(stmt)).scalars().first()
    if mv:
        return np.frombuffer(mv.vector, dtype=np.float32).copy()
    return None


async def classify_thread_reply(
    db: AsyncSession,
    reply: Message,
    thread_owner_id: str,
    thread_messages: list[Message],
) -> tuple[str, str, float]:
    """Returns (edge_type, target_user_id, weight)."""

    # Check explicit reference
    if reply.reference_id:
        ref_stmt = select(Message).where(Message.id == reply.reference_id)
        ref_msg = (await db.execute(ref_stmt)).scalars().first()
        if ref_msg:
            if ref_msg.author_id == thread_owner_id:
                return "main", thread_owner_id, 0.9
            else:
                return "sub", ref_msg.author_id, 0.85

    # Check vector proximity
    reply_vec = await _get_vector(db, reply)
    if reply_vec is not None:
        owner_msgs = [m for m in thread_messages if m.author_id == thread_owner_id]
        others = [m for m in thread_messages if m.author_id != thread_owner_id and m.author_id != reply.author_id]

        owner_vecs = []
        for m in owner_msgs:
            v = await _get_vector(db, m)
            if v is not None:
                owner_vecs.append(v)

        if owner_vecs:
            d_main = 1.0 - vec_algo.cosine_similarity(reply_vec, np.mean(owner_vecs, axis=0))
        else:
            d_main = 0.5

        # Find most recent non-owner message
        prev_vecs = []
        for m in reversed(others[:3]):
            v = await _get_vector(db, m)
            if v is not None:
                prev_vecs.append(v)

        if prev_vecs:
            d_prev = 1.0 - vec_algo.cosine_similarity(reply_vec, prev_vecs[0])
        else:
            d_prev = 0.5

        if d_prev < d_main * 0.8:
            target = others[0].author_id if others else thread_owner_id
            return "sub", target, 0.75
        elif d_main < d_prev * 0.8:
            return "main", thread_owner_id, 0.80
        else:
            return "distributed", thread_owner_id, 0.60

    # Default: Type A with reduced weight
    return "main", thread_owner_id, 0.60


async def run(db: AsyncSession, guild_id: str, run_id: int) -> list[dict]:
    """Process all thread messages and return edge candidates."""
    edges = []

    # Find thread starter messages
    thread_start_stmt = select(Message).where(
        and_(
            Message.guild_id == guild_id,
            Message.is_thread_start == True,
        )
    )
    thread_starters = (await db.execute(thread_start_stmt)).scalars().all()

    for starter in thread_starters:
        thread_id = starter.thread_id or starter.id
        # Get all messages in this thread
        thread_stmt = select(Message).where(
            and_(
                Message.thread_id == thread_id,
                Message.guild_id == guild_id,
            )
        ).order_by(Message.timestamp)
        thread_msgs = (await db.execute(thread_stmt)).scalars().all()

        for reply in thread_msgs:
            if reply.author_id == starter.author_id:
                continue
            edge_type, target_id, weight = await classify_thread_reply(
                db=db,
                reply=reply,
                thread_owner_id=starter.author_id,
                thread_messages=thread_msgs,
            )
            edges.append({
                "source_id": reply.author_id,
                "target_id": target_id,
                "message_id": reply.id,
                "parent_id": starter.id,
                "weight": weight,
                "edge_type": edge_type,
                "channel_id": reply.channel_id,
                "timestamp": reply.timestamp,
                "confidence": weight,
                "route": "phase25",
            })

    logger.info(f"Phase 2.5: {len(edges)} thread edges classified")
    return edges
