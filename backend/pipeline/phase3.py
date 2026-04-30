"""Phase 3: Edge construction.

- Merges edge candidates from Phase 2 Fast/Slow/2.5
- Handles thanks message detection
- Applies reaction weight bonuses
- Processes OpenSocket timeouts
"""
import logging
import re
from datetime import datetime, timedelta

from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.schema import Message, Edge, Mention, Reaction, OpenSocket, NodeScore
from config import settings
from pipeline.phase2_fast import FastResult
from pipeline.phase2_slow import SlowResult

logger = logging.getLogger(__name__)

THANKS_PATTERNS = re.compile(
    r"(ありがとう|ありがとうございます|助かりました|解決しました|なるほど|わかりました|了解です|thx|thanks)"
)

THANKS_EMOJIS = {"🙏", "✅", "👍", "🎉", "❤️", "🔥", "💯", "🫡", "🤝", "😊", "🥹"}


def _is_thanks(text: str) -> bool:
    return bool(THANKS_PATTERNS.search(text or ""))


async def _get_reaction_bonus(db: AsyncSession, message_id: str) -> float:
    stmt = select(Reaction).where(Reaction.message_id == message_id)
    reactions = (await db.execute(stmt)).scalars().all()
    thanks_count = sum(1 for r in reactions if r.emoji in THANKS_EMOJIS)
    total = sum(r.count for r in reactions)
    if total == 0:
        return 1.0
    bonus = 1.0 + 0.1 * thanks_count
    return min(bonus, 1.5)


async def _save_edge(db: AsyncSession, edge_data: dict):
    edge = Edge(
        source_id=edge_data["source_id"],
        target_id=edge_data["target_id"],
        message_id=edge_data["message_id"],
        parent_id=edge_data["parent_id"],
        weight=min(edge_data["weight"], 1.0),
        edge_type=edge_data["edge_type"],
        channel_id=edge_data["channel_id"],
        timestamp=edge_data["timestamp"],
        confidence=edge_data["confidence"],
        route=edge_data["route"],
    )
    db.add(edge)


async def run(
    db: AsyncSession,
    guild_id: str,
    run_id: int,
    fast_results: list[FastResult],
    slow_results: list[SlowResult],
    thread_edges: list[dict],
) -> int:
    edge_count = 0

    # Process Fast Route results
    for fr in fast_results:
        msg_stmt = select(Message).where(Message.id == fr.message_id)
        msg = (await db.execute(msg_stmt)).scalars().first()
        parent_stmt = select(Message).where(Message.id == fr.parent_id)
        parent = (await db.execute(parent_stmt)).scalars().first()
        if not msg or not parent:
            continue

        bonus = await _get_reaction_bonus(db, msg.id)
        await _save_edge(db, {
            "source_id": msg.author_id,
            "target_id": parent.author_id,
            "message_id": msg.id,
            "parent_id": parent.id,
            "weight": fr.confidence * bonus,
            "edge_type": "main",
            "channel_id": msg.channel_id,
            "timestamp": msg.timestamp,
            "confidence": fr.confidence,
            "route": fr.route,
        })
        edge_count += 1

    # Process Slow Route results
    for sr in slow_results:
        msg_stmt = select(Message).where(Message.id == sr.message_id)
        msg = (await db.execute(msg_stmt)).scalars().first()
        parent_stmt = select(Message).where(Message.id == sr.parent_id)
        parent = (await db.execute(parent_stmt)).scalars().first()
        if not msg or not parent:
            continue

        bonus = await _get_reaction_bonus(db, msg.id)
        await _save_edge(db, {
            "source_id": msg.author_id,
            "target_id": parent.author_id,
            "message_id": msg.id,
            "parent_id": parent.id,
            "weight": sr.confidence * bonus,
            "edge_type": "main",
            "channel_id": msg.channel_id,
            "timestamp": msg.timestamp,
            "confidence": sr.confidence,
            "route": sr.route,
        })
        edge_count += 1

    # Thread edges
    for te in thread_edges:
        bonus = await _get_reaction_bonus(db, te["message_id"])
        te["weight"] = min(te["weight"] * bonus, 1.0)
        await _save_edge(db, te)
        edge_count += 1

    # Thanks message processing
    thanks_stmt = select(Message).where(
        and_(
            Message.guild_id == guild_id,
            Message.content.contains("ありがとう") | Message.content.contains("thx") | Message.content.contains("thanks"),
        )
    )
    thanks_msgs = (await db.execute(thanks_stmt)).scalars().all()

    for tm in thanks_msgs:
        socket_stmt = select(OpenSocket).where(
            and_(
                OpenSocket.author_id == tm.author_id,
                OpenSocket.channel_id == tm.channel_id,
                OpenSocket.status == "open",
                OpenSocket.created_at < tm.timestamp,
            )
        ).order_by(OpenSocket.created_at.desc()).limit(1)

        socket = (await db.execute(socket_stmt)).scalars().first()
        if socket:
            q_stmt = select(Message).where(Message.id == socket.message_id)
            q_msg = (await db.execute(q_stmt)).scalars().first()
            prev_stmt = select(Message).where(
                and_(
                    Message.channel_id == tm.channel_id,
                    Message.timestamp < tm.timestamp,
                    Message.author_id != tm.author_id,
                )
            ).order_by(Message.timestamp.desc()).limit(1)
            prev_msg = (await db.execute(prev_stmt)).scalars().first()

            if prev_msg and q_msg:
                await _save_edge(db, {
                    "source_id": prev_msg.author_id,
                    "target_id": tm.author_id,
                    "message_id": tm.id,
                    "parent_id": q_msg.id,
                    "weight": 0.7,
                    "edge_type": "main",
                    "channel_id": tm.channel_id,
                    "timestamp": tm.timestamp,
                    "confidence": 0.7,
                    "route": "thanks",
                })
                socket.status = "closed"
                socket.closed_by = tm.id
                socket.closed_at = tm.timestamp
                edge_count += 1

    # OpenSocket timeout
    timeout_threshold = datetime.utcnow() - timedelta(hours=settings.open_socket_timeout_hours)
    timeout_stmt = select(OpenSocket).where(
        and_(
            OpenSocket.status == "open",
            OpenSocket.created_at < timeout_threshold,
        )
    )
    timed_out = (await db.execute(timeout_stmt)).scalars().all()

    for socket in timed_out:
        socket.status = "timeout"
        # Increment unresolved count
        score_stmt = select(NodeScore).where(NodeScore.member_id == socket.author_id)
        score = (await db.execute(score_stmt)).scalars().first()
        if score:
            score.unresolved_count += 1
        else:
            db.add(NodeScore(member_id=socket.author_id, unresolved_count=1))

    await db.commit()
    logger.info(f"Phase 3: {edge_count} edges created, {len(timed_out)} sockets timed out")
    return edge_count
