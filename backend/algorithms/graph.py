import logging
import math
from typing import Any

import networkx as nx
import numpy as np

logger = logging.getLogger(__name__)


def build_graph(edges: list[dict]) -> nx.DiGraph:
    G = nx.DiGraph()
    for e in edges:
        src, tgt = e["source_id"], e["target_id"]
        w = e.get("weight", 1.0)
        if G.has_edge(src, tgt):
            G[src][tgt]["weight"] += w
        else:
            G.add_edge(src, tgt, weight=w, edge_type=e.get("edge_type", "main"))
    return G


def compute_betweenness(G: nx.DiGraph) -> dict[str, float]:
    if len(G) == 0:
        return {}
    try:
        return nx.betweenness_centrality(G, weight="weight", normalized=True)
    except Exception as e:
        logger.warning(f"Betweenness failed: {e}")
        return {n: 0.0 for n in G.nodes()}


def compute_pagerank(G: nx.DiGraph) -> dict[str, float]:
    if len(G) == 0:
        return {}
    try:
        return nx.pagerank(G, weight="weight")
    except Exception as e:
        logger.warning(f"PageRank failed: {e}")
        return {n: 0.0 for n in G.nodes()}


def compute_contribution_score(
    centrality: float,
    resolved_count: int,
    max_resolved: int,
    reaction_density: float,
    avg_sentiment: float,
) -> float:
    resolved_norm = resolved_count / max(max_resolved, 1)
    score = (
        0.35 * centrality
        + 0.25 * avg_sentiment
        + 0.20 * reaction_density
        + 0.20 * resolved_norm
    )
    return round(min(1.0, max(0.0, score)), 4)


def find_information_hubs(G: nx.DiGraph, betweenness: dict[str, float], top_k: int = 5) -> list[str]:
    scored = []
    for node in G.nodes():
        b = betweenness.get(node, 0.0)
        out_deg = G.out_degree(node, weight="weight")
        scored.append((node, b * out_deg))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [n for n, _ in scored[:top_k]]


def compute_expertise_score(topic_vectors: list[bytes]) -> float:
    """Inverse entropy of topic cluster distribution (higher = more specialized)."""
    if not topic_vectors:
        return 0.0
    try:
        vecs = [np.frombuffer(v, dtype=np.float32) for v in topic_vectors]
        mat = np.stack(vecs)
        # Simple k-means with k=5 cluster approximation
        from sklearn.cluster import MiniBatchKMeans
        k = min(5, len(vecs))
        km = MiniBatchKMeans(n_clusters=k, n_init=3, random_state=42)
        labels = km.fit_predict(mat)
        counts = np.bincount(labels, minlength=k).astype(float)
        probs = counts / counts.sum()
        probs = probs[probs > 0]
        entropy = -np.sum(probs * np.log2(probs))
        max_entropy = math.log2(k)
        inverse_entropy = 1.0 - (entropy / max_entropy) if max_entropy > 0 else 0.0
        return round(float(inverse_entropy), 4)
    except Exception as e:
        logger.warning(f"Expertise score failed: {e}")
        return 0.0
