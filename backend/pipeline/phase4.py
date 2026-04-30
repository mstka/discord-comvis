"""Phase 4: Graph computation and score update."""
import logging
from datetime import datetime

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.schema import Edge, Member, NodeScore, Reaction, AnalysisRun
from algorithms import graph as graph_algo
from config import settings

logger = logging.getLogger(__name__)


async def run(db: AsyncSession, guild_id: str, run_id: int):
    # Load all edges above confidence threshold
    edge_stmt = select(Edge).where(Edge.confidence >= settings.edge_confidence_threshold)
    edges = (await db.execute(edge_stmt)).scalars().all()

    edge_dicts = [
        {"source_id": e.source_id, "target_id": e.target_id, "weight": e.weight, "edge_type": e.edge_type}
        for e in edges
    ]

    G = graph_algo.build_graph(edge_dicts)
    betweenness = graph_algo.compute_betweenness(G)
    pagerank = graph_algo.compute_pagerank(G)

    # Per-member stats
    member_stmt = select(Member)
    members = (await db.execute(member_stmt)).scalars().all()

    # Max resolved for normalization
    max_resolved = 1
    for node_id in G.nodes():
        out_degree = G.out_degree(node_id)
        if out_degree > max_resolved:
            max_resolved = out_degree

    for member in members:
        mid = member.id

        # Resolved / asked counts from edges
        resolved = G.out_degree(mid) if G.has_node(mid) else 0
        asked = G.in_degree(mid) if G.has_node(mid) else 0

        # Reaction density
        sent_msg_stmt = select(func.count()).select_from(Edge).where(Edge.source_id == mid)
        sent_count = (await db.execute(sent_msg_stmt)).scalar() or 1

        reaction_stmt = (
            select(func.sum(Reaction.count))
            .join(Edge, Edge.message_id == Reaction.message_id)
            .where(Edge.source_id == mid)
        )
        total_reactions = (await db.execute(reaction_stmt)).scalar() or 0
        reaction_density = min(total_reactions / sent_count / 10.0, 1.0)

        # Thanks reaction ratio as avg_sentiment
        centrality = betweenness.get(mid, 0.0)
        avg_sentiment = min(reaction_density * 1.5, 1.0)

        contribution = graph_algo.compute_contribution_score(
            centrality=centrality,
            resolved_count=resolved,
            max_resolved=max_resolved,
            reaction_density=reaction_density,
            avg_sentiment=avg_sentiment,
        )

        existing_stmt = select(NodeScore).where(NodeScore.member_id == mid)
        existing = (await db.execute(existing_stmt)).scalars().first()
        if existing:
            existing.contribution_score = contribution
            existing.centrality = centrality
            existing.avg_sentiment = avg_sentiment
            existing.reaction_density = reaction_density
            existing.resolved_count = resolved
            existing.asked_count = asked
            existing.updated_at = datetime.utcnow()
        else:
            db.add(NodeScore(
                member_id=mid,
                contribution_score=contribution,
                centrality=centrality,
                avg_sentiment=avg_sentiment,
                reaction_density=reaction_density,
                resolved_count=resolved,
                asked_count=asked,
            ))

    # Mark run as done
    run_stmt = select(AnalysisRun).where(AnalysisRun.id == run_id)
    run_obj = (await db.execute(run_stmt)).scalars().first()
    if run_obj:
        run_obj.status = "done"
        run_obj.finished_at = datetime.utcnow()

    await db.commit()
    logger.info(f"Phase 4: graph computed, {len(members)} nodes scored")
