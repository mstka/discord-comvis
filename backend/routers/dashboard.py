import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.schema import Member, NodeScore, Edge, OpenSocket, Message

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/ranking")
async def contribution_ranking(db: AsyncSession = Depends(get_db), top_k: int = 10):
    stmt = (
        select(Member, NodeScore)
        .join(NodeScore, NodeScore.member_id == Member.id)
        .order_by(NodeScore.contribution_score.desc())
        .limit(top_k)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "rank": i + 1,
            "member_id": m.id,
            "display_name": m.display_name or m.username,
            "contribution_score": s.contribution_score,
            "resolved_count": s.resolved_count,
            "centrality": s.centrality,
        }
        for i, (m, s) in enumerate(rows)
    ]


@router.get("/unresolved")
async def unresolved_questions(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(OpenSocket, Message, Member)
        .join(Message, Message.id == OpenSocket.message_id)
        .join(Member, Member.id == OpenSocket.author_id)
        .where(OpenSocket.status == "open")
        .order_by(OpenSocket.created_at.desc())
        .limit(50)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": s.id,
            "author": m.display_name or m.username,
            "content": msg.content[:100] if msg.content else "",
            "channel_id": s.channel_id,
            "created_at": s.created_at,
        }
        for s, msg, m in rows
    ]


@router.get("/timeline")
async def communication_timeline(db: AsyncSession = Depends(get_db), days: int = 30):
    since = datetime.utcnow() - timedelta(days=days)
    stmt = (
        select(func.date(Edge.timestamp).label("day"), func.count().label("count"))
        .where(Edge.timestamp >= since)
        .group_by(func.date(Edge.timestamp))
        .order_by(func.date(Edge.timestamp))
    )
    rows = (await db.execute(stmt)).all()
    return [{"date": str(r.day), "count": r.count} for r in rows]


@router.get("/kpis")
async def kpis(db: AsyncSession = Depends(get_db)):
    total_messages = (await db.execute(select(func.count()).select_from(Message))).scalar() or 0
    total_edges = (await db.execute(select(func.count()).select_from(Edge))).scalar() or 0
    total_open = (
        await db.execute(select(func.count()).select_from(OpenSocket).where(OpenSocket.status == "open"))
    ).scalar() or 0
    total_closed = (
        await db.execute(select(func.count()).select_from(OpenSocket).where(OpenSocket.status == "closed"))
    ).scalar() or 0
    resolved_ratio = total_closed / max(total_closed + total_open, 1)

    active_contributors = (
        await db.execute(
            select(func.count()).select_from(NodeScore).where(NodeScore.resolved_count > 0)
        )
    ).scalar() or 0

    return {
        "total_messages": total_messages,
        "total_edges": total_edges,
        "resolved_ratio": round(resolved_ratio, 3),
        "active_contributors": active_contributors,
    }
