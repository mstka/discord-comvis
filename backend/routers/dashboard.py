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


@router.get("/members")
async def list_members(db: AsyncSession = Depends(get_db)):
    """全メンバー一覧 with scores"""
    stmt = (
        select(Member, NodeScore)
        .outerjoin(NodeScore, NodeScore.member_id == Member.id)
        .order_by(NodeScore.contribution_score.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "member_id": m.id,
            "display_name": m.display_name or m.username,
            "avatar_url": m.avatar_url,
            "contribution_score": round(s.contribution_score, 3) if s else 0.0,
            "centrality": round(s.centrality, 3) if s else 0.0,
            "resolved_count": s.resolved_count if s else 0,
            "expertise_score": round(s.expertise_score, 3) if s else 0.0,
            "avg_sentiment": round(s.avg_sentiment, 3) if s else 0.0,
            "reaction_density": round(s.reaction_density, 3) if s else 0.0,
        }
        for m, s in rows
    ]


@router.get("/risk-analysis")
async def risk_analysis(db: AsyncSession = Depends(get_db)):
    """負荷集中リスク: 平均の1.5倍以上のリクエストを受けているメンバー"""
    stmt = select(Member, NodeScore).join(NodeScore, NodeScore.member_id == Member.id)
    rows = (await db.execute(stmt)).all()
    if not rows:
        return []

    avg_resolved = sum(s.resolved_count for _, s in rows) / len(rows)
    results = []
    for m, s in rows:
        ratio = s.resolved_count / max(avg_resolved, 0.1)
        if ratio >= 1.5:
            results.append({
                "member_id": m.id,
                "display_name": m.display_name or m.username,
                "resolved_count": s.resolved_count,
                "avg_resolved": round(avg_resolved, 1),
                "load_ratio": round(ratio, 2),
                "centrality": round(s.centrality, 3),
                "risk_level": "high" if ratio >= 2.5 else "medium",
            })

    return sorted(results, key=lambda x: x["load_ratio"], reverse=True)


@router.get("/oversight-candidates")
async def oversight_candidates(db: AsyncSession = Depends(get_db)):
    """評価見落とし候補: 貢献度が高いが中心性(可視性)が低いメンバー"""
    stmt = select(Member, NodeScore).join(NodeScore, NodeScore.member_id == Member.id)
    rows = (await db.execute(stmt)).all()
    if not rows:
        return []

    avg_score = sum(s.contribution_score for _, s in rows) / len(rows)
    avg_centrality = sum(s.centrality for _, s in rows) / len(rows)

    candidates = []
    for m, s in rows:
        if s.contribution_score > avg_score and s.centrality <= avg_centrality:
            candidates.append({
                "member_id": m.id,
                "display_name": m.display_name or m.username,
                "contribution_score": round(s.contribution_score, 3),
                "centrality": round(s.centrality, 3),
                "resolved_count": s.resolved_count,
                "recognition_gap": round(s.contribution_score - s.centrality, 3),
            })

    return sorted(candidates, key=lambda x: x["recognition_gap"], reverse=True)[:10]


@router.get("/contribution-types/{member_id}")
async def contribution_types(member_id: str, db: AsyncSession = Depends(get_db)):
    """メンバーの貢献タイプ分類"""
    score_stmt = select(NodeScore).where(NodeScore.member_id == member_id)
    score = (await db.execute(score_stmt)).scalars().first()
    if not score:
        return {"types": [], "contribution_score": 0.0}

    edges_resolved = (await db.execute(
        select(func.count()).select_from(Edge).where(Edge.target_id == member_id)
    )).scalar() or 0

    types = [
        {
            "type": "相談対応",
            "score": min(1.0, score.resolved_count / 10),
            "count": score.resolved_count,
            "description": f"{score.resolved_count}件の相談・質問に対応",
        },
        {
            "type": "橋渡し",
            "score": min(1.0, score.centrality * 5),
            "count": None,
            "description": "チーム内の情報ハブ・接続役",
        },
    ]

    return {"types": types, "contribution_score": score.contribution_score}
