"""Evaluation assistance endpoints — Phase 4 & 5 + 6-axis relationship scoring."""
import logging
from datetime import datetime, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.schema import Member, NodeScore, Edge, Message

logger = logging.getLogger(__name__)
router = APIRouter()


# ── internal score computation ────────────────────────────────────────────────

def _compute_scores(s: NodeScore) -> dict:
    """3-axis contribution scores (チャット分析で計測可能な範囲)."""
    cognitive = s.expertise_score * 0.5 + min(1.0, s.resolved_count / 10) * 0.5
    relational = s.centrality * 0.6 + max(0.0, s.avg_sentiment) * 0.4
    future_score = min(1.0, s.reaction_density)
    weighted = (
        0.40 * cognitive
        + 0.35 * relational
        + 0.25 * future_score
    )
    coefficient = round(0.8 + weighted * 0.4, 3)
    return {
        "認知貢献": round(cognitive, 3),
        "関係性貢献": round(relational, 3),
        "未来投資貢献": round(future_score, 3),
        "_coefficient": coefficient,
    }


async def _compute_6axes(member_id: str, db: AsyncSession) -> dict:
    """
    6-axis relationship index computation.

    Axis 1 育成指数 (Nurturing)
        Ratio of people this member helped who later helped others.
        → edges_out_from_helped / total_helped (max 1.0)

    Axis 2 橋渡し指数 (Bridging)
        Betweenness proxy: unique channels the member appears in as either
        source or target, normalised to [0,1].

    Axis 3 関係の多様性 (Relationship Diversity)
        Unique counterparts (union of source/target distinct IDs).
        log-normalised so 10+ people → ~1.0.

    Axis 4 双方向率 (Bidirectionality)
        Proportion of unique counterparts with whom the member has BOTH
        helped and been helped.

    Axis 5 持続性 (Persistence)
        Whether interactions are spread over time.
        1 - (stddev_of_weekly_counts / mean_of_weekly_counts + 1) clamped [0,1].
        High = steady contributions, low = bursty.

    Axis 6 応答性 (Responsiveness)
        Inverse of median response latency among replies this member sent.
        Based on Edge timestamps vs Message timestamps of the parent.
    """
    import math

    # All edges involving this member
    out_edges_stmt = select(Edge).where(Edge.source_id == member_id)
    in_edges_stmt = select(Edge).where(Edge.target_id == member_id)
    out_edges = (await db.execute(out_edges_stmt)).scalars().all()
    in_edges = (await db.execute(in_edges_stmt)).scalars().all()

    # ── Axis 1: 育成指数 ──────────────────────────────────────────
    helped_ids = {e.target_id for e in out_edges}
    if helped_ids:
        # Count how many of those people later helped someone else
        nurturing_stmt = select(func.count(Edge.source_id.distinct())).where(
            Edge.source_id.in_(helped_ids)
        )
        helped_who_helped = (await db.execute(nurturing_stmt)).scalar() or 0
        nurturing_index = round(helped_who_helped / len(helped_ids), 3)
    else:
        nurturing_index = 0.0

    # ── Axis 2: 橋渡し指数 ───────────────────────────────────────
    out_channels = {e.channel_id for e in out_edges}
    in_channels = {e.channel_id for e in in_edges}
    all_channels = out_channels | in_channels
    # Get total distinct channels in DB for normalization
    total_ch_stmt = select(func.count(Edge.channel_id.distinct()))
    total_channels = (await db.execute(total_ch_stmt)).scalar() or 1
    bridging_index = round(min(1.0, len(all_channels) / max(total_channels, 1)), 3)

    # ── Axis 3: 関係の多様性 ─────────────────────────────────────
    counterparts = {e.target_id for e in out_edges} | {e.source_id for e in in_edges}
    counterparts.discard(member_id)
    diversity_index = round(min(1.0, math.log1p(len(counterparts)) / math.log1p(10)), 3)

    # ── Axis 4: 双方向率 ─────────────────────────────────────────
    helped_set = {e.target_id for e in out_edges}
    was_helped_set = {e.source_id for e in in_edges}
    mutual = helped_set & was_helped_set
    all_partners = helped_set | was_helped_set
    if all_partners:
        bidirectionality = round(len(mutual) / len(all_partners), 3)
    else:
        bidirectionality = 0.0

    # ── Axis 5: 持続性 ───────────────────────────────────────────
    all_edges_ts = [e.timestamp for e in out_edges]
    if len(all_edges_ts) >= 3:
        from collections import Counter
        # Bucket into ISO weeks
        weeks: Counter = Counter()
        for ts in all_edges_ts:
            week_key = ts.strftime("%Y-W%U")
            weeks[week_key] += 1
        counts = list(weeks.values())
        mean_c = sum(counts) / len(counts)
        variance = sum((c - mean_c) ** 2 for c in counts) / len(counts)
        std_c = variance ** 0.5
        cv = std_c / (mean_c + 1e-9)  # coefficient of variation
        persistence_index = round(max(0.0, 1.0 - min(1.0, cv)), 3)
    else:
        persistence_index = 0.5 if out_edges else 0.0

    # ── Axis 6: 応答性 ───────────────────────────────────────────
    latencies: list[float] = []
    for e in out_edges:
        # Find parent message timestamp
        parent_stmt = select(Message).where(Message.id == e.parent_id)
        parent = (await db.execute(parent_stmt)).scalars().first()
        if parent:
            delta = (e.timestamp - parent.timestamp).total_seconds()
            if 0 < delta < 86400:  # ignore negative or >1 day
                latencies.append(delta)

    if latencies:
        latencies.sort()
        median_latency = latencies[len(latencies) // 2]
        # 5 min = score 1.0, 1 hour = ~0.5, 1 day = ~0.0
        responsiveness = round(1.0 / (1.0 + median_latency / 300), 3)
    else:
        responsiveness = 0.5  # neutral when no data

    return {
        "育成指数": nurturing_index,
        "橋渡し指数": bridging_index,
        "関係の多様性": diversity_index,
        "双方向率": bidirectionality,
        "持続性": persistence_index,
        "応答性": responsiveness,
    }


# ── endpoints ────────────────────────────────────────────────────────────────

@router.get("/coefficients")
async def all_coefficients(db: AsyncSession = Depends(get_db)):
    """全メンバーの3軸貢献係数."""
    stmt = select(Member, NodeScore).join(NodeScore, NodeScore.member_id == Member.id)
    rows = (await db.execute(stmt)).all()
    results = []
    for m, s in rows:
        sc = _compute_scores(s)
        coeff = sc.pop("_coefficient")
        results.append({
            "member_id": m.id,
            "display_name": m.display_name or m.username,
            "scores": sc,
            "coefficient": coeff,
            "bonus_ratio": coeff,
        })
    return sorted(results, key=lambda x: x["coefficient"], reverse=True)


@router.get("/relationship-axes/{member_id}")
async def relationship_axes(member_id: str, db: AsyncSession = Depends(get_db)):
    """6軸関係性スコア for a single member."""
    member = (await db.execute(select(Member).where(Member.id == member_id))).scalars().first()
    if not member:
        raise HTTPException(404, "Member not found")

    axes = await _compute_6axes(member_id, db)
    overall = round(sum(axes.values()) / len(axes), 3)

    return {
        "member_id": member_id,
        "display_name": member.display_name or member.username,
        "axes": axes,
        "overall_relationship_score": overall,
        "descriptions": {
            "育成指数": "支援した相手がその後他者を助けた割合",
            "橋渡し指数": "複数チャンネルにまたがる情報流通への関与度",
            "関係の多様性": "交流した相手の多様さ（対数スケール）",
            "双方向率": "互いにやり取りしたことのある相手の割合",
            "持続性": "貢献が時間的に分散している安定度",
            "応答性": "質問への返答速度（中央値ベース）",
        },
    }


@router.get("/relationship-axes-all")
async def relationship_axes_all(db: AsyncSession = Depends(get_db)):
    """全メンバーの6軸スコア一覧."""
    members = (await db.execute(select(Member))).scalars().all()
    results = []
    for m in members:
        axes = await _compute_6axes(m.id, db)
        overall = round(sum(axes.values()) / len(axes), 3)
        results.append({
            "member_id": m.id,
            "display_name": m.display_name or m.username,
            "axes": axes,
            "overall_relationship_score": overall,
        })
    return sorted(results, key=lambda x: x["overall_relationship_score"], reverse=True)


@router.get("/report/{member_id}")
async def evaluation_report(member_id: str, db: AsyncSession = Depends(get_db)):
    """月次評価補助レポート（3軸スコア + 6軸関係性 + 評価コメント草案）."""
    member = (await db.execute(select(Member).where(Member.id == member_id))).scalars().first()
    if not member:
        raise HTTPException(404, "Member not found")

    score = (await db.execute(select(NodeScore).where(NodeScore.member_id == member_id))).scalars().first()

    edges_resolved = (await db.execute(
        select(func.count()).select_from(Edge).where(Edge.source_id == member_id)
    )).scalar() or 0

    edges_asked = (await db.execute(
        select(func.count()).select_from(Edge).where(Edge.target_id == member_id)
    )).scalar() or 0

    since = datetime.utcnow() - timedelta(days=30)
    recent_resolved = (await db.execute(
        select(func.count()).select_from(Edge).where(
            Edge.source_id == member_id,
            Edge.timestamp >= since,
        )
    )).scalar() or 0

    sc = _compute_scores(score) if score else {
        "認知貢献": 0.0, "関係性貢献": 0.0, "未来投資貢献": 0.0,
        "_coefficient": 0.8,
    }
    coeff = sc.pop("_coefficient")

    # 6-axis
    axes_6 = await _compute_6axes(member_id, db)

    name = member.display_name or member.username

    # 貢献タイプ (always include all)
    resolved = score.resolved_count if score else 0
    centrality = score.centrality if score else 0
    types = [
        {"type": "相談対応", "count": resolved},
        {"type": "橋渡し", "score": round(centrality, 3)},
        {"type": "育成支援", "sentiment": round(score.avg_sentiment if score else 0, 3)},
        {"type": "高認知負荷な応答", "expertise": round(score.expertise_score if score else 0, 3)},
        {"type": "リアクション獲得", "density": round(score.reaction_density if score else 0, 3)},
    ]

    # 評価コメント草案
    parts = []
    if resolved > 5:
        parts.append(f"今月は{resolved}件の相談に対応し、チームの問題解決に大きく貢献しました。")
    if centrality > 0.2:
        parts.append("コミュニケーションの中心として機能しており、情報流通に不可欠な存在です。")
    if recent_resolved > 3:
        parts.append(f"直近30日で{recent_resolved}件の回答実績があり、継続的な貢献が見られます。")
    if axes_6.get("育成指数", 0) > 0.5:
        parts.append("支援した相手がその後チームに貢献する傾向があり、育成効果が高いと評価できます。")
    if axes_6.get("双方向率", 0) > 0.5:
        parts.append("双方向のやり取りが多く、健全な相互支援関係を構築しています。")
    if not parts:
        parts.append("分析データを蓄積中です。継続的なメッセージ収集で精度が向上します。")
    draft_comment = " ".join(parts)

    # 1on1確認事項
    questions = [
        "今月対応した中で、特に印象に残った相談はありましたか？",
        "チームの中で、もっとサポートがあれば助かると感じる部分はありますか？",
        "今後挑戦したい役割や領域はありますか？",
        "自分の貢献がチームに届いていると感じますか？",
    ]
    if resolved > 10:
        questions.insert(0, "これだけ多くの相談に対応していますが、負荷を感じていませんか？")
    if centrality > 0.3:
        questions.insert(0, "チームの橋渡し役として、特に苦労している点はありますか？")

    # マネージャー確認ポイント
    manager_checkpoints = [
        {"point": "本当に評価に入れるべきか", "note": f"解決件数: {resolved}件"},
        {"point": "通常業務の範囲内か", "note": "期待役割と照合が必要"},
        {"point": "期待値を超えているか", "note": f"貢献スコア {score.contribution_score:.2f}" if score else "データ不足"},
        {"point": "負荷が偏っていないか", "note": f"直近30日の対応: {recent_resolved}件"},
        {"point": "本人の成長・役割と合っているか", "note": "1on1で確認"},
        {"point": "事業成果との関連があるか", "note": "売上貢献は別途確認が必要"},
    ]

    return {
        "member_id": member_id,
        "display_name": name,
        "period": "直近30日",
        "summary": {
            "total_resolved": resolved,
            "recent_resolved": recent_resolved,
            "edges_asked": edges_asked,
            "contribution_score": round(score.contribution_score, 3) if score else 0.0,
            "centrality": round(score.centrality, 3) if score else 0.0,
        },
        "contribution_types": types,
        "scores": sc,
        "coefficient": coeff,
        "relationship_axes": axes_6,
        "draft_evaluation_comment": draft_comment,
        "one_on_one_questions": questions,
        "manager_checkpoints": manager_checkpoints,
    }
