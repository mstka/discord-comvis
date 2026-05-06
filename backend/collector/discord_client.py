import asyncio
import logging
import discord

logger = logging.getLogger(__name__)

intents = discord.Intents.default()
intents.message_content = True   # Privileged: must enable in Developer Portal
intents.members = False          # Privileged: disable unless you need member list sync
intents.guilds = True

discord_client = discord.Client(intents=intents)
_ready_event = asyncio.Event()


@discord_client.event
async def on_ready():
    logger.info(f"Discord bot connected as {discord_client.user}")
    _ready_event.set()


@discord_client.event
async def on_disconnect():
    _ready_event.clear()
    logger.warning("Discord bot disconnected")


async def wait_until_ready(timeout: float = 30.0) -> bool:
    try:
        await asyncio.wait_for(_ready_event.wait(), timeout=timeout)
        return True
    except asyncio.TimeoutError:
        return False


def is_ready() -> bool:
    return discord_client.is_ready()


def get_guild(guild_id: int) -> discord.Guild | None:
    return discord_client.get_guild(guild_id)
