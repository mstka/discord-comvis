import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Callable, Awaitable

import discord
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy import select

from models.schema import Message, Mention, Reaction, Member
from collector.discord_client import discord_client

logger = logging.getLogger(__name__)

BATCH_SIZE = 100


class FetchJob:
    def __init__(self):
        self._cancel = asyncio.Event()
        self.done = 0
        self.total: int | None = None
        self.status = "idle"

    def cancel(self):
        self._cancel.set()

    def is_cancelled(self) -> bool:
        return self._cancel.is_set()


_current_job: FetchJob | None = None


def get_current_job() -> FetchJob | None:
    return _current_job


async def fetch_channel(
    db: AsyncSession,
    channel_id: int,
    limit: int | None = None,
    after: datetime | None = None,
    before: datetime | None = None,
    progress_cb: Callable[[int, int | None], Awaitable[None]] | None = None,
    done_cb: Callable[[int], Awaitable[None]] | None = None,
) -> FetchJob:
    global _current_job

    job = FetchJob()
    _current_job = job
    job.status = "running"

    channel = discord_client.get_channel(channel_id)
    if channel is None:
        try:
            channel = await discord_client.fetch_channel(channel_id)
        except Exception as e:
            job.status = "error"
            logger.error(f"Cannot fetch channel {channel_id}: {e}")
            return job

    if not isinstance(channel, discord.TextChannel):
        job.status = "error"
        logger.error(f"Channel {channel_id} is not a TextChannel")
        return job

    guild = channel.guild

    async def _run():
        count = 0
        msg_batch: list[dict] = []
        mention_batch: list[dict] = []
        reaction_batch: list[dict] = []

        try:
            after_obj = discord.Object(id=discord.utils.time_snowflake(after)) if after else None
            before_obj = discord.Object(id=discord.utils.time_snowflake(before)) if before else None

            async for message in channel.history(
                limit=limit,
                after=after_obj,
                before=before_obj,
                oldest_first=True,
            ):
                if job.is_cancelled():
                    break

                # Upsert member
                await _upsert_member(db, message.author)

                msg_batch.append({
                    "id": str(message.id),
                    "channel_id": str(channel.id),
                    "guild_id": str(guild.id),
                    "author_id": str(message.author.id),
                    "content": message.content,
                    "timestamp": message.created_at.replace(tzinfo=None),
                    "reference_id": str(message.reference.message_id) if message.reference else None,
                    "thread_id": str(message.thread.id) if message.thread else None,
                    "is_thread_start": message.type == discord.MessageType.thread_created,
                    "raw_json": json.dumps({
                        "id": str(message.id),
                        "author": str(message.author.id),
                        "content": message.content,
                    }),
                    "fetched_at": datetime.utcnow(),
                })

                for user in message.mentions:
                    mention_batch.append({
                        "message_id": str(message.id),
                        "user_id": str(user.id),
                    })

                for reaction in message.reactions:
                    reaction_batch.append({
                        "message_id": str(message.id),
                        "emoji": str(reaction.emoji),
                        "count": reaction.count,
                        "user_ids": None,
                    })

                count += 1
                job.done = count

                if len(msg_batch) >= BATCH_SIZE:
                    await _flush(db, msg_batch, mention_batch, reaction_batch)
                    msg_batch, mention_batch, reaction_batch = [], [], []
                    if progress_cb:
                        await progress_cb(count, job.total)

            if msg_batch:
                await _flush(db, msg_batch, mention_batch, reaction_batch)
                if progress_cb:
                    await progress_cb(count, job.total)

            job.status = "done"
            logger.info(f"Fetch complete: {count} messages from channel {channel_id}")
            if done_cb:
                await done_cb(count)

        except Exception as e:
            job.status = "error"
            logger.error(f"Fetch error: {e}", exc_info=True)
            if done_cb:
                await done_cb(count)

    asyncio.create_task(_run())
    return job


async def _upsert_member(db: AsyncSession, author: discord.abc.User):
    stmt = sqlite_insert(Member).values(
        id=str(author.id),
        username=author.name,
        display_name=getattr(author, "display_name", author.name),
        avatar_url=str(author.display_avatar.url) if author.display_avatar else None,
        roles=None,
    ).on_conflict_do_update(
        index_elements=["id"],
        set_={"username": author.name, "display_name": getattr(author, "display_name", author.name)},
    )
    await db.execute(stmt)
    await db.commit()


async def _flush(
    db: AsyncSession,
    messages: list[dict],
    mentions: list[dict],
    reactions: list[dict],
):
    if messages:
        stmt = sqlite_insert(Message).values(messages).on_conflict_do_nothing(index_elements=["id"])
        await db.execute(stmt)

    if mentions:
        await db.execute(sqlite_insert(Mention).values(mentions).on_conflict_do_nothing())

    if reactions:
        await db.execute(sqlite_insert(Reaction).values(reactions).on_conflict_do_nothing())

    await db.commit()
