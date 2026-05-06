import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

from config import settings
from models.schema import Base

logger = logging.getLogger(__name__)

# SQLite needs the data/ directory; PostgreSQL doesn't
if not settings.is_postgres:
    os.makedirs("data", exist_ok=True)

# PostgreSQL: use NullPool (Railway serverless-friendly) or AsyncAdaptedQueuePool (default)
_engine_kwargs: dict = {"echo": False}
if settings.is_postgres:
    # asyncpg connection pool tuning for Railway free tier
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 10
    _engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(settings.database_url, **_engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if not settings.is_postgres:
            # SQLite WAL mode for local development
            await conn.execute(text("PRAGMA journal_mode=WAL"))
            await conn.execute(text("PRAGMA synchronous=NORMAL"))
    logger.info(f"Database ready ({'PostgreSQL' if settings.is_postgres else 'SQLite'})")


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
