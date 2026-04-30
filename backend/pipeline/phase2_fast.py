"""Phase 2 Fast Route: morphological analysis for QA pair detection."""
import logging
from dataclasses import dataclass

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.schema import Message, Edge, OpenSocket
from algorithms import morphological

logger = logging.getLogger(__name__)


@dataclass
class FastResult:
    message_id: str
    parent_id: str
    confidence: float
    route: str  # "fast" | "slow_needed"


async def run(db: AsyncSession, guild_id: str, run_id: int) -> tuple[list[FastResult], list[str]]:
    """Returns (fast_confirmed, slow_needed_ids)."""
    confirmed: list[FastResult] = []
    needs_slow: list[str] = []

    # Find open sockets paired with messages that arrived after them
    stmt = (
        select(OpenSocket, Message)
        .join(Message, Message.id == OpenSocket.message_id)
        .where(
            and_(
                Message.guild_id == guild_id,
                OpenSocket.status == "open",
            )
        )
    )
    pairs_result = await db.execute(stmt)
    socket_pairs = pairs_result.all()

    # For each open socket, find candidate reply messages
    for socket, q_msg in socket_pairs:
        reply_stmt = select(Message).where(
            and_(
                Message.channel_id == q_msg.channel_id,
                Message.author_id != q_msg.author_id,
                Message.timestamp > q_msg.timestamp,
                Message.guild_id == guild_id,
            )
        ).order_by(Message.timestamp).limit(5)

        replies = (await db.execute(reply_stmt)).scalars().all()

        for reply in replies:
            doc_q = morphological.process(q_msg.content or "")
            doc_r = morphological.process(reply.content or "")
            score = morphological.compute_fast_score(doc_q, doc_r)

            if score >= 0.65:
                confirmed.append(FastResult(
                    message_id=reply.id,
                    parent_id=q_msg.id,
                    confidence=score,
                    route="fast",
                ))
                socket.status = "closed"
                socket.closed_by = reply.id
                socket.closed_at = reply.timestamp
                socket.confidence = score
                break
            elif score >= 0.40:
                # Borderline — try modality correction
                modality = morphological.compute_modality_symmetry(doc_q, doc_r)
                adjusted = score + modality * 0.1
                if adjusted >= 0.65:
                    confirmed.append(FastResult(
                        message_id=reply.id,
                        parent_id=q_msg.id,
                        confidence=adjusted,
                        route="fast",
                    ))
                    socket.status = "closed"
                    socket.closed_by = reply.id
                    socket.closed_at = reply.timestamp
                    socket.confidence = adjusted
                    break
                else:
                    needs_slow.append(reply.id)
            else:
                needs_slow.append(reply.id)

    # Also handle direct replies and mentions
    direct_stmt = select(Message).where(
        and_(
            Message.guild_id == guild_id,
            Message.reference_id.isnot(None),
        )
    )
    direct_messages = (await db.execute(direct_stmt)).scalars().all()

    for msg in direct_messages:
        parent_stmt = select(Message).where(Message.id == msg.reference_id)
        parent = (await db.execute(parent_stmt)).scalars().first()
        if parent and parent.author_id != msg.author_id:
            doc_p = morphological.process(parent.content or "")
            doc_m = morphological.process(msg.content or "")
            score = morphological.compute_fast_score(doc_p, doc_m)
            if score >= 0.40:
                confirmed.append(FastResult(
                    message_id=msg.id,
                    parent_id=parent.id,
                    confidence=max(score, 0.70),
                    route="fast",
                ))
            else:
                confirmed.append(FastResult(
                    message_id=msg.id,
                    parent_id=parent.id,
                    confidence=0.70,
                    route="confirmed",
                ))

    await db.commit()
    logger.info(f"Phase 2 Fast: {len(confirmed)} confirmed, {len(needs_slow)} need slow route")
    return confirmed, needs_slow
