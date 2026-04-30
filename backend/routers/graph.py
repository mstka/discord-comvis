import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.schema import Member, NodeScore, Edge
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/nodes")
async def get_nodes(
    db: AsyncSession = Depends(get_db),
    min_score: float = Query(0.0),
    limit: int = Query(200),
):
    stmt = (
        select(Member, NodeScore)
        .outerjoin(NodeScore, NodeScore.member_id == Member.id)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    nodes = []
    for member, score in rows:
        nodes.append({
            "id": member.id,
            "username": member.username,
            "display_name": member.display_name or member.username,
            "avatar_url": member.avatar_url,
            "contribution_score": score.contribution_score if score else 0.0,
            "centrality": score.centrality if score else 0.0,
            "avg_sentiment": score.avg_sentiment if score else 0.0,
            "reaction_density": score.reaction_density if score else 0.0,
            "expertise_score": score.expertise_score if score else 0.0,
            "resolved_count": score.resolved_count if score else 0,
            "asked_count": score.asked_count if score else 0,
            "unresolved_count": score.unresolved_count if score else 0,
        })
    return {"nodes": nodes, "total": len(nodes)}


@router.get("/edges")
async def get_edges(
    db: AsyncSession = Depends(get_db),
    min_weight: float = Query(0.0),
    edge_type: Optional[str] = Query(None),
    channel_id: Optional[str] = Query(None),
    limit: int = Query(2000),
):
    filters = [Edge.confidence >= settings.edge_confidence_threshold]
    if edge_type:
        filters.append(Edge.edge_type == edge_type)
    if channel_id:
        filters.append(Edge.channel_id == channel_id)
    if min_weight > 0:
        filters.append(Edge.weight >= min_weight)

    stmt = select(Edge).where(and_(*filters)).limit(limit)
    edges = (await db.execute(stmt)).scalars().all()

    return {
        "edges": [
            {
                "id": e.id,
                "source": e.source_id,
                "target": e.target_id,
                "value": e.weight,
                "weight": e.weight,
                "edge_type": e.edge_type,
                "channel_id": e.channel_id,
                "timestamp": e.timestamp,
                "route": e.route,
                "confidence": e.confidence,
            }
            for e in edges
        ],
        "total": len(edges),
    }


@router.get("/node/{member_id}")
async def get_node_detail(member_id: str, db: AsyncSession = Depends(get_db)):
    member_stmt = select(Member).where(Member.id == member_id)
    member = (await db.execute(member_stmt)).scalars().first()
    if not member:
        from fastapi import HTTPException
        raise HTTPException(404, "Member not found")

    score_stmt = select(NodeScore).where(NodeScore.member_id == member_id)
    score = (await db.execute(score_stmt)).scalars().first()

    out_edges_stmt = select(Edge).where(Edge.source_id == member_id).limit(20)
    out_edges = (await db.execute(out_edges_stmt)).scalars().all()

    in_edges_stmt = select(Edge).where(Edge.target_id == member_id).limit(20)
    in_edges = (await db.execute(in_edges_stmt)).scalars().all()

    return {
        "id": member.id,
        "username": member.username,
        "display_name": member.display_name,
        "avatar_url": member.avatar_url,
        "roles": member.roles,
        "score": {
            "contribution_score": score.contribution_score if score else 0.0,
            "centrality": score.centrality if score else 0.0,
            "avg_sentiment": score.avg_sentiment if score else 0.0,
            "reaction_density": score.reaction_density if score else 0.0,
            "expertise_score": score.expertise_score if score else 0.0,
            "resolved_count": score.resolved_count if score else 0,
            "asked_count": score.asked_count if score else 0,
            "unresolved_count": score.unresolved_count if score else 0,
        },
        "helped": [{"target": e.target_id, "weight": e.weight} for e in out_edges],
        "helped_by": [{"source": e.source_id, "weight": e.weight} for e in in_edges],
    }


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    node_count = (await db.execute(select(func.count()).select_from(Member))).scalar()
    edge_count = (await db.execute(select(func.count()).select_from(Edge))).scalar()
    avg_centrality = (await db.execute(select(func.avg(NodeScore.centrality)))).scalar() or 0.0
    return {
        "total_nodes": node_count,
        "total_edges": edge_count,
        "avg_centrality": round(float(avg_centrality), 4),
    }
