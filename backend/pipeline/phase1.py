"""Phase 1: Route classification.

Classifies each message into:
- direct_reply   : has reference_id (reply to another message)
- mention_reply  : has @mention(s) pointing to another user
- thread_reply   : inside a thread but not the thread starter
- standalone     : floating message, needs parent detection
"""
import logging
import re
from datetime import datetime

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.schema import Message, Mention, OpenSocket
from algorithms import morphological

logger = logging.getLogger(__name__)

# Fast regex gate: cheap first-pass check.
# If this hits, we skip the heavier morphological analysis.
QUESTION_PATTERNS = re.compile(
    r"(？|\?|か[？?]?$|教えてください|教えて下さい|わかりますか|ありますか|どうすれば|どうしたら|なぜ|どうして|方法は|やり方)"
)


def _looks_like_question(text: str) -> bool:
    """Two-stage question detection.

    Stage 1 (fast): regex — same patterns as before, O(n) string scan.
    Stage 2 (morph): morphological.is_question_doc — broader coverage using
    GiNZA token analysis. Only runs when Stage 1 misses, so cost is low
    for the common case.
    """
    if not text:
        return False
    if QUESTION_PATTERNS.search(text):
        return True
    # Morphological fallback: catches interrogative pronouns,
    # colloquial patterns, and sentence-final か particles that
    # the regex doesn't cover (e.g. "どこですか" "知ってる？" "確認お願い").
    doc = morphological.process(text)
    return morphological.is_question_doc(doc)


async def run(db: AsyncSession, guild_id: str, run_id: int) -> int:
    """Returns number of messages processed."""
    stmt = select(Message).where(Message.guild_id == guild_id).order_by(Message.timestamp)
    result = await db.execute(stmt)
    messages = result.scalars().all()

    processed = 0
    for msg in messages:
        if msg.reference_id:
            # Direct reply — Phase 2.5 handles target detection
            pass
        else:
            # Check for mentions
            mention_stmt = select(Mention).where(Mention.message_id == msg.id)
            mentions = (await db.execute(mention_stmt)).scalars().all()
            if mentions:
                # Has explicit mentions — direct target known
                pass
            elif _looks_like_question(msg.content or ""):
                # Standalone question — open a socket
                existing = await db.execute(
                    select(OpenSocket).where(
                        and_(
                            OpenSocket.author_id == msg.author_id,
                            OpenSocket.channel_id == msg.channel_id,
                            OpenSocket.status == "open",
                        )
                    )
                )
                if not existing.scalars().first():
                    socket = OpenSocket(
                        message_id=msg.id,
                        channel_id=msg.channel_id,
                        author_id=msg.author_id,
                        created_at=msg.timestamp,
                        status="open",
                    )
                    db.add(socket)

        processed += 1

    await db.commit()
    logger.info(f"Phase 1 complete: {processed} messages classified")
    return processed
